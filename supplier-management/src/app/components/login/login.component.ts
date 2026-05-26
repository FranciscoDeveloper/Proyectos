import { Component, inject, signal, OnDestroy, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { OnboardingService } from '../../services/onboarding.service';

/**
 * Replace this with the Client ID from Google Cloud Console:
 * https://console.cloud.google.com/apis/credentials
 * Authorized origins must include http://localhost:4200 (dev) and your production domain.
 */
const GOOGLE_CLIENT_ID = '594136956378-r4ep9hdh9ivn4e72drfel8rmsqp4mrkg.apps.googleusercontent.com';

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
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './login.component.html',
    styleUrl: './login.component.scss'
})
export class LoginComponent implements AfterViewInit, OnDestroy {
  private fb           = inject(FormBuilder);
  private auth         = inject(AuthService);
  private onboarding   = inject(OnboardingService);
  private route        = inject(ActivatedRoute);
  private router       = inject(Router);
  private sub?: Subscription;
  private gsiRetries = 0;

  @ViewChild('googleBtnRef') googleBtnRef!: ElementRef<HTMLDivElement>;

  loading      = signal(false);
  error        = signal('');
  showPass     = signal(false);
  googleReady  = signal(false);

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

  ngAfterViewInit() {
    this.initGoogleSSO();
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  // ── Google SSO ─────────────────────────────────────────────────────────────

  private initGoogleSSO() {
    const g = (window as any)['google'];
    if (!g?.accounts?.id) {
      if (this.gsiRetries < 20) {
        this.gsiRetries++;
        setTimeout(() => this.initGoogleSSO(), 300);
      }
      return;
    }

    g.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response: { credential: string }) =>
        this.handleGoogleCredential(response.credential),
      auto_select: false,
      cancel_on_tap_outside: true
    });

    g.accounts.id.renderButton(this.googleBtnRef.nativeElement, {
      theme: 'outline',
      size: 'large',
      width: this.googleBtnRef.nativeElement.offsetWidth || 400,
      text: 'continue_with',
      shape: 'rectangular',
      logo_alignment: 'center'
    });

    this.googleReady.set(true);
  }

  private handleGoogleCredential(idToken: string) {
    this.loading.set(true);
    this.error.set('');

    this.sub = this.auth.loginWithGoogle(idToken).subscribe({
      next: response => {
        this.auth.handleAuthResponse(response);
        this.redirectAfterLogin();
      },
      error: (err: Error) => {
        this.loading.set(false);
        this.error.set(err.message);
      }
    });
  }

  // ── Email / password ───────────────────────────────────────────────────────

  fill(account: DemoAccount) {
    this.form.patchValue({ email: account.email, password: account.password });
    this.error.set('');
  }

  togglePass() { this.showPass.update(v => !v); }

  submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.loading.set(true);
    this.error.set('');

    const { email, password } = this.form.getRawValue();

    this.sub = this.auth.login({ email: email!, password: password! }).subscribe({
      next: response => {
        this.auth.handleAuthResponse(response);
        this.redirectAfterLogin();
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

  private redirectAfterLogin() {
    const raw      = this.route.snapshot.queryParamMap.get('returnUrl') ?? '';
    const hasReturn = raw && raw.startsWith('/') && !raw.startsWith('//') && raw !== '/';
    let target: string;

    if (hasReturn) {
      target = raw;
    } else {
      const user = this.auth.user();
      target = (user && this.onboarding.needsOnboarding(user.id))
        ? '/onboarding'
        : '/app/dashboard';
    }

    window.location.href = '/?_=' + Date.now() + '#' + target;
  }
}
