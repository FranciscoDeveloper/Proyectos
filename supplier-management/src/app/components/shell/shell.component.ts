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

  /**
   * On desktop the sidebar is a persistent 260px column, so it starts expanded.
   * Under 768px the same "expanded" state renders as a fixed overlay covering
   * ~2/3 of a phone screen — starting open meant the app booted with its own
   * navigation hiding the page. Start closed on narrow viewports instead.
   */
  sidebarOpen = signal(!ShellComponent.isNarrowViewport());

  private static isNarrowViewport(): boolean {
    return typeof window !== 'undefined' && window.innerWidth <= 768;
  }

  // ZK setup state
  zkSetting   = signal(false);

  // ZK unlock state (certificate upload)
  zkUnlocking  = signal(false);
  zkCertError  = signal(false);

  toggleSidebar() { this.sidebarOpen.update(v => !v); }

  /**
   * Dismiss the sidebar after navigating on a phone. On desktop the sidebar is
   * not an overlay, so it must stay put — otherwise every click would collapse it.
   */
  onNavigate(): void {
    if (ShellComponent.isNarrowViewport()) this.sidebarOpen.set(false);
  }

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
        // presupuestos siempre tiene moduleType 'crud' (tanto en app_schema como en
        // DEFAULT_DAIRI_SCHEMAS), nunca 'presupuestos' — ese moduleType nunca ocurre
        // en los datos reales, así que comparar contra él no filtraba nada y el
        // módulo aparecía dos veces: una desde este loop genérico y otra desde el
        // bloque de "Presupuestos" más abajo (hasBudgets). Se filtra por key en su lugar.
        .filter(s => s.entity.key !== 'presupuestos' && s.entity.moduleType !== 'admin' && s.entity.key !== 'reports')
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
