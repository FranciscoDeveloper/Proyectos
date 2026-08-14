import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';

interface ProfessionalOption {
  id: number;
  nombre: string;
  especialidad: string | null;
}

// Etiqueta de conversión de Google Ads para el registro — misma etiqueta para
// Starter (gratis) y Pro, ambos cuentan como la misma conversión en Ads.
// gtag.js ya se carga globalmente en index.html (config AW-736089910); esto solo
// dispara el evento de conversión puntual, en el punto donde el registro realmente
// se completó con éxito — no en el clic crudo del botón, para no contar como
// conversión un intento que falló por validación o error del servidor.
const GADS_SIGNUP_CONVERSION = 'AW-736089910/i6FKCKmSmtwcELau_94C';

function passwordMatch(ctrl: AbstractControl): ValidationErrors | null {
  const pass    = ctrl.get('password')?.value;
  const confirm = ctrl.get('confirmPassword')?.value;
  return pass && confirm && pass !== confirm ? { passwordMismatch: true } : null;
}

function passwordStrength(ctrl: AbstractControl): ValidationErrors | null {
  const v = ctrl.value ?? '';
  const errors: ValidationErrors = {};
  if (v.length < 8)              errors['minLength']  = true;
  if (!/[A-Z]/.test(v))          errors['uppercase']  = true;
  if (!/[a-z]/.test(v))          errors['lowercase']  = true;
  if (!/\d/.test(v))             errors['number']     = true;
  if (!/[^A-Za-z0-9]/.test(v))  errors['special']    = true;
  return Object.keys(errors).length ? errors : null;
}

@Component({
    selector: 'app-register',
    imports: [CommonModule, ReactiveFormsModule, RouterLink],
    templateUrl: './register.component.html',
    styleUrl: './register.component.scss'
})
export class RegisterComponent implements OnInit {
  private fb    = inject(FormBuilder);
  private http  = inject(HttpClient);
  private route = inject(ActivatedRoute);

  // ?plan=agenda → free Starter plan (agenda-only access, see handleRegister in lambda-auth)
  readonly isFreePlan = this.route.snapshot.queryParamMap.get('plan') === 'agenda';

  showPass      = signal(false);
  showConfirm   = signal(false);
  showTerms     = signal(false);
  submitted      = signal(false);
  loading        = signal(false);
  serverError    = signal('');
  emailSent      = signal(true);
  activationUrl  = signal('');

  // Pro plan only: no self-serve way (yet) to provision a real professional record,
  // so the signup captures which existing professional/specialty it's for — an admin
  // finishes real account setup manually afterward (see the distinct activation
  // message this produces, in lambda-auth's handleActivateDairi).
  //
  // Esto ERA un <select> con las 9 especialidades del directorio
  // `dairi-professionals`. Ya no: los registros nuevos son de psicología y de
  // psicología solamente, en línea con la landing. La entrada de psicología se
  // sigue tomando del MISMO endpoint (/api/auth/professionals) y no de un id
  // escrito a mano: si mañana cambia el id 2 en DynamoDB, esto sigue apuntando
  // a la fila correcta en vez de romperse en silencio.
  //
  // Las cuentas ya creadas bajo otras especialidades (odontología, medicina
  // general, kinesiología…) no se tocan: esto solo afecta el alta nueva. El
  // backend tampoco cambió — sigue recibiendo un professionalId válido y
  // validándolo contra la misma tabla.
  private psychologist = signal<ProfessionalOption | null>(null);

  /** Etiqueta fija que ve el usuario donde antes estaba el desplegable. */
  readonly specialtyLabel = computed(() => this.psychologist()?.especialidad ?? 'Psicología');

  /**
   * true cuando el directorio respondió pero no traía ninguna fila de
   * psicología (o la llamada falló). El control sigue vacío e inválido, así que
   * el submit queda bloqueado — es preferible a mandar un registro que el
   * backend rechazaría con "El profesional seleccionado no es válido".
   */
  readonly specialtyUnavailable = signal(false);

  form = this.fb.group({
    nombre:          ['', [Validators.required, Validators.minLength(2)]],
    apellidos:       ['', [Validators.required, Validators.minLength(2)]],
    email:           ['', [Validators.required, Validators.email]],
    telefono:        ['', [Validators.required, Validators.pattern(/^\+?[\d\s\-]{7,15}$/)]],
    password:        ['', [Validators.required, passwordStrength]],
    confirmPassword: ['', [Validators.required]],
    professionalId:  [null as number | null, this.isFreePlan ? [] : [Validators.required]],
    termsAccepted:   [false, [Validators.requiredTrue]]
  }, { validators: passwordMatch });

