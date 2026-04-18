import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Supplier, SupplierFilter, SupplierStats } from '../models/supplier.model';
import { CryptoService, SUPPLIER_ENCRYPTED_FIELDS } from './crypto.service';

@Injectable({ providedIn: 'root' })
export class SupplierService {
  private http   = inject(HttpClient);
  private crypto = inject(CryptoService);
  private _suppliers = signal<Supplier[]>([]);

  constructor() {
    this.http.get<Supplier[]>('/api/suppliers').subscribe({
      next: async data => {
        const decrypted = await Promise.all(
          data.map(s => this.crypto.decryptFields(s as any, SUPPLIER_ENCRYPTED_FIELDS))
        );
        this._suppliers.set(decrypted as Supplier[]);
      }
    });
  }

  getAll() {
    return this._suppliers.asReadonly();
  }

  getById(id: number): Supplier | undefined {
    return this._suppliers().find(s => s.id === id);
  }

  create(data: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>): void {
    this.crypto.encryptFields(data as any, SUPPLIER_ENCRYPTED_FIELDS).then(encrypted => {
      this.http.post<Supplier>('/api/suppliers', encrypted).subscribe({
        next: async created => {
          const decrypted = await this.crypto.decryptFields(created as any, SUPPLIER_ENCRYPTED_FIELDS);
          this._suppliers.update(list => [...list, decrypted as Supplier]);
        }
      });
    });
  }

  update(id: number, data: Partial<Supplier>): void {
    this.crypto.encryptFields(data as any, SUPPLIER_ENCRYPTED_FIELDS).then(encrypted => {
      this.http.put<Supplier>(`/api/suppliers/${id}`, encrypted).subscribe({
        next: async updated => {
          const decrypted = await this.crypto.decryptFields(updated as any, SUPPLIER_ENCRYPTED_FIELDS);
          this._suppliers.update(
            list => list.map(s => s.id === id ? decrypted as Supplier : s)
          );
        }
      });
    });
  }

  delete(id: number): void {
    this.http.delete(`/api/suppliers/${id}`).subscribe({
      next: () => this._suppliers.update(list => list.filter(s => s.id !== id))
    });
  }

  getStats(): SupplierStats {
    const list = this._suppliers();
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
    return this._suppliers().filter(s => {
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
