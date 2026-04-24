import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import {
  SubscriptionService,
  Subscription,
  SubscriptionPlan,
  SubscriptionUser
} from '../../services/subscription.service';

type ModalMode = 'create' | 'edit';

@Component({
  selector: 'app-vendor-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './vendor-dashboard.component.html',
  styleUrl: './vendor-dashboard.component.scss'
})
export class VendorDashboardComponent implements OnInit {
  private svc = inject(SubscriptionService);
  private fb  = inject(FormBuilder);

  // ── Data ──────────────────────────────────────────────────────────────────
  subscriptions = signal<Subscription[]>([]);
  plans         = signal<SubscriptionPlan[]>([]);
  loading       = signal(true);
  error         = signal('');

  // ── Modal ─────────────────────────────────────────────────────────────────
  modalOpen      = signal(false);
  modalMode      = signal<ModalMode>('create');
  modalSaving    = signal(false);
  modalError     = signal('');
  editingId      = signal<number | null>(null);

  form = this.fb.group({
    name:          ['', [Validators.required, Validators.minLength(2)]],
    planCode:      ['', Validators.required],
    biometricAuth: [null as boolean | null],
    active:        [true],
    contactEmail:  ['', Validators.email]
  });

  // ── Detail panel ──────────────────────────────────────────────────────────
  detailSub     = signal<Subscription | null>(null);
  detailUsers   = signal<SubscriptionUser[]>([]);
  detailLoading = signal(false);

  // ── Delete confirmation ───────────────────────────────────────────────────
  confirmDeleteId   = signal<number | null>(null);
  confirmDeleteName = signal('');
  deleteLoading     = signal(false);
  deleteError       = signal('');

  // ── Computed ──────────────────────────────────────────────────────────────
  stats = computed(() => {
    const subs = this.subscriptions();
    return {
      total:    subs.length,
      active:   subs.filter(s => s.active).length,
      biometric: subs.filter(s => s.effectiveBiometricAuth).length,
      users:    subs.reduce((n, s) => n + s.userCount, 0)
    };
  });

  async ngOnInit(): Promise<void> {
    await this.loadData();
  }

  async loadData(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const [subs, plans] = await Promise.all([
        this.svc.listSubscriptions(),
        this.svc.listPlans()
      ]);
      this.subscriptions.set(subs);
      this.plans.set(plans);
    } catch {
      this.error.set('No se pudieron cargar las suscripciones.');
    } finally {
      this.loading.set(false);
    }
  }

  // ── Modal helpers ─────────────────────────────────────────────────────────

  openCreate(): void {
    this.modalMode.set('create');
    this.editingId.set(null);
    this.form.reset({ biometricAuth: null, active: true });
    this.modalError.set('');
    this.modalOpen.set(true);
  }

  openEdit(sub: Subscription): void {
    this.modalMode.set('edit');
    this.editingId.set(sub.id);
    this.form.patchValue({
      name:          sub.name,
      planCode:      sub.planCode,
      biometricAuth: sub.biometricAuth,
      active:        sub.active,
      contactEmail:  sub.contactEmail ?? ''
    });
    this.modalError.set('');
    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.modalOpen.set(false);
  }

  async saveModal(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.modalSaving.set(true);
    this.modalError.set('');

    const raw = this.form.getRawValue();
    const dto = {
      name:          raw.name!,
      planCode:      raw.planCode!,
      biometricAuth: raw.biometricAuth,
      active:        raw.active ?? true,
      contactEmail:  raw.contactEmail || undefined
    };

    try {
      if (this.modalMode() === 'create') {
        const created = await this.svc.createSubscription(dto);
        this.subscriptions.update(list => [created, ...list]);
      } else {
        const updated = await this.svc.updateSubscription(this.editingId()!, dto);
        this.subscriptions.update(list => list.map(s => s.id === updated.id ? updated : s));
        if (this.detailSub()?.id === updated.id) this.detailSub.set(updated);
      }
      this.modalOpen.set(false);
    } catch (e: any) {
      this.modalError.set(e?.error?.error ?? 'Error al guardar suscripción.');
    } finally {
      this.modalSaving.set(false);
    }
  }

  // ── Detail panel ──────────────────────────────────────────────────────────

  async openDetail(sub: Subscription): Promise<void> {
    this.detailSub.set(sub);
    this.detailUsers.set([]);
    this.detailLoading.set(true);
    try {
      const users = await this.svc.listUsers(sub.id);
      this.detailUsers.set(users);
    } finally {
      this.detailLoading.set(false);
    }
  }

  closeDetail(): void {
    this.detailSub.set(null);
    this.detailUsers.set([]);
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  askDelete(sub: Subscription): void {
    this.confirmDeleteId.set(sub.id);
    this.confirmDeleteName.set(sub.name);
    this.deleteError.set('');
  }

  cancelDelete(): void {
    this.confirmDeleteId.set(null);
  }

  async confirmDelete(): Promise<void> {
    const id = this.confirmDeleteId();
    if (id === null) return;
    this.deleteLoading.set(true);
    this.deleteError.set('');
    try {
      await this.svc.deleteSubscription(id);
      this.subscriptions.update(list => list.filter(s => s.id !== id));
      if (this.detailSub()?.id === id) this.closeDetail();
      this.confirmDeleteId.set(null);
    } catch (e: any) {
      this.deleteError.set(e?.error?.error ?? 'No se pudo eliminar la suscripción.');
    } finally {
      this.deleteLoading.set(false);
    }
  }

  // ── Quick biometric toggle (with confirmation) ───────────────────────────

  confirmToggleSub   = signal<Subscription | null>(null);
  confirmToggleValue = signal(false);
  confirmToggling    = signal(false);

  askToggleBiometric(sub: Subscription): void {
    this.confirmToggleSub.set(sub);
    this.confirmToggleValue.set(!sub.effectiveBiometricAuth);
  }

  cancelToggle(): void { this.confirmToggleSub.set(null); }

  async executeToggle(): Promise<void> {
    const sub = this.confirmToggleSub();
    if (!sub) return;
    this.confirmToggling.set(true);
    try {
      const updated = await this.svc.updateSubscription(sub.id, { biometricAuth: this.confirmToggleValue() });
      this.subscriptions.update(list => list.map(s => s.id === updated.id ? updated : s));
      if (this.detailSub()?.id === updated.id) this.detailSub.set(updated);
    } catch { /* silent */ }
    this.confirmToggling.set(false);
    this.confirmToggleSub.set(null);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  isInvalid(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.invalid && ctrl.touched);
  }

  planLabel(code: string): string {
    return this.plans().find(p => p.code === code)?.label ?? code;
  }

  biometricLabel(sub: Subscription): string {
    if (sub.biometricAuth === null) return `Plan (${sub.effectiveBiometricAuth ? 'Sí' : 'No'})`;
    return sub.biometricAuth ? 'Activo (forzado)' : 'Inactivo (forzado)';
  }

  roleColor(role: string): string {
    const map: Record<string, string> = {
      admin: '#6366f1', manager: '#10b981', viewer: '#f59e0b', superadmin: '#ef4444'
    };
    return map[role] ?? '#94a3b8';
  }

  initials(name: string): string {
    return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }
}
