import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SchemaService } from '../../services/schema.service';
import { GenericCrudService } from '../../services/generic-crud.service';
import { EntitySchema, FieldDefinition } from '../../models/entity-schema.model';

@Component({
  selector: 'app-generic-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './generic-list.component.html',
  styleUrl: './generic-list.component.scss'
})
export class GenericListComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private schemaService = inject(SchemaService);
  private crudService = inject(GenericCrudService);

  schema = signal<EntitySchema | null>(null);
  entityKey = signal('');
  searchQuery = signal('');
  selectFilters = signal<Record<string, string>>({});
  sortField = signal('');
  sortDir = signal<'asc' | 'desc'>('asc');
  currentPage = signal(1);
  deleteModalId = signal<number | null>(null);
  readonly pageSize = 8;

  listFields = computed(() => this.schema()?.fields.filter(f => f.showInList) ?? []);
  titleField = computed(() => this.schema()?.fields.find(f => f.isTitle));
  subtitleField = computed(() => this.schema()?.fields.find(f => f.isSubtitle));

  filterableFields = computed(() => this.schema()?.fields.filter(f => f.filterable) ?? []);
  selectFilterFields = computed(() => this.filterableFields().filter(f => f.filterType === 'select'));
  searchFilterField = computed(() => this.filterableFields().find(f => f.filterType === 'search'));

  allItems = computed(() => this.crudService.getAll(this.entityKey())());

  filteredItems = computed(() => {
    let items = this.allItems();
    const q = this.searchQuery().toLowerCase().trim();
    if (q) {
      items = items.filter(item =>
        Object.values(item).some(v => v != null && String(v).toLowerCase().includes(q))
      );
    }
    const filters = this.selectFilters();
    for (const [field, value] of Object.entries(filters)) {
      if (value) items = items.filter(item => String(item[field]) === value);
    }
    const sf = this.sortField();
    if (sf) {
      const dir = this.sortDir();
      items = [...items].sort((a, b) => {
        const av = a[sf]; const bv = b[sf];
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return dir === 'asc' ? cmp : -cmp;
      });
    }
    return items;
  });

  totalPages = computed(() => Math.ceil(this.filteredItems().length / this.pageSize));

  paginatedItems = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.filteredItems().slice(start, start + this.pageSize);
  });

  pages = computed(() => {
    const total = this.totalPages();
    const cur = this.currentPage();
    const start = Math.max(1, cur - 2);
    const end = Math.min(total, start + 4);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  });

  hasFilters = computed(() =>
    !!this.searchQuery() || Object.values(this.selectFilters()).some(v => !!v)
  );

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const key = params.get('entityKey') ?? '';
      this.entityKey.set(key);
      const schema = this.schemaService.getSchema(key);
      this.schema.set(schema);
      this.crudService.initStore(key);
      this.sortField.set(this.schema()?.fields.find(f => f.isTitle)?.name ?? '');
      this.selectFilters.set({});
      this.searchQuery.set('');
      this.currentPage.set(1);
    });
  }

  setSort(field: string) {
    if (this.sortField() === field) {
      this.sortDir.update(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortField.set(field);
      this.sortDir.set('asc');
    }
    this.currentPage.set(1);
  }

  setSelectFilter(fieldName: string, value: string) {
    this.selectFilters.update(f => ({ ...f, [fieldName]: value }));
    this.currentPage.set(1);
  }

  clearFilters() {
    this.searchQuery.set('');
    this.selectFilters.set({});
    this.currentPage.set(1);
  }

  confirmDelete(id: number) { this.deleteModalId.set(id); }
  cancelDelete() { this.deleteModalId.set(null); }
  executeDelete() {
    const id = this.deleteModalId();
    if (id !== null) {
      this.crudService.delete(this.entityKey(), id);
      this.deleteModalId.set(null);
    }
  }

  prevPage() { this.currentPage.update(p => p - 1); }
  nextPage() { this.currentPage.update(p => p + 1); }
  setPage(p: number) { this.currentPage.set(p); }

  navigateNew() { this.router.navigate(['/app/entity', this.entityKey(), 'new']); }
  navigateEdit(id: number) { this.router.navigate(['/app/entity', this.entityKey(), id, 'edit']); }
  navigateDetail(id: number) { this.router.navigate(['/app/entity', this.entityKey(), id]); }

  getSelectFilter(fieldName: string): string {
    return this.selectFilters()[fieldName] || '';
  }

  getEntitySingular(): string {
    return this.schema()?.entity.singular ?? '';
  }

  // ─── Display helpers ───

  getCellValue(item: Record<string, any>, field: FieldDefinition): string {
    const raw = item[field.name];
    if (raw == null || raw === '') return '—';
    if (field.format === 'currency') return this.formatCurrency(Number(raw));
    if (field.format === 'date') return this.formatDate(raw);
    if (field.format === 'stars') return raw.toString();
    if (field.type === 'tags' && Array.isArray(raw)) return raw.join(', ');
    if (field.options) {
      return field.options.find(o => o.value === raw)?.label ?? String(raw);
    }
    return String(raw);
  }

  getBadgeColor(field: FieldDefinition, value: any): string {
    return field.badgeColors?.[value] ?? '#6b7280';
  }

  getStars(value: number): boolean[] {
    return Array(5).fill(false).map((_, i) => i < Math.floor(value));
  }

  getAvatarColor(name: string): string {
    const colors = [
      'linear-gradient(135deg,#6366f1,#8b5cf6)',
      'linear-gradient(135deg,#10b981,#059669)',
      'linear-gradient(135deg,#3b82f6,#2563eb)',
      'linear-gradient(135deg,#f59e0b,#d97706)',
      'linear-gradient(135deg,#ef4444,#dc2626)',
      'linear-gradient(135deg,#8b5cf6,#7c3aed)',
      'linear-gradient(135deg,#06b6d4,#0891b2)',
      'linear-gradient(135deg,#ec4899,#db2777)',
    ];
    return colors[(name ?? 'A').charCodeAt(0) % colors.length];
  }

  getAvatarInitials(name: string): string {
    if (!name) return '?';
    const parts = name.split(' ');
    return parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : name.substring(0, 2).toUpperCase();
  }

  private formatCurrency(value: number): string {
    if (value >= 1_000_000) return '$' + (value / 1_000_000).toFixed(1) + 'M';
    if (value >= 1_000) return '$' + (value / 1_000).toFixed(0) + 'K';
    return '$' + value.toFixed(2);
  }

  private formatDate(value: string | Date): string {
    if (!value) return '—';
    const d = new Date(value);
    return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
