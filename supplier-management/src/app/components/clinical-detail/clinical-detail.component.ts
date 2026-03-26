import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SchemaService } from '../../services/schema.service';
import { GenericCrudService } from '../../services/generic-crud.service';
import { FieldDefinition } from '../../models/entity-schema.model';

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
}
