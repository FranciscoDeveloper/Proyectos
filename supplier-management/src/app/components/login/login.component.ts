import { Component, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { WebAuthnService } from '../../services/webauthn.service';
import { CryptoService } from '../../services/crypto.service';

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
  styleUrl:    './login.component.scss'
})
export class LoginComponent implements OnDestroy {
  private fb       = inject(FormBuilder);
  private auth     = inject(AuthService);
  private route    = inject(ActivatedRoute);
  private webauthn = inject(WebAuthnService);
  private crypto   = inject(CryptoService);
  private sub?: Subscription;

  loading        = signal(false);
  error          = signal('');
  showPass       = signal(false);
  bioLoading     = signal(false);
  bioError       = signal('');
  showBioSuccess = signal(false);

  readonly bioSupported = this.webauthn.isSupported;

  form = this.fb.group({
    email:    ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  readonly demoAccounts: DemoAccount[] = [
    { email: 'admin@empresa.com',       password: 'admin123',   role: 'Administrador', name: 'Admin General',     access: 'Proveedores · Productos · Pacientes', color: '#6366f1' },
    { email: 'compras@empresa.com',     password: 'compras123', role: 'Manager',       name: 'Jefe de Compras',   access: 'Proveedores · Productos',             color: '#10b981' },
    { email: 'medico@hospital.com',     password: 'medico123',  role: 'Manager',       name: 'Dra. Morales',      access: 'Pacientes · Fichas Clínicas',          color: '#ef4444' },
    { email: 'auditor@empresa.com',     password: 'viewer123',  role: 'Viewer',        name: 'Auditor',           access: 'Proveedores (solo lectura)',           color: '#f59e0b' },
    { email: 'psicologia@clinica.com',  password: 'psico123',   role: 'Manager',       name: 'Ps. Carolina Vega', access: 'Sesiones · Fichas Psicológicas',       color: '#8b5cf6' },
    { email: 'odontologia@clinica.com', password: 'denti123',   role: 'Manager',       name: 'Dr. Ramírez',       access: 'Citas Dentales · Fichas Dentales',     color: '#14b8a6' }
  ];

  fill(account: DemoAccount) {
    this.form.patchValue({ email: account.email, password: account.password });
    this.error.set('');
    this.bioError.set('');
  }

  togglePass() { this.showPass.update(v => !v); }

  ngOnDestroy() { this.sub?.unsubscribe(); }

  // ── Password login ────────────────────────────────────────────────────────

  submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.loading.set(true);
    this.error.set('');

    const { email, password } = this.form.getRawValue();
    this.sub = this.auth.login({ email: email!, password: password! }).subscribe({
      next: (response) => {
        this.auth.handleAuthResponse(response);
        this._navigate();
      },
      error: (err: Error) => {
        this.loading.set(false);
        this.error.set(err.message ?? 'Credenciales inválidas.');
      }
    });
  }

  // ── Biometric login ───────────────────────────────────────────────────────

  async loginWithBiometric(): Promise<void> {
    const email = this.form.get('email')?.value?.trim();
    if (!email) {
      this.bioError.set('Ingresa tu email primero.');
      return;
    }

    this.bioLoading.set(true);
    this.bioError.set('');
    this.error.set('');

    const result = await this.webauthn.authenticate(email);

    if (!result.success || !result.authResponse) {
      this.bioLoading.set(false);
      this.bioError.set(result.error ?? 'Autenticación biométrica fallida.');
      return;
    }

    // Activate ZK key from PRF if available (no certificate needed)
    if (result.prfKey) {
      this.crypto.loadKeyFromPrf(result.prfKey);
    }

    this.auth.handleAuthResponse(result.authResponse);
    this.bioLoading.set(false);
    this._navigate();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  isInvalid(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.invalid && ctrl.touched);
  }

  private _navigate(): void {
    const raw    = this.route.snapshot.queryParamMap.get('returnUrl') ?? '';
    const target = (raw && raw.startsWith('/') && !raw.startsWith('//') && raw !== '/')
      ? raw : '/app/dashboard';
    window.location.href = '/?_=' + Date.now() + '#' + target;
  }
}
