import {
  Component, inject, signal, computed, ViewChild, ElementRef, OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { OnboardingService } from '../../services/onboarding.service';

interface ExtraProf {
  nombre: string;
  rut: string;
  especialidad: string;
  telefono: string;
  photoPreview: string | null;
  photoFile: File | null;
  errors: Record<string, string>;
}

const ESPECIALIDADES = [
  'Medicina General', 'Pediatría', 'Ginecología y Obstetricia', 'Cardiología',
  'Dermatología', 'Traumatología y Ortopedia', 'Neurología', 'Psiquiatría',
  'Psicología', 'Kinesiología', 'Fonoaudiología', 'Nutrición y Dietética',
  'Odontología', 'Oftalmología', 'Urología', 'Gastroenterología',
  'Otorrinolaringología', 'Reumatología', 'Endocrinología', 'Anestesiología',
  'Medicina del Deporte', 'Geriatría', 'Medicina Interna', 'Otra especialidad'
];

const DIAS = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' }
];

function validateRutFormat(rut: string): boolean {
  const clean = rut.replace(/[.\-\s]/g, '').toUpperCase();
  if (clean.length < 2 || !/^\d+[0-9K]$/.test(clean)) return false;
  const body = clean.slice(0, -1);
  const dv   = clean.slice(-1);
  let sum = 0, mul = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const rem = sum % 11;
  const expected = rem === 0 ? '0' : rem === 1 ? 'K' : String(11 - rem);
  return dv === expected;
}

@Component({
    selector: 'app-onboarding',
    imports: [CommonModule, FormsModule],
    templateUrl: './onboarding.component.html',
    styleUrl: './onboarding.component.scss'
})
export class OnboardingComponent implements OnInit {
  private auth         = inject(AuthService);
  private router       = inject(Router);
  private http         = inject(HttpClient);
  private onboardingSvc = inject(OnboardingService);

  @ViewChild('photoInputRef') photoInputRef!: ElementRef<HTMLInputElement>;

  readonly especialidades = ESPECIALIDADES;
  readonly dias = DIAS;

  // ── Primary professional ───────────────────────────────────────────────────
  nombre       = signal('');
  rut          = signal('');
  especialidad = signal('');
  telefono     = signal('');
  duracion     = signal<number>(45);
  videoconsulta = signal(false);
  diasDisponibles = signal<number[]>([1, 2, 3, 4, 5]);
  photoPreview = signal<string | null>(null);
  photoFile    = signal<File | null>(null);
  errors       = signal<Record<string, string>>({});

  // ── Extra professionals (max 4) ────────────────────────────────────────────
  extraProfs = signal<ExtraProf[]>([]);
  readonly MAX_EXTRA = 4;

  // ── UI ──────────────────────────────────────────────────────────────────────
  saving   = signal(false);
  dragOver = signal(false);

  userName = computed(() => this.auth.user()?.name ?? '');

  ngOnInit(): void {
    const name = this.auth.user()?.name ?? '';
    this.nombre.set(name);
  }

  // ── Photo ──────────────────────────────────────────────────────────────────

