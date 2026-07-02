import { Component, signal, computed, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { CryptoService } from '../../services/crypto.service';

type ZkStep =
  | 'setup_passphrase'   // new user entering a passphrase
  | 'setup_codes'        // displaying recovery codes after setup
  | 'unlock_passphrase'  // page-reload passphrase prompt
  | 'unlock_recovery'    // recovery-code + new-passphrase form
  | 'migrate_file'       // v1 legacy user uploading old cert
  | 'migrate_passphrase' // v1 user setting new passphrase after file unlock
  | 'migrate_codes';     // displaying new codes after migration

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, FormsModule],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss'
})
export class ShellComponent {
  readonly auth      = inject(AuthService);
  readonly cryptoSvc = inject(CryptoService);

  sidebarOpen = signal(true);

  // ── ZK state machine ──────────────────────────────────────────────────────

  /** Current step in whichever ZK flow is active. Null means no banner shown. */
  zkStep = signal<ZkStep | null>(null);

  // Input fields (bound via ngModel)
  zkPassphrase        = signal('');
  zkPassphraseConfirm = signal('');
  zkRecoveryInput     = signal('');
  zkNewPassphrase     = signal('');

  // Async states
  zkWorking    = signal(false);
  zkError      = signal('');

  // Recovery codes to display (only in setup_codes / migrate_codes steps)
  zkCodes      = signal<string[]>([]);
  zkCodesCopied = signal(false);

  /** Initialise the step when the banner first becomes visible. */
  readonly zkBannerStep = computed<ZkStep | null>(() => {
    if (this.cryptoSvc.isReady()) return null;
    if (this.zkStep()) return this.zkStep();

    if (this.cryptoSvc.needsSetup())     { this.zkStep.set('setup_passphrase');   return 'setup_passphrase'; }
    if (this.cryptoSvc.needsMigration()) { this.zkStep.set('migrate_file');        return 'migrate_file'; }
    if (this.cryptoSvc.needsUnlock())    { this.zkStep.set('unlock_passphrase');   return 'unlock_passphrase'; }
    return null;
  });

  // ── Setup flow ────────────────────────────────────────────────────────────

  async setupZk(): Promise<void> {
    const pass = this.zkPassphrase().trim();
    if (!pass || pass.length < 8) {
      this.zkError.set('La contraseña debe tener al menos 8 caracteres.'); return;
    }
    if (pass !== this.zkPassphraseConfirm().trim()) {
      this.zkError.set('Las contraseñas no coinciden.'); return;
    }
    this.zkWorking.set(true);
    this.zkError.set('');
    try {
      const email = this.auth.user()?.email ?? '';
      const codes = await this.cryptoSvc.setup(email, pass);
      this.zkCodes.set(codes);
      this.zkPassphrase.set('');
      this.zkPassphraseConfirm.set('');
      this.zkStep.set('setup_codes');
    } catch {
      this.zkError.set('Error generando las claves. Intenta de nuevo.');
    } finally {
      this.zkWorking.set(false);
    }
  }

  doneWithCodes(): void {
    this.zkCodes.set([]);
    this.zkCodesCopied.set(false);
    this.zkStep.set(null);
  }

  // ── Unlock flow ───────────────────────────────────────────────────────────

  async unlockZk(): Promise<void> {
    const pass = this.zkPassphrase().trim();
    if (!pass) { this.zkError.set('Ingresa tu contraseña ZK.'); return; }
    this.zkWorking.set(true);
    this.zkError.set('');
    try {
      const ok = await this.cryptoSvc.unlockWithPassphrase(pass);
      if (ok) {
        this.zkPassphrase.set('');
        this.zkStep.set(null);
      } else {
        this.zkError.set('Contraseña incorrecta. Verifica e intenta de nuevo.');
      }
    } catch {
      this.zkError.set('Error descifrando. Intenta de nuevo.');
    } finally {
      this.zkWorking.set(false);
    }
  }

  showRecoveryForm(): void {
    this.zkPassphrase.set('');
    this.zkError.set('');
    this.zkRecoveryInput.set('');
    this.zkNewPassphrase.set('');
    this.zkStep.set('unlock_recovery');
  }

