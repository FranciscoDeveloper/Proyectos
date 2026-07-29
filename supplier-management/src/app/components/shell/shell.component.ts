import { Component, signal, computed, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { CryptoService } from '../../services/crypto.service';

@Component({
    selector: 'app-shell',
    imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
    templateUrl: './shell.component.html',
    styleUrl: './shell.component.scss'
})
export class ShellComponent {
  readonly auth      = inject(AuthService);
  readonly cryptoSvc = inject(CryptoService);

  sidebarOpen = signal(true);

  // ZK setup state
  zkSetting   = signal(false);

  // ZK unlock state (certificate upload)
  zkUnlocking  = signal(false);
  zkCertError  = signal(false);

  toggleSidebar() { this.sidebarOpen.update(v => !v); }

  logout() { this.auth.logout(); }

  getUserFirstName(): string {
    return this.auth.user()?.name?.split(' ')[0] ?? '';
  }

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
    if (!ok) {
      this.zkCertError.set(true);
    }
    // Reset the file input so the same file can be re-selected if needed
    input.value = '';
  }

  navItems = computed(() => {
    const schemas        = this.auth.schemas();
    const hasPayments    = schemas.some(s => s.entity.key === 'payments');
    const hasRecords     = schemas.some(s =>
      s.entity.key === 'clinical-records' ||
      s.entity.key === 'clinicalRecords'  ||
      s.entity.moduleType === 'clinical-record'
    );
    // Matching on "appointment" here used to also match the Starter/agenda plan's
    // sole module (key: "appointments"), incorrectly showing "Importar" and
    // "Presupuestos" to accounts that only have a calendar and no patient/clinical
    // module at all. Both features require actual patient/clinical-record access
    // (hasRecords) — Pro/Enterprise schemas don't literally contain "patient" as a
    // key (e.g. "clinicalRecords"), so gate on hasRecords instead of a key substring.
    const hasImportable  = hasRecords;
    const hasBudgets     = hasRecords || schemas.some(s => s.entity.key === 'payments');
    return [
      { label: 'Dashboard',     icon: 'grid',         route: '/app/dashboard'     },
      ...schemas
        .filter(s => s.entity.moduleType !== 'presupuestos' && s.entity.moduleType !== 'admin' && s.entity.key !== 'reports')
        .map(s => ({
          label: s.entity.plural,
          icon: s.entity.icon,
          route: s.entity.moduleType === 'calendar'
            ? '/app/module/' + s.entity.key
            : s.entity.moduleType === 'clinical-record'
              ? '/app/clinical/' + s.entity.key
              : '/app/entity/' + s.entity.key
        })),
      ...((hasRecords || schemas.some(s => s.entity.key === 'reports')) ? [{ label: 'Reportes', icon: 'bar-chart', route: '/app/reports' }] : []),
      ...(hasPayments    ? [{ label: 'Comisiones',    icon: 'dollar-sign',  route: '/app/commissions'   }] : []),
      ...(hasBudgets     ? [{ label: 'Presupuestos',  icon: 'file-text',    route: '/app/presupuestos'  }] : []),
      ...(hasImportable  ? [{ label: 'Importar',      icon: 'upload',       route: '/app/import'        }] : []),
      { label: 'Chat',          icon: 'chat',         route: '/app/chat'          },
      ...(schemas.some(s => s.entity.key === 'user-management') || this.auth.isSuperAdmin()
        ? [{ label: 'Administración', icon: 'shield', route: '/app/admin' }] : [])
    ];
  });
}
