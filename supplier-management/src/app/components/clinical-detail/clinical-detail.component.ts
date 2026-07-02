import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SchemaService } from '../../services/schema.service';
import { GenericCrudService } from '../../services/generic-crud.service';
import { FieldDefinition } from '../../models/entity-schema.model';
import { ChatService, ChatUser } from '../../services/chat.service';
import { AudioRecorderService } from '../../services/audio-recorder.service';
import { AuthService } from '../../services/auth.service';
import { OdontogramComponent, OdontogramData } from '../odontogram/odontogram.component';
import { PeriodontogramComponent, PeriodontogramData } from '../periodontogram/periodontogram.component';

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
  imports: [CommonModule, RouterLink, OdontogramComponent, PeriodontogramComponent],
  templateUrl: './clinical-detail.component.html',
  styleUrl: './clinical-detail.component.scss'
})
export class ClinicalDetailComponent {
  private route     = inject(ActivatedRoute);
  private schemaSvc = inject(SchemaService);
  private crudSvc   = inject(GenericCrudService);
  protected chatSvc = inject(ChatService);
  readonly recorder = inject(AudioRecorderService);
  readonly AudioRecorderService = AudioRecorderService;
  private auth = inject(AuthService);

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
      patientId:    '',
      rut:          String(get('rut') ?? ''),
      birthDate:    String(get('birthDate') ?? ''),
      age:          Number(get('age') ?? 0),
      gender:       this.schema.fields.find(f=>f.name==='gender')?.options?.find(o=>o.value===get('gender'))?.label ?? '',
      statusLabel:  statusField?.options?.find(o => o.value === statusVal)?.label ?? '',
      statusColor:  statusField?.badgeColors?.[statusVal] ?? '#6b7280',
      bloodType:    String(btVal ?? ''),
      bloodTypeColor: btField?.badgeColors?.[btVal] ?? '#6b7280',
      insurance:    insField?.options?.find(o => o.value === insVal)?.label ?? String(insVal ?? ''),
      insuranceColor: insField?.badgeColors?.[insVal] ?? '#6b7280',
      doctor:       String(get('doctorName') ?? get('doctor') ?? ''),
      lastVisit:    String(get('lastVisit') ?? ''),
      phone:        String(get('phone') ?? ''),
      email:        String(get('email') ?? ''),
      address:      String(get('address') ?? ''),
      emergencyContact: String(get('emergencyContact') ?? '')
    };
  });

  readonly specialty = computed<'medical' | 'psych' | 'dental' | 'kine' | 'nutrition' | 'fono' | 'ot' | 'midwife' | 'medtech'>(() => {
    switch (this.entityKey) {
      case 'dental-records':    return 'dental';
      case 'psych-records':     return 'psych';
      case 'kine-records':      return 'kine';
      case 'nutrition-records': return 'nutrition';
      case 'fono-records':      return 'fono';
      case 'ot-records':        return 'ot';
      case 'matrona-records':   return 'midwife';
      case 'tecnomed-records':  return 'medtech';
      default:                  return 'medical';
    }
  });

  readonly isPsychRecord = computed(() => this.specialty() === 'psych');
  readonly isNonMedical  = computed(() => this.specialty() !== 'medical');

  readonly professionalLabel = computed(() => {
    switch (this.specialty()) {
      case 'dental':    return 'Odontólogo/a';
      case 'psych':     return 'Psicólogo/a';
      case 'kine':      return 'Kinesiólogo/a';
      case 'nutrition': return 'Nutricionista';
      case 'fono':      return 'Fonoaudiólogo/a';
      case 'ot':        return 'Terapeuta Ocupacional';
      case 'midwife':   return 'Matrona/Matrón';
      case 'medtech':   return 'Tecnólogo Médico';
      default:          return 'Médico Tratante';
    }
  });

  readonly isMyPatient = computed(() => {
    const userName = this.auth.user()?.name;
    if (!userName) return false;
    return this.patient()?.doctor === userName;
  });

  readonly alerts = computed(() => {
    const r = this.record();
    if (!r || !this.schema) return {
      allergies: [] as string[], contraindications: '', alertNotes: '',
      allergyLabel: 'Alergias', contraindicationLabel: 'Contraindicaciones', alertNotesLabel: 'Notas de alerta'
    };
    const allergies = r['allergies'];
    return {
      allergies:            Array.isArray(allergies) ? allergies as string[] : [],
      contraindications:    String(r['contraindications'] ?? ''),
      alertNotes:           String(r['alertNotes'] ?? ''),
      allergyLabel:         this.schema.fields.find(f => f.name === 'allergies')?.label ?? 'Alergias',
      contraindicationLabel: this.schema.fields.find(f => f.name === 'contraindications')?.label ?? 'Contraindicaciones',
      alertNotesLabel:      this.schema.fields.find(f => f.name === 'alertNotes')?.label ?? 'Notas de alerta'
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
    const nonMedical = this.isNonMedical();
    return this.schema.fields
      .filter(f => f.isVitalSign)
      .map(f => {
        const raw = r[f.name];
        const meta = nonMedical
          ? { unit: '', normal: '' }
          : (this.VITAL_META[f.name] ?? { unit: '', normal: '—' });
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

  /** Uses the schema field label so each specialty shows its own term
   *  (e.g. "Plan de Tratamiento" for dental, "Diagnóstico diferencial" for others) */
  readonly differentialDxLabel = computed(() =>
    this.schema?.fields.find(f => f.name === 'differentialDx')?.label ?? 'Diagnóstico diferencial'
  );

  readonly historyFields = computed<SectionField[]>(() =>
    this.sectionFields('history')
  );

  readonly medicationFields = computed<SectionField[]>(() => {
    const bySection = this.sectionFields('medications');
    if (bySection.length > 0) return bySection;
    const r = this.record();
    if (!r || !this.schema) return [];
    const result: SectionField[] = [];
    const medsField = this.schema.fields.find(f => f.name === 'currentMedications');
    const chronicField = this.schema.fields.find(f => f.name === 'chronicConditions');
    const meds = String(r['currentMedications'] ?? '');
    const chronic = r['chronicConditions'];
    if (meds && medsField) result.push({ label: medsField.label, value: meds, field: medsField });
    if (Array.isArray(chronic) && chronic.length > 0 && chronicField) result.push({ label: chronicField.label, value: chronic, field: chronicField });
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
      uploadedBy: this.auth.user()?.name ?? this.patient()?.doctor ?? 'Sistema',
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

  activeTab = signal<'record' | 'history' | 'documents' | 'odontogram' | 'periodontogram'>('record');

  // ── Dental chart detection ────────────────────────────────────────────────

  readonly isDentalRecord = computed(() => this.specialty() === 'dental');

  readonly breadcrumbLabel = computed(() =>
    this.schema?.entity.plural ?? 'Fichas Clínicas'
  );

  readonly vitalsSectionTitle = computed(() => {
    switch (this.specialty()) {
      case 'dental':    return 'Examen Clínico';
      case 'psych':     return 'Estado Mental';
      case 'kine':      return 'Evaluación Funcional';
      case 'nutrition': return 'Evaluación Nutricional';
      case 'fono':      return 'Evaluación Fonoaudiológica';
      case 'ot':        return 'Evaluación Ocupacional';
      case 'midwife':   return 'Control Clínico';
      case 'medtech':   return 'Parámetros del Examen';
      default:          return 'Signos Vitales';
    }
  });

  readonly historySectionTitle = computed(() => {
    switch (this.specialty()) {
      case 'dental':    return 'Anamnesis Dental';
      case 'psych':     return 'Antecedentes Psicológicos';
      case 'kine':      return 'Antecedentes Kinésicos';
      case 'nutrition': return 'Anamnesis Alimentaria';
      case 'fono':      return 'Antecedentes Fonoaudiológicos';
      case 'ot':        return 'Antecedentes Ocupacionales';
      case 'midwife':   return 'Antecedentes Gíneco-Obstétricos';
      case 'medtech':   return 'Antecedentes del Paciente';
      default:          return 'Antecedentes Médicos';
    }
  });

  readonly surgicalSectionTitle = computed(() => {
    switch (this.specialty()) {
      case 'dental':    return 'Tratamientos Dentales';
      case 'psych':     return 'Terapias e Intervenciones';
      case 'kine':      return 'Intervenciones y Plan Kinésico';
      case 'nutrition': return 'Cirugías y Metas Nutricionales';
      case 'fono':      return 'Intervenciones Fonoaudiológicas';
      case 'ot':        return 'Intervenciones Terapéuticas';
      case 'midwife':   return 'Procedimientos Realizados';
      case 'medtech':   return 'Exámenes y Procedimientos';
      default:          return 'Intervenciones Quirúrgicas';
    }
  });

  readonly surgicalHistoryLabel = computed(() =>
    this.schema?.fields.find(f => f.name === 'surgicalHistory')?.label ?? 'Antecedentes Quirúrgicos'
  );

  readonly surgicalPlannedLabel = computed(() =>
    this.schema?.fields.find(f => f.name === 'plannedInterventions')?.label ?? 'Intervenciones Programadas'
  );

  readonly soapSectionTitle = computed(() => {
    switch (this.specialty()) {
      case 'dental':    return 'Nota de Atención Dental';
      case 'psych':     return 'Nota de Sesión';
      case 'kine':      return 'Nota Kinésica';
      case 'nutrition': return 'Nota Nutricional';
      case 'fono':      return 'Nota Fonoaudiológica';
      case 'ot':        return 'Nota de Terapia Ocupacional';
      case 'midwife':   return 'Nota de Control';
      case 'medtech':   return 'Registro del Examen';
      default:          return 'Nota Clínica (SOAP)';
    }
  });

  readonly newEncounterLabel = computed(() => {
    switch (this.specialty()) {
      case 'dental':    return 'Nueva Sesión Dental';
      case 'psych':     return 'Nueva Sesión';
      case 'kine':      return 'Nueva Sesión';
      case 'nutrition': return 'Nuevo Control';
      case 'fono':      return 'Nueva Sesión';
      case 'ot':        return 'Nueva Sesión';
      case 'midwife':   return 'Nuevo Control';
      case 'medtech':   return 'Nuevo Examen';
      default:          return 'Nueva Atención';
    }
  });

  readonly recordTabLabel = computed(() => {
    switch (this.specialty()) {
      case 'dental':    return 'Ficha Dental';
      case 'psych':     return 'Ficha Psicológica';
      case 'kine':      return 'Ficha Kinésica';
      case 'nutrition': return 'Ficha Nutricional';
      case 'fono':      return 'Ficha Fonoaudiológica';
      case 'ot':        return 'Ficha T.O.';
      case 'midwife':   return 'Ficha Obstétrica';
      case 'medtech':   return 'Ficha Tecnomédica';
      default:          return 'Ficha Clínica';
    }
  });

  readonly historyTabLabel = computed(() => {
    switch (this.specialty()) {
      case 'dental':    return 'Historial Dental';
      case 'psych':     return 'Historial de Sesiones';
      case 'kine':      return 'Historial de Sesiones';
      case 'nutrition': return 'Historial de Controles';
      case 'fono':      return 'Historial de Sesiones';
      case 'ot':        return 'Historial de Sesiones';
      case 'midwife':   return 'Historial de Controles';
      case 'medtech':   return 'Historial de Exámenes';
      default:          return 'Historial de Atenciones';
    }
  });

  readonly lastVisitLabel = computed(() =>
    this.schema?.fields.find(f => f.name === 'lastVisit')?.label ?? 'Última consulta'
  );

  readonly medicationSectionTitle = computed(() => {
    const fromSchema = this.schema?.fields.find(f => f.section === 'medications')?.label;
    if (fromSchema) return fromSchema;
    switch (this.specialty()) {
      case 'psych': return 'Medicación y Tratamiento';
      default:      return 'Medicación Actual';
    }
  });

  readonly prescriptionButtonLabel = computed(() => {
    switch (this.specialty()) {
      case 'psych':     return 'Imprimir Plan';
      case 'kine':      return 'Imprimir Indicaciones';
      case 'nutrition': return 'Imprimir Plan Alimentario';
      case 'fono':      return 'Imprimir Indicaciones';
      case 'ot':        return 'Imprimir Plan T.O.';
      case 'medtech':   return 'Imprimir Informe';
      default:          return 'Imprimir Receta';
    }
  });

  readonly encounterCountLabel = computed(() => {
    const n = this.encounterHistory().length;
    const sp = this.specialty();
    const [noun, nounPl] =
      sp === 'nutrition' || sp === 'midwife' ? ['control', 'controles'] :
      sp === 'medtech'                        ? ['examen',  'exámenes']  :
      sp === 'medical'                        ? ['atención', 'atenciones'] :
      ['sesión', 'sesiones'];
    return `${n} ${n !== 1 ? nounPl : noun} registrada${n !== 1 ? 's' : ''}`;
  });

  readonly encounterEmptyMsg = computed(() => {
    const sp = this.specialty();
    if (sp === 'psych' || sp === 'kine' || sp === 'fono' || sp === 'ot')
      return 'No hay sesiones registradas para este paciente.';
    if (sp === 'nutrition' || sp === 'midwife')
      return 'No hay controles registrados para este paciente.';
    if (sp === 'medtech')
      return 'No hay exámenes registrados para este paciente.';
    if (sp === 'dental')
      return 'No hay atenciones dentales registradas para este paciente.';
    return 'No hay atenciones registradas para este paciente.';
  });

  readonly odontogramData = computed<OdontogramData | null>(() => {
    const r = this.record();
    if (!r) return null;
    const raw = r['odontogram'];
    if (!raw || typeof raw !== 'object') return null;
    return raw as OdontogramData;
  });

  readonly periodontogramData = computed<PeriodontogramData | null>(() => {
    const r = this.record();
    if (!r) return null;
    const raw = r['periodontogram'];
    if (!raw || typeof raw !== 'object') return null;
    return raw as PeriodontogramData;
  });

  saveOdontogram(data: OdontogramData): void {
    this.crudSvc.update(this.entityKey, this.id, { odontogram: data });
  }

  savePeriodontogram(data: PeriodontogramData): void {
    this.crudSvc.update(this.entityKey, this.id, { periodontogram: data });
  }

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

  printBlocked = signal(false);

  private esc(s: string): string {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  openPrescriptionTab(): void {
    const p  = this.patient();
    const rx = this.prescriptionField();
    if (!p || !rx) return;

    this.printBlocked.set(false);

    const sp        = this.specialty();
    const profLabel = this.professionalLabel();
    const profName  = this.auth.user()?.name ?? p.doctor;
    const [docTitle, docType] = (() => {
      switch (sp) {
        case 'psych':     return [`Plan Terapéutico — ${p.fullName}`,      'PLAN TERAPÉUTICO'];
        case 'dental':    return [`Plan Dental — ${p.fullName}`,           'PLAN DENTAL'];
        case 'kine':      return [`Indicaciones Kinésicas — ${p.fullName}`, 'INDICACIONES KINÉSICAS'];
        case 'nutrition': return [`Plan Alimentario — ${p.fullName}`,      'PLAN ALIMENTARIO'];
        case 'fono':      return [`Indicaciones Fonoaudiológicas — ${p.fullName}`, 'INDICACIONES FONOAUDIOLÓGICAS'];
        case 'ot':        return [`Plan T.O. — ${p.fullName}`,             'PLAN TERAPIA OCUPACIONAL'];
        case 'medtech':   return [`Informe de Examen — ${p.fullName}`,     'INFORME DE EXAMEN'];
        default:          return [`Receta Médica — ${p.fullName}`,         'RECETA MÉDICA'];
      }
    })();
    const dateStr = new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${this.esc(docTitle)}</title>
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
    <div class="clinic-name">Dairi Clínica — ${this.esc(docType)}</div>
    <div class="clinic-sub">${this.esc(profLabel)}: ${this.esc(profName)}</div>
  </div>
  <hr/>
  <div class="section-label">Datos del Paciente</div>
  <div class="patient-grid">
    <div class="patient-row"><span class="field-label">Nombre:</span><span>${this.esc(p.fullName)}</span></div>
    <div class="patient-row"><span class="field-label">RUT:</span><span>${this.esc(p.rut)}</span></div>
    <div class="patient-row"><span class="field-label">Edad:</span><span>${this.esc(String(p.age))} años</span></div>
    <div class="patient-row"><span class="field-label">Previsión:</span><span>${this.esc(p.insurance)}</span></div>
    <div class="patient-row"><span class="field-label">Fecha:</span><span>${this.esc(dateStr)}</span></div>
  </div>
  <hr/>
  <div class="section-label">${this.esc(rx.label)}</div>
  <pre class="rx-body">${this.esc(rx.value)}</pre>
  <div class="footer">
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-name">${this.esc(profName)}</div>
      <div class="sig-sub">${this.esc(profLabel)} — Firma y Timbre</div>
    </div>
  </div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    const tab  = window.open(url, '_blank', 'noopener');
    if (!tab) {
      URL.revokeObjectURL(url);
      this.printBlocked.set(true);
    } else {
      // Allow time for the browser to load the blob before revoking
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    }
  }

  // ── Audio recording ───────────────────────────────────────────────────────

  toggleRecording(): void {
    if (this.recorder.isRecording) {
      this.recorder.stop();
    } else {
      const name = this.patient()?.fullName ?? 'paciente';
      this.recorder.start(name);
    }
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
      `Paciente: ${p.fullName} · ${p.rut}`,
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
