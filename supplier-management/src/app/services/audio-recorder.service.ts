import { Injectable, signal } from '@angular/core';

export type RecordingState = 'idle' | 'recording' | 'saving';

@Injectable({ providedIn: 'root' })
export class AudioRecorderService {
  readonly state    = signal<RecordingState>('idle');
  readonly duration = signal(0);           // seconds elapsed
  readonly error    = signal<string>('');

  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private timerRef: ReturnType<typeof setInterval> | null = null;
  private startedAt = 0;

  get isRecording() { return this.state() === 'recording'; }

  async start(patientName: string): Promise<void> {
    this.error.set('');
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
      this._save(patientName, this.mediaRecorder?.mimeType ?? 'audio/webm');
      this._cleanup();
    };

    this.mediaRecorder.start(250); // collect every 250 ms
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

  private _save(patientName: string, mimeType: string): void {
    const ext  = mimeType.includes('ogg') ? 'ogg' : 'webm';
    const safe = patientName.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '').trim().replace(/\s+/g, '_');
    const date = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const filename = `atencion_${safe}_${date}.${ext}`;

    const blob = new Blob(this.chunks, { type: mimeType });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);

    this.state.set('idle');
    this.duration.set(0);
  }

  private _cleanup(): void {
    if (this.timerRef) { clearInterval(this.timerRef); this.timerRef = null; }
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
    this.mediaRecorder = null;
    this.chunks = [];
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

  /** Formats seconds → mm:ss */
  static formatDuration(s: number): string {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
}
