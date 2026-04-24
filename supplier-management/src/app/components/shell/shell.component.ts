import { Component, signal, computed, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { CryptoService } from '../../services/crypto.service';
import { WebAuthnService } from '../../services/webauthn.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss'
})
export class ShellComponent {
  readonly auth      = inject(AuthService);
  readonly cryptoSvc = inject(CryptoService);
  readonly webauthn  = inject(WebAuthnService);

  sidebarOpen = signal(true);

  // ZK setup state (certificate flow)
  zkSetting   = signal(false);

  // ZK unlock state (certificate upload)
  zkUnlocking = signal(false);
  zkCertError = signal(false);

  // WebAuthn registration
  bioRegistering    = signal(false);
  bioRegisterError  = signal('');
  bioRegisterOk     = signal(false);

  // WebAuthn biometric re-unlock (after page reload)
  bioUnlocking      = signal(false);
  bioUnlockError    = signal('');

  toggleSidebar() { this.sidebarOpen.update(v => !v); }
  logout()        { this.auth.logout(); }

  getUserFirstName(): string {
    return this.auth.user()?.name?.split(' ')[0] ?? '';
  }

  // ── Certificate-based ZK setup ────────────────────────────────────────────

  async setupZk(): Promise<void> {
    const email = this.auth.user()?.email ?? '';
    if (!email) return;
    this.zkSetting.set(true);
    try {
      await this.cryptoSvc.generateAndDownloadCertificate(email);
    } finally {
      this.zkSetting.set(false);
    }
  }

  async onCertFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file) return;
    this.zkUnlocking.set(true);
    this.zkCertError.set(false);
    const ok = await this.cryptoSvc.unlockWithCertificate(file);
    this.zkUnlocking.set(false);
    if (!ok) this.zkCertError.set(true);
    input.value = '';
  }

  // ── WebAuthn fingerprint registration ─────────────────────────────────────

  async registerBiometric(): Promise<void> {
    const email = this.auth.user()?.email ?? '';
    const name  = this.auth.user()?.name  ?? 'Mi dispositivo';
    if (!email) return;

    this.bioRegistering.set(true);
    this.bioRegisterError.set('');
    this.bioRegisterOk.set(false);

    const result = await this.webauthn.register(email, name);

    if (!result.success) {
      this.bioRegistering.set(false);
      this.bioRegisterError.set(result.error ?? 'Error al registrar biometría.');
      return;
    }

    // If PRF was supported, ZK key is now active — no certificate needed
    if (result.prfKey) {
      this.cryptoSvc.loadKeyFromPrf(result.prfKey);
    }

    this.bioRegistering.set(false);
    this.bioRegisterOk.set(true);
    setTimeout(() => this.bioRegisterOk.set(false), 4000);
  }

  // ── WebAuthn biometric re-unlock (after page reload) ─────────────────────

  async unlockWithBiometric(): Promise<void> {
    const email = this.auth.user()?.email ?? '';
    if (!email) return;

    this.bioUnlocking.set(true);
    this.bioUnlockError.set('');

    const result = await this.webauthn.authenticate(email);

    if (!result.success) {
      this.bioUnlocking.set(false);
      this.bioUnlockError.set(result.error ?? 'Autenticación biométrica fallida.');
      return;
    }

    if (result.prfKey) {
      this.cryptoSvc.loadKeyFromPrf(result.prfKey);
    }
    this.bioUnlocking.set(false);
  }

  // ── Nav ───────────────────────────────────────────────────────────────────

  navItems = computed(() => {
    const schemas     = this.auth.schemas();
    const hasPayments = schemas.some(s => s.entity.key === 'payments');
    const hasRecords  = schemas.some(s => s.entity.key === 'clinical-records');
    return [
      { label: 'Dashboard', icon: 'grid',      route: '/app/dashboard' },
      ...schemas.map(s => ({
        label: s.entity.plural,
        icon:  s.entity.icon,
        route: s.entity.moduleType === 'calendar'
          ? '/app/module/' + s.entity.key
          : s.entity.moduleType === 'clinical-record'
            ? '/app/clinical/' + s.entity.key
            : '/app/entity/' + s.entity.key
      })),
      ...(hasRecords  ? [{ label: 'Reportes',   icon: 'bar-chart',   route: '/app/reports'     }] : []),
      ...(hasPayments ? [{ label: 'Comisiones', icon: 'dollar-sign', route: '/app/commissions' }] : []),
      { label: 'Chat', icon: 'chat', route: '/app/chat' }
    ];
  });
}