  onPhotoChange(event: Event, profIndex?: number): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    (event.target as HTMLInputElement).value = '';
    this.setPhoto(file, profIndex);
  }

  onPhotoDrop(event: DragEvent, profIndex?: number): void {
    event.preventDefault();
    this.dragOver.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) this.setPhoto(file, profIndex);
  }

  private setPhoto(file: File, profIndex?: number): void {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target!.result as string;
      if (profIndex === undefined) {
        this.photoFile.set(file);
        this.photoPreview.set(base64);
      } else {
        this.extraProfs.update(list =>
          list.map((p, i) => i === profIndex ? { ...p, photoFile: file, photoPreview: base64 } : p)
        );
      }
    };
    reader.readAsDataURL(file);
  }

  removePhoto(profIndex?: number): void {
    if (profIndex === undefined) {
      this.photoFile.set(null);
      this.photoPreview.set(null);
    } else {
      this.extraProfs.update(list =>
        list.map((p, i) => i === profIndex ? { ...p, photoFile: null, photoPreview: null } : p)
      );
    }
  }

  // ── Days toggle ────────────────────────────────────────────────────────────

  toggleDia(value: number): void {
    this.diasDisponibles.update(days =>
      days.includes(value) ? days.filter(d => d !== value) : [...days, value]
    );
  }

  isDiaSelected(value: number): boolean {
    return this.diasDisponibles().includes(value);
  }

  // ── Extra professionals ────────────────────────────────────────────────────

  addExtraProf(): void {
    if (this.extraProfs().length >= this.MAX_EXTRA) return;
    this.extraProfs.update(list => [
      ...list,
      { nombre: '', rut: '', especialidad: '', telefono: '', photoPreview: null, photoFile: null, errors: {} }
    ]);
  }

  removeExtraProf(i: number): void {
    this.extraProfs.update(list => list.filter((_, idx) => idx !== i));
  }

  updateExtraField(i: number, field: keyof ExtraProf, value: string): void {
    this.extraProfs.update(list =>
      list.map((p, idx) => idx === i ? { ...p, [field]: value, errors: {} } : p)
    );
  }

  // ── Validation ─────────────────────────────────────────────────────────────

  private validate(): boolean {
    const errs: Record<string, string> = {};

    if (!this.nombre().trim() || this.nombre().trim().length < 2) {
      errs['nombre'] = 'El nombre es requerido (mínimo 2 caracteres)';
    }
    if (!this.rut().trim()) {
      errs['rut'] = 'El RUT es requerido';
    } else if (!validateRutFormat(this.rut())) {
      errs['rut'] = 'RUT inválido. Formato: 12.345.678-9 o K';
    }
    if (!this.especialidad()) {
      errs['especialidad'] = 'Selecciona una especialidad';
    }

    this.errors.set(errs);

    // Validate extra profs
    let extraValid = true;
    this.extraProfs.update(list =>
      list.map(p => {
        const pErrs: Record<string, string> = {};
        if (!p.nombre.trim() || p.nombre.trim().length < 2)
          pErrs['nombre'] = 'Nombre requerido';
        if (!p.rut.trim())
          pErrs['rut'] = 'RUT requerido';
        else if (!validateRutFormat(p.rut))
          pErrs['rut'] = 'RUT inválido';
        if (!p.especialidad)
          pErrs['especialidad'] = 'Especialidad requerida';
        if (Object.keys(pErrs).length > 0) extraValid = false;
        return { ...p, errors: pErrs };
      })
    );

    return Object.keys(errs).length === 0 && extraValid;
  }

  // ── Submit / skip ──────────────────────────────────────────────────────────

  async save(): Promise<void> {
    if (!this.validate()) return;
    this.saving.set(true);

    try {
      const formData = new FormData();
      formData.append('nombre', this.nombre().trim());
      formData.append('rut', this.rut().trim());
      formData.append('especialidad', this.especialidad());
      formData.append('telefono', this.telefono().trim());
      formData.append('duracion', String(this.duracion()));
      formData.append('videoconsulta', String(this.videoconsulta()));
      formData.append('diasDisponibles', JSON.stringify(this.diasDisponibles()));
      if (this.photoFile()) {
        formData.append('photo', this.photoFile()!);
      }

      const extras = this.extraProfs().map((p, i) => {
        const obj: Record<string, any> = {
          nombre: p.nombre.trim(), rut: p.rut.trim(),
          especialidad: p.especialidad, telefono: p.telefono.trim()
        };
        if (p.photoFile) formData.append(`photo_extra_${i}`, p.photoFile);
        return obj;
      });
      formData.append('extraProfessionals', JSON.stringify(extras));

      await firstValueFrom(this.http.post('/api/professionals/onboarding', formData));
    } catch {
      // Backend endpoint may not exist yet; proceed anyway
    }

    this.saving.set(false);
    this.proceed();
  }

  skip(): void {
    this.proceed();
  }

  private proceed(): void {
    const user = this.auth.user();
    if (user) this.onboardingSvc.markComplete(user.id);
    this.router.navigate(['/app/import'], { queryParams: { from: 'onboarding' } });
  }

  // ── Formatters ─────────────────────────────────────────────────────────────

  formatRut(event: Event): void {
    const input = event.target as HTMLInputElement;
    let val = input.value.replace(/[^0-9kK]/g, '');
    if (val.length > 1) {
      const dv   = val.slice(-1);
      const body = val.slice(0, -1);
      let fmt    = '';
      let count  = 0;
      for (let i = body.length - 1; i >= 0; i--) {
        fmt = body[i] + fmt;
        count++;
        if (count % 3 === 0 && i !== 0) fmt = '.' + fmt;
      }
      val = fmt + '-' + dv.toUpperCase();
    }
    this.rut.set(val);
    input.value = val;
  }

  formatExtraRut(event: Event, i: number): void {
    const input = event.target as HTMLInputElement;
    let val = input.value.replace(/[^0-9kK]/g, '');
    if (val.length > 1) {
      const dv   = val.slice(-1);
      const body = val.slice(0, -1);
      let fmt    = '';
      let count  = 0;
      for (let j = body.length - 1; j >= 0; j--) {
        fmt = body[j] + fmt;
        count++;
        if (count % 3 === 0 && j !== 0) fmt = '.' + fmt;
      }
      val = fmt + '-' + dv.toUpperCase();
    }
    this.updateExtraField(i, 'rut', val);
    input.value = val;
  }
}
