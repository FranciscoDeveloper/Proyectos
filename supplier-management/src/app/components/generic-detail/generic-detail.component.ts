import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SchemaService } from '../../services/schema.service';
import { GenericCrudService } from '../../services/generic-crud.service';
import { EntitySchema, FieldDefinition } from '../../models/entity-schema.model';

@Component({
  selector: 'app-generic-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './generic-detail.component.html',
  styleUrl: './generic-detail.component.scss'
})
export class GenericDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private schemaService = inject(SchemaService);
  private crudService = inject(GenericCrudService);

  schema = signal<EntitySchema | null>(null);
  entityKey = signal('');
  record = signal<Record<string, any> | null>(null);
  deleteModal = signal(false);

  titleField = computed(() => this.schema()?.fields.find(f => f.isTitle));
  subtitleField = computed(() => this.schema()?.fields.find(f => f.isSubtitle));
  detailFields = computed(() => this.schema()?.fields.filter(f => f.showInDetail && !f.isTitle && !f.isSubtitle) ?? []);

  ngOnInit() {
    const key = this.route.snapshot.paramMap.get('entityKey') ?? '';
    const id = +(this.route.snapshot.paramMap.get('id') ?? '0');
    this.entityKey.set(key);
    this.schema.set(this.schemaService.getSchema(key));
    this.crudService.initStore(key);
    this.record.set(this.crudService.getById(key, id) ?? null);
  }

  navigateEdit() {
    const id = this.record()?.['id'];
    if (id != null) this.router.navigate(['/entity', this.entityKey(), id, 'edit']);
  }

  confirmDelete() { this.deleteModal.set(true); }
  cancelDelete() { this.deleteModal.set(false); }
  executeDelete() {
    const id = this.record()?.['id'];
    if (id != null) {
      this.crudService.delete(this.entityKey(), id);
      this.router.navigate(['/entity', this.entityKey()]);
    }
  }

  getDisplayValue(field: FieldDefinition, record: Record<string, any>): string {
    const raw = record[field.name];
    if (raw == null || raw === '') return '—';
    if (field.format === 'currency') return this.formatCurrency(Number(raw));
    if (field.format === 'date') return this.formatDate(raw);
    if (field.type === 'boolean') return raw ? 'Sí' : 'No';
    if (field.type === 'tags' && Array.isArray(raw)) return raw.join(', ');
    if (field.options) return field.options.find(o => o.value === raw)?.label ?? String(raw);
    return String(raw);
  }

  getTagsArray(field: FieldDefinition, record: Record<string, any>): string[] {
    const raw = record[field.name];
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    return String(raw).split(',').map(t => t.trim()).filter(Boolean);
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

  getEntitySingular(): string {
    return this.schema()?.entity.singular ?? '';
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
    return isNaN(d.getTime())
      ? String(value)
      : d.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
  }
}
