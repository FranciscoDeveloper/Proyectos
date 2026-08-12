import { Component, EventEmitter, Input, Output, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PsychService, ScaleTemplate, ScaleResult } from '../../../services/psych.service';

/**
 * Modal de aplicación de una escala (PHQ-9 / GAD-7), ítem por ítem.
 *
 * Se avanza de a una pregunta a propósito: el cuestionario completo en una sola
 * pantalla invita a marcar en diagonal, y el PHQ-9 termina con el ítem de ideación
 * suicida, que no debería contestarse de pasada.
 *
 * La instancia en el backend se crea al abrir el modal y las respuestas se envían
 * al final, en un solo POST. Ese POST es idempotente por (instancia, ítem), así que
 * un doble click sobre "Finalizar" reescribe los mismos valores en lugar de duplicar
 * respuestas; aun así el botón se bloquea mientras hay envío en curso.
 */
@Component({
  selector: 'app-scale-form',
  imports: [CommonModule],
  templateUrl: './scale-form.component.html',
  styleUrl: './scale-form.component.scss'
})
export class ScaleFormComponent {
  @Input({ required: true }) recordId!: number;

  /** Template a aplicar. Al asignarlo se abre la instancia en el backend. */
  @Input({ required: true })
  set template(t: ScaleTemplate | null) {
    this._template.set(t);
    this.reset();
    if (t) this.startInstance(t);
  }
  get template(): ScaleTemplate | null { return this._template(); }

  /** Emite el resultado calculado cuando el cuestionario se envía con éxito. */
  @Output() completed = new EventEmitter<ScaleResult>();
  /** Emite al cerrar sin completar. */
  @Output() closed = new EventEmitter<void>();

  private psych = inject(PsychService);

  private readonly _template = signal<ScaleTemplate | null>(null);

  readonly instanceId = signal<number | null>(null);
  readonly step       = signal(0);
  readonly answers    = signal<Record<string, number>>({});
  readonly submitting = signal(false);
  readonly error      = signal<string | null>(null);
  readonly result     = signal<ScaleResult | null>(null);

  readonly items   = computed(() => this._template()?.items ?? []);
  readonly options = computed(() => this._template()?.scoring?.options ?? []);

  readonly currentItem = computed(() => this.items()[this.step()] ?? null);

  readonly answeredCount = computed(() => Object.keys(this.answers()).length);

  readonly allAnswered = computed(() =>
    this.items().length > 0 && this.answeredCount() === this.items().length
  );

  readonly progressPct = computed(() => {
    const total = this.items().length;
    return total ? Math.round((this.answeredCount() / total) * 100) : 0;
  });

  readonly isLastStep = computed(() => this.step() === this.items().length - 1);

  private reset(): void {
    this.instanceId.set(null);
    this.step.set(0);
    this.answers.set({});
    this.submitting.set(false);
    this.error.set(null);
    this.result.set(null);
  }

  private startInstance(t: ScaleTemplate): void {
    this.psych.startInstance(this.recordId, t.id).subscribe({
      next: inst => this.instanceId.set(inst.id),
      error: () => this.error.set('No se pudo iniciar la escala.')
    });
  }

  /** Marca la respuesta del ítem actual y avanza salvo que sea el último. */
  choose(value: number): void {
    const item = this.currentItem();
    if (!item) return;
    this.answers.update(a => ({ ...a, [item.id]: value }));
    if (!this.isLastStep()) this.step.update(s => s + 1);
  }

  valueFor(itemId: string): number | undefined {
    return this.answers()[itemId];
  }

  prev(): void { this.step.update(s => Math.max(0, s - 1)); }
  next(): void { this.step.update(s => Math.min(this.items().length - 1, s + 1)); }

  goTo(idx: number): void { this.step.set(idx); }

  submit(): void {
    const instanceId = this.instanceId();
    if (!instanceId || this.submitting() || !this.allAnswered()) return;

    this.submitting.set(true);
    this.error.set(null);

    const responses = this.items().map(i => ({ item_id: i.id, value: this.answers()[i.id] }));

    this.psych.submitResponses(instanceId, responses).subscribe({
      next: res => {
        this.result.set(res);
        this.submitting.set(false);
        this.completed.emit(res);
      },
      error: () => {
        this.submitting.set(false);
        this.error.set('No se pudieron guardar las respuestas.');
      }
    });
  }

  close(): void { this.closed.emit(); }

  /** Color del badge de severidad devuelto por el backend. */
  severityColor(severity: string): string {
    switch (severity) {
      case 'ninguna':
      case 'minima':         return '#10b981';
      case 'leve':           return '#3b82f6';
      case 'moderada':       return '#f59e0b';
      case 'moderada-grave': return '#f97316';
      case 'grave':          return '#ef4444';
      default:               return '#6b7280';
    }
  }
}
