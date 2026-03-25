import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
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
export class LoginComponent {
  private fb      = inject(FormBuilder);
  private auth    = inject(AuthService);
  private router  = inject(Router);
  private route   = inject(ActivatedRoute);

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

  submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.loading.set(true);
    this.error.set('');

    const { email, password } = this.form.getRawValue();

    this.auth.login({ email: email!, password: password! }).subscribe({
      next: (response) => {
        this.auth.handleAuthResponse(response);
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/dashboard';
        // Defer navigation one tick so Angular can process the *ngIf change in AppComponent
        // (the loginOutlet router-outlet is destroyed, the app-shell router-outlet is created)
        // before the router tries to render the target route.
        setTimeout(() => this.router.navigateByUrl(returnUrl));
      },
      error: (err: Error) => {
        this.loading.set(false);
        this.error.set(err.message);
      }
    });
  }

  isInvalid(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.invalid && ctrl.touched);
  }
}
