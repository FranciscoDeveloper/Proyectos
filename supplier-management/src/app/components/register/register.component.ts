import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { RouterLink } from '@angular/router';

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
  private fb = inject(FormBuilder);

  showPass      = signal(false);
  showConfirm   = signal(false);
  showTerms     = signal(false);
  submitted     = signal(false);
  loading       = signal(false);

  form = this.fb.group({
    nombre:          ['', [Validators.required, Validators.minLength(2)]],
    apellidos:       ['', [Validators.required, Validators.minLength(2)]],
    email:           ['', [Validators.required, Validators.email]],
    telefono:        ['', [Validators.required, Validators.pattern(/^\+?[\d\s\-]{7,15}$/)]],
    password:        ['', [Validators.required, Validators.minLength(8)]],
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
    setTimeout(() => {
      this.loading.set(false);
      this.submitted.set(true);
    }, 1400);
  }
}
