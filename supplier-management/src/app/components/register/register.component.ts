import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

function passwordMatch(ctrl: AbstractControl): ValidationErrors | null {
  const pass    = ctrl.get('password')?.value;
  const confirm = ctrl.get('confirmPassword')?.value;
  return pass && confirm && pass !== confirm ? { passwordMismatch: true } : null;
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent {
  private fb      = inject(FormBuilder);
  private authSvc = inject(AuthService);

  showPass      = signal(false);
  showConfirm   = signal(false);
  showTerms     = signal(false);
  submitted     = signal(false);
  loading       = signal(false);
  serverError   = signal('');

  form = this.fb.group({
    nombre:          ['', [Validators.required, Validators.minLength(2)]],
    apellidos:       ['', [Validators.required, Validators.minLength(2)]],
    email:           ['', [Validators.required, Validators.email]],
    telefono:        ['', [Validators.required, Validators.pattern(/^\+?[\d\s\-]{7,15}$/)]],
    password:        ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required]],
    termsAccepted:   [false, [Validators.requiredTrue]]
  }, { validators: passwordMatch });

  // ── Password strength ─────────────────────────────────────────────────────

  passwordStrength = computed((): { score: number; label: string; color: string } => {
    const v = this.form.get('password')?.value ?? '';
    if (!v) return { score: 0, label: '', color: '' };
    let score = 0;
    if (v.length >= 8)               score++;
    if (v.length >= 12)              score++;
    if (/[A-Z]/.test(v))             score++;
    if (/[0-9]/.test(v))             score++;
    if (/[^A-Za-z0-9]/.test(v))     score++;
    const map = [
      { score: 0, label: '',           color: '' },
      { score: 1, label: 'Muy débil',  color: '#ef4444' },
      { score: 2, label: 'Débil',      color: '#f97316' },
      { score: 3, label: 'Regular',    color: '#eab308' },
      { score: 4, label: 'Buena',      color: '#22c55e' },
      { score: 5, label: 'Muy fuerte', color: '#10b981' },
    ];
    return map[score] ?? map[4];
  });

  isInvalid(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.invalid && ctrl.touched);
  }

  get passwordMismatch(): boolean {
    return !!(this.form.hasError('passwordMismatch') && this.form.get('confirmPassword')?.touched);
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

  async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.loading.set(true);
    this.serverError.set('');

    const raw = this.form.getRawValue();
    try {
      await this.authSvc.register({
        nombre:    raw.nombre!,
        apellidos: raw.apellidos!,
        email:     raw.email!,
        telefono:  raw.telefono!,
        password:  raw.password!,
      });
      this.submitted.set(true);
    } catch (e: any) {
      this.serverError.set(e?.message ?? 'No se pudo crear la cuenta. Intenta nuevamente.');
    } finally {
      this.loading.set(false);
    }
  }
}
