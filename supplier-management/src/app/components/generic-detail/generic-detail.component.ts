import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SchemaService } from '../../services/schema.service';
import { GenericCrudService } from '../../services/generic-crud.service';
import { SignatureService } from '../../services/signature.service';
import { EntitySchema, FieldDefinition } from '../../models/entity-schema.model';

@Component({
    selector: 'app-generic-detail',
    imports: [CommonModule, RouterLink],
    templateUrl: './generic-detail.component.html',
    styleUrl: './generic-detail.component.scss'
})
export class GenericDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private schemaService = inject(SchemaService);
  private crudService = inject(GenericCrudService);
  signatureService = inject(SignatureService);

  schema = signal<EntitySchema | null>(null);
  entityKey = signal('');
  recordId = signal(0);
  deleteModal = signal(false);
  signatureValid = signal<boolean | null>(null);

  /**
   * Both the record itself and the linked clinical record are DERIVED from the
   * crud stores rather than snapshotted in ngOnInit. `initStore()` is
   * fire-and-forget, so a synchronous read right after it returns `[]` whenever
   * that store happens to be cold. That made "Agregar Antecedente" appear or
   * disappear on the very same URL purely according to which view the user came
   * from (the calendar path had already warmed the clinical store; the list path
   * had not). Deriving from the signals resolves as soon as the data lands, no
   * matter how the page was reached.
   */
  record = computed<Record<string, any> | null>(() => {
    const key = this.entityKey();
    if (!key) return null;
    const id = this.recordId();
    return this.crudService.getAll(key)().find(r => r['id'] === id) ?? null;
  });

  /** ID of the linked clinical record (resolved from encounterEntity config) */
  private linkedClinical = computed<{ key: string; id: number } | null>(() => {
    const schema = this.schema();
    const rec = this.record();
    const encounterEntity = schema?.entity.encounterEntity;
    const matchField = schema?.entity.encounterMatchField;
    if (!encounterEntity || !matchField || !rec) return null;

    const patientName = String(rec[matchField] ?? '').toLowerCase();
    if (!patientName) return null;

    const clinicalSchema = this.schemaService.getSchema(encounterEntity);
    const titleFieldName = clinicalSchema?.fields.find(f => f.isTitle)?.name ?? 'fullName';
    const match = this.crudService
      .getAll(encounterEntity)()
      .find(r => String(r[titleFieldName] ?? '').toLowerCase() === patientName);
    return match ? { key: encounterEntity, id: match['id'] } : null;
  });

  linkedClinicalRecordId = computed(() => this.linkedClinical()?.id ?? null);
  linkedClinicalEntityKey = computed(() => this.linkedClinical()?.key ?? '');

  titleField = computed(() => this.schema()?.fields.find(f => f.isTitle));
  subtitleField = computed(() => this.schema()?.fields.find(f => f.isSubtitle));
  detailFields = computed(() => this.schema()?.fields.filter(f => f.showInDetail && !f.isTitle && !f.isSubtitle) ?? []);

  constructor() {
    // Re-verify the signature whenever the record actually materialises.
    effect(() => {
      const rec = this.record();
      const key = this.entityKey();
      if (rec?.['_signatureHash']) {
        this.signatureService.verifyRecord(key, rec).then(valid => this.signatureValid.set(valid));
      } else {
        this.signatureValid.set(null);
      }
    });
  }

  ngOnInit() {
    const key = this.route.snapshot.paramMap.get('entityKey') ?? '';
    const id = +(this.route.snapshot.paramMap.get('id') ?? '0');
    this.entityKey.set(key);
    this.recordId.set(id);
    const schema = this.schemaService.getSchema(key);
    this.schema.set(schema);
    this.crudService.initStore(key);

    // Warm the linked clinical store too, so the derived lookup above can settle
    // regardless of which view navigated here.
    const encounterEntity = schema?.entity.encounterEntity;
    if (encounterEntity) this.crudService.initStore(encounterEntity);
  }

  navigateEdit() {
    const id = this.record()?.['id'];
    if (id != null) this.router.navigate(['/app/entity', this.entityKey(), id, 'edit']);
  }

  confirmDelete() { this.deleteModal.set(true); }
  cancelDelete() { this.deleteModal.set(false); }
  executeDelete() {
    const id = this.record()?.['id'];
    if (id != null) {
      this.crudService.delete(this.entityKey(), id);
      this.router.navigate(['/app/entity', this.entityKey()]);
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
