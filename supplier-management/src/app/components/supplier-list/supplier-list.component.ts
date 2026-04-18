import { Component, signal, computed, inject } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SupplierService } from '../../services/supplier.service';
import { Supplier, SupplierFilter } from '../../models/supplier.model';

@Component({
  selector: 'app-supplier-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, TitleCasePipe],
  templateUrl: './supplier-list.component.html',
  styleUrl: './supplier-list.component.scss'
})
export class SupplierListComponent {
  private supplierService = inject(SupplierService);

  filters = signal<SupplierFilter>({ search: '', category: '', status: '', country: '', minRating: 0 });
  sortField = signal<keyof Supplier>('name');
  sortDir = signal<'asc' | 'desc'>('asc');
  showDeleteModal = signal<number | null>(null);
  viewMode = signal<'table' | 'grid'>('table');
  currentPage = signal(1);
  pageSize = 8;

  filteredSuppliers = computed(() => {
    const list = this.supplierService.filter(this.filters());
    const field = this.sortField();
    const dir = this.sortDir();
    return list.sort((a, b) => {
      const av = a[field];
      const bv = b[field];
      const cmp = av! < bv! ? -1 : av! > bv! ? 1 : 0;
      return dir === 'asc' ? cmp : -cmp;
    });
  });

  paginatedSuppliers = computed(() => {
    const all = this.filteredSuppliers();
    const start = (this.currentPage() - 1) * this.pageSize;
    return all.slice(start, start + this.pageSize);
  });

  totalPages = computed(() => Math.ceil(this.filteredSuppliers().length / this.pageSize));

  pages = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const pages: number[] = [];
    const start = Math.max(1, current - 2);
    const end = Math.min(total, start + 4);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  });

  categories = ['technology', 'manufacturing', 'logistics', 'services', 'raw-materials', 'food-beverage', 'healthcare', 'construction'];
  statuses = ['active', 'inactive', 'pending', 'blacklisted'];
  countries = computed(() => [...new Set(this.supplierService.getAll()().map(s => s.country))].sort());

  updateFilter(partial: Partial<SupplierFilter>) {
    this.filters.update(f => ({ ...f, ...partial }));
    this.currentPage.set(1);
  }

  setSort(field: keyof Supplier) {
    if (this.sortField() === field) {
      this.sortDir.update(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortField.set(field);
      this.sortDir.set('asc');
    }
  }

  clearFilters() {
    this.filters.set({ search: '', category: '', status: '', country: '', minRating: 0 });
    this.currentPage.set(1);
  }

  confirmDelete(id: number) { this.showDeleteModal.set(id); }

  executeDelete() {
    const id = this.showDeleteModal();
    if (id !== null) {
      this.supplierService.delete(id);
      this.showDeleteModal.set(null);
    }
  }

  cancelDelete() { this.showDeleteModal.set(null); }

  getStars(rating: number): boolean[] {
    return Array(5).fill(0).map((_, i) => i < Math.floor(rating));
  }

  getAvatarColor(name: string): string {
    const colors = [
      'linear-gradient(135deg, #6366f1, #8b5cf6)',
      'linear-gradient(135deg, #10b981, #059669)',
      'linear-gradient(135deg, #3b82f6, #2563eb)',
      'linear-gradient(135deg, #f59e0b, #d97706)',
      'linear-gradient(135deg, #ef4444, #dc2626)',
      'linear-gradient(135deg, #8b5cf6, #7c3aed)',
      'linear-gradient(135deg, #06b6d4, #0891b2)',
      'linear-gradient(135deg, #ec4899, #db2777)',
    ];
    return colors[name.charCodeAt(0) % colors.length];
  }

  formatCurrency(value: number): string {
    if (value >= 1000000) return '$' + (value / 1000000).toFixed(1) + 'M';
    if (value >= 1000) return '$' + (value / 1000).toFixed(0) + 'K';
    return '$' + value;
  }

  prevPage() { this.currentPage.update(p => p - 1); }
  nextPage() { this.currentPage.update(p => p + 1); }

  hasActiveFilters = computed(() => {
    const f = this.filters();
    return !!(f.search || f.category || f.status || f.country || f.minRating > 0);
  });

  minVal(a: number, b: number) { return Math.min(a, b); }
}
