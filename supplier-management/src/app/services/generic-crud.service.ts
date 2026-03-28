import { Injectable, inject, signal, WritableSignal, Signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SchemaService } from './schema.service';

/**
 * Generic CRUD service backed by the mock REST API (/api/entities/:key).
 *
 * Each entity key gets its own reactive Signal<Record<string,any>[]>.
 * HTTP calls go to the MockApiInterceptor during development; swap
 * the interceptor for a real backend in production without touching this service.
 *
 * Endpoints used
 * ──────────────
 *  GET    /api/entities/:key
 *  POST   /api/entities/:key
 *  PUT    /api/entities/:key/:id
 *  DELETE /api/entities/:key/:id
 *  POST   /api/entities/:key/:id/encounters
 */
@Injectable({ providedIn: 'root' })
export class GenericCrudService {
  private http         = inject(HttpClient);
  private schemaService = inject(SchemaService);

  private stores  = new Map<string, WritableSignal<Record<string, any>[]>>();
  private loading = new Set<string>();

  // ── Initialise / refresh store from the server ─────────────────────────────

  initStore(key: string): void {
    if (this.stores.has(key)) return;         // already initialised
    if (this.loading.has(key)) return;        // in-flight request
    this.loading.add(key);
    this.stores.set(key, signal([]));

    this.http.get<Record<string, any>[]>(`/api/entities/${key}`).subscribe({
      next: data  => { this.stores.get(key)!.set(data); this.loading.delete(key); },
      error: _err => {
        // Fallback: seed from SchemaService so the app still works offline
        const payload = this.schemaService.getEntityPayload(key);
        this.stores.get(key)!.set(payload ? [...payload.data] : []);
        this.loading.delete(key);
      }
    });
  }

  /** Reactive signal for all records of an entity */
  getAll(key: string): Signal<Record<string, any>[]> {
    this.initStore(key);
    return this.stores.get(key)!.asReadonly();
  }

  getById(key: string, id: number): Record<string, any> | undefined {
    return this.stores.get(key)?.()?.find(item => item['id'] === id);
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  create(key: string, data: Record<string, any>): void {
    this.http.post<Record<string, any>>(`/api/entities/${key}`, data).subscribe({
      next: created => this.stores.get(key)?.update(list => [...list, created])
    });
  }

  update(key: string, id: number, data: Record<string, any>): void {
    this.http.put<Record<string, any>>(`/api/entities/${key}/${id}`, data).subscribe({
      next: updated => this.stores.get(key)?.update(
        list => list.map(item => item['id'] === id ? updated : item)
      )
    });
  }

  appendEncounter(key: string, id: number, encounter: Record<string, any>): void {
    this.http.post<Record<string, any>>(`/api/entities/${key}/${id}/encounters`, encounter).subscribe({
      next: updated => this.stores.get(key)?.update(
        list => list.map(item => item['id'] === id ? updated : item)
      )
    });
  }

  delete(key: string, id: number): void {
    this.http.delete(`/api/entities/${key}/${id}`).subscribe({
      next: () => this.stores.get(key)?.update(list => list.filter(item => item['id'] !== id))
    });
  }

  /** Text search across all string fields (client-side, no extra HTTP call) */
  search(key: string, query: string): Record<string, any>[] {
    const all = this.stores.get(key)?.() ?? [];
    if (!query.trim()) return all;
    const q = query.toLowerCase();
    return all.filter(item =>
      Object.values(item).some(v => v != null && String(v).toLowerCase().includes(q))
    );
  }
}
