import {
  Component, inject, signal, computed, OnInit, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { switchMap, of, catchError } from 'rxjs';
import { GenericCrudService } from '../../services/generic-crud.service';
import { AuthService } from '../../services/auth.service';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Professional {
  id: string;
  nombre: string;
  especialidad: string;
}

export interface PatientOption {
  id: number;
  name: string;
  rut: string;
  phone: string;
  email: string;
}

export interface PresupuestoItem {
  description: string;
  quantity: number;
  unitPrice: number;
  discountPct: number;
  subtotal: number;
}

export interface Presupuesto {
  id?: number;
  numero: string;
  patientId?: number | null;
  professionalId?: number | null;
  patientName: string;
  patientRut: string;
  patientPhone: string;
  patientEmail: string;
  doctorName: string;
  specialty: string;
  fechaEmision: string;
  fechaVencimiento: string;
  prevision: string;
  coveragePercent: number;
  discountGlobal: number;
  items: PresupuestoItem[];
  notes: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

type PanelMode = 'closed' | 'create' | 'edit' | 'view';

const EMPTY_ITEM = (): PresupuestoItem => ({
  description: '', quantity: 1, unitPrice: 0, discountPct: 0, subtotal: 0
});

const EMPTY_FORM = (): Omit<Presupuesto, 'id' | 'createdAt' | 'updatedAt'> => ({
  numero: '',
  patientId: null, professionalId: null,
  patientName: '', patientRut: '', patientPhone: '', patientEmail: '',
  doctorName: '', specialty: '',
  fechaEmision: new Date().toISOString().split('T')[0],
  fechaVencimiento: new Date(Date.now() + 30 * 864e5).toISOString().split('T')[0],
  prevision: 'particular',
  coveragePercent: 0,
  discountGlobal: 0,
  items: [EMPTY_ITEM()],
  notes: '',
  status: 'draft'
});

// ── Component ─────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-presupuestos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './presupuestos.component.html',
  styleUrl: './presupuestos.component.scss'
})
export class PresupuestosComponent implements OnInit {
  private http    = inject(HttpClient);
  private crudSvc = inject(GenericCrudService);
  private auth = inject(AuthService);

  // ── State ──────────────────────────────────────────────────────────────────
  presupuestos = signal<Presupuesto[]>([]);
  loading      = signal(true);
  saving       = signal(false);
  serverError  = signal('');

  panelMode    = signal<PanelMode>('closed');
  selected     = signal<Presupuesto | null>(null);
  form         = signal<ReturnType<typeof EMPTY_FORM>>(EMPTY_FORM());

  filterSearch = signal('');
  filterStatus = signal('');
  filterFrom   = signal('');
  filterTo     = signal('');
  showDeleteId = signal<number | null>(null);
  printMode    = signal(false);

  // Professionals list
  professionals  = signal<Professional[]>([]);
  loadingProfs   = signal(false);
  selectedProfId = signal('');

  // Patients list — reactive via GenericCrudService (falls back to schema seed data)
  patients = computed<PatientOption[]>(() =>
    this.crudSvc.getAll('patients')().map((p: any) => ({
      id:    p.id,
      name:  p.name   ?? p.nombre   ?? '',
      rut:   p.rut    ?? '',
      phone: p.phone  ?? p.telefono ?? '',
      email: p.email  ?? ''
    }))
  );
  loadingPatients   = signal(false);
  selectedPatientId = signal<number | null>(null);

  // Send email modal state
  sendModalOpen = signal(false);
  sendTarget    = signal<Presupuesto | null>(null);
  sendTo        = signal('');
  sendMode      = signal<'completo' | 'total' | 'minimal'>('completo');
  sendMessage   = signal('');
  sending       = signal(false);
  sendResult    = signal<{ ok: boolean; msg: string } | null>(null);

  // ── Computed ───────────────────────────────────────────────────────────────

