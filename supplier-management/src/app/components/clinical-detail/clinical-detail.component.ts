import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SchemaService } from '../../services/schema.service';
import { GenericCrudService } from '../../services/generic-crud.service';
import { FieldDefinition } from '../../models/entity-schema.model';
import { ChatService, ChatUser } from '../../services/chat.service';

interface VitalSign {
  label: string;
  value: string;
  unit: string;
  normal: string;
  field: FieldDefinition;
}

interface SectionField {
  label: string;
  value: any;
  field: FieldDefinition;
}

@Component({
  selector: 'app-clinical-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './clinical-detail.component.html',
  styleUrl: './clinical-detail.component.scss'
})
export class ClinicalDetailComponent {
  private route     = inject(ActivatedRoute);
  private schemaSvc = inject(SchemaService);
  private crudSvc   = inject(GenericCrudService);
  protected chatSvc = inject(ChatService);

  readonly entityKey = this.route.snapshot.paramMap.get('entityKey')!;
  readonly id        = Number(this.route.snapshot.paramMap.get('id')!);
  readonly schema    = this.schemaSvc.getSchema(this.entityKey);

  readonly record = computed(() => {
    const data = this.crudSvc.getAll(this.entityKey)();
    return data.find(r => r['id'] === this.id) ?? null;
  });

  readonly patient = computed(() => {
    const r = this.record();
    if (!r || !this.schema) return null;

    const get = (name: string) => r[name] ?? null;
    const statusField = this.schema.fields.find(f => f.name === 'status');
    const btField     = this.schema.fields.find(f => f.name === 'bloodType');
    const insField    = this.schema.fields.find(f => f.name === 'insurance');
    const statusVal   = get('status');
    const btVal       = get('bloodType');
    const insVal      = get('insurance');

    return {
      fullName:     String(get('fullName') ?? ''),
      patientId:    String(get('patientId') ?? ''),
      rut:          String(get('rut') ?? ''),
      birthDate:    String(get('birthDate') ?? ''),
      age:          Number(get('age') ?? 0),
      gender:       this.schema.fields.find(f=>f.name==='gender')?.options?.find(o=>o.value===get('gender'))?.label ?? '',
      statusLabel:  statusField?.options?.find(o => o.value === statusVal)?.label ?? '',
      statusColor:  statusField?.badgeColors?.[statusVal] ?? '#6b7280',
      bloodType:    String(btVal ?? ''),
      bloodTypeColor: btField?.badgeColors?.[btVal] ?? '#6b7280',
      insurance:    insField?.options?.find(o => o.value === insVal)?.label ?? '',
      insuranceColor: insField?.badgeColors?.[insVal] ?? '#6b7280',
      doctor:       String(get('doctor') ?? ''),
      lastVisit:    String(get('lastVisit') ?? ''),
      phone:        String(get('phone') ?? ''),
      email:        String(get('email') ?? ''),
      address:      String(get('address') ?? ''),
      emergencyContact: String(get('emergencyContact') ?? '')
    };
  });

  readonly alerts = computed(() => {
    const r = this.record();
    if (!r || !this.schema) return { allergies: [] as string[], contraindications: '', alertNotes: '' };
    const allergies = r['allergies'];
    return {
      allergies:        Array.isArray(allergies) ? allergies as string[] : [],
      contraindications: String(r['contraindications'] ?? ''),
      alertNotes:        String(r['alertNotes'] ?? '')
    };
  });

  readonly hasAlerts = computed(() => {
    const a = this.alerts();
    return a.allergies.length > 0 || a.contraindications || a.alertNotes;
  });

  private readonly VITAL_META: Record<string, { unit: string; normal: string }> = {
    bp:             { unit: 'mmHg',   normal: '< 120/80' },
    heartRate:      { unit: 'bpm',    normal: '60–100'   },
    temperature:    { unit: '°C',     normal: '36.1–37.2' },
    o2Saturation:   { unit: '%',      normal: '≥ 95'     },
    weight:         { unit: 'kg',     normal: '—'        },
    height:         { unit: 'cm',     normal: '—'        },
    bmi:            { unit: 'kg/m²',  normal: '18.5–24.9' },
    respiratoryRate:{ unit: 'rpm',    normal: '12–20'    }
  };

