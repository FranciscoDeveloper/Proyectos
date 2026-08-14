import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, timer, throwError, of } from 'rxjs';
import { switchMap, filter, take, defaultIfEmpty } from 'rxjs/operators';

/**
 * Endpoints de psicología del BFF: /api/psych/*, /api/process-notes/* y
 * /api/clinical/pre-session-brief/*.
 *
 * Fase 2 (handlers/psychHandler.mjs):
 *   · Tareas intersesión — lo que el paciente se lleva entre una sesión y la siguiente.
 *   · Registro de humor — serie corta de estado de ánimo (1-10).
 *   · MBC (medición basada en resultados) — aplicación de PHQ-9 / GAD-7 y su trayectoria.
 *
 * Fases 1 y 3:
 *   · Notas de proceso — el cuaderno del terapeuta, separado de la ficha oficial.
 *   · Brief pre-sesión y borradores de informe — generados por IA, en dos pasos.
 *
 * Todas las rutas cuelgan de un `recordId` (`clinical_record.id`). El backend comprueba
 * la propiedad de ese registro y responde 404 cuando no corresponde al profesional
 * autenticado, así que un id ajeno se ve igual que uno inexistente.
 *
 * ── Por qué el brief y los informes van en dos pasos ─────────────────────────
 * El BFF vive dentro de la VPC (para hablar con RDS) y desde ahí no alcanza Bedrock.
 * Así que POST solo encola el trabajo y responde 202 con un `jobId`; una Lambda fuera
 * de la VPC llama al modelo y escribe el resultado, y el cliente hace polling del GET
 * hasta que `status` deja de ser 'pending'. `pollJob` de más abajo encapsula ese ciclo.
 */

/**
 * "Hoy" en la fecha calendario LOCAL del navegador, como YYYY-MM-DD.
 *
 * El backend, cuando no recibe `session_date`, lo completa con
 * `new Date().toISOString().slice(0, 10)` — la fecha en UTC del servidor. En Chile
 * (UTC-4) eso adelanta un día completo durante la tarde/noche local: una tarea creada
 * a las 23:20 quedaba "Asignada" el día siguiente. El navegador sí conoce la zona
 * horaria real de quien está usando la app, así que quien crea el registro debe
 * mandar esta fecha explícita en vez de dejar que el servidor adivine.
 */
export function todayLocal(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

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

/**
 * Nota de proceso. `is_encrypted` viene siempre false en esta entrega: las columnas de
 * cifrado existen para más adelante, pero hoy no se cifra nada. La garantía real es que
 * solo la ve el terapeuta que la escribió (el backend filtra por author_id).
 */
export interface ProcessNote {
  id: number;
  session_date: string;
  content: string;
  is_encrypted: boolean;
  created_at: string;
  updated_at: string;
}

/** Respuesta 202 al encolar un trabajo de IA. */
export interface AiJobAccepted {
  jobId: string;
  status: 'pending';
  warnings: string[];
  requiresReview: true;
  reportType?: string;
  reportLabel?: string;
}

interface AiJobBase {
  status: 'pending' | 'done' | 'error';
  error: string | null;
  warnings: string[];
  generatedAt: string | null;
  model: string | null;
  /** Siempre true: lo que devuelve el modelo es un borrador que el profesional revisa. */
  requiresReview: true;
}

export interface BriefJob extends AiJobBase {
  brief: string | null;
}

export interface ReportJob extends AiJobBase {
  draft: string | null;
  reportType: string | null;
  reportLabel: string | null;
}

/** Los cuatro tipos de informe que acepta el backend (reportsHandler.mjs). */
export const REPORT_TYPES: ReadonlyArray<{ value: string; label: string; hint: string }> = [
  { value: 'avance-terapeutico', label: 'Informe de Avance',            hint: 'Para el profesional derivante' },
  { value: 'colegio',            label: 'Establecimiento Educacional',  hint: 'Lenguaje para docentes y directivos' },
  { value: 'tribunal-familia',   label: 'Tribunal de Familia',          hint: 'Formato técnico-forense' },
  { value: 'licencia',           label: 'Licencia Médica',              hint: 'Certificado de diagnóstico' },
];

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

  // ── Notas de proceso ───────────────────────────────────────────────────────

  getProcessNotes(recordId: number): Observable<ProcessNote[]> {
    return this.http.get<ProcessNote[]>(`/api/process-notes/${recordId}`);
  }

  createProcessNote(
    recordId: number,
    body: { content: string; session_date?: string | null }
  ): Observable<ProcessNote> {
    return this.http.post<ProcessNote>(`/api/process-notes/${recordId}`, body);
  }

  updateProcessNote(recordId: number, noteId: number, content: string): Observable<ProcessNote> {
    return this.http.patch<ProcessNote>(`/api/process-notes/${recordId}/${noteId}`, { content });
  }

  deleteProcessNote(recordId: number, noteId: number): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`/api/process-notes/${recordId}/${noteId}`);
  }

  // ── Trabajos de IA (brief pre-sesión e informes) ───────────────────────────

  /** Encola un brief. Devuelve el `jobId` con el que hacer polling. */
  requestPreSessionBrief(recordId: number): Observable<AiJobAccepted> {
    return this.http.post<AiJobAccepted>(`/api/clinical/pre-session-brief/${recordId}`, {});
  }

  getPreSessionBriefJob(jobId: string): Observable<BriefJob> {
    return this.http.get<BriefJob>(`/api/clinical/pre-session-brief/job/${jobId}`);
  }

  requestReportDraft(body: {
    recordId: number;
    reportType: string;
    additionalContext?: string;
  }): Observable<AiJobAccepted> {
    return this.http.post<AiJobAccepted>('/api/psych/reports/draft', body);
  }

  getReportJob(jobId: string): Observable<ReportJob> {
    return this.http.get<ReportJob>(`/api/psych/reports/job/${jobId}`);
  }

  /**
   * Consulta `fetchJob` cada `POLL_INTERVAL_MS` hasta que el trabajo deja de estar
   * pendiente, y se rinde tras `POLL_MAX_ATTEMPTS` intentos (~30 s).
   *
   * El tope existe porque un trabajo puede quedarse en 'pending' para siempre si el
   * worker nunca llegó a escribir el desenlace; sin él la UI giraría indefinidamente.
   * Al agotarse emite un error y el componente ofrece reintentar — el `jobId` sigue
   * siendo válido mientras no expire su TTL de una hora.
   */
  pollJob<T extends { status: string }>(fetchJob: () => Observable<T>): Observable<T> {
    return timer(0, PsychService.POLL_INTERVAL_MS).pipe(
      take(PsychService.POLL_MAX_ATTEMPTS),
      switchMap(() => fetchJob()),
      filter(job => job.status !== 'pending'),
      take(1),
      // Sin esto, agotar los 15 intentos completaría el observable sin emitir nada:
      // el componente no recibiría ni `next` ni `error` y se quedaría cargando para
      // siempre. `defaultIfEmpty` convierte ese caso en un error explícito.
      defaultIfEmpty(null as T | null),
      switchMap(job => (job ? of(job) : throwError(() => new Error('POLL_TIMEOUT'))))
    );
  }

  private static readonly POLL_INTERVAL_MS = 2_000;
  private static readonly POLL_MAX_ATTEMPTS = 15;
}