  filtered = computed(() => {
    let list = this.presupuestos();
    // Auto-filter: professionals see only their own budgets
    const me = this.auth.user();
    if (me && this.auth.isProfessionalView()) {
      const profId   = this.auth.myProfessionalId();
      const profName = me.professionalName ?? me.name;
      list = profId != null
        ? list.filter(p => (p as any).professionalId === profId)
        : list.filter(p => p.doctorName === profName);
    }
    const q  = this.filterSearch().toLowerCase();
    const s  = this.filterStatus();
    const fd = this.filterFrom();
    const td = this.filterTo();

    if (q)  list = list.filter(p => p.patientName.toLowerCase().includes(q) || p.numero.toLowerCase().includes(q) || p.doctorName.toLowerCase().includes(q));
    if (s)  list = list.filter(p => p.status === s);
    if (fd) list = list.filter(p => p.fechaEmision >= fd);
    if (td) list = list.filter(p => p.fechaEmision <= td);

    return list.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  });

  stats = computed(() => {
    const all = this.presupuestos();
    const now = new Date().toISOString().split('T')[0];
    const active = all.filter(p => p.status !== 'rejected' && p.status !== 'expired');
    const approved = all.filter(p => p.status === 'approved' || p.status === 'converted');
    const sent     = all.filter(p => p.status !== 'draft');
    return {
      total:      all.length,
      draft:      all.filter(p => p.status === 'draft').length,
      sent:       all.filter(p => p.status === 'sent').length,
      approved:   approved.length,
      pending:    all.filter(p => p.status === 'sent').length,
      totalValue: active.reduce((s, p) => s + this.calcTotal(p), 0),
      conversion: sent.length ? Math.round((approved.length / sent.length) * 100) : 0,
      expiringSoon: all.filter(p =>
        p.status === 'sent' &&
        p.fechaVencimiento >= now &&
        p.fechaVencimiento <= new Date(Date.now() + 7 * 864e5).toISOString().split('T')[0]
      ).length
    };
  });

  formTotals = computed(() => this.calcTotalsFromForm(this.form()));

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  ngOnInit() { this.load(); this.loadProfessionals(); }

  private load() {
    this.loading.set(true);
    this.http.get<Presupuesto[]>('/api/entities/presupuestos').subscribe({
      next:  list => { this.presupuestos.set(list); this.loading.set(false); },
      error: _err => { this.presupuestos.set(this.mockData()); this.loading.set(false); }
    });
  }

  private loadProfessionals() {
    this.loadingProfs.set(true);
    this.http.get<Professional[]>('/api/book').subscribe({
      next:  list => { this.professionals.set(list); this.loadingProfs.set(false); },
      error: _    => { this.loadingProfs.set(false); }
    });
  }

  selectProfessional(id: string) {
    this.selectedProfId.set(id);
    const prof = this.professionals().find(p => p.id === id);
    if (prof) {
      this.form.update(f => ({
        ...f,
        professionalId: parseInt(prof.id) || null,
        doctorName: prof.nombre,
        specialty:  prof.especialidad ?? ''
      }));
    } else {
      this.form.update(f => ({ ...f, professionalId: null, doctorName: '', specialty: '' }));
    }
  }

  selectPatient(idStr: string) {
    const id = parseInt(idStr);
    this.selectedPatientId.set(id || null);
    const pat = this.patients().find(p => p.id === id);
    if (pat) {
      this.form.update(f => ({
        ...f,
        patientId:    pat.id,
        patientName:  pat.name,
        patientRut:   pat.rut,
        patientPhone: pat.phone,
        patientEmail: pat.email
      }));
    } else {
      this.form.update(f => ({
        ...f,
        patientId: null,
        patientName: '', patientRut: '', patientPhone: '', patientEmail: ''
      }));
    }
  }

  // ── Panel ──────────────────────────────────────────────────────────────────

  openCreate() {
    this.form.set({ ...EMPTY_FORM(), numero: this.nextNumero() });
    this.selected.set(null);
    this.selectedProfId.set('');
    this.selectedPatientId.set(null);
    this.serverError.set('');
    this.panelMode.set('create');
  }