  readonly vitals = computed<VitalSign[]>(() => {
    const r = this.record();
    if (!r || !this.schema) return [];
    return this.schema.fields
      .filter(f => f.isVitalSign)
      .map(f => {
        const raw = r[f.name];
        const meta = this.VITAL_META[f.name] ?? { unit: '', normal: '—' };
        return {
          label: f.label,
          value: raw != null ? String(raw) : '—',
          unit:  meta.unit,
          normal: meta.normal,
          field: f
        };
      });
  });

  private readonly SOAP_LABELS: Record<string, { icon: string; color: string }> = {
    soapSubjective: { icon: 'S', color: '#6366f1' },
    soapObjective:  { icon: 'O', color: '#3b82f6' },
    soapAssessment: { icon: 'A', color: '#f59e0b' },
    soapPlan:       { icon: 'P', color: '#10b981' }
  };

  readonly soapItems = computed(() => {
    const r = this.record();
    if (!r || !this.schema) return [];
    return this.schema.fields
      .filter(f => f.section === 'soap')
      .map(f => ({
        label: f.label,
        value: String(r[f.name] ?? ''),
        meta:  this.SOAP_LABELS[f.name] ?? { icon: '?', color: '#6b7280' },
        field: f
      }))
      .filter(i => i.value);
  });

  readonly diagnosisCode  = computed(() => String(this.record()?.['diagnosisCode']  ?? ''));
  readonly diagnosisLabel = computed(() => String(this.record()?.['diagnosisLabel'] ?? ''));
  readonly differentialDx = computed(() => String(this.record()?.['differentialDx'] ?? ''));

  readonly historyFields = computed<SectionField[]>(() =>
    this.sectionFields('history')
  );

  readonly medicationFields = computed<SectionField[]>(() => {
    const r = this.record();
    if (!r || !this.schema) return [];
    const meds = String(r['currentMedications'] ?? '');
    const chronic = r['chronicConditions'];
    const result: SectionField[] = [];
    if (meds) result.push({ label: 'Medicamentos Actuales', value: meds, field: { name: 'currentMedications', type: 'textarea', label: 'Medicamentos Actuales' } });
    if (Array.isArray(chronic) && chronic.length > 0) result.push({ label: 'Condiciones Crónicas', value: chronic, field: { name: 'chronicConditions', type: 'tags', label: 'Condiciones Crónicas' } });
    return result;
  });

  private sectionFields(section: string): SectionField[] {
    const r = this.record();
    if (!r || !this.schema) return [];
    return this.schema.fields
      .filter(f => f.section === section && !f.isVitalSign && !f.isAlert)
      .map(f => ({ label: f.label, value: r[f.name], field: f }))
      .filter(sf => sf.value != null && sf.value !== '');
  }

  // ── Surgical interventions ────────────────────────────────────────────────

  readonly surgicalFields = computed(() => {
    const r = this.record();
    if (!r || !this.schema) return { history: '', planned: '' };
    return {
      history: String(r['surgicalHistory'] ?? ''),
      planned: String(r['plannedInterventions'] ?? '')
    };
  });

  readonly hasSurgical = computed(() => {
    const s = this.surgicalFields();
    return !!(s.history || s.planned);
  });

  // ── Documents tab ─────────────────────────────────────────────────────────

  readonly DOC_CATEGORIES = [
    { value: 'lab',       label: 'Laboratorio',      color: '#6366f1' },
    { value: 'imaging',   label: 'Imágenes',         color: '#3b82f6' },
    { value: 'referral',  label: 'Interconsulta',    color: '#f59e0b' },
    { value: 'report',    label: 'Informe',          color: '#10b981' },
    { value: 'consent',   label: 'Consentimiento',   color: '#8b5cf6' },
    { value: 'other',     label: 'Otro',             color: '#6b7280' }
  ] as const;

  readonly documents = signal<Array<{
    id: number;
    name: string;
    category: string;
    date: string;
    size: string;
    uploadedBy: string;
    notes: string;
  }>>([
    { id: 1, name: 'Hemograma completo 2026-03-24.pdf', category: 'lab',      date: '2026-03-24', size: '245 KB', uploadedBy: 'Dra. Morales', notes: 'Resultados control mensual' },
    { id: 2, name: 'Eco cardíaco Doppler 2026-03.pdf',  category: 'imaging',  date: '2026-03-10', size: '1.2 MB', uploadedBy: 'Dra. Morales', notes: 'Solicitud urgente por deterioro funcional' },
    { id: 3, name: 'Interconsulta Cardiología.pdf',     category: 'referral', date: '2026-02-28', size: '120 KB', uploadedBy: 'Dra. Morales', notes: '' },
    { id: 4, name: 'Consentimiento Informado Cx.pdf',   category: 'consent',  date: '2026-01-15', size: '88 KB',  uploadedBy: 'Dra. Morales', notes: 'Firmado por paciente y familiar' }
  ]);

