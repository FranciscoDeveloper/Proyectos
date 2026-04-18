import { Component, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
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
  private fb    = inject(FormBuilder);
  private auth  = inject(AuthService);
  private route = inject(ActivatedRoute);
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
    { email: 'admin@empresa.com',        password: 'admin123',   role: 'Administrador', name: 'Admin General',       access: 'Proveedores · Productos · Pacientes', color: '#6366f1' },
    { email: 'compras@empresa.com',      password: 'compras123', role: 'Manager',       name: 'Jefe de Compras',     access: 'Proveedores · Productos',             color: '#10b981' },
    { email: 'medico@hospital.com',      password: 'medico123',  role: 'Manager',       name: 'Dra. Morales',        access: 'Pacientes · Fichas Clínicas',          color: '#ef4444' },
    { email: 'auditor@empresa.com',      password: 'viewer123',  role: 'Viewer',        name: 'Auditor',             access: 'Proveedores (solo lectura)',           color: '#f59e0b' },
    { email: 'psicologia@clinica.com',   password: 'psico123',   role: 'Manager',       name: 'Ps. Carolina Vega',   access: 'Sesiones · Fichas Psicológicas',       color: '#8b5cf6' },
    { email: 'odontologia@clinica.com',  password: 'denti123',   role: 'Manager',       name: 'Dr. Ramírez',         access: 'Citas Dentales · Fichas Dentales',     color: '#14b8a6' }
  ];

  fill(account: DemoAccount) {
    this.form.patchValue({ email: account.email, password: account.password });
    this.error.set('');
  }

  togglePass() { this.showPass.update(v => !v); }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.loading.set(true);
    this.error.set('');

    const { email, password } = this.form.getRawValue();
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/app/dashboard';

    this.sub = this.auth.login({ email: email!, password: password! }).subscribe({
      next: (response) => {
        this.auth.handleAuthResponse(response);
        const raw    = this.route.snapshot.queryParamMap.get('returnUrl') ?? '';
        const target = (raw && raw.startsWith('/') && !raw.startsWith('//') && raw !== '/')
          ? raw
          : '/app/dashboard';
        window.location.href = '/?_=' + Date.now() + '#' + target;
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
