import { Injectable, inject } from '@angular/core';
import { Signal } from '@angular/core';
import { Supplier, SupplierFilter, SupplierStats } from '../models/supplier.model';
import { GenericCrudService } from './generic-crud.service';

@Injectable({ providedIn: 'root' })
export class SupplierService {
  private crud = inject(GenericCrudService);
  private readonly entityKey = 'suppliers';

  constructor() {
    this.crud.initStore(this.entityKey);
  }

  getAll(): Signal<Supplier[]> {
    return this.crud.getAll(this.entityKey) as Signal<Supplier[]>;
  }

  getById(id: number): Supplier | undefined {
    return this.crud.getById(this.entityKey, id) as Supplier | undefined;
  }

  create(data: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>): void {
    this.crud.create(this.entityKey, data as Record<string, any>);
  }

  update(id: number, data: Partial<Supplier>): void {
    this.crud.update(this.entityKey, id, data as Record<string, any>);
  }

  delete(id: number): void {
    this.crud.delete(this.entityKey, id);
  }

  getStats(): SupplierStats {
    const list = this.getAll()();
    return {
      total:       list.length,
      active:      list.filter(s => s.status === 'active').length,
      inactive:    list.filter(s => s.status === 'inactive').length,
      pending:     list.filter(s => s.status === 'pending').length,
      blacklisted: list.filter(s => s.status === 'blacklisted').length,
      totalSpent:  list.reduce((acc, s) => acc + s.totalSpent, 0),
      avgRating:   list.length ? list.reduce((acc, s) => acc + s.rating, 0) / list.length : 0
    };
  }

  filter(filters: SupplierFilter): Supplier[] {
    return this.getAll()().filter(s => {
      const matchSearch = !filters.search ||
        s.name.toLowerCase().includes(filters.search.toLowerCase()) ||
        s.code.toLowerCase().includes(filters.search.toLowerCase()) ||
        s.email.toLowerCase().includes(filters.search.toLowerCase()) ||
        s.contactPerson.toLowerCase().includes(filters.search.toLowerCase());

      const matchCategory = !filters.category || s.category === filters.category;
      const matchStatus   = !filters.status   || s.status   === filters.status;
      const matchCountry  = !filters.country  || s.country  === filters.country;
      const matchRating   = !filters.minRating || s.rating  >= filters.minRating;

      return matchSearch && matchCategory && matchStatus && matchCountry && matchRating;
    });
  }
}