  showUploadForm = signal(false);
  newDocName     = signal('');
  newDocCategory = signal('lab');
  newDocNotes    = signal('');
  private nextDocId = 5;

  docFilter = signal('');

  readonly filteredDocuments = computed(() => {
    const docs = this.documents();
    const f = this.docFilter();
    if (!f) return docs;
    return docs.filter(d =>
      d.category === f
    );
  });

  addDocument(): void {
    const name = this.newDocName().trim();
    if (!name) return;
    this.documents.update(docs => [...docs, {
      id: this.nextDocId++,
      name,
      category: this.newDocCategory(),
      date: new Date().toISOString().slice(0, 10),
      size: '—',
      uploadedBy: this.patient()?.doctor ?? 'Sistema',
      notes: this.newDocNotes().trim()
    }]);
    this.newDocName.set('');
    this.newDocNotes.set('');
    this.newDocCategory.set('lab');
    this.showUploadForm.set(false);
  }

  removeDocument(id: number): void {
    this.documents.update(docs => docs.filter(d => d.id !== id));
  }

  getCategoryMeta(value: string) {
    return this.DOC_CATEGORIES.find(c => c.value === value)
      ?? { value: 'other', label: 'Otro', color: '#6b7280' };
  }

  // ── Encounter history tab ─────────────────────────────────────────────────

  activeTab = signal<'record' | 'history' | 'documents'>('record');

  /**
   * Schema-driven: collects all fields with section === 'encounters'.
   * Each field value must be an array of objects (one per encounter).
   * The frontend makes no assumptions about which keys exist — it renders
   * whatever the backend provides.
   */
  readonly encounterHistory = computed<Record<string, any>[]>(() => {
    const r = this.record();
    if (!r || !this.schema) return [];

    const encounters = this.schema.fields
      .filter(f => f.section === 'encounters')
      .flatMap(f => {
        const val = r[f.name];
        return Array.isArray(val) ? (val as Record<string, any>[]) : [];
      });

    return encounters.sort((a, b) => {
      const dateKey = Object.keys(a).find(k => /date|fecha/i.test(k));
      if (!dateKey) return 0;
      return String(b[dateKey]).localeCompare(String(a[dateKey]));
    });
  });

