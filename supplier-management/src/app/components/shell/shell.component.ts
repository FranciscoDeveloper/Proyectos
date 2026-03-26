import { Component, signal, computed, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SchemaService } from '../../services/schema.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss'
})
export class ShellComponent {
  private schemaService = inject(SchemaService);
  readonly auth = inject(AuthService);

  sidebarOpen = signal(true);

  toggleSidebar() { this.sidebarOpen.update(v => !v); }

  logout() { this.auth.logout(); }

  getUserFirstName(): string {
    return this.auth.user()?.name?.split(' ')[0] ?? '';
  }

  navItems = computed(() => {
    const entities = this.schemaService.getAvailableEntities();
    return [
      { label: 'Dashboard', icon: 'grid', route: '/dashboard' },
      ...entities.map(e => ({ label: e.plural, icon: e.icon, route: '/entity/' + e.key }))
    ];
  });
}