  ngOnInit(): void {
    if (this.isFreePlan) return;
    this.http.get<ProfessionalOption[]>('/api/auth/professionals').subscribe({
      next:  (list) => this.selectPsychology(list ?? []),
      error: () => this.specialtyUnavailable.set(true)
    });
  }

  /**
   * Elige la fila de psicología del directorio y la fija en el formulario.
   *
   * El match va contra `especialidad` y, como respaldo, contra `nombre`: en el
   * directorio actual ambos valen "Psicología" (la tabla es en la práctica un
   * catálogo de especialidades, no de personas), pero si alguien agrega un
   * profesional real con nombre propio, la especialidad sigue siendo el campo
   * confiable.
   *
   * Basta comparar el prefijo "psico" en minúsculas: el único acento de
   * "Psicología" cae en "logía", después del prefijo, así que no hace falta
   * normalizar tildes (y de paso "Psicologia" sin tilde también calza).
   */
  private selectPsychology(list: ProfessionalOption[]): void {
    const isPsy = (s: string | null) => (s ?? '').trim().toLowerCase().startsWith('psico');

    const match = list.find(p => isPsy(p.especialidad))
               ?? list.find(p => isPsy(p.nombre));

    if (!match) { this.specialtyUnavailable.set(true); return; }

    this.psychologist.set(match);
    this.specialtyUnavailable.set(false);
    this.form.get('professionalId')?.setValue(match.id);
  }

  isInvalid(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.invalid && ctrl.touched);
  }

  get passwordMismatch(): boolean {
    return !!(this.form.hasError('passwordMismatch') && this.form.get('confirmPassword')?.touched);
  }

  get passwordRules() {
    const ctrl = this.form.get('password');
    const v    = ctrl?.value ?? '';
    return {
      minLength: v.length >= 8,
      uppercase: /[A-Z]/.test(v),
      lowercase: /[a-z]/.test(v),
      number:    /\d/.test(v),
      special:   /[^A-Za-z0-9]/.test(v),
      touched:   !!ctrl?.touched,
    };
  }

  get passwordStrengthLevel(): 'weak' | 'medium' | 'strong' {
    const r = this.passwordRules;
    const passed = [r.minLength, r.uppercase, r.lowercase, r.number, r.special].filter(Boolean).length;
    if (passed <= 2) return 'weak';
    if (passed <= 4) return 'medium';
    return 'strong';
  }

  get registeredEmail(): string {
    return this.form.get('email')?.value ?? '';
  }

  togglePass()    { this.showPass.update(v => !v); }
  toggleConfirm() { this.showConfirm.update(v => !v); }

  openTerms(e: Event) {
    e.preventDefault();
    this.showTerms.set(true);
  }

  closeTerms() { this.showTerms.set(false); }

  acceptTerms() {
    this.form.get('termsAccepted')?.setValue(true);
    this.form.get('termsAccepted')?.markAsTouched();
    this.showTerms.set(false);
  }

  submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.loading.set(true);
    this.serverError.set('');

    const v = this.form.value;
    this.http.post('/api/auth/register', {
      nombre:    v.nombre,
      apellidos: v.apellidos,
      email:     v.email,
      telefono:  v.telefono,
      password:  v.password,
      ...(this.isFreePlan ? { plan: 'agenda' } : { professionalId: v.professionalId }),
    }).subscribe({
      next: (res: any) => {
        this.loading.set(false);
        this.activationUrl.set(res?.activationUrl ?? '');
        this.submitted.set(true);
        this.trackSignupConversion();
        // Send email via public send-email Lambda (not blocked by VPC)
        if (res?.emailPayload) {
          this.http.post('/api/send-email', res.emailPayload).subscribe({
            next:  () => this.emailSent.set(true),
            error: () => this.emailSent.set(false)
          });
        } else {
          this.emailSent.set(res?.emailSent !== false);
        }
        // Internal "new Pro signup" notification to contacto@dairi.cl — same
        // path as the activation email above (login can't send this itself,
        // it's VPC-attached with no route to invoke another Lambda directly).
        // Fire-and-forget: nothing in the UI depends on this succeeding.
        if (res?.notifyPayload) {
          this.http.post('/api/send-email', res.notifyPayload).subscribe({ error: () => {} });
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.serverError.set(
          err.error?.message ?? 'No se pudo crear la cuenta. Intenta nuevamente.'
        );
      },
    });
  }

  // gtag puede no existir si un bloqueador de anuncios impidió que cargara gtag.js —
  // no debe romper el flujo de registro si eso pasa.
  private trackSignupConversion(): void {
    (window as any).gtag?.('event', 'conversion', { send_to: GADS_SIGNUP_CONVERSION });
  }
}
