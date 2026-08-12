import { Component, Input, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PsychService, REPORT_TYPES } from '../../../services/psych.service';

/**
 * Generador de borradores de informe psicológico (tribunal de familia, colegio,
 * licencia médica, avance terapéutico).
 *
 * ── Lo que está en juego ─────────────────────────────────────────────────────
 * Estos documentos tienen consecuencias legales y clínicas para el paciente y los firma
 * el profesional. Lo que devuelve el modelo es un **borrador**: puede equivocarse,
 * omitir cosas o rellenar huecos. La UI lo presenta siempre como tal — banner de
 * revisión sobre el texto, avisos de lo que falta, y ningún botón que sugiera que el
 * documento está listo para firmar. El backend marca toda respuesta con
 * `requiresReview: true`.
 *
 * ── Por qué hay un estado "generando" ────────────────────────────────────────
 * El BFF está en la VPC y no alcanza Bedrock, así que el POST solo encola el trabajo y
 * este componente hace polling del `jobId` (cada 2 s, hasta ~30 s). Ver psych.service.ts.
 */
@Component({
  selector: 'app-report-generator',
  imports: [CommonModule, FormsModule],
  templateUrl: './report-generator.component.html',
  styleUrl: './report-generator.component.scss'
})
export class ReportGeneratorComponent {
  /** `clinical_record.id` de la ficha abierta. */
  @Input({ required: true }) recordId!: number;

  private psych = inject(PsychService);

  readonly reportTypes = REPORT_TYPES;

  selectedType      = signal<string>(REPORT_TYPES[0].value);
  additionalContext = signal('');

  readonly draft       = signal<string | null>(null);
  readonly warnings    = signal<string[]>([]);
  readonly reportLabel = signal<string | null>(null);
  readonly generatedAt = signal<string | null>(null);
  readonly model       = signal<string | null>(null);

  /** 'idle' | 'working' | 'done' | 'error' | 'timeout' */
  readonly state    = signal<'idle' | 'working' | 'done' | 'error' | 'timeout'>('idle');
  readonly errorMsg = signal<string | null>(null);

  generate(): void {
    if (this.state() === 'working') return;
    this.state.set('working');
    this.errorMsg.set(null);
    this.draft.set(null);
    this.warnings.set([]);

    this.psych.requestReportDraft({
      recordId:          this.recordId,
      reportType:        this.selectedType(),
      additionalContext: this.additionalContext().trim() || undefined
    }).subscribe({
      next: accepted => {
        this.warnings.set(accepted.warnings ?? []);
        this.reportLabel.set(accepted.reportLabel ?? null);
        this.poll(accepted.jobId);
      },
      error: err => {
        this.state.set('error');
        this.errorMsg.set(
          err?.status === 429 ? 'Demasiadas solicitudes seguidas. Espera un momento y reintenta.'
          : err?.status === 400 ? 'Tipo de informe no válido.'
          : 'No se pudo solicitar el borrador.'
        );
      }
    });
  }

  private poll(jobId: string): void {
    this.psych.pollJob(() => this.psych.getReportJob(jobId)).subscribe({
      next: job => {
        if (job.status === 'done') {
          this.draft.set(job.draft);
          this.warnings.set(job.warnings ?? this.warnings());
          this.reportLabel.set(job.reportLabel ?? this.reportLabel());
          this.generatedAt.set(job.generatedAt);
          this.model.set(job.model);
          this.state.set('done');
        } else {
          this.state.set('error');
          this.errorMsg.set(job.error ?? 'No se pudo generar el borrador.');
        }
      },
      error: err => {
        if (err?.message === 'POLL_TIMEOUT') { this.state.set('timeout'); return; }
        this.state.set('error');
        this.errorMsg.set('Se perdió la conexión mientras se generaba el borrador.');
      }
    });
  }

  copy(): void {
    const text = this.draft();
    if (text) void navigator.clipboard.writeText(text);
  }

  typeHint(): string {
    return this.reportTypes.find(t => t.value === this.selectedType())?.hint ?? '';
  }
}
