import { Component, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';

interface DemoAccount {
  email: string;
  password: string;
  role: string;
  name: string;
  access: string;
  color: string;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnDestroy {
  private fb     = inject(FormBuilder);
  private auth   = inject(AuthService);
  private router = inject(Router);
  private sub?: Subscription;

  loading  = signal(false);
  error    = signal('');
  showPass = signal(false);

  form = this.fb.group({
    email:    ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  readonly demoAccounts: DemoAccount[] = [
    { email: 'admin@clinica.com',   password: 'admin123',   role: 'Administrador', name: 'Admin General',   access: 'Proveedores · Productos · Cobros · Gastos', color: '#6366f1' },
    { email: 'compras@clinica.com', password: 'compras123', role: 'Manager',       name: 'Jefe de Compras', access: 'Proveedores · Productos · Gastos',           color: '#10b981' },
    { email: 'medico@clinica.com',  password: 'medico123',  role: 'Manager',       name: 'Dra. Morales',    access: 'Cobros',                                     color: '#ef4444' },
    { email: 'auditor@clinica.com', password: 'viewer123',  role: 'Viewer',        name: 'Auditor',         access: 'Proveedores · Cobros · Gastos',              color: '#f59e0b' }
  ];

  fill(account: DemoAccount) {
    this.form.patchValue({ email: account.email, password: account.password });
    this.error.set('');
  }

  togglePass() { this.showPass.update(v => !v); }

  ngOnDestroy() { this.sub?.unsubscribe(); }

  submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.loading.set(true);
    this.error.set('');

    const { email, password } = this.form.getRawValue();
    this.sub = this.auth.login({ email: email!, password: password! }).subscribe({
      next: response => {
        // Persist auth state then navigate — no page reload needed in Electron
        this.auth.handleAuthResponse(response);
        this.loading.set(false);
        this.router.navigate(['/dashboard']);
      },
      error: (err: Error) => {
        this.loading.set(false);
        this.error.set(err.message ?? 'Credenciales inválidas.');
      }
    });
  }

  isInvalid(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.invalid && ctrl.touched);
  }
}
