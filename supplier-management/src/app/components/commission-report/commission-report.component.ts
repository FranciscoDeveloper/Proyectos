import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GenericCrudService } from '../../services/generic-crud.service';

export interface ProfCommission {
  name:               string;
  initials:           string;
  color:              string;
  specialty:          string;
  totalPayments:      number;
  totalInvoiced:      number;
  avgRate:            number;
  totalCommission:    number;
  paidCommission:     number;
  pendingCommission:  number;
  payments:           Record<string, any>[];
}

type FilterStatus = 'all' | 'pendiente' | 'pagada';

const AVATAR_COLORS = ['#6366f1','#10b981','#ef4444','#f59e0b','#8b5cf6','#14b8a6','#ec4899','#3b82f6'];

function colorForName(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

@Component({
  selector: 'app-commission-report',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './commission-report.component.html',
  styleUrl: './commission-report.component.scss'
})
export class CommissionReportComponent implements OnInit {
  private crud = inject(GenericCrudService);

  filterStatus = signal<FilterStatus>('all');
  expandedProf = signal<string | null>(null);
  paying       = signal<Set<number>>(new Set());

  private _payments = this.crud.getAll('payments');

  readonly professionals = computed<ProfCommission[]>(() => {
    const all = this._payments().filter(p => !!p['professionalName']);

    // Group by professional
    const map = new Map<string, Record<string, any>[]>();
    for (const p of all) {
      const n = p['professionalName'] as string;
      if (!map.has(n)) map.set(n, []);
      map.get(n)!.push(p);
    }

    const result: ProfCommission[] = [];
    map.forEach((payments, name) => {
      const total    = payments.reduce((s, p) => s + (Number(p['commissionAmount']) || 0), 0);
      const paid     = payments.filter(p => p['commissionStatus'] === 'pagada').reduce((s, p) => s + (Number(p['commissionAmount']) || 0), 0);
      const pending  = payments.filter(p => p['commissionStatus'] === 'pendiente').reduce((s, p) => s + (Number(p['commissionAmount']) || 0), 0);
      const avgRate  = payments.reduce((s, p) => s + (Number(p['commissionRate']) || 0), 0) / payments.length;

      const flt = this.filterStatus();
      if (flt === 'pendiente' && pending === 0) return;
      if (flt === 'pagada'    && paid    === 0) return;

      // Derive specialty label from most common concept
      const conceptCount = new Map<string, number>();
      for (const p of payments) {
        const c = p['concept'] as string;
        conceptCount.set(c, (conceptCount.get(c) ?? 0) + 1);
      }
      const topConcept = [...conceptCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
      const specialtyMap: Record<string, string> = {
        consulta: 'Medicina General', psicologia: 'Psicología',
        odontologia: 'Odontología', procedimiento: 'Procedimientos', examenes: 'Exámenes'
      };

      result.push({
        name,
        initials: name.replace(/^(Dra?\.|Ps\.)\s*/i, '').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase(),
        color: colorForName(name),
        specialty: specialtyMap[topConcept] ?? 'Salud',
        totalPayments:     payments.length,
        totalInvoiced:     payments.reduce((s, p) => s + (Number(p['amount']) || 0), 0),
        avgRate:           Math.round(avgRate),
        totalCommission:   total,
        paidCommission:    paid,
        pendingCommission: pending,
        payments:          [...payments].sort((a, b) => new Date(b['date']).getTime() - new Date(a['date']).getTime()),
      });
    });

    return result.sort((a, b) => b.totalCommission - a.totalCommission);
  });

  readonly totals = computed(() => {
    const profs = this.professionals();
    return {
      count:      profs.length,
      invoiced:   profs.reduce((s, p) => s + p.totalInvoiced,     0),
      commission: profs.reduce((s, p) => s + p.totalCommission,   0),
      paid:       profs.reduce((s, p) => s + p.paidCommission,     0),
      pending:    profs.reduce((s, p) => s + p.pendingCommission,  0),
    };
  });

  ngOnInit(): void {
    this.crud.initStore('payments');
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  setFilter(f: FilterStatus): void {
    this.filterStatus.set(f);
    this.expandedProf.set(null);
  }

  toggleExpand(name: string): void {
    this.expandedProf.update(v => v === name ? null : name);
  }

  isExpanded(name: string): boolean {
    return this.expandedProf() === name;
  }

  markPaid(paymentId: number): void {
    const current = new Set(this.paying());
    current.add(paymentId);
    this.paying.set(current);

    this.crud.update('payments', paymentId, { commissionStatus: 'pagada' });

    // Remove from paying set after a short delay (optimistic UI)
    setTimeout(() => {
      const s = new Set(this.paying());
      s.delete(paymentId);
      this.paying.set(s);
    }, 600);
  }

  markAllPending(prof: ProfCommission): void {
    const pending = prof.payments.filter(p => p['commissionStatus'] === 'pendiente');
    for (const p of pending) {
      this.markPaid(p['id'] as number);
    }
  }

  isPaying(id: number): boolean {
    return this.paying().has(id);
  }

  // ── Formatting ────────────────────────────────────────────────────────────

  fmtCurrency(n: number): string {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `$${Math.round(n / 1_000)}k`;
    return `$${n.toLocaleString('es-CL')}`;
  }

  fmtFull(n: number): string {
    return '$' + n.toLocaleString('es-CL');
  }

  fmtDate(d: string): string {
    if (!d) return '';
    return new Date(d + 'T00:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  conceptLabel(c: string): string {
    const map: Record<string, string> = {
      consulta: 'Consulta', procedimiento: 'Procedimiento', examenes: 'Exámenes',
      psicologia: 'Psicología', odontologia: 'Odontología', medicamentos: 'Medicamentos', otro: 'Otro'
    };
    return map[c] ?? c;
  }

  pendingCount(prof: ProfCommission): number {
    return prof.payments.filter(p => p['commissionStatus'] === 'pendiente').length;
  }
}
