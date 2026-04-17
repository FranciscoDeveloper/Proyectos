import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { GenericCrudService } from '../../services/generic-crud.service';
import { AuthService } from '../../services/auth.service';

export type Period = '7d' | '30d' | 'all';

interface DonutSegment {
  label:      string;
  count:      number;
  pct:        number;
  color:      string;
  dashArray:  string;
  dashOffset: number;
}

interface BarItem {
  label: string;
  count: number;
  pct:   number;
  color: string;
}

interface AmountBar {
  label:  string;
  amount: number;
  pct:    number;
  color:  string;
}

const DONUT_R = 40;
const DONUT_C = 2 * Math.PI * DONUT_R;

function buildDonut(
  items: { label: string; count: number; pct: number; color: string }[]
): DonutSegment[] {
  let accumulated = 0;
  return items.map(item => {
    const len = (item.pct / 100) * DONUT_C;
    const seg: DonutSegment = {
      ...item,
      dashArray:  `${len} ${DONUT_C - len}`,
      dashOffset: accumulated,
    };
    accumulated += len;
    return seg;
  });
}

@Component({
  selector: 'app-medical-reports',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './medical-reports.component.html',
  styleUrl:    './medical-reports.component.scss',
})
export class MedicalReportsComponent {
  private crud = inject(GenericCrudService);
  private auth = inject(AuthService);

  period = signal<Period>('30d');
  setPeriod(p: Period) { this.period.set(p); }

  private _appointments = this.crud.getAll('appointments');
  private _patients     = this.crud.getAll('patients');
  private _records      = this.crud.getAll('clinical-records');
  private _payments     = this.crud.getAll('payments');