  /** Converts camelCase key to human-readable label when no schema label exists. */
  formatKey(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, s => s.toUpperCase())
      .trim();
  }

  /** Returns non-null, non-empty entries of an encounter object. */
  encounterEntries(enc: Record<string, any>): [string, any][] {
    return Object.entries(enc).filter(([, v]) => v != null && v !== '');
  }

  /** Checks if a key looks like a primary date field. */
  isDateKey(key: string): boolean {
    return /date|fecha/i.test(key);
  }

  isArray(val: any): val is any[] {
    return Array.isArray(val);
  }

  // ── Prescription print ────────────────────────────────────────────────────

  readonly today = new Date();

  /**
   * Schema-driven: finds the first field with isPrescription === true.
   * Returns its label and value so the print tab renders whatever the backend defined.
   */
  readonly prescriptionField = computed(() => {
    const r = this.record();
    if (!r || !this.schema) return null;
    const f = this.schema.fields.find(fd => fd.isPrescription);
    if (!f) return null;
    const val = String(r[f.name] ?? '').trim();
    return val ? { label: f.label, value: val } : null;
  });

  openPrescriptionTab(): void {
    const p  = this.patient();
    const rx = this.prescriptionField();
    if (!p || !rx) return;

    const dateStr = new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Receta Médica — ${p.fullName}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Georgia,'Times New Roman',serif;font-size:14px;color:#1a1a1a;background:#fff;padding:40px;max-width:760px;margin:0 auto}
    .hint{font-family:-apple-system,sans-serif;font-size:12px;color:#6b7280;text-align:center;margin-bottom:28px;padding:10px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb}
    .letterhead{text-align:center;padding-bottom:14px}
    .clinic-name{font-size:20px;font-weight:700;letter-spacing:1px;text-transform:uppercase}
    .clinic-sub{font-size:13px;color:#555;margin-top:4px}
    hr{border:none;border-top:1px solid #aaa;margin:14px 0}
    .section-label{font-size:10px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#6b7280;margin-bottom:10px}
    .patient-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px 24px;margin-bottom:6px}
    .patient-row{display:flex;gap:8px;font-size:13px}
    .field-label{font-weight:700;min-width:72px;color:#444;flex-shrink:0}
    .rx-body{font-family:Georgia,serif;font-size:15px;line-height:1.85;white-space:pre-wrap;padding:10px 0 24px}
    .footer{margin-top:56px;display:flex;justify-content:flex-end}
    .sig-box{text-align:center;min-width:200px}
    .sig-line{border-top:1px solid #333;margin-bottom:8px;height:48px}
    .sig-name{font-size:13px;font-weight:700}
    .sig-sub{font-size:11px;color:#666;margin-top:2px}
    @media print{.hint{display:none}body{padding:20mm}}
  </style>
</head>
<body>
  <p class="hint">Usa Ctrl+P / Cmd+P para imprimir o guardar como PDF</p>
  <div class="letterhead">
    <div class="clinic-name">Clínica — Sistema Médico</div>
    <div class="clinic-sub">${p.doctor}</div>
  </div>
  <hr/>
  <div class="section-label">Datos del Paciente</div>
  <div class="patient-grid">
    <div class="patient-row"><span class="field-label">Nombre:</span><span>${p.fullName}</span></div>
    <div class="patient-row"><span class="field-label">RUT:</span><span>${p.rut}</span></div>
    <div class="patient-row"><span class="field-label">Edad:</span><span>${p.age} años</span></div>
    <div class="patient-row"><span class="field-label">Previsión:</span><span>${p.insurance}</span></div>
    <div class="patient-row"><span class="field-label">Fecha:</span><span>${dateStr}</span></div>
  </div>
  <hr/>
  <div class="section-label">${rx.label}</div>
  <pre class="rx-body">${rx.value}</pre>
  <div class="footer">
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-name">${p.doctor}</div>
      <div class="sig-sub">Firma y Timbre</div>
    </div>
  </div>
</body>
</html>`;

    const tab = window.open('', '_blank');
    if (tab) { tab.document.write(html); tab.document.close(); }
  }

  // ── Share record ──────────────────────────────────────────────────────────

  showShare      = signal(false);
  shareMessage   = signal('');
  shareSelected  = signal<Set<number>>(new Set());
  shareSuccess   = signal(false);

  /** All users except the currently logged-in one */
  readonly shareContacts: ChatUser[] = this.chatSvc.allUsers.filter(
    u => u.id !== (this.chatSvc as any).auth?.user()?.id
  );

  /** Lazy-evaluated to handle auth not ready at construction time */
  get availableContacts(): ChatUser[] {
    const meId = this.chatSvc.getContacts().length; // forces recalculation through service
    return this.chatSvc.getContacts();
  }

  toggleShareUser(id: number): void {
    this.shareSelected.update(s => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  isShareSelected(id: number): boolean {
    return this.shareSelected().has(id);
  }

  shareRecord(): void {
    const r = this.record();
    const p = this.patient();
    if (!r || !p || this.shareSelected().size === 0) return;

    const link = `#/clinical/${this.entityKey}/${this.id}`;
    const singular = this.schema?.entity.singular ?? 'Ficha';
    const extra = this.shareMessage().trim();
    const msg = [
      `📋 *${singular} compartida*`,
      `Paciente: ${p.fullName} · ${p.patientId}`,
      `Estado: ${p.statusLabel}`,
      extra ? `\n"${extra}"` : '',
      `→ Ver ficha: ${link}`
    ].filter(Boolean).join('\n');

    for (const userId of this.shareSelected()) {
      const convId = this.chatSvc.getDMId(userId);
      this.chatSvc.sendMessage(convId, msg);
    }

    this.shareSuccess.set(true);
    setTimeout(() => {
      this.showShare.set(false);
      this.shareSuccess.set(false);
      this.shareSelected.set(new Set());
      this.shareMessage.set('');
    }, 1800);
  }
}
