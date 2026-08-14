import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PsychService, ProcessNote, todayLocal } from '../../../services/psych.service';

/**
 * Notas de proceso: el cuaderno de trabajo del terapeuta, separado de la ficha oficial.
 *
 * La ficha clínica es una fila compartida por paciente — otro profesional que atienda a
 * la misma persona la ve. Estas notas no: el backend filtra por `author_id`, así que
 * solo las lee quien las escribió.
 *
 * Lo que la UI dice sobre esa privacidad está deliberadamente acotado a lo que es
 * cierto: "visible solo para el terapeuta que la escribió". No se afirma cifrado ni
 * inaccesibilidad para Dairi, porque el contenido se guarda en claro en la base de datos.
 *
 * Solo se monta para fichas psicológicas (ver clinical-detail.component.html).
 */
@Component({
  selector: 'app-process-notes',
  imports: [CommonModule, FormsModule],
  templateUrl: './process-notes.component.html',
  styleUrl: './process-notes.component.scss'
})
export class ProcessNotesComponent implements OnInit {
  /** `clinical_record.id` de la ficha abierta. */
  @Input({ required: true }) recordId!: number;

  private psych = inject(PsychService);

  readonly notes   = signal<ProcessNote[]>([]);
  readonly loading = signal(true);
  readonly error   = signal<string | null>(null);

  // ── Nota nueva ─────────────────────────────────────────────────────────────
  showForm    = signal(false);
  newContent  = signal('');
  newDate     = signal('');
  saving      = signal(false);

  // ── Edición en línea ───────────────────────────────────────────────────────
  editingId      = signal<number | null>(null);
  editingContent = signal('');

  ngOnInit(): void {
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.psych.getProcessNotes(this.recordId).subscribe({
      next: rows => { this.notes.set(rows); this.loading.set(false); },
      error: () => { this.loading.set(false); this.error.set('No se pudieron cargar las notas.'); }
    });
  }

  addNote(): void {
    const content = this.newContent().trim();
    if (!content || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    this.psych.createProcessNote(this.recordId, {
      content,
      // Sin fecha elegida, se manda "hoy" en hora LOCAL: dejar el campo en null hacía
      // que el backend lo completara con la fecha UTC del servidor, que en Chile
      // adelanta un día durante la tarde/noche (ver todayLocal()).
      session_date: this.newDate() || todayLocal()
    }).subscribe({
      next: note => {
        // Se recarga en vez de anteponer: el orden es por session_date DESC y una nota
        // fechada hacia atrás no va necesariamente primero.
        this.cancelForm();
        this.saving.set(false);
        this.reload();
        void note;
      },
      error: () => { this.saving.set(false); this.error.set('No se pudo guardar la nota.'); }
    });
  }

  cancelForm(): void {
    this.showForm.set(false);
    this.newContent.set('');
    this.newDate.set('');
  }

  startEdit(note: ProcessNote): void {
    this.editingId.set(note.id);
    this.editingContent.set(note.content);
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.editingContent.set('');
  }

  saveEdit(): void {
    const id      = this.editingId();
    const content = this.editingContent().trim();
    if (id == null || !content) return;
    this.psych.updateProcessNote(this.recordId, id, content).subscribe({
      next: updated => {
        this.notes.update(list => list.map(n => (n.id === updated.id ? updated : n)));
        this.cancelEdit();
      },
      error: () => this.error.set('No se pudo actualizar la nota.')
    });
  }

  // El confirm() nativo era bloqueante, no traducible y visualmente ajeno a la
  // app. Se sustituye por un modal propio, igual que en tareas intersesión.
  deletingNote = signal<ProcessNote | null>(null);

  askDeleteNote(note: ProcessNote): void { this.deletingNote.set(note); }
  cancelDeleteNote(): void { this.deletingNote.set(null); }

  confirmDeleteNote(): void {
    const note = this.deletingNote();
    if (!note) return;
    this.psych.deleteProcessNote(this.recordId, note.id).subscribe({
      next: () => {
        this.notes.update(list => list.filter(n => n.id !== note.id));
        this.deletingNote.set(null);
      },
      error: () => {
        this.deletingNote.set(null);
        this.error.set('No se pudo eliminar la nota.');
      }
    });
  }

  /** true cuando la nota fue editada después de crearse (para mostrar "editada"). */
  wasEdited(note: ProcessNote): boolean {
    return !!note.updated_at && !!note.created_at &&
      new Date(note.updated_at).getTime() - new Date(note.created_at).getTime() > 1000;
  }
}