  openView(p: Presupuesto) {
    this.selected.set(p);
    this.panelMode.set('view');
    this.serverError.set('');
  }

  openEdit(p: Presupuesto) {
    this.form.set({
      numero: p.numero, patientName: p.patientName, patientRut: p.patientRut,
      patientPhone: p.patientPhone, patientEmail: p.patientEmail,
      doctorName: p.doctorName, specialty: p.specialty,
      fechaEmision: p.fechaEmision, fechaVencimiento: p.fechaVencimiento,
      prevision: p.prevision, coveragePercent: p.coveragePercent,
      discountGlobal: p.discountGlobal,
      items: p.items.length ? p.items.map(i => ({ ...i })) : [EMPTY_ITEM()],
      notes: p.notes, status: p.status
    });
    const matchProf = p.professionalId
      ? this.professionals().find(pr => parseInt(pr.id) === p.professionalId)
      : this.professionals().find(pr => pr.nombre === p.doctorName);
    this.selectedProfId.set(matchProf?.id ?? '');

    const matchPat = p.patientId
      ? this.patients().find(pt => pt.id === p.patientId)
      : null;
    this.selectedPatientId.set(matchPat?.id ?? null);
    this.selected.set(p);
    this.serverError.set('');
    this.panelMode.set('edit');
  }

  closePanel() { this.panelMode.set('closed'); this.selected.set(null); }

  // ── Form helpers ───────────────────────────────────────────────────────────

  addItem() {
    this.form.update(f => ({ ...f, items: [...f.items, EMPTY_ITEM()] }));
  }

  removeItem(i: number) {
    this.form.update(f => ({
      ...f, items: f.items.filter((_, idx) => idx !== i)
    }));
    this.recalcItems();
  }

  updateItem(i: number, field: keyof PresupuestoItem, value: string | number) {
    this.form.update(f => {
      const items = f.items.map((item, idx) => {
        if (idx !== i) return item;
        const updated = { ...item, [field]: value };
        // Clamp numeric fields to valid ranges
        const qty   = Math.max(0, +(field === 'quantity'    ? value : updated.quantity)  || 0);
        const price = Math.max(0, +(field === 'unitPrice'   ? value : updated.unitPrice) || 0);
        const disc  = Math.min(100, Math.max(0, +(field === 'discountPct' ? value : updated.discountPct) || 0));
        updated.quantity   = qty;
        updated.unitPrice  = price;
        updated.discountPct = disc;
        updated.subtotal   = qty * price * (1 - disc / 100);
        return updated;
      });
      return { ...f, items };
    });
  }

  updateFormField(field: string, value: string | number) {
    let v: string | number = value;
    if (field === 'discountGlobal' || field === 'coveragePercent') {
      v = Math.min(100, Math.max(0, +value || 0));
    }
    this.form.update(f => ({ ...f, [field]: v }));
  }

  private recalcItems() {
    this.form.update(f => ({
      ...f,
      items: f.items.map(item => ({
        ...item,
        subtotal: this.itemSubtotal(item)
      }))
    }));
  }

  // Safe per-item subtotal recalculated from raw fields (avoids stale cache)
  private itemSubtotal(item: PresupuestoItem): number {
    const qty   = Math.max(0, +item.quantity   || 0);
    const price = Math.max(0, +item.unitPrice  || 0);
    const disc  = Math.min(100, Math.max(0, +item.discountPct || 0));
    return qty * price * (1 - disc / 100);
  }

  private nextNumero(): string {
    const year  = new Date().getFullYear();
    const all   = this.presupuestos();
    const max   = all
      .map(p => parseInt(p.numero.replace(/\D/g, '')) || 0)
      .reduce((a, b) => Math.max(a, b), 0);
    return `PRES-${year}-${String(max + 1).padStart(4, '0')}`;
  }

  // ── Calculations ───────────────────────────────────────────────────────────

