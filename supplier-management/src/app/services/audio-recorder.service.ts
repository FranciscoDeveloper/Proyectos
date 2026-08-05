import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Capacitor } from '@capacitor/core';

export type RecordingState = 'idle' | 'recording' | 'saving' | 'uploading' | 'done' | 'error';

export interface AudioUploadContext {
  patientName: string;
  patientRut:  string;   // unique patient identifier (RUT) used in the filename
  doctorId:    number;   // authenticated professional's numeric ID
  doctorName:  string;   // authenticated professional's display name
  entityKey:   string;
  recordId:    number;
}

export interface AudioUploadResult {
  id:        string;
  url:       string;
  filename:  string;
  duration:  number;
  entityKey: string;
  recordId:  number;
}

@Injectable({ providedIn: 'root' })
export class AudioRecorderService {
  private http = inject(HttpClient);

  readonly state       = signal<RecordingState>('idle');
  readonly duration    = signal(0);
  readonly error       = signal<string>('');
  readonly uploadResult = signal<AudioUploadResult | null>(null);

  private mediaRecorder: MediaRecorder | null = null;
  private chunks:        Blob[]               = [];
  private stream:        MediaStream | null   = null;
  private timerRef:      ReturnType<typeof setInterval> | null = null;
  private startedAt      = 0;
  private context:       AudioUploadContext | null = null;

  get isRecording() { return this.state() === 'recording'; }

  async start(ctx: AudioUploadContext): Promise<void> {
    this.error.set('');
    this.uploadResult.set(null);
    this.context = ctx;

    if (!navigator.mediaDevices?.getUserMedia) {
      this.error.set('Tu navegador no soporta grabación de audio.');
      return;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (err: any) {
      // The old copy said "configuración del navegador", which is meaningless
      // inside the native app — there is no browser UI to open. On a phone the
      // grant lives in the OS app-permissions screen.
      const nativeHint = Capacitor.isNativePlatform()
        ? 'Permiso de micrófono denegado. Actívalo en Ajustes → Dairi → Micrófono.'
        : 'Permiso de micrófono denegado. Actívalo en la configuración del navegador.';
      this.error.set(
        err?.name === 'NotAllowedError' ? nativeHint : 'No se pudo acceder al micrófono.'
      );
      return;
    }

    const mimeType = this._bestMime();
    this.chunks = [];
    this.mediaRecorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : {});

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };

    this.mediaRecorder.onstop = () => {
      const finalDuration = Math.floor((Date.now() - this.startedAt) / 1000);
      this._upload(this.mediaRecorder?.mimeType ?? 'audio/webm', finalDuration);
      this._cleanup();
    };

    this.mediaRecorder.start(250);
    this.startedAt = Date.now();
    this.state.set('recording');
    this.duration.set(0);

    this.timerRef = setInterval(() => {
      this.duration.set(Math.floor((Date.now() - this.startedAt) / 1000));
    }, 1000);
  }

  stop(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.state.set('saving');
      this.mediaRecorder.stop();
    }
  }

  private async _upload(mimeType: string, finalDuration: number): Promise<void> {
    const ctx = this.context;
    if (!ctx) return;

    this.state.set('uploading');

    const ext       = this._extFor(mimeType);
    const sanitize  = (s: string) => s.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '').trim().replace(/\s+/g, '_') || 'desconocido';
    const rut       = ctx.patientRut.replace(/\./g, '').replace(/\s/g, '') || `id${ctx.recordId}`;
    const patient   = sanitize(ctx.patientName);
    const doctor    = sanitize(ctx.doctorName);
    const date      = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    // Fields separated by '--' so split('--') gives [type, date, rut, patient, drId, doctor]
    const filename  = `atencion--${date}--${rut}--${patient}--dr${ctx.doctorId}--${doctor}.${ext}`;
    const blob     = new Blob(this.chunks, { type: mimeType });

    try {
      // Paso 1: obtener presigned PUT URL (solo metadata, ~200 bytes)
      const presignRes = await firstValueFrom(
        this.http.post<{ presignedUrl: string; key: string; id: string }>(
          '/api/audio-recordings/presign',
          { filename, mimeType, entityKey: ctx.entityKey, recordId: ctx.recordId, duration: finalDuration }
        )
      );

      // Paso 2: subir el binario directo a S3 (sin pasar por API Gateway/Lambda)
      const s3Res = await fetch(presignRes.presignedUrl, {
        method:  'PUT',
        body:    blob,
        headers: { 'Content-Type': mimeType },
      });

      if (!s3Res.ok) {
        throw new Error(`Error al subir a S3: ${s3Res.status} ${s3Res.statusText}`);
      }

      // Paso 3: confirmar subida y obtener URL de reproducción
      const result = await firstValueFrom(
        this.http.post<AudioUploadResult>(
          '/api/audio-recordings/confirm',
          { key: presignRes.key, id: presignRes.id, filename, entityKey: ctx.entityKey, recordId: ctx.recordId, duration: finalDuration }
        )
      );

      this.uploadResult.set(result);
      this.state.set('done');

    } catch (err: any) {
      const msg = err?.error?.message ?? err?.message ?? 'Error al subir el audio. Intenta de nuevo.';
      this.error.set(msg);
      this.state.set('error');
    }
  }

  private _cleanup(): void {
    if (this.timerRef) { clearInterval(this.timerRef); this.timerRef = null; }
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream        = null;
    this.mediaRecorder = null;
    this.chunks        = [];
  }

  /**
   * iOS/WKWebView supports NONE of webm/ogg — WebKit's MediaRecorder only
   * produces MP4/AAC. The original list therefore matched nothing on iOS and
   * returned '', leaving MediaRecorder to pick its own default (audio/mp4).
   * Listing audio/mp4 explicitly makes that choice visible in `mimeType` and in
   * the upload's Content-Type instead of depending on an implicit fallback;
   * the resulting recording is byte-identical either way.
   */
  private _bestMime(): string {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/mp4',          // Safari / iOS WKWebView
      'audio/mp4;codecs=mp4a.40.2',
    ];
    return candidates.find(m => MediaRecorder.isTypeSupported(m)) ?? '';
  }

  /**
   * Maps the recorder's MIME type to the uploaded file's extension.
   *
   * DO NOT "correct" this to emit .m4a for audio/mp4 recordings, however wrong
   * the label looks. The extension is load-bearing infrastructure, not
   * cosmetics: the S3 bucket `budget-riquelmetapia` fires the transcription
   * Lambda (`transcribe-nova-3`) from a notification whose filter is
   * {Prefix: "recordings/", Suffix: ".webm"}. An object uploaded as .m4a
   * matches no rule, so no event fires and the encounter is never transcribed —
   * silently, with no error anywhere.
   *
   * The mislabelling is harmless downstream because the handler passes the raw
   * buffer to Deepgram's transcribeFile() without any format hint, and Deepgram
   * detects the container from the bytes. So an iOS MP4/AAC recording named
   * .webm transcribes correctly today.
   *
   * To make the extension honest, the S3 notification must gain a matching
   * suffix rule (or drop the suffix filter) FIRST — an AWS change, not a
   * frontend one.
   */
  private _extFor(mimeType: string): string {
    if (mimeType.includes('ogg')) return 'ogg';
    return 'webm';
  }

  static formatDuration(s: number): string {
    const m   = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
}
