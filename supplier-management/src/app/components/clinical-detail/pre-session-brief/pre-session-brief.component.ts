import { Component, Input, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PsychService } from '../../../services/psych.service';

/**
 * Brief de preparación de sesión: un resumen corto de dónde quedó el proceso, generado
 * por IA a partir de la ficha, las tareas intersesión, el registro de ánimo y las escalas.
 *
 * ── Por qué hay un estado "generando" ────────────────────────────────────────
 * El BFF no puede llamar al modelo: vive dentro de la VPC y desde ahí no alcanza
 * Bedrock. El POST solo encola el trabajo y responde con un `jobId`; una Lambda fuera de
 * la VPC lo genera, y este componente hace polling cada 2 s (hasta 15 intentos, ~30 s).
 * Si se agotan, se ofrece reintentar en vez de quedarse girando.
 *
 * ── Es un borrador ───────────────────────────────────────────────────────────
 * El texto sale de un modelo de lenguaje y puede equivocarse u omitir cosas. Se muestra
 * siempre bajo un aviso de revisión y nunca como una lectura clínica cerrada.
 */
@Component({
  selector: 'app-pre-session-brief',
  imports: [CommonModule],
  templateUrl: './pre-session-brief.component.html',
  styleUrl: './pre-session-brief.component.scss'
})
export class PreSessionBriefComponent {
  /** `clinical_record.id` de la ficha abierta. */
  @Input({ required: true }) recordId!: number;

  private psych = inject(PsychService);

  readonly brief       = signal<string | null>(null);
  readonly warnings    = signal<string[]>([]);
  readonly generatedAt = signal<string | null>(null);
  readonly model       = signal<string | null>(null);

  /** 'idle' | 'working' (encolado o generando) | 'done' | 'error' | 'timeout' */
  readonly state = signal<'idle' | 'working' | 'done' | 'error' | 'timeout'>('idle');
  readonly errorMsg = signal<string | null>(null);

  generate(): void {
    if (this.state() === 'working') return;
    this.state.set('working');
    this.errorMsg.set(null);
    this.brief.set(null);
    this.warnings.set([]);

    this.psych.requestPreSessionBrief(this.recordId).subscribe({
      next: accepted => {
        // Los avisos vienen ya calculados desde los datos reales de la ficha, así que
        // se pueden mostrar mientras el modelo todavía está escribiendo.
        this.warnings.set(accepted.warnings ?? []);
        this.poll(accepted.jobId);
      },
      error: err => {
        this.state.set('error');
        this.errorMsg.set(err?.status === 429
          ? 'Demasiadas solicitudes seguidas. Espera un momento y reintenta.'
          : 'No se pudo solicitar el brief.');
      }
    });
  }

  private poll(jobId: string): void {
    this.psych.pollJob(() => this.psych.getPreSessionBriefJob(jobId)).subscribe({
      next: job => {
        if (job.status === 'done') {
          this.brief.set(job.brief);
          this.warnings.set(job.warnings ?? this.warnings());
          this.generatedAt.set(job.generatedAt);
          this.model.set(job.model);
          this.state.set('done');
        } else {
          this.state.set('error');
          this.errorMsg.set(job.error ?? 'No se pudo generar el brief.');
        }
      },
      error: err => {
        if (err?.message === 'POLL_TIMEOUT') { this.state.set('timeout'); return; }
        this.state.set('error');
        this.errorMsg.set('Se perdió la conexión mientras se generaba el brief.');
      }
    });
  }

  copy(): void {
    const text = this.brief();
    if (text) void navigator.clipboard.writeText(text);
  }
}
