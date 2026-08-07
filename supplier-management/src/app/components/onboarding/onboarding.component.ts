import {
  Component, inject, signal, computed, ViewChild, ElementRef, OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { CryptoService } from '../../services/crypto.service';
import { OnboardingService } from '../../services/onboarding.service';
import { ClinicLogoService } from '../../services/clinic-logo.service';

interface ExtraProf {
  nombre: string;
  rut: string;
  especialidad: string;
  telefono: string;
  photoPreview: string | null;
  photoFile: File | null;
  errors: Record<string, string>;
}

interface Specialty {
  value: string;
  label: string;
}

/**
 * Catálogo de especialidades: se carga desde GET /api/professionals/specialties,
 * que lee la tabla `professional_specialty` de RDS (migración 013) — la MISMA
 * fuente que usa el selector del registro Pro.
 *
 * Antes este componente tenía su propio array de 24 especialidades escritas a mano
 * ('Pediatría', 'Cardiología', 'Otra especialidad'…) que no coincidía con el
 * catálogo canónico de 9 valores ni con ningún otro punto de la app, así que la
 * especialidad elegida en el onboarding no era comparable con la del resto del
 * sistema. Este fallback existe sólo para que el formulario siga siendo usable si
 * la petición falla; refleja exactamente las filas de `professional_specialty`.
 */
const FALLBACK_ESPECIALIDADES: Specialty[] = [
  { value: 'medicina-general',    label: 'Medicina General' },
  { value: 'psicologia',          label: 'Psicología' },
  { value: 'odontologia',         label: 'Odontología' },
  { value: 'kinesiologia',        label: 'Kinesiología' },
  { value: 'nutricion',           label: 'Nutrición' },
  { value: 'fonoaudiologia',      label: 'Fonoaudiología' },
  { value: 'terapia-ocupacional', label: 'Terapia Ocupacional' },
  { value: 'matrona',             label: 'Matrona' },
  { value: 'tecnologia-medica',   label: 'Tecnología Médica' }
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
  private cryptoSvc   = inject(CryptoService);
  private clinicLogo  = inject(ClinicLogoService);

  @ViewChild('photoInputRef') photoInputRef!: ElementRef<HTMLInputElement>;

  especialidades = signal<Specialty[]>(FALLBACK_ESPECIALIDADES);
  readonly dias = DIAS;

  // ── Primary professional ───────────────────────────────────────────────────
  nombre       = signal('');
  rut          = signal('');
  especialidad = signal('');
  telefono     = signal('');
  duracion     = signal<number>(45);
  precioConsulta = signal<number | null>(null);
  videoconsulta = signal(false);
  diasDisponibles = signal<number[]>([1, 2, 3, 4, 5]);
  photoPreview = signal<string | null>(null);
  photoFile    = signal<File | null>(null);
  errors       = signal<Record<string, string>>({});

  /** Error de guardado a nivel de formulario. Antes el fallo del POST se tragaba
   *  en silencio y la UI avanzaba igual; ahora se muestra y NO se avanza. */
  saveError    = signal<string | null>(null);

  // ── Extra professionals (límite por plan) ──────────────────────────────────
  // Antes era `readonly MAX_EXTRA = 4` para todos. Ahora depende del plan de la
  // cuenta: Starter 1 profesional en total (0 adicionales), Pro 3 en total
  // (titular + 2). El servidor aplica el mismo límite en el endpoint de
  // onboarding, así que esto es UX, no la barrera real.
  extraProfs = signal<ExtraProf[]>([]);
  readonly maxExtra       = this.auth.maxExtraProfessionals;
  readonly maxTotalProfs  = this.auth.maxProfessionals;
  readonly isStarter      = this.auth.isStarterPlan;

  // ── Clinic logo (nivel cuenta) ─────────────────────────────────────────────
  // Reemplaza el texto "Dairi Clínica" en la papelería imprimible. Es de la
  // cuenta, no de un profesional, por eso vive aparte de photoFile/photoPreview.
  logoPreview = signal<string | null>(null);
  logoFile    = signal<File | null>(null);
  logoDragOver = signal(false);

  // ── UI ──────────────────────────────────────────────────────────────────────
  step     = signal<1 | 2>(1);
  saving   = signal(false);
  savingZk = signal(false);
  dragOver = signal(false);

  // ── Step 2: Security / ZK ──────────────────────────────────────────────────
  zkEnabled = signal(false);

  userName = computed(() => this.auth.user()?.name ?? '');

  ngOnInit(): void {
    const name = this.auth.user()?.name ?? '';
    this.nombre.set(name);
    this.loadSpecialties();
  }

  /** Catálogo canónico desde el servidor; ante fallo se conserva el fallback local. */
  private async loadSpecialties(): Promise<void> {
    try {
      const list = await firstValueFrom(
        this.http.get<Specialty[]>('/api/professionals/specialties')
      );
      if (Array.isArray(list) && list.length > 0) this.especialidades.set(list);
    } catch {
      // Se mantiene FALLBACK_ESPECIALIDADES — el formulario sigue usable.
    }
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

  // ── Clinic logo ────────────────────────────────────────────────────────────

  onLogoChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    (event.target as HTMLInputElement).value = '';
    this.setLogo(file);
  }

  onLogoDrop(event: DragEvent): void {
    event.preventDefault();
    this.logoDragOver.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) this.setLogo(file);
  }

  private setLogo(file: File): void {
    const reader = new FileReader();
    reader.onload = e => {
      this.logoFile.set(file);
      this.logoPreview.set(e.target!.result as string);
    };
    reader.readAsDataURL(file);
  }

  removeLogo(): void {
    this.logoFile.set(null);
    this.logoPreview.set(null);
  }

  /** Vacío ⇒ null (sin precio fijado ⇒ el backend cae al default), no 0. */
  setPrecio(raw: string): void {
    const trimmed = (raw ?? '').trim();
    this.precioConsulta.set(trimmed === '' ? null : Number(trimmed));
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
    if (this.extraProfs().length >= this.maxExtra()) return;
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
    const precio = this.precioConsulta();
    if (precio !== null && precio !== undefined) {
      if (!Number.isFinite(precio) || precio <= 0) {
        errs['precioConsulta'] = 'El precio debe ser mayor a 0';
      } else if (precio > 9999999) {
        errs['precioConsulta'] = 'El precio es demasiado alto';
      }
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

  /**
   * Sube una foto a S3 con el patrón de pre-signed URL que ya usa el módulo de
   * documentos de pacientes (documentsHandler.mjs): el backend firma una URL PUT,
   * el archivo va DIRECTO a S3 y sólo la `key` resultante viaja en el JSON.
   *
   * Se usa `fetch` y no HttpClient a propósito (igual que clinical-detail): la URL
   * firmada es absoluta y no debe pasar por el apiInterceptor, que le adosaría el
   * header Authorization y rompería la firma de S3.
   */
  private async uploadPhoto(file: File, kind: 'photo' | 'logo' = 'photo'): Promise<string> {
    const { url, key } = await firstValueFrom(
      this.http.post<{ url: string; key: string }>(
        '/api/professionals/photo-upload-url',
        { contentType: file.type, kind }
      )
    );
    const res = await fetch(url, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type }
    });
    if (!res.ok) throw new Error('No se pudo subir la foto');
    return key;
  }

  /**
   * Guarda el perfil profesional.
   *
   * Antes esta función hacía POST de un FormData a /api/professionals/onboarding —
   * un endpoint que NO existía en ninguna Lambda ni en API Gateway — y su catch
   * decía literalmente "Backend endpoint may not exist yet; proceed anyway": el
   * fallo se tragaba y la UI avanzaba al paso 2 como si hubiera guardado. Nada se
   * persistía nunca. Ahora el endpoint existe (dairi-bff), el envío es JSON, las
   * fotos van por pre-signed URL, y un fallo se muestra y DETIENE el avance.
   */
  async save(): Promise<void> {
    this.saveError.set(null);
    if (!this.validate()) return;

    // Cuentas Starter: no hay nada que guardar server-side. Viven 100% en
    // DynamoDB y el BFF las bloquea con 403 antes de cualquier ruta Postgres
    // (index.mjs), así que este POST NO puede tener éxito jamás — su "profesional"
    // es la propia cuenta en dairi-agenda-accounts, siempre exactamente uno.
    // Antes esto dejaba al usuario Starter atrapado en el paso 1 con un error de
    // guardado del que no podía salir. Se avanza sin llamar al backend.
    if (this.isStarter()) {
      this.step.set(2);
      return;
    }

    this.saving.set(true);

    try {
      // 1. Fotos primero: si algo falla acá no se escribe nada en la base.
      let photoKey: string | null = null;
      if (this.photoFile()) photoKey = await this.uploadPhoto(this.photoFile()!);

      let clinicLogoKey: string | null = null;
      if (this.logoFile()) clinicLogoKey = await this.uploadPhoto(this.logoFile()!, 'logo');

      const extras = [];
      for (const p of this.extraProfs()) {
        extras.push({
          nombre:       p.nombre.trim(),
          rut:          p.rut.trim(),
          especialidad: p.especialidad,
          telefono:     p.telefono.trim(),
          photoKey:     p.photoFile ? await this.uploadPhoto(p.photoFile) : null
        });
      }

      // 2. Perfil completo como JSON.
      await firstValueFrom(this.http.post('/api/professionals/onboarding', {
        nombre:            this.nombre().trim(),
        rut:               this.rut().trim(),
        especialidad:      this.especialidad(),
        telefono:          this.telefono().trim(),
        duracion:          this.duracion(),
        consultationPrice: this.precioConsulta(),
        videoconsulta:     this.videoconsulta(),
        diasDisponibles:   this.diasDisponibles(),
        photoKey,
        clinicLogoKey,
        extraProfessionals: extras
      }));

      // El logo cacheado en memoria quedó obsoleto si se acaba de subir uno.
      if (clinicLogoKey) this.clinicLogo.reset();

      this.saving.set(false);
      this.step.set(2);
    } catch (err: any) {
      this.saving.set(false);

      // Errores de validación por campo devueltos por el backend.
      const serverErrors = err?.error?.errors;
      if (serverErrors && typeof serverErrors === 'object') {
        this.errors.set({ ...this.errors(), ...serverErrors });
      }
      this.saveError.set(
        err?.error?.message ??
        'No se pudo guardar tu perfil profesional. Revisa tu conexión e inténtalo de nuevo.'
      );
    }
  }

  skip(): void {
    this.step.set(2);
  }

  async saveZkAndProceed(): Promise<void> {
    this.savingZk.set(true);
    let enabled = this.zkEnabled();
    try {
      // The certificate is generated BEFORE zkEnabled is persisted. The previous
      // order flipped the server flag first, so if the certificate never reached
      // the user (which it never did on native — the blob download was a silent
      // no-op in a WebView) the account was left marked ZK-enabled with no key
      // in existence anywhere.
      if (enabled) {
        const email = this.auth.user()?.email ?? '';
        const delivered = await this.cryptoSvc.generateAndDownloadCertificate(email);
        if (!delivered) {
          enabled = false;
          this.zkEnabled.set(false);
          alert(
            'No se pudo guardar el certificado, así que el cifrado no fue activado.\n\n' +
            'Puedes activarlo más tarde desde la configuración.'
          );
        }
      }
      await firstValueFrom(this.http.patch('/api/user/config', {
        zkEnabled: enabled,
        onboardingCompleted: true
      }));
      this.auth.updateZkEnabled(enabled);
    } catch {
      // proceed even if config save fails
    }
    this.savingZk.set(false);
    this.proceed();
  }

  skipZk(): void {
    this.proceed();
  }

  /**
   * Cierra el onboarding. Marca la finalización en el SERVIDOR además de la caché
   * local: antes sólo se escribía localStorage, así que limpiar el navegador o
   * entrar desde otro dispositivo re-disparaba el onboarding. El PATCH es
   * best-effort — si falla, la caché local igual evita el bucle en este navegador
   * y el guard reintentará la consulta en el próximo.
   */
  private proceed(): void {
    const user = this.auth.user();
    if (user) this.onboardingSvc.markCompleteLocally(user.id);

    firstValueFrom(
      this.http.patch('/api/user/config', { onboardingCompleted: true })
    ).catch(() => { /* best-effort */ });

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