  private inPeriod(data: Record<string, any>[], dateField: string): Record<string, any>[] {
    const p = this.period();
    if (p === 'all') return data;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (p === '7d' ? 7 : 30));
    return data.filter(r => {
      const d = r[dateField];
      return d && new Date(d) >= cutoff;
    });
  }

  // ── KPIs ─────────────────────────────────────────────────────────────────

  kpiAppt = computed(() => {
    const all       = this.inPeriod(this._appointments(), 'startDate');
    const total     = all.length;
    const completed = all.filter(a => a['status'] === 'completed').length;
    const scheduled = all.filter(a => a['status'] === 'scheduled').length;
    const noShow    = all.filter(a => a['status'] === 'no_show').length;
    const cancelled = all.filter(a => a['status'] === 'cancelled').length;
    return {
      total, completed, scheduled, noShow, cancelled,
      attendanceRate: total ? Math.round((completed / total) * 100) : 0,
    };
  });

  kpiPatients = computed(() => {
    const all      = this._patients();
    const active   = all.filter(p => p['status'] === 'active').length;
    const critical = all.filter(p => p['status'] === 'critical').length;
    return { total: all.length, active, critical };
  });

  kpiRevenue = computed(() => {
    const all     = this.inPeriod(this._payments(), 'date');
    const revenue = all.reduce((s, p) => s + (Number(p['amount']) || 0), 0);
    const myName  = this.auth.user()?.name ?? '';
    const myPays  = all.filter(p => p['professionalName'] === myName);
    const myComm  = myPays.reduce((s, p) => s + (Number(p['commissionAmount']) || 0), 0);
    const pending = myPays
      .filter(p => p['commissionStatus'] === 'pendiente')
      .reduce((s, p) => s + (Number(p['commissionAmount']) || 0), 0);
    return { revenue, myComm, pending };
  });

  kpiRecords = computed(() => {
    const all = this._records();
    return { total: all.length };
  });

  // ── Appointment charts ────────────────────────────────────────────────────

  apptStatusDonut = computed((): DonutSegment[] => {
    const all   = this.inPeriod(this._appointments(), 'startDate');
    const total = all.length || 1;
    const defs  = [
      { key: 'completed', label: 'Completada', color: '#10b981' },
      { key: 'scheduled', label: 'Programada', color: '#3b82f6' },
      { key: 'cancelled', label: 'Cancelada',  color: '#ef4444' },
      { key: 'no_show',   label: 'No asistió', color: '#f59e0b' },
    ];
    const items = defs.map(d => ({
      ...d,
      count: all.filter(a => a['status'] === d.key).length,
      pct:   Math.round(all.filter(a => a['status'] === d.key).length / total * 100),
    }));
    return buildDonut(items);
  });

  apptByDow = computed((): BarItem[] => {
    const all    = this.inPeriod(this._appointments(), 'startDate');
    const days   = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const colors = ['#6b7280','#6366f1','#6366f1','#6366f1','#6366f1','#6366f1','#6b7280'];
    const counts = new Array(7).fill(0);
    for (const a of all) {
      const d = new Date(a['startDate']);
      if (!isNaN(d.getTime())) counts[d.getDay()]++;
    }
    const max = Math.max(...counts, 1);
    return days.map((label, i) => ({
      label, count: counts[i], pct: Math.round((counts[i] / max) * 100), color: colors[i],
    }));
  });

  apptTopMotives = computed((): BarItem[] => {
    const all = this.inPeriod(this._appointments(), 'startDate');
    const map = new Map<string, number>();
    for (const a of all) {
      const key = (a['title'] as string || 'Otro').trim();
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const max    = sorted[0]?.[1] || 1;
    const palette = ['#6366f1','#8b5cf6','#3b82f6','#06b6d4','#10b981'];
    return sorted.map(([label, count], i) => ({
      label, count, pct: Math.round((count / max) * 100), color: palette[i % palette.length],
    }));
  });

  // ── Patient charts ────────────────────────────────────────────────────────

  patientStatusDonut = computed((): DonutSegment[] => {
    const all   = this._patients();
    const total = all.length || 1;
    const defs  = [
      { key: 'active',     label: 'Activo',    color: '#10b981' },
      { key: 'critical',   label: 'Crítico',   color: '#ef4444' },
      { key: 'scheduled',  label: 'Agendado',  color: '#3b82f6' },
      { key: 'discharged', label: 'Alta',      color: '#9ca3af' },
    ];
    const items = defs.map(d => ({
      ...d,
      count: all.filter(p => p['status'] === d.key).length,
      pct:   Math.round(all.filter(p => p['status'] === d.key).length / total * 100),
    }));
    return buildDonut(items);
  });

  insuranceDist = computed((): BarItem[] => {
    const all   = this._patients();
    const total = all.length || 1;
    const map   = new Map<string, number>();
    for (const p of all) {
      const k = String(p['insurance'] ?? 'particular');
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    const labels: Record<string, string> = {
      fonasa_a: 'FONASA A', fonasa_b: 'FONASA B', fonasa_c: 'FONASA C',
      fonasa_d: 'FONASA D', isapre: 'Isapre', particular: 'Particular',
    };
    const colors: Record<string, string> = {
      fonasa_a: '#10b981', fonasa_b: '#34d399', fonasa_c: '#6366f1',
      fonasa_d: '#8b5cf6', isapre: '#f59e0b', particular: '#9ca3af',
    };
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k, count]) => ({
        label: labels[k] ?? k,
        count,
        pct:   Math.round((count / total) * 100),
        color: colors[k] ?? '#9ca3af',
      }));
  });

  topConditions = computed((): BarItem[] => {
    const all = this._records();
    const map = new Map<string, number>();
    for (const r of all) {
      const conds = r['chronicConditions'];
      if (Array.isArray(conds)) {
        for (const c of conds) map.set(String(c), (map.get(String(c)) ?? 0) + 1);
      }
    }
    const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7);
    const max    = sorted[0]?.[1] || 1;
    return sorted.map(([label, count]) => ({
      label, count, pct: Math.round((count / max) * 100), color: '#ef4444',
    }));
  });

  // ── Revenue charts ────────────────────────────────────────────────────────

  revenueByConceptBars = computed((): AmountBar[] => {
    const all = this.inPeriod(this._payments(), 'date');
    const map = new Map<string, number>();
    for (const p of all) {
      const k = String(p['concept'] ?? 'otro');
      map.set(k, (map.get(k) ?? 0) + (Number(p['amount']) || 0));
    }
    const labels: Record<string, string> = {
      consulta: 'Consulta', procedimiento: 'Procedimiento', examenes: 'Exámenes',
      psicologia: 'Psicología', odontologia: 'Odontología', medicamentos: 'Medicamentos', otro: 'Otro',
    };
    const colors: Record<string, string> = {
      consulta: '#6366f1', procedimiento: '#8b5cf6', examenes: '#3b82f6',
      psicologia: '#ec4899', odontologia: '#14b8a6', medicamentos: '#10b981', otro: '#6b7280',
    };
    const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]);
    const max    = sorted[0]?.[1] || 1;
    return sorted.map(([k, amount]) => ({
      label: labels[k] ?? k,
      amount,
      pct:   Math.round((amount / max) * 100),
      color: colors[k] ?? '#9ca3af',
    }));
  });

  paymentMethodDonut = computed((): DonutSegment[] => {
    const all   = this.inPeriod(this._payments(), 'date');
    const total = all.length || 1;
    const map   = new Map<string, number>();
    for (const p of all) {
      const k = String(p['paymentMethod'] ?? 'otro');
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    const labels: Record<string, string> = {
      fonasa: 'FONASA', isapre: 'Isapre', efectivo: 'Efectivo',
      debito: 'Débito', credito: 'Crédito', transferencia: 'Transferencia',
    };
    const colors: Record<string, string> = {
      fonasa: '#10b981', isapre: '#f59e0b', efectivo: '#6b7280',
      debito: '#3b82f6', credito: '#6366f1', transferencia: '#8b5cf6',
    };
    const items = [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k, count]) => ({
        label: labels[k] ?? k,
        count,
        pct:   Math.round((count / total) * 100),
        color: colors[k] ?? '#9ca3af',
      }));
    return buildDonut(items);
  });

  // ── Diagnoses ─────────────────────────────────────────────────────────────

  topDiagnoses = computed((): (BarItem & { code: string })[] => {
    const all = this._records();
    const map = new Map<string, { code: string; label: string; count: number }>();
    for (const r of all) {
      const code  = String(r['diagnosisCode'] ?? '');
      const label = String(r['diagnosisLabel'] ?? code);
      if (!code) continue;
      const ex = map.get(code);
      if (ex) ex.count++;
      else    map.set(code, { code, label, count: 1 });
    }
    const sorted = [...map.values()].sort((a, b) => b.count - a.count).slice(0, 6);
    const max    = sorted[0]?.count || 1;
    const palette = ['#6366f1','#8b5cf6','#3b82f6','#06b6d4','#10b981','#f59e0b'];
    return sorted.map((d, i) => ({
      code:  d.code,
      label: d.label,
      count: d.count,
      pct:   Math.round((d.count / max) * 100),
      color: palette[i % palette.length],
    }));
  });

  // ── SVG helper ────────────────────────────────────────────────────────────

  readonly donutCircumference = DONUT_C;
  readonly donutR             = DONUT_R;

  // ── Formatting ────────────────────────────────────────────────────────────

  fmt(n: number): string {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `$${Math.round(n / 1_000)}k`;
    return `$${n.toLocaleString('es-CL')}`;
  }

  commPaidPct = computed(() => {
    const { myComm, pending } = this.kpiRevenue();
    return myComm > 0 ? Math.round(((myComm - pending) / myComm) * 100) : 0;
  });

  userName = computed(() => this.auth.user()?.name ?? '');
  periodLabel = computed(() =>
    this.period() === '7d' ? 'Últimos 7 días' :
    this.period() === '30d' ? 'Últimos 30 días' : 'Todo el período'
  );
}
