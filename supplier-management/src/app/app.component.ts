import { Component, signal, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SchemaService } from './services/schema.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  private schemaService = inject(SchemaService);

  sidebarOpen = signal(true);

  toggleSidebar() {
    this.sidebarOpen.update(v => !v);
  }

  /** Dashboard + all entities from SchemaService (populated dynamically from backend JSON) */
  get navItems() {
    const entities = this.schemaService.getAvailableEntities();
    return [
      { label: 'Dashboard', icon: 'grid', route: '/dashboard' },
      ...entities.map(e => ({ label: e.plural, icon: e.icon, route: '/entity/' + e.key }))
    ];
  }
}
