import { Component, signal, computed, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { CryptoService } from '../../services/crypto.service';

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

  sidebarOpen  = signal(true);
  unlockPass   = signal('');
  unlockError  = signal(false);
  unlocking    = signal(false);

  toggleSidebar() { this.sidebarOpen.update(v => !v); }

  logout() { this.auth.logout(); }

  getUserFirstName(): string {
    return this.auth.user()?.name?.split(' ')[0] ?? '';
  }

  async unlock(): Promise<void> {
    const pass  = this.unlockPass().trim();
    const email = this.auth.user()?.email ?? '';
    if (!pass || !email) return;

    this.unlocking.set(true);
    this.unlockError.set(false);

    const ok = await this.cryptoSvc.unlockWithPassword(pass, email);
    this.unlocking.set(false);
    if (ok) {
      this.unlockPass.set('');
    } else {
      this.unlockError.set(true);
    }
  }

  navItems = computed(() => {
    const schemas = this.auth.schemas();
    const hasPayments = schemas.some(s => s.entity.key === 'payments');
    return [
      { label: 'Dashboard', icon: 'grid',         route: '/dashboard'   },
      ...schemas.map(s => ({
        label: s.entity.plural,
        icon: s.entity.icon,
        route: s.entity.moduleType === 'calendar'
          ? '/module/' + s.entity.key
          : s.entity.moduleType === 'clinical-record'
            ? '/clinical/' + s.entity.key
            : '/entity/' + s.entity.key
      })),
      ...(hasPayments ? [{ label: 'Comisiones', icon: 'dollar-sign', route: '/commissions' }] : []),
      { label: 'Chat',      icon: 'chat',         route: '/chat'        }
    ];
  });
}
