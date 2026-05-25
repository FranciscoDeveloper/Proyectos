import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export type RecordingState = 'idle' | 'recording' | 'saving' | 'uploading' | 'done' | 'error';

export interface AudioUploadContext {
  patientName: string;
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
      this.error.set(
        err?.name === 'NotAllowedError'
          ? 'Permiso de micrófono denegado. Actívalo en la configuración del navegador.'
          : 'No se pudo acceder al micrófono.'
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

    const ext      = mimeType.includes('ogg') ? 'ogg' : 'webm';
    const safe     = ctx.patientName.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '').trim().replace(/\s+/g, '_');
    const date     = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const filename = `atencion_${safe}_${date}.${ext}`;

    const blob     = new Blob(this.chunks, { type: mimeType });
    const form     = new FormData();
    form.append('file',       blob, filename);
    form.append('filename',   filename);
    form.append('entityKey',  ctx.entityKey);
    form.append('recordId',   String(ctx.recordId));
    form.append('duration',   String(finalDuration));
    form.append('mimeType',   mimeType);

    try {
      const result = await firstValueFrom(
        this.http.post<AudioUploadResult>('/api/audio-recordings', form)
      );
      this.uploadResult.set(result);
      this.state.set('done');
    } catch (err: any) {
      const msg = err?.error?.message ?? 'Error al subir el audio. Intenta de nuevo.';
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

  private _bestMime(): string {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg',
    ];
    return candidates.find(m => MediaRecorder.isTypeSupported(m)) ?? '';
  }

  static formatDuration(s: number): string {
    const m   = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
}