  // Recalculates each item's subtotal from its raw fields (avoids stale stored value)
  calcSubtotal(p: { items: PresupuestoItem[] }): number {
    return p.items.reduce((s, i) => s + this.itemSubtotal(i), 0);
  }

  calcDiscount(p: { items: PresupuestoItem[]; discountGlobal: number }): number {
    const sub  = this.calcSubtotal(p);
    const pct  = Math.min(100, Math.max(0, +p.discountGlobal || 0));
    return sub * (pct / 100);
  }

  calcTotal(p: Presupuesto | Omit<Presupuesto, 'id' | 'createdAt' | 'updatedAt'>): number {
    return Math.max(0, this.calcSubtotal(p) - this.calcDiscount(p));
  }

  calcCovered(p: Presupuesto | Omit<Presupuesto, 'id' | 'createdAt' | 'updatedAt'>): number {
    const pct = Math.min(100, Math.max(0, +p.coveragePercent || 0));
    return Math.max(0, this.calcTotal(p) * (pct / 100));
  }

  calcPatientPays(p: Presupuesto | Omit<Presupuesto, 'id' | 'createdAt' | 'updatedAt'>): number {
    return Math.max(0, this.calcTotal(p) - this.calcCovered(p));
  }

  private calcTotalsFromForm(f: ReturnType<typeof EMPTY_FORM>) {
    const subtotal    = this.calcSubtotal(f);
    const discPct     = Math.min(100, Math.max(0, +f.discountGlobal || 0));
    const covPct      = Math.min(100, Math.max(0, +f.coveragePercent || 0));
    const discount    = subtotal * (discPct / 100);
    const total       = Math.max(0, subtotal - discount);
    const covered     = Math.max(0, total * (covPct / 100));
    const patientPays = Math.max(0, total - covered);
    return { subtotal, discount, total, covered, patientPays };
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  save() {
    const f = this.form();
    if (!f.patientName.trim() || !f.doctorName.trim() || !f.fechaEmision || !f.fechaVencimiento) {
      this.serverError.set('Completa los campos obligatorios: paciente, doctor y fechas.');
      return;
    }
    if (f.items.length === 0 || f.items.every(i => !i.description.trim())) {
      this.serverError.set('Agrega al menos un ítem con descripción.');
      return;
    }

    this.saving.set(true);
    this.serverError.set('');

    const payload: Omit<Presupuesto, 'id' | 'createdAt' | 'updatedAt'> = {
      ...f,
      items: f.items.filter(i => i.description.trim())
    };

    const mode = this.panelMode();
    if (mode === 'create') {
      this.http.post<Presupuesto>('/api/entities/presupuestos', payload).subscribe({
        next: created => {
          this.presupuestos.update(list => [created, ...list]);
          this.saving.set(false);
          this.panelMode.set('view');
          this.selected.set(created);
        },
        error: err => {
          this.saving.set(false);
          this.serverError.set(err.error?.message ?? 'Error al guardar el presupuesto.');
        }
      });
    } else {
      const id = this.selected()!.id!;
      this.http.put<Presupuesto>(`/api/entities/presupuestos/${id}`, payload).subscribe({
        next: updated => {
          this.presupuestos.update(list => list.map(p => p.id === id ? updated : p));
          this.saving.set(false);
          this.panelMode.set('view');
          this.selected.set(updated);
        },
        error: err => {
          this.saving.set(false);
          this.serverError.set(err.error?.message ?? 'Error al actualizar el presupuesto.');
        }
      });
    }
  }

  changeStatus(p: Presupuesto, newStatus: string) {
    this.http.put<Presupuesto>(`/api/entities/presupuestos/${p.id}`, { status: newStatus }).subscribe({
      next: updated => {
        this.presupuestos.update(list => list.map(x => x.id === p.id ? { ...x, status: updated.status } : x));
        if (this.selected()?.id === p.id) this.selected.update(s => s ? { ...s, status: updated.status } : s);
      }
    });
  }

  confirmDelete(id: number) { this.showDeleteId.set(id); }
  cancelDelete()            { this.showDeleteId.set(null); }

  doDelete() {
    const id = this.showDeleteId();
    if (!id) return;
    this.http.delete(`/api/entities/presupuestos/${id}`).subscribe({
      next: () => {
        this.presupuestos.update(list => list.filter(p => p.id !== id));
        this.showDeleteId.set(null);
        if (this.selected()?.id === id) this.closePanel();
      }
    });
  }

  // ── Send email ─────────────────────────────────────────────────────────────

  openSendModal(p: Presupuesto) {
    this.sendTarget.set(p);
    this.sendTo.set(p.patientEmail ?? '');
    this.sendMode.set('completo');
    this.sendMessage.set('');
    this.sendResult.set(null);
    this.sendModalOpen.set(true);
  }

  closeSendModal() {
    this.sendModalOpen.set(false);
    this.sendTarget.set(null);
    this.sendResult.set(null);
  }

  doSendEmail() {
    const p = this.sendTarget();
    if (!p?.id) return;

    const to = this.sendTo().trim();
    if (!to || !to.includes('@')) {
      this.sendResult.set({ ok: false, msg: 'Ingresa un email válido.' });
      return;
    }

    this.sending.set(true);
    this.sendResult.set(null);

    this.http.post<{ message: string; emailSent: boolean; newStatus?: string; emailPayload?: any }>(
      `/api/entities/presupuestos/${p.id}/send`,
      { to, mode: this.sendMode(), message: this.sendMessage() }
    ).pipe(
      switchMap(res => {
        // Backend returned emailPayload → send via /api/send-email (public endpoint, no VPC)
        if (res.emailPayload) {
          return this.http.post('/api/send-email', res.emailPayload).pipe(
            switchMap(() => of({ ...res, emailSent: true,  message: 'Presupuesto enviado correctamente.' })),
            catchError(() => of({ ...res, emailSent: false, message: 'Presupuesto guardado pero no se pudo enviar el email.' }))
          );
        }
        return of(res);
      })
    ).subscribe({
      next: res => {
        this.sending.set(false);
        this.sendResult.set({ ok: res.emailSent, msg: res.message ?? 'Email enviado correctamente.' });
        if (res.newStatus) {
          this.presupuestos.update(list =>
            list.map(x => x.id === p.id ? { ...x, status: res.newStatus! } : x)
          );
          if (this.selected()?.id === p.id) {
            this.selected.update(s => s ? { ...s, status: res.newStatus! } : s);
          }
        }
      },
      error: err => {
        this.sending.set(false);
        this.sendResult.set({ ok: false, msg: err.error?.message ?? 'No se pudo enviar el email.' });
      }
    });
  }

  // ── PDF print ──────────────────────────────────────────────────────────────

  printPresupuesto(p: Presupuesto) {
    this.selected.set(p);
    this.printMode.set(true);
    setTimeout(() => {
      window.print();
      this.printMode.set(false);
    }, 200);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  statusLabel(s: string): string {
    return { draft: 'Borrador', sent: 'Enviado', approved: 'Aprobado', rejected: 'Rechazado', expired: 'Vencido', converted: 'Convertido' }[s] ?? s;
  }

  previsionLabel(p: string): string {
    const map: Record<string, string> = {
      particular:   'Particular',
      fonasa:       'FONASA',
      banmedica:    'Banmédica',
      colmena:      'Colmena',
      consalud:     'Consalud',
      cruzblanca:   'Cruz Blanca',
      esencial:     'Esencial',
      nuevamasvida: 'Nueva Masvida',
      vidatres:     'Vida Tres',

      capredena:    'CAPREDENA',
      dipreca:      'DIPRECA',
    };
    return map[p] ?? p;
  }

  nextStatuses(current: string): { value: string; label: string }[] {
    const map: Record<string, { value: string; label: string }[]> = {
      draft:     [{ value: 'sent',      label: 'Marcar como Enviado' }],
      sent:      [{ value: 'approved',  label: 'Aprobar' }, { value: 'rejected', label: 'Rechazar' }],
      approved:  [{ value: 'converted', label: 'Convertir a Cobro' }],
      rejected:  [],
      expired:   [],
      converted: []
    };
    return map[current] ?? [];
  }

  formatCLP(n: number): string {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(Math.round(n));
  }

  trackByIdx = (_i: number) => _i;

  getYear(): number { return new Date().getFullYear(); }

  isExpiringSoon(p: Presupuesto): boolean {
    if (p.status !== 'sent' && p.status !== 'draft') return false;
    const today = new Date().toISOString().split('T')[0];
    const soon  = new Date(Date.now() + 7 * 864e5).toISOString().split('T')[0];
    return p.fechaVencimiento >= today && p.fechaVencimiento <= soon;
  }

  isExpired(p: Presupuesto): boolean {
    if (p.status === 'approved' || p.status === 'converted' || p.status === 'rejected') return false;
    return p.fechaVencimiento < new Date().toISOString().split('T')[0];
  }

  hasActiveFilters(): boolean {
    return !!(this.filterSearch() || this.filterStatus() || this.filterFrom() || this.filterTo());
  }

  clearFilters() {
    this.filterSearch.set(''); this.filterStatus.set('');
    this.filterFrom.set('');   this.filterTo.set('');
  }

  // ── Mock data (fallback when backend unavailable) ─────────────────────────

  private mockData(): Presupuesto[] {
    const today = new Date().toISOString().split('T')[0];
    const expire = new Date(Date.now() + 30 * 864e5).toISOString().split('T')[0];
    return [
      {
        id: 1, numero: 'PRES-2025-0001', patientName: 'María González', patientRut: '12.345.678-9',
        patientPhone: '+56912345678', patientEmail: 'maria@correo.com',
        doctorName: 'Dra. Morales', specialty: 'Medicina General',
        fechaEmision: today, fechaVencimiento: expire,
        prevision: 'fonasa', coveragePercent: 60, discountGlobal: 0,
        items: [
          { description: 'Consulta médica general', quantity: 1, unitPrice: 25000, discountPct: 0, subtotal: 25000 },
          { description: 'Examen de sangre completo', quantity: 1, unitPrice: 18000, discountPct: 0, subtotal: 18000 }
        ],
        notes: 'Paciente FONASA A', status: 'sent',
        createdAt: today, updatedAt: today
      },
      {
        id: 2, numero: 'PRES-2025-0002', patientName: 'Carlos Pérez', patientRut: '9.876.543-2',
        patientPhone: '+56987654321', patientEmail: 'carlos@correo.com',
        doctorName: 'Dr. Ramírez', specialty: 'Odontología',
        fechaEmision: today, fechaVencimiento: expire,
        prevision: 'particular', coveragePercent: 0, discountGlobal: 10,
        items: [
          { description: 'Ortodoncia - bracket metálico', quantity: 1, unitPrice: 850000, discountPct: 0, subtotal: 850000 },
          { description: 'Control mensual (12 meses)', quantity: 12, unitPrice: 15000, discountPct: 0, subtotal: 180000 }
        ],
        notes: '', status: 'approved',
        createdAt: today, updatedAt: today
      },
      {
        id: 3, numero: 'PRES-2025-0003', patientName: 'Ana Torres', patientRut: '15.222.333-4',
        patientPhone: '+56922333444', patientEmail: 'ana@correo.com',
        doctorName: 'Ps. Vega', specialty: 'Psicología',
        fechaEmision: today, fechaVencimiento: expire,
        prevision: 'isapre', coveragePercent: 40, discountGlobal: 0,
        items: [
          { description: 'Sesión psicológica individual', quantity: 8, unitPrice: 45000, discountPct: 0, subtotal: 360000 }
        ],
        notes: 'Paquete 8 sesiones', status: 'draft',
        createdAt: today, updatedAt: today
      }
    ];
  }
}
