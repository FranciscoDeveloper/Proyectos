import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';

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
export class RegisterComponent {
  private fb   = inject(FormBuilder);
  private http = inject(HttpClient);

  showPass      = signal(false);
  showConfirm   = signal(false);
  showTerms     = signal(false);
  submitted      = signal(false);
  loading        = signal(false);
  serverError    = signal('');
  emailSent      = signal(true);
  activationUrl  = signal('');

  form = this.fb.group({
    nombre:          ['', [Validators.required, Validators.minLength(2)]],
    apellidos:       ['', [Validators.required, Validators.minLength(2)]],
    email:           ['', [Validators.required, Validators.email]],
    telefono:        ['', [Validators.required, Validators.pattern(/^\+?[\d\s\-]{7,15}$/)]],
    password:        ['', [Validators.required, passwordStrength]],
    confirmPassword: ['', [Validators.required]],
    termsAccepted:   [false, [Validators.requiredTrue]]
  }, { validators: passwordMatch });

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
    }).subscribe({
      next: (res: any) => {
        this.loading.set(false);
        this.activationUrl.set(res?.activationUrl ?? '');
        this.submitted.set(true);
        // Send email via public send-email Lambda (not blocked by VPC)
        if (res?.emailPayload) {
          this.http.post('/api/send-email', res.emailPayload).subscribe({
            next:  () => this.emailSent.set(true),
            error: () => this.emailSent.set(false)
          });
        } else {
          this.emailSent.set(res?.emailSent !== false);
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
}