  backToPassphrase(): void {
    this.zkError.set('');
    this.zkStep.set('unlock_passphrase');
  }

  async unlockWithRecoveryCode(): Promise<void> {
    const code    = this.zkRecoveryInput().trim();
    const newPass = this.zkNewPassphrase().trim();
    if (!code) { this.zkError.set('Ingresa un código de recuperación.'); return; }
    if (newPass.length < 8) { this.zkError.set('La nueva contraseña debe tener al menos 8 caracteres.'); return; }

    this.zkWorking.set(true);
    this.zkError.set('');
    try {
      const newCodes = await this.cryptoSvc.unlockWithRecoveryCode(code, newPass);
      if (newCodes) {
        this.zkCodes.set(newCodes);
        this.zkRecoveryInput.set('');
        this.zkNewPassphrase.set('');
        this.zkStep.set('setup_codes'); // reuse codes display step
      } else {
        this.zkError.set('Código inválido o ya utilizado.');
      }
    } catch {
      this.zkError.set('Error al procesar el código. Intenta de nuevo.');
    } finally {
      this.zkWorking.set(false);
    }
  }

  // ── Migration flow (v1 → v2) ──────────────────────────────────────────────

  async onCertFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file) return;
    this.zkWorking.set(true);
    this.zkError.set('');
    try {
      const ok = await this.cryptoSvc.unlockWithCertificateV1(file);
      if (ok) {
        this.zkPassphrase.set('');
        this.zkPassphraseConfirm.set('');
        this.zkStep.set('migrate_passphrase');
      } else {
        this.zkError.set('Certificado inválido o no corresponde a esta cuenta.');
      }
    } catch {
      this.zkError.set('No se pudo leer el certificado.');
    } finally {
      this.zkWorking.set(false);
      input.value = '';
    }
  }

  async migratePassphrase(): Promise<void> {
    const pass = this.zkPassphrase().trim();
    if (pass.length < 8) { this.zkError.set('La contraseña debe tener al menos 8 caracteres.'); return; }
    if (pass !== this.zkPassphraseConfirm().trim()) { this.zkError.set('Las contraseñas no coinciden.'); return; }

    this.zkWorking.set(true);
    this.zkError.set('');
    try {
      const codes = await this.cryptoSvc.migrateToPassphrase(pass);
      this.zkCodes.set(codes);
      this.zkPassphrase.set('');
      this.zkPassphraseConfirm.set('');
      this.zkStep.set('migrate_codes');
    } catch {
      this.zkError.set('Error migrando las claves. Intenta de nuevo.');
    } finally {
      this.zkWorking.set(false);
    }
  }

  // ── Misc ──────────────────────────────────────────────────────────────────

  async copyAllCodes(): Promise<void> {
    const text = this.zkCodes().join('\n');
    try {
      await navigator.clipboard.writeText(text);
      this.zkCodesCopied.set(true);
    } catch { /* clipboard not available */ }
  }

  toggleSidebar() { this.sidebarOpen.update(v => !v); }
  logout() { this.auth.logout(); }
  getUserFirstName(): string { return this.auth.user()?.name?.split(' ')[0] ?? ''; }

  navItems = computed(() => {
    const schemas     = this.auth.schemas();
    const hasPayments = schemas.some(s => s.entity.key === 'payments');
    const hasRecords  = schemas.some(s => s.entity.key === 'clinical-records');
    return [
      { label: 'Dashboard', icon: 'grid',      route: '/app/dashboard' },
      ...schemas.map(s => ({
        label: s.entity.plural,
        icon: s.entity.icon,
        route: s.entity.moduleType === 'calendar'
          ? '/app/module/' + s.entity.key
          : s.entity.moduleType === 'clinical-record'
            ? '/app/clinical/' + s.entity.key
            : '/app/entity/' + s.entity.key
      })),
      ...(hasRecords  ? [{ label: 'Reportes',   icon: 'bar-chart',   route: '/app/reports'     }] : []),
      ...(hasPayments ? [{ label: 'Comisiones', icon: 'dollar-sign', route: '/app/commissions' }] : []),
      { label: 'Chat',      icon: 'chat',      route: '/app/chat'      }
    ];
  });
}
