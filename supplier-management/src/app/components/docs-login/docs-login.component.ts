import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

/**
 * Dedicated login screen for /docs. Documentation used to be fully public;
 * accessing it now requires a session, entered here rather than through the
 * main app's login page — a different interface only. Authentication itself
 * is identical: same AuthService.login(), same POST /api/auth/login, same
 * JWT. Any authenticated account can read the docs; this isn't a new
 * permission tier, just an access gate (see docsAuthGuard).
 */
@Component({
    selector: 'app-docs-login',
    imports: [CommonModule, ReactiveFormsModule, RouterLink],
    templateUrl: './docs-login.component.html',
    styleUrl: './docs-login.component.scss'
})
export class DocsLoginComponent {
  private fb    = inject(FormBuilder);
  private auth  = inject(AuthService);
  private route = inject(ActivatedRoute);

  loading  = signal(false);
  error    = signal('');
  showPass = signal(false);

  form = this.fb.group({
    email:    ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  togglePass(): void {
    this.showPass.update(v => !v);
  }

  isInvalid(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.invalid && ctrl.touched);
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.loading.set(true);
    this.error.set('');

    const { email, password } = this.form.getRawValue();

    this.auth.login({ email: email!, password: password! }).subscribe({
      next: response => {
        this.auth.handleAuthResponse(response);
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/docs';
        // Hash-routing reload, same mechanism login.component.ts uses — a plain
        // router.navigate() here would leave stale auth-dependent state (e.g.
        // interceptor token) from before the login in some edge cases.
        window.location.href = '/?_=' + Date.now() + '#' + returnUrl;
      },
      error: (err: Error) => {
        this.loading.set(false);
        this.error.set(err.message ?? 'Credenciales inválidas.');
      }
    });
  }
}
