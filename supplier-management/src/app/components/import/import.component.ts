import {
  Component, inject, signal, computed, ChangeDetectionStrategy, OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { GenericCrudService } from '../../services/generic-crud.service';
import { OnboardingService } from '../../services/onboarding.service';
import { Workbook } from 'exceljs';
import { firstValueFrom } from 'rxjs';

// ── Types ─────────────────────────────────────────────────────────────────────

type TabType = 'patients' | 'appointments';

interface ParsedRow {
  index: number;
  data: Record<string, string>;
  errors: string[];
  status: 'pending' | 'importing' | 'done' | 'error';
  serverError?: string;
}

interface ColumnMap {
  excelCol: string;
  fieldKey: string;
  label: string;
  required: boolean;
}

// Known aliases for patient fields
const PATIENT_ALIASES: Record<string, string[]> = {
  name:      ['nombre completo', 'nombre', 'full name', 'name', 'paciente'],
  rut:       ['rut', 'run', 'dni', 'cedula', 'id'],
  email:     ['email', 'correo', 'e-mail', 'mail'],
  phone:     ['telefono', 'teléfono', 'phone', 'celular', 'movil', 'móvil', 'fono'],
  birthDate: ['fecha nacimiento', 'fecha de nacimiento', 'birth date', 'birthdate', 'nacimiento'],
  address:   ['direccion', 'dirección', 'address'],
};

// Known aliases for appointment fields
const APPOINTMENT_ALIASES: Record<string, string[]> = {
  patientName: ['paciente', 'nombre paciente', 'patient', 'patient name'],
  date:        ['fecha', 'date', 'día', 'dia'],
  time:        ['hora', 'time', 'horario'],
  duration:    ['duración', 'duracion', 'duration', 'minutos', 'minutes'],
  doctorName:  ['doctor', 'médico', 'medico', 'profesional', 'physician'],
  specialty:   ['especialidad', 'specialty'],
  reason:      ['motivo', 'reason', 'causa', 'descripcion', 'descripción'],
  status:      ['estado', 'status'],
  notes:       ['notas', 'notes', 'observaciones'],
};

const PATIENT_FIELDS = [
  { key: 'name',      label: 'Nombre Completo', required: true  },
  { key: 'rut',       label: 'RUT/ID',          required: false },
  { key: 'email',     label: 'Email',            required: false },
  { key: 'phone',     label: 'Teléfono',         required: false },
  { key: 'birthDate', label: 'Fecha Nacimiento', required: false },
  { key: 'address',   label: 'Dirección',        required: false },
];

const APPOINTMENT_FIELDS = [
  { key: 'patientName', label: 'Paciente',    required: true  },
  { key: 'date',        label: 'Fecha',       required: true  },
  { key: 'time',        label: 'Hora',        required: false },
  { key: 'duration',    label: 'Duración',    required: false },
  { key: 'doctorName',  label: 'Doctor',      required: false },
  { key: 'specialty',   label: 'Especialidad',required: false },
  { key: 'reason',      label: 'Motivo',      required: false },
  { key: 'status',      label: 'Estado',      required: false },
  { key: 'notes',       label: 'Notas',       required: false },
];

function matchColumn(header: string, aliases: Record<string, string[]>): string | null {
  const h = header.toLowerCase().trim();
  for (const [fieldKey, aliasList] of Object.entries(aliases)) {
    if (aliasList.some(a => h.includes(a) || a.includes(h))) return fieldKey;
  }
  return null;
}

@Component({
  selector: 'app-import',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './import.component.html',
  styleUrl: './import.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ImportComponent implements OnInit {
  private auth         = inject(AuthService);
  private crud         = inject(GenericCrudService);
  private route        = inject(ActivatedRoute);
  private router       = inject(Router);
  private onboardingSvc = inject(OnboardingService);

  fromOnboarding = signal(false);

  // ── Available entity keys ──────────────────────────────────────────────────

  // 'patients' in the BFF is skipAuth:true (always accessible). We enable the
  // patients import tab if the user has any clinical module that uses patients.
  patientKey = computed<string | null>(() => {
    const hasClinicalModule = this.auth.schemas().some(s =>
      /clinical|psych|dental|kinesi|nutri|fonoaudio|terapia|matrona/i.test(s.entity.key) ||
      s.entity.key === 'clinicalRecords'
    );
    return hasClinicalModule ? 'patients' : null;
  });

  appointmentKey = computed(() => {
    const s = this.auth.schemas().find(s =>
      /appointment|cita/i.test(s.entity.key) || s.entity.key === 'appointments'
    );
    return s?.entity.key ?? null;
  });

  availableTabs = computed<TabType[]>(() => {
    const tabs: TabType[] = [];
    if (this.patientKey()) tabs.push('patients');
    if (this.appointmentKey()) tabs.push('appointments');
    return tabs;
  });

  // ── State ──────────────────────────────────────────────────────────────────
  activeTab    = signal<TabType>('patients');
  dragging     = signal(false);
  parsedRows   = signal<ParsedRow[]>([]);
  columnMap    = signal<ColumnMap[]>([]);
  excelHeaders = signal<string[]>([]);
  fileName     = signal('');
  importing    = signal(false);
  importDone   = signal(false);
  doneCount    = signal(0);
  errorCount   = signal(0);
  parseError   = signal('');

  // ── Computed ───────────────────────────────────────────────────────────────
  validRows = computed(() => this.parsedRows().filter(r => r.errors.length === 0));
  invalidRows = computed(() => this.parsedRows().filter(r => r.errors.length > 0));
  doneRows  = computed(() => this.parsedRows().filter(r => r.status === 'done'));
  errorRows = computed(() => this.parsedRows().filter(r => r.status === 'error'));
  progress  = computed(() => {
    const total = this.parsedRows().length;
    if (!total) return 0;
    return Math.round(((this.doneRows().length + this.errorRows().length) / total) * 100);
  });

  currentFields = computed(() =>
    this.activeTab() === 'patients' ? PATIENT_FIELDS : APPOINTMENT_FIELDS
  );

  currentAliases = computed(() =>
    this.activeTab() === 'patients' ? PATIENT_ALIASES : APPOINTMENT_ALIASES
  );

  // ── Tab switch ─────────────────────────────────────────────────────────────
  switchTab(tab: TabType): void {
    this.activeTab.set(tab);
    this.reset();
  }

  reset(): void {
    this.parsedRows.set([]);
    this.columnMap.set([]);
    this.excelHeaders.set([]);
    this.fileName.set('');
    this.importing.set(false);
    this.importDone.set(false);
    this.doneCount.set(0);
    this.errorCount.set(0);
    this.parseError.set('');
  }

  // ── File input / drag-drop ─────────────────────────────────────────────────
  onFileInput(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.processFile(file);
    (event.target as HTMLInputElement).value = '';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  onDragLeave(): void { this.dragging.set(false); }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) this.processFile(file);
  }

  // ── Excel parsing ──────────────────────────────────────────────────────────
  private processFile(file: File): void {
    this.reset();
    this.parseError.set('');

    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      this.parseError.set('Formato no soportado. Usa .xlsx, .xls o .csv');
      return;
    }

    this.fileName.set(file.name);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const buffer = e.target!.result as ArrayBuffer;
        let raw: any[][] = [];

        if (file.name.match(/\.csv$/i)) {
          const text = new TextDecoder('utf-8').decode(buffer);
          raw = this.parseCSV(text);
        } else {
          const wb = new Workbook();
          await wb.xlsx.load(buffer);
          const ws = wb.getWorksheet(1);
          if (!ws) { this.parseError.set('El archivo está vacío.'); return; }
          ws.eachRow((row) => {
            const vals = (row.values as any[]).slice(1);
            raw.push(vals.map((v: any) => {
              if (v == null) return '';
              if (v instanceof Date) return v.toISOString().split('T')[0];
              if (typeof v === 'object' && 'text' in v) return String(v.text);
              if (typeof v === 'object' && 'result' in v) return String(v.result);
              return v;
            }));
          });
        }

        if (!raw.length) {
          this.parseError.set('El archivo está vacío.');
          return;
        }

        const headers = (raw[0] as any[]).map(h => String(h ?? '').trim());
        this.excelHeaders.set(headers);

        // Auto-map columns
        const aliases  = this.currentAliases();
        const mapping: ColumnMap[] = headers.map(h => {
          const matched = matchColumn(h, aliases);
          const field   = this.currentFields().find(f => f.key === matched);
          return {
            excelCol: h,
            fieldKey: matched ?? '',
            label:    field?.label ?? '',
            required: field?.required ?? false
          };
        });
        this.columnMap.set(mapping);

        // Parse rows (skip header row)
        const rows: ParsedRow[] = (raw.slice(1) as any[][])
          .filter(row => row.some(cell => String(cell ?? '').trim() !== ''))
          .map((row, i) => {
            const rowData: Record<string, string> = {};
            headers.forEach((h, idx) => {
              const map = mapping.find(m => m.excelCol === h);
              if (map?.fieldKey) {
                rowData[map.fieldKey] = String(row[idx] ?? '').trim();
              }
            });
            const errors = this.validateRow(rowData);
            return { index: i + 2, data: rowData, errors, status: 'pending' };
          });

        this.parsedRows.set(rows);
      } catch (err) {
        this.parseError.set('Error al leer el archivo. Verifica que sea un Excel válido.');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  private parseCSV(text: string): any[][] {
    return text.split(/\r?\n/).filter(l => l.trim()).map(line => {
      const cells: string[] = [];
      let cell = '', inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') { inQuotes = !inQuotes; }
        else if (line[i] === ',' && !inQuotes) { cells.push(cell.trim()); cell = ''; }
        else { cell += line[i]; }
      }
      cells.push(cell.trim());
      return cells;
    });
  }

  private validateRow(data: Record<string, string>): string[] {
    const errors: string[] = [];
    for (const field of this.currentFields()) {
      if (field.required && !data[field.key]?.trim()) {
        errors.push(`"${field.label}" es requerido`);
      }
    }
    return errors;
  }

  // ── Column mapping update ──────────────────────────────────────────────────
  updateMapping(excelCol: string, fieldKey: string): void {
    this.columnMap.update(map =>
      map.map(m => m.excelCol === excelCol
        ? { ...m, fieldKey, label: this.currentFields().find(f => f.key === fieldKey)?.label ?? '', required: this.currentFields().find(f => f.key === fieldKey)?.required ?? false }
        : m
      )
    );
    // Re-parse rows with new mapping
    this.reParse();
  }

  private reParse(): void {
    this.parsedRows.update(rows =>
      rows.map(r => ({ ...r, errors: this.validateRow(r.data), status: 'pending' as const }))
    );
  }

  // ── Import ─────────────────────────────────────────────────────────────────
  async startImport(): Promise<void> {
    const valid = this.validRows();
    if (!valid.length) return;

    const entityKey = this.activeTab() === 'patients'
      ? this.patientKey()
      : this.appointmentKey();
    if (!entityKey) return;

    this.importing.set(true);
    this.importDone.set(false);
    this.doneCount.set(0);
    this.errorCount.set(0);

    for (const row of valid) {
      this.parsedRows.update(rows =>
        rows.map(r => r.index === row.index ? { ...r, status: 'importing' } : r)
      );

      try {
        await this.createRecord(entityKey, row.data);
        this.parsedRows.update(rows =>
          rows.map(r => r.index === row.index ? { ...r, status: 'done' } : r)
        );
        this.doneCount.update(n => n + 1);
      } catch (err: any) {
        this.parsedRows.update(rows =>
          rows.map(r => r.index === row.index
            ? { ...r, status: 'error', serverError: err?.message ?? 'Error al guardar' }
            : r
          )
        );
        this.errorCount.update(n => n + 1);
      }

      // Small delay to avoid hammering the API
      await new Promise(res => setTimeout(res, 120));
    }

    this.importing.set(false);
    this.importDone.set(true);
  }

  private createRecord(key: string, data: Record<string, string>): Promise<Record<string, any>> {
    return firstValueFrom(this.crud.create(key, data));
  }

  // ── Template helpers ───────────────────────────────────────────────────────
  fieldOptions = computed(() => [
    { key: '', label: '— Ignorar columna —' },
    ...this.currentFields().map(f => ({ key: f.key, label: f.label + (f.required ? ' *' : '') }))
  ]);

  trackByIndex(_: number, row: ParsedRow): number { return row.index; }

  get previewHeaders(): string[] {
    return this.columnMap()
      .filter(m => !!m.fieldKey)
      .map(m => m.label || m.fieldKey);
  }

  previewCells(row: ParsedRow): string[] {
    return this.columnMap()
      .filter(m => !!m.fieldKey)
      .map(m => row.data[m.fieldKey] ?? '');
  }

  async downloadTemplate(): Promise<void> {
    const fields  = this.currentFields();
    const headers = fields.map(f => f.label + (f.required ? ' *' : ''));
    const wb = new Workbook();
    const ws = wb.addWorksheet('Plantilla');
    ws.addRow(headers);
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = this.activeTab() === 'patients' ? 'plantilla_pacientes.xlsx' : 'plantilla_citas.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  }

  ngOnInit(): void {
    if (this.route.snapshot.queryParamMap.get('from') === 'onboarding') {
      this.fromOnboarding.set(true);
    }
  }

  finishOnboarding(): void {
    const user = this.auth.user();
    if (user) this.onboardingSvc.markComplete(user.id);
    this.router.navigate(['/app/dashboard']);
  }
}
