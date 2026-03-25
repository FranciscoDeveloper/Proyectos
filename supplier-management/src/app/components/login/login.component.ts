import { Component, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
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
  private sub?: Subscription;

  loading  = signal(false);
  error    = signal('');
  showPass = signal(false);

  form = this.fb.group({
    email:    ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  readonly demoAccounts: DemoAccount[] = [
    { email: 'admin@empresa.com',   password: 'admin123',   role: 'Administrador', name: 'Admin General',  access: 'Proveedores · Productos · Pacientes', color: '#6366f1' },
    { email: 'compras@empresa.com', password: 'compras123', role: 'Manager',       name: 'Jefe de Compras', access: 'Proveedores · Productos',            color: '#10b981' },
    { email: 'medico@hospital.com', password: 'medico123',  role: 'Manager',       name: 'Dra. Morales',   access: 'Pacientes',                           color: '#ef4444' },
    { email: 'auditor@empresa.com', password: 'viewer123',  role: 'Viewer',        name: 'Auditor',        access: 'Proveedores (solo lectura)',           color: '#f59e0b' }
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
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/dashboard';

    this.sub = this.auth.login({ email: email!, password: password! }).subscribe({
      next: (response) => {
        // 1. Persist auth state to sessionStorage BEFORE navigating
        this.auth.handleAuthResponse(response);

        // 2. Navigate via window.location — full page reload.
        //    This sidesteps any Angular Router timing issue in the static bundle
        //    (guard redirect chains, lazy-chunk scheduling, Zone.js scheduler).
        //    Angular reads sessionStorage on bootstrap and restores the session.
        const raw = this.route.snapshot.queryParamMap.get('returnUrl') ?? '';
        // Only trust returnUrl if it is an internal relative path
        const target = (raw && raw.startsWith('/') && !raw.startsWith('//') && raw !== '/')
          ? raw
          : '/dashboard';
        window.location.href = '/#' + target;
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
