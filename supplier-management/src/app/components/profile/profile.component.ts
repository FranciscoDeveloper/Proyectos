import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

type MfaView = 'idle' | 'setup' | 'confirm' | 'codes' | 'disable';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent {
  private auth      = inject(AuthService);
  private fb        = inject(FormBuilder);
  private sanitizer = inject(DomSanitizer);

  user = this.auth.user;

  // MFA state
  mfaView       = signal<MfaView>('idle');
  loading        = signal(false);
  error          = signal('');
  success        = signal('');
  qrUri          = signal<SafeUrl | null>(null);
  rawSecret      = signal('');
  recoveryCodes  = signal<string[]>([]);
  copiedCodes    = signal(false);

  confirmForm = this.fb.group({
    totpCode: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]]
  });

  disableForm = this.fb.group({
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  // ── Setup flow ──────────────────────────────────────────────────────────────

  startSetup() {
    this.error.set('');
    this.success.set('');
    this.loading.set(true);
    this.auth.mfaSetup().subscribe({
      next: res => {
        this.rawSecret.set(res.secret);
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(res.otpAuthUri)}`;
        this.qrUri.set(this.sanitizer.bypassSecurityTrustUrl(qrUrl));
        this.mfaView.set('setup');
        this.loading.set(false);
      },
      error: (err: Error) => {
        this.error.set(err.message);
        this.loading.set(false);
      }
    });
  }

  goToConfirm() {
    this.confirmForm.reset();
    this.error.set('');
    this.mfaView.set('confirm');
  }

  submitConfirm() {
    this.confirmForm.markAllAsTouched();
    if (this.confirmForm.invalid) return;

    this.loading.set(true);
    this.error.set('');

    const code = this.confirmForm.getRawValue().totpCode!.trim();
    this.auth.mfaConfirm(code).subscribe({
      next: res => {
        this.recoveryCodes.set(res.recoveryCodes);
        this.mfaView.set('codes');
        this.loading.set(false);
      },
      error: (err: Error) => {
        this.error.set(err.message);
        this.loading.set(false);
      }
    });
  }

  finishSetup() {
    this.mfaView.set('idle');
    this.success.set('Autenticación en dos pasos activada correctamente.');
    this.recoveryCodes.set([]);
    this.qrUri.set(null);
    this.rawSecret.set('');
  }

  copyCodes() {
    const text = this.recoveryCodes().join('\n');
    navigator.clipboard.writeText(text).then(() => {
      this.copiedCodes.set(true);
      setTimeout(() => this.copiedCodes.set(false), 2000);
    });
  }

  // ── Disable flow ────────────────────────────────────────────────────────────

  startDisable() {
    this.disableForm.reset();
    this.error.set('');
    this.success.set('');
    this.mfaView.set('disable');
  }

  submitDisable() {
    this.disableForm.markAllAsTouched();
    if (this.disableForm.invalid) return;

    this.loading.set(true);
    this.error.set('');

    const password = this.disableForm.getRawValue().password!;
    this.auth.mfaDisable(password).subscribe({
      next: () => {
        this.mfaView.set('idle');
        this.success.set('Autenticación en dos pasos desactivada.');
        this.loading.set(false);
      },
      error: (err: Error) => {
        this.error.set(err.message);
        this.loading.set(false);
      }
    });
  }

  cancel() {
    this.mfaView.set('idle');
    this.error.set('');
    this.confirmForm.reset();
    this.disableForm.reset();
  }
}
