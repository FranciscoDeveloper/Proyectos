import { Component, Input, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PsychService, IntersessionTask, MoodEntry, todayLocal } from '../../../services/psych.service';

/**
 * "Puente entre sesiones": lo que ocurre en los 6 días y 23 horas que el paciente
 * pasa fuera de la consulta. Reúne las dos piezas de esa idea porque se leen juntas
 * al preparar la sesión siguiente:
 *
 *   · Tareas intersesión — encargos concretos con fecha de entrega y la nota que el
 *     paciente deja al completarlas.
 *   · Registro de humor — serie corta 1-10 que da contexto a esas tareas.
 *
 * Solo se monta para fichas psicológicas (ver clinical-detail.component.html).
 */
@Component({
  selector: 'app-intersession-tasks',
  imports: [CommonModule, FormsModule],
  templateUrl: './intersession-tasks.component.html',
  styleUrl: './intersession-tasks.component.scss'
})
export class IntersessionTasksComponent implements OnInit {
  /** `clinical_record.id` de la ficha abierta. */
  @Input({ required: true }) recordId!: number;

  private psych = inject(PsychService);

  readonly tasks   = signal<IntersessionTask[]>([]);
  readonly moods   = signal<MoodEntry[]>([]);
  readonly loading = signal(true);
  readonly error   = signal<string | null>(null);

  readonly pending   = computed(() => this.tasks().filter(t => !t.completed));
  readonly completed = computed(() => this.tasks().filter(t =>  t.completed));

  // ── Formulario de tarea nueva ──────────────────────────────────────────────
  showForm    = signal(false);
  newDesc     = signal('');
  newDueDate  = signal('');
  saving      = signal(false);

  // ── Formulario de humor ────────────────────────────────────────────────────
  showMoodForm = signal(false);
  moodScore    = signal(5);
  moodNote     = signal('');
  savingMood   = signal(false);

  /** Escala 1-10 para los botones del selector de ánimo. */
  readonly moodScale = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  ngOnInit(): void {
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.psych.getTasks(this.recordId).subscribe({
      next: rows => { this.tasks.set(rows); this.loading.set(false); },
      error: () => { this.loading.set(false); this.error.set('No se pudieron cargar las tareas.'); }
    });
    this.psych.getMoodLog(this.recordId).subscribe({
      next: rows => this.moods.set(rows),
      error: () => { /* el panel de humor se muestra vacío; el error de tareas ya avisa */ }
    });
  }

  addTask(): void {
    const description = this.newDesc().trim();
    if (!description || this.saving()) return;
    this.saving.set(true);
    this.psych.createTask(this.recordId, {
      description,
      due_date: this.newDueDate() || null,
      // Explícita: dejarla fuera hace que el backend la complete con la fecha UTC del
      // servidor, que en Chile adelanta un día durante la tarde/noche (ver todayLocal()).
      session_date: todayLocal()
    }).subscribe({
      next: task => {
        // Se antepone en vez de recargar: el orden del backend es
        // (completed, created_at DESC), y una tarea nueva siempre es la primera.
        this.tasks.update(list => [task, ...list]);
        this.cancelForm();
        this.saving.set(false);
      },
      error: () => { this.saving.set(false); this.error.set('No se pudo crear la tarea.'); }
    });
  }

  cancelForm(): void {
    this.showForm.set(false);
    this.newDesc.set('');
    this.newDueDate.set('');
  }

  // ── Completar tarea ────────────────────────────────────────────────────────
  // La nota del paciente se capturaba con `prompt()`. Un diálogo nativo bloquea
  // el hilo, no se puede estilar ni traducir y —lo importante aquí— es un sitio
  // pésimo para recoger texto clínico: al ser modal del navegador, cualquier
  // escritura dirigida a la página aterriza dentro del prompt y termina
  // guardada en la ficha del paciente sin que nadie lo haya tecleado a
  // propósito. Ahora es un modal de la propia app, explícito y cancelable.
  completingTask = signal<IntersessionTask | null>(null);
  completeNote   = signal('');
  savingComplete = signal(false);

  askCompleteTask(task: IntersessionTask): void {
    this.completingTask.set(task);
    this.completeNote.set('');
  }

  cancelCompleteTask(): void {
    this.completingTask.set(null);
    this.completeNote.set('');
  }

  confirmCompleteTask(): void {
    const task = this.completingTask();
    if (!task || this.savingComplete()) return;
    this.savingComplete.set(true);
    const note = this.completeNote().trim() || undefined;
    this.psych.completeTask(this.recordId, task.id, note).subscribe({
      next: updated => {
        this.tasks.update(list => list.map(t => (t.id === updated.id ? updated : t)));
        this.savingComplete.set(false);
        this.cancelCompleteTask();
      },
      error: () => {
        this.savingComplete.set(false);
        this.cancelCompleteTask();
        this.error.set('No se pudo marcar la tarea como completada.');
      }
    });
  }

  // ── Eliminar tarea ─────────────────────────────────────────────────────────
  deletingTask = signal<IntersessionTask | null>(null);

  askDeleteTask(task: IntersessionTask): void { this.deletingTask.set(task); }
  cancelDeleteTask(): void { this.deletingTask.set(null); }

  confirmDeleteTask(): void {
    const task = this.deletingTask();
    if (!task) return;
    this.psych.deleteTask(this.recordId, task.id).subscribe({
      next: () => {
        this.tasks.update(list => list.filter(t => t.id !== task.id));
        this.deletingTask.set(null);
      },
      error: () => {
        this.deletingTask.set(null);
        this.error.set('No se pudo eliminar la tarea.');
      }
    });
  }

  logMood(): void {
    if (this.savingMood()) return;
    this.savingMood.set(true);
    this.psych.logMood(this.recordId, {
      mood_score: this.moodScore(),
      mood_label: this.moodLabel(this.moodScore()),
      note: this.moodNote().trim() || null
    }).subscribe({
      next: entry => {
        this.moods.update(list => [entry, ...list]);
        this.showMoodForm.set(false);
        this.moodNote.set('');
        this.moodScore.set(5);
        this.savingMood.set(false);
      },
      error: () => { this.savingMood.set(false); this.error.set('No se pudo registrar el ánimo.'); }
    });
  }

  /** Etiqueta cualitativa para un puntaje 1-10, para no mostrar un número pelado. */
  moodLabel(score: number): string {
    if (score <= 2) return 'Muy bajo';
    if (score <= 4) return 'Bajo';
    if (score <= 6) return 'Neutro';
    if (score <= 8) return 'Bueno';
    return 'Muy bueno';
  }

  moodColor(score: number): string {
    if (score <= 2) return '#ef4444';
    if (score <= 4) return '#f59e0b';
    if (score <= 6) return '#6b7280';
    if (score <= 8) return '#3b82f6';
    return '#10b981';
  }

  /** true cuando la tarea sigue pendiente y su fecha de entrega ya pasó. */
  isOverdue(task: IntersessionTask): boolean {
    if (task.completed || !task.due_date) return false;
    return task.due_date < new Date().toISOString().slice(0, 10);
  }
}
