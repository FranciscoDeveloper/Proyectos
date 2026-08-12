import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

/**
 * Endpoints /api/psych/* del BFF (handlers/psychHandler.mjs).
 *
 * Cubre las tres piezas de la Fase 2 de psicología:
 *   · Tareas intersesión — lo que el paciente se lleva entre una sesión y la siguiente.
 *   · Registro de humor — serie corta de estado de ánimo (1-10).
 *   · MBC (medición basada en resultados) — aplicación de PHQ-9 / GAD-7 y su trayectoria.
 *
 * Todas las rutas cuelgan de un `recordId` (`clinical_record.id`). El backend comprueba
 * la propiedad de ese registro y responde 404 cuando no corresponde al profesional
 * autenticado, así que un id ajeno se ve igual que uno inexistente.
 */

export interface IntersessionTask {
  id: number;
  description: string;
  due_date: string | null;
  completed: boolean;
  completed_at: string | null;
  patient_note: string | null;
  session_date: string;
  created_at: string;
}

export interface MoodEntry {
  id: number;
  mood_score: number;
  mood_label: string | null;
  note: string | null;
  logged_by: string;
  logged_at: string;
}

export interface ScaleOption { value: number; label: string; }
export interface ScaleRange  { min: number; max: number; label: string; severity: string; }
export interface ScaleItem   { id: string; text: string; }

export interface ScaleTemplate {
  id: number;
  code: string;
  name: string;
  description: string | null;
  items: ScaleItem[];
  scoring: { options: ScaleOption[]; ranges: ScaleRange[] };
}

export interface ScaleInstance {
  id: number;
  administered_at: string;
}

export interface ScaleResult {
  instanceId: number;
  total: number;
  severity: string;
  label: string;
}

export interface TrajectoryPoint {
  instanceId: number;
  score: number;
  severity: string;
  date: string;
}

export interface TrajectorySeries {
  code: string;
  name: string;
  points: TrajectoryPoint[];
}

@Injectable({ providedIn: 'root' })
export class PsychService {
  private http = inject(HttpClient);

  // ── Tareas intersesión ─────────────────────────────────────────────────────

  getTasks(recordId: number): Observable<IntersessionTask[]> {
    return this.http.get<IntersessionTask[]>(`/api/psych/tasks/${recordId}`);
  }

  createTask(
    recordId: number,
    body: { description: string; due_date?: string | null; session_date?: string | null }
  ): Observable<IntersessionTask> {
    return this.http.post<IntersessionTask>(`/api/psych/tasks/${recordId}`, body);
  }

  completeTask(recordId: number, taskId: number, note?: string): Observable<IntersessionTask> {
    return this.http.post<IntersessionTask>(
      `/api/psych/tasks/${recordId}/${taskId}/complete`,
      { patient_note: note ?? null }
    );
  }

  deleteTask(recordId: number, taskId: number): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`/api/psych/tasks/${recordId}/${taskId}`);
  }

  // ── Registro de humor ──────────────────────────────────────────────────────

  getMoodLog(recordId: number): Observable<MoodEntry[]> {
    return this.http.get<MoodEntry[]>(`/api/psych/mood/${recordId}`);
  }

  logMood(
    recordId: number,
    body: { mood_score: number; mood_label?: string | null; note?: string | null }
  ): Observable<MoodEntry> {
    return this.http.post<MoodEntry>(`/api/psych/mood/${recordId}`, body);
  }

  // ── Escalas MBC ────────────────────────────────────────────────────────────

  /**
   * Catálogo de escalas aplicables al módulo. El default es `psych-records` porque
   * la UI que las aplica vive en el detalle de la ficha; el seed las declara también
   * bajo `psych-sessions` para la agenda.
   */
  getTemplates(schemaKey = 'psych-records'): Observable<ScaleTemplate[]> {
    return this.http.get<ScaleTemplate[]>(
      `/api/psych/mbc/templates?schemaKey=${encodeURIComponent(schemaKey)}`
    );
  }

  startInstance(recordId: number, templateId: number): Observable<ScaleInstance> {
    return this.http.post<ScaleInstance>('/api/psych/mbc/instances', { recordId, templateId });
  }

  /**
   * Envía las respuestas de una instancia. Es idempotente por (instancia, ítem):
   * reenviar el mismo cuestionario actualiza los valores en vez de duplicar filas,
   * así que un doble click no altera el conteo de respuestas ni el puntaje.
   */
  submitResponses(
    instanceId: number,
    responses: { item_id: string; value: number }[]
  ): Observable<ScaleResult> {
    return this.http.post<ScaleResult>(
      `/api/psych/mbc/instances/${instanceId}/responses`,
      { responses }
    );
  }

  getTrajectory(recordId: number): Observable<TrajectorySeries[]> {
    return this.http.get<TrajectorySeries[]>(`/api/psych/mbc/trajectory/${recordId}`);
  }
}
