import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { AuthService } from '../../services/auth.service';
import { DeleteAccountPanelComponent } from './delete-account-panel.component';

/**
 * Public account-deletion page — https://dairi.cl/#/eliminar-cuenta
 *
 * Why this exists separately from the in-app control at /app/cuenta:
 * Google Play's User Data policy requires apps that support account creation to
 * offer account deletion *both* in-app **and** through a "readily discoverable"
 * web resource that a person can reach **without installing the app** — the URL
 * is submitted in the Play Console's Data Safety form. An in-app-only control
 * satisfies Apple 5.1.1(v) but not Play.
 *
 * So this route is public (no guard of any kind) and self-contained: a visitor
 * who arrives from a browser with no session can read what deletion does, sign
 * in right here with the same /api/auth/login the app uses, and delete the
 * account without ever installing anything. A visitor who is already signed in
 * skips straight to the control.
 */
type PageState = 'auth' | 'ready' | 'done';

@Component({
  selector: 'app-delete-account',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, DeleteAccountPanelComponent],
  templateUrl: './delete-account.component.html',
  styleUrl: './delete-account.component.scss'
})
export class DeleteAccountComponent implements OnInit {
  private fb       = inject(FormBuilder);
  private titleSvc = inject(Title);
  private metaSvc  = inject(Meta);
  readonly auth    = inject(AuthService);

  state        = signal<PageState>('auth');
  loginLoading = signal(false);
  loginError   = signal('');
  showPass     = signal(false);

  loginForm = this.fb.group({
    email:    ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]]
  });

  ngOnInit(): void {
    this.titleSvc.setTitle('Eliminar mi cuenta — Dairi');
    this.metaSvc.updateTag({
      name: 'description',
      content: 'Solicita la eliminación de tu cuenta Dairi. Explica qué datos se eliminan, ' +
               'qué registros clínicos se conservan por obligación legal y cómo hacerlo desde la web.'
    });
    // This page must be indexable: Play reviewers (and users) need to be able to
    // find it from outside the app.
    this.metaSvc.updateTag({ name: 'robots', content: 'index, follow' });

    if (this.auth.isAuthenticated()) this.state.set('ready');
  }

  submitLogin(): void {
    if (this.loginForm.invalid) {
      this.loginError.set('Ingresa tu correo y contraseña.');
      return;
    }
    this.loginLoading.set(true);
    this.loginError.set('');

    const { email, password } = this.loginForm.value;
    this.auth.login({ email: email!, password: password! }).subscribe({
      next: (res) => {
        this.auth.handleAuthResponse(res);
        this.loginLoading.set(false);
        this.state.set('ready');
      },
      error: (err: Error) => {
        this.loginLoading.set(false);
        this.loginError.set(err.message);
      }
    });
  }

  onDeleted(): void {
    // The server-side session no longer exists, so drop the local one without
    // calling /api/auth/logout (guaranteed 401) and without the redirect to
    // /login that logout() performs — this page shows its own acknowledgment.
    this.auth.clearLocalSession();
    this.state.set('done');
  }
}
