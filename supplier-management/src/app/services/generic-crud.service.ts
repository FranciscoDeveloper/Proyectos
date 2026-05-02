import { Injectable, inject, signal, WritableSignal, Signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SchemaService } from './schema.service';
import { CryptoService } from './crypto.service';

@Injectable({ providedIn: 'root' })
export class GenericCrudService {
  private http          = inject(HttpClient);
  private schemaService = inject(SchemaService);
  private crypto        = inject(CryptoService);

  private stores  = new Map<string, WritableSignal<Record<string, any>[]>>();
  private loading = new Set<string>();

  // ── Initialise / refresh store from the server ─────────────────────────────

  initStore(key: string): void {
    if (this.stores.has(key)) return;
    if (this.loading.has(key)) return;
    this.loading.add(key);
    this.stores.set(key, signal([]));

    this.http.get<Record<string, any>[]>(`/api/entities/${key}`).subscribe({
      next: async data => {
        const decrypted = await Promise.all(
          data.map(r => this.crypto.decryptRecord(r, key))
        );
        this.stores.get(key)!.set(decrypted);
        this.loading.delete(key);
      },
      error: _err => {
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
    this.crypto.encryptRecord(data, key).then(encrypted => {
      this.http.post<Record<string, any>>(`/api/entities/${key}`, encrypted).subscribe({
        next: async created => {
          const decrypted = await this.crypto.decryptRecord(created, key);
          this.stores.get(key)?.update(list => [...list, decrypted]);
        }
      });
    });
  }

  update(key: string, id: number, data: Record<string, any>): void {
    // Optimistic update: merge immediately so signals (e.g. odontogramData) stay reactive
    const existing = this.getById(key, id);
    if (existing) {
      const merged = { ...existing, ...data };
      this.stores.get(key)?.update(
        list => list.map(item => item['id'] === id ? merged : item)
      );
    }

    this.crypto.encryptRecord(data, key).then(encrypted => {
      this.http.put<Record<string, any>>(`/api/entities/${key}/${id}`, encrypted).subscribe({
        next: async updated => {
          const decrypted = await this.crypto.decryptRecord(updated, key);
          this.stores.get(key)?.update(
            list => list.map(item => item['id'] === id ? decrypted : item)
          );
        }
      });
    });
  }

  appendEncounter(key: string, id: number, encounter: Record<string, any>): void {
    this.crypto.encryptRecord(encounter, key).then(encryptedEnc => {
      this.http.post<Record<string, any>>(`/api/entities/${key}/${id}/encounters`, encryptedEnc).subscribe({
        next: async updated => {
          const decrypted = await this.crypto.decryptRecord(updated, key);
          this.stores.get(key)?.update(
            list => list.map(item => item['id'] === id ? decrypted : item)
          );
        }
      });
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
