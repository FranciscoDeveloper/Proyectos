import { Injectable, signal, WritableSignal, Signal } from '@angular/core';
import { SchemaService } from './schema.service';

/**
 * Generic in-memory CRUD store.
 * Each entity key gets its own isolated WritableSignal<Record<string, any>[]>.
 * In a real app, each method would call HttpClient against a REST API.
 */
@Injectable({ providedIn: 'root' })
export class GenericCrudService {
  private stores = new Map<string, WritableSignal<Record<string, any>[]>>();

  constructor(private schemaService: SchemaService) {}

  /** Initializes (or resets) the store for a given entity from the backend payload */
  initStore(key: string): void {
    if (!this.stores.has(key)) {
      const payload = this.schemaService.getEntityPayload(key);
      const initial = payload ? [...payload.data] : [];
      this.stores.set(key, signal(initial));
    }
  }

  /** Returns the reactive signal for a given entity store */
  getAll(key: string): Signal<Record<string, any>[]> {
    this.initStore(key);
    return this.stores.get(key)!.asReadonly();
  }

  getById(key: string, id: number): Record<string, any> | undefined {
    this.initStore(key);
    return this.stores.get(key)!().find(item => item['id'] === id);
  }

  create(key: string, data: Record<string, any>): Record<string, any> {
    this.initStore(key);
    const newItem = { ...data, id: Date.now(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    this.stores.get(key)!.update(list => [...list, newItem]);
    return newItem;
  }

  update(key: string, id: number, data: Record<string, any>): Record<string, any> | null {
    this.initStore(key);
    let updated: Record<string, any> | null = null;
    this.stores.get(key)!.update(list =>
      list.map(item => {
        if (item['id'] === id) {
          updated = { ...item, ...data, id, updatedAt: new Date().toISOString() };
          return updated;
        }
        return item;
      })
    );
    return updated;
  }

  /**
   * Appends a new encounter object to the record's encounters array and
   * updates lastVisit. Used by encounter mode in GenericFormComponent.
   */
  appendEncounter(key: string, id: number, encounter: Record<string, any>): void {
    this.initStore(key);
    this.stores.get(key)!.update(list =>
      list.map(item => {
        if (item['id'] !== id) return item;
        const existing = Array.isArray(item['encounters']) ? item['encounters'] : [];
        return {
          ...item,
          encounters: [encounter, ...existing],
          lastVisit: encounter['encounterDate'] ?? new Date().toISOString().slice(0, 10),
          updatedAt: new Date().toISOString()
        };
      })
    );
  }

  delete(key: string, id: number): void {
    this.initStore(key);
    this.stores.get(key)!.update(list => list.filter(item => item['id'] !== id));
  }

  /** Returns items filtered by a simple text search across all string fields */
  search(key: string, query: string): Record<string, any>[] {
    this.initStore(key);
    if (!query.trim()) return this.stores.get(key)!();
    const q = query.toLowerCase();
    return this.stores.get(key)!().filter(item =>
      Object.values(item).some(v => v != null && String(v).toLowerCase().includes(q))
    );
  }
}
