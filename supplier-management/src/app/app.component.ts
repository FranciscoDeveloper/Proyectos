import { Component, signal, inject, computed } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SchemaService } from './services/schema.service';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  private schemaService = inject(SchemaService);
  readonly auth = inject(AuthService);

  sidebarOpen = signal(true);

  toggleSidebar() {
    this.sidebarOpen.update(v => !v);
  }

  logout() {
    this.auth.logout();
  }

  getUserFirstName(): string {
    return this.auth.user()?.name?.split(' ')[0] ?? '';
  }

  /** Dashboard + authorized entities from the backend auth response */
  get navItems() {
    const entities = this.schemaService.getAvailableEntities();
    return [
      { label: 'Dashboard', icon: 'grid', route: '/dashboard' },
      ...entities.map(e => ({ label: e.plural, icon: e.icon, route: '/entity/' + e.key }))
    ];
  }
}
