import { Injectable, inject, signal, WritableSignal, Signal } from '@angular/core';
import { ElectronApiService } from './electron-api.service';

/**
 * Generic CRUD service backed by the Electron IPC layer.
 *
 * Each entity key gets its own reactive Signal<Record<string,any>[]>.
 * The Electron main process is the data source — it holds in-memory stores
 * that persist for the lifetime of the app process.
 *
 * IPC channels used:
 *  entity:list(key)            → Record<string,any>[]
 *  entity:create(key, data)    → Record<string,any>
 *  entity:update(key, id, data)→ Record<string,any>
 *  entity:delete(key, id)      → { success: true }
 */
@Injectable({ providedIn: 'root' })
export class GenericCrudService {
  private api    = inject(ElectronApiService);
  private stores = new Map<string, WritableSignal<Record<string, any>[]>>();
  private loading = new Set<string>();

  initStore(key: string): void {
    if (this.stores.has(key)) return;
    if (this.loading.has(key)) return;
    this.loading.add(key);
    this.stores.set(key, signal([]));

    this.api.invoke<Record<string, any>[]>('entity:list', key).subscribe({
      next: data => { this.stores.get(key)!.set(data); this.loading.delete(key); },
      error: _   => { this.loading.delete(key); }
    });
  }

  getAll(key: string): Signal<Record<string, any>[]> {
    this.initStore(key);
    return this.stores.get(key)!.asReadonly();
  }

  getById(key: string, id: number): Record<string, any> | undefined {
    return this.stores.get(key)?.()?.find(item => item['id'] === id);
  }

  create(key: string, data: Record<string, any>): void {
    this.api.invoke<Record<string, any>>('entity:create', key, data).subscribe({
      next: created => this.stores.get(key)?.update(list => [...list, created])
    });
  }

  update(key: string, id: number, data: Record<string, any>): void {
    this.api.invoke<Record<string, any>>('entity:update', key, id, data).subscribe({
      next: updated => this.stores.get(key)?.update(
        list => list.map(item => item['id'] === id ? updated : item)
      )
    });
  }

  delete(key: string, id: number): void {
    this.api.invoke('entity:delete', key, id).subscribe({
      next: () => this.stores.get(key)?.update(list => list.filter(item => item['id'] !== id))
    });
  }
}
