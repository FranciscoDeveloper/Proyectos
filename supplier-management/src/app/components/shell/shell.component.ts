import { Component, signal, computed, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss'
})
export class ShellComponent {
  readonly auth = inject(AuthService);

  sidebarOpen = signal(true);

  toggleSidebar() { this.sidebarOpen.update(v => !v); }

  logout() { this.auth.logout(); }

  getUserFirstName(): string {
    return this.auth.user()?.name?.split(' ')[0] ?? '';
  }

  /**
   * Navigation items derived purely from backend-authorized schemas.
   * moduleType === 'calendar' → /module/:key  (calendar view)
   * otherwise                 → /entity/:key  (CRUD list view)
   * The shell has no hardcoded knowledge of which entities exist.
   */
  navItems = computed(() => {
    const schemas = this.auth.schemas();
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
      { label: 'Chat',      icon: 'chat',      route: '/app/chat'      }
    ];
  });
}
