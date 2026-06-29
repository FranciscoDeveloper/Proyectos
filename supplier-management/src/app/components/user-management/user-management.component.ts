import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';

interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: string;
  avatar: string;
  emailVerified: boolean;
  createdAt: string;
  schemas: string[];
}

interface AvailableSchema {
  id: number;
  schema_key: string;
  singular: string;
  plural: string;
  module_type: string;
  icon: string;
}

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-management.component.html',
  styleUrl: './user-management.component.scss'
})
export class UserManagementComponent implements OnInit {
  private http = inject(HttpClient);
  readonly auth = inject(AuthService);

  users    = signal<AdminUser[]>([]);
  loading  = signal(true);
  error    = signal<string | null>(null);

  // Schema panel
  editingSchemas   = signal<AdminUser | null>(null);
  availableSchemas = signal<string[]>([]);
  selectedSchemas  = signal<Set<string>>(new Set());
  savingSchemas    = signal(false);

  // Password panel
  editingPassword  = signal<AdminUser | null>(null);
  newPassword      = signal('');
  savingPassword   = signal(false);
  passwordError    = signal<string | null>(null);

  // Status toggle feedback
  togglingId = signal<number | null>(null);

  // All schema keys available in the system (derived from app_schema)
  readonly ALL_SCHEMAS = [
    'appointments', 'sessions', 'reports', 'suppliers', 'expenses',
    'clinicalRecords', 'payments', 'products', 'presupuestos', 'categories',
    'user-management'
  ];

  ngOnInit() { this.loadUsers(); }

  loadUsers() {
    this.loading.set(true);
    this.error.set(null);
    this.http.get<AdminUser[]>('/api/admin/users').subscribe({
      next: users => { this.users.set(users); this.loading.set(false); },
      error: err  => { this.error.set(err.error?.message ?? 'Error cargando usuarios'); this.loading.set(false); }
    });
  }

  toggleStatus(user: AdminUser) {
    this.togglingId.set(user.id);
    this.http.put(`/api/admin/users/${user.id}/status`, { active: !user.emailVerified }).subscribe({
      next: () => {
        this.users.update(list =>
          list.map(u => u.id === user.id ? { ...u, emailVerified: !u.emailVerified } : u)
        );
        this.togglingId.set(null);
      },
      error: err => {
        this.error.set(err.error?.message ?? 'Error actualizando estado');
        this.togglingId.set(null);
      }
    });
  }

  openSchemas(user: AdminUser) {
    this.editingSchemas.set(user);
    this.selectedSchemas.set(new Set(user.schemas));
  }

  closeSchemas() { this.editingSchemas.set(null); }

  toggleSchema(key: string) {
    this.selectedSchemas.update(s => {
      const next = new Set(s);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  saveSchemas() {
    const user = this.editingSchemas();
    if (!user) return;
    this.savingSchemas.set(true);
    const schemaKeys = [...this.selectedSchemas()];
    this.http.put(`/api/admin/users/${user.id}/schemas`, { schemaKeys }).subscribe({
      next: (res: any) => {
        this.users.update(list =>
          list.map(u => u.id === user.id ? { ...u, schemas: res.schemas } : u)
        );
        this.savingSchemas.set(false);
        this.closeSchemas();
      },
      error: err => {
        this.error.set(err.error?.message ?? 'Error guardando módulos');
        this.savingSchemas.set(false);
      }
    });
  }

  openPassword(user: AdminUser) {
    this.editingPassword.set(user);
    this.newPassword.set('');
    this.passwordError.set(null);
  }

  closePassword() { this.editingPassword.set(null); }

  savePassword() {
    const pass = this.newPassword();
    if (pass.length < 8) { this.passwordError.set('Mínimo 8 caracteres'); return; }
    const user = this.editingPassword();
    if (!user) return;
    this.savingPassword.set(true);
    this.http.put(`/api/admin/users/${user.id}/password`, { password: pass }).subscribe({
      next: () => { this.savingPassword.set(false); this.closePassword(); },
      error: err => {
        this.passwordError.set(err.error?.message ?? 'Error cambiando contraseña');
        this.savingPassword.set(false);
      }
    });
  }

  isSelf(userId: number): boolean {
    return this.auth.user()?.id === userId;
  }
}
