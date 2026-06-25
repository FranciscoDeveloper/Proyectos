import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
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
  let offset = 0;
  return items.map(item => {
    const len = (item.pct / 100) * DONUT_C;
    const seg: DonutSegment = { ...item, dashArray: `${len} ${DONUT_C - len}`, dashOffset: offset };
    offset += len;
    return seg;
  });
}

@Component({
  selector: 'app-medical-reports',
  imports: [CommonModule],
  templateUrl: './medical-reports.component.html',
  styleUrl:    './medical-reports.component.scss'
})
export class MedicalReportsComponent {
  private crud = inject(GenericCrudService);
  private auth = inject(AuthService);

  period = signal<Period>('30d');
  setPeriod(p: Period) { this.period.set(p); }

  private _appointments = this.crud.getAll('appointments');
  private _records      = this.crud.getAll('clinical-records');
  private _presupuestos = this.crud.getAll('presupuestos');

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

  // ══════════════════════ CITAS ══════════════════════════════════════════════

  kpiAppt = computed(() => {
    const all       = this.inPeriod(this._appointments(), 'dateTime');
    const total     = all.length;
    const completed = all.filter(a => a['status'] === 'completed').length;
    const scheduled = all.filter(a => a['status'] === 'scheduled' || a['status'] === 'confirmed').length;
    const noShow    = all.filter(a => a['status'] === 'no_show').length;
    const cancelled = all.filter(a => a['status'] === 'cancelled').length;
    return {
      total, completed, scheduled, noShow, cancelled,
      attendanceRate: total ? Math.round((completed / total) * 100) : 0,
      noShowRate:     total ? Math.round((noShow    / total) * 100) : 0,
    };
  });

  apptStatusDonut = computed((): DonutSegment[] => {
    const all   = this.inPeriod(this._appointments(), 'dateTime');
    const total = all.length || 1;
    const defs  = [
      { key: 'completed', label: 'Completada', color: '#10b981' },
      { key: 'scheduled', label: 'Programada', color: '#3b82f6' },
      { key: 'confirmed', label: 'Confirmada', color: '#8b5cf6' },
      { key: 'cancelled', label: 'Cancelada',  color: '#ef4444' },
      { key: 'no_show',   label: 'No asistió', color: '#f59e0b' },
    ];
    return buildDonut(defs.map(d => ({
      ...d,
      count: all.filter(a => a['status'] === d.key).length,
      pct:   Math.round(all.filter(a => a['status'] === d.key).length / total * 100),
    })));
  });

  apptByDow = computed((): BarItem[] => {
    const all    = this.inPeriod(this._appointments(), 'dateTime');
    const days   = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const colors = ['#6b7280','#6366f1','#6366f1','#6366f1','#6366f1','#6366f1','#6b7280'];
    const counts = new Array(7).fill(0);
    for (const a of all) {
      const d = new Date(a['dateTime']);
      if (!isNaN(d.getTime())) counts[d.getDay()]++;
    }
    const max = Math.max(...counts, 1);
    return days.map((label, i) => ({
      label, count: counts[i], pct: Math.round((counts[i] / max) * 100), color: colors[i],
    }));
  });

  apptTopMotives = computed((): BarItem[] => {
    const all     = this.inPeriod(this._appointments(), 'dateTime');
    const map     = new Map<string, number>();
    for (const a of all) {
      const key = (String(a['service'] ?? 'Sin especificar')).trim() || 'Sin especificar';
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    const sorted  = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const max     = sorted[0]?.[1] || 1;
    const palette = ['#6366f1','#8b5cf6','#3b82f6','#06b6d4','#10b981'];
    return sorted.map(([label, count], i) => ({
      label, count, pct: Math.round((count / max) * 100), color: palette[i],
    }));
  });

  apptModalityDonut = computed((): DonutSegment[] => {
    const all    = this.inPeriod(this._appointments(), 'dateTime');
    const total  = all.length || 1;
    const map    = new Map<string, number>();
    for (const a of all) {
      const k = String(a['modality'] ?? 'in_person');
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    const LABELS: Record<string, string> = { in_person: 'Presencial', video: 'Videoconsulta', phone: 'Teléfono' };
    const COLORS: Record<string, string> = { in_person: '#6366f1',    video:  '#0891b2',       phone: '#10b981'  };
    return buildDonut([...map.entries()].sort((a, b) => b[1] - a[1]).map(([k, count]) => ({
      label: LABELS[k] ?? k, count, pct: Math.round((count / total) * 100), color: COLORS[k] ?? '#9ca3af',
    })));
  });

  // ══════════════════════ FICHAS CLÍNICAS ════════════════════════════════════

  kpiRecords = computed(() => {
    const all      = this._records();
    const encounters = all.reduce((s, r) =>
      s + (Array.isArray(r['encounters']) ? r['encounters'].length : 0), 0);
    const withAlerts = all.filter(r =>
      (r['alertNotes'] && String(r['alertNotes']).trim()) ||
      (Array.isArray(r['allergies']) && r['allergies'].length > 0)
    ).length;
    return {
      total: all.length,
      encounters,
      withAlerts,
      avgEncounters: all.length ? +(encounters / all.length).toFixed(1) : 0,
    };
  });

  genderDonut = computed((): DonutSegment[] => {
    const all   = this._records();
    const total = all.length || 1;
    const map   = new Map<string, number>();
    for (const r of all) map.set(String(r['gender'] ?? 'otro'), (map.get(String(r['gender'] ?? 'otro')) ?? 0) + 1);
    const LABELS: Record<string, string> = { male: 'Masculino', female: 'Femenino', other: 'Otro', otro: 'Otro' };
    const COLORS: Record<string, string> = { male: '#3b82f6',   female: '#ec4899',  other: '#9ca3af', otro: '#9ca3af' };
    return buildDonut([...map.entries()].sort((a, b) => b[1] - a[1]).map(([k, count]) => ({
      label: LABELS[k] ?? k, count, pct: Math.round((count / total) * 100), color: COLORS[k] ?? '#9ca3af',
    })));
  });

  ageGroupDist = computed((): BarItem[] => {
    const all    = this._records();
    const groups = [
      { label: '0–17',  min: 0,  max: 17,  color: '#06b6d4' },
      { label: '18–35', min: 18, max: 35,  color: '#6366f1' },
      { label: '36–50', min: 36, max: 50,  color: '#8b5cf6' },
      { label: '51–65', min: 51, max: 65,  color: '#f59e0b' },
      { label: '65+',   min: 66, max: 999, color: '#ef4444' },
    ];
    const counts = groups.map(g => ({
      ...g,
      count: all.filter(r => { const a = Number(r['age']); return a >= g.min && a <= g.max; }).length,
    }));
    const max = Math.max(...counts.map(c => c.count), 1);
    return counts.map(c => ({ ...c, pct: Math.round((c.count / max) * 100) }));
  });

  insuranceDist = computed((): BarItem[] => {
    const all   = this._records();
    const total = all.length || 1;
    const map   = new Map<string, number>();
    for (const r of all) {
      const k = String(r['insurance'] ?? 'particular');
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    // Supports both legacy snake_case keys and new DB values (e.g. 'FONASA A')
    const KNOWN_COLORS: Record<string, string> = {
      fonasa_a: '#10b981', fonasa_b: '#34d399', fonasa_c: '#6366f1', fonasa_d: '#8b5cf6',
      isapre: '#f59e0b', particular: '#9ca3af',
      'FONASA A': '#10b981', 'FONASA B': '#34d399', 'FONASA C': '#6366f1', 'FONASA D': '#8b5cf6',
      'ISAPRE': '#f59e0b', 'Particular': '#9ca3af', 'Sin Previsión': '#6b7280',
      'CAPREDENA': '#3b82f6', 'DIPRECA': '#06b6d4',
    };
    const FALLBACK_PALETTE = ['#10b981','#6366f1','#3b82f6','#f59e0b','#8b5cf6','#06b6d4','#9ca3af'];
    return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([k, count], i) => ({
      label: k,
      count,
      pct:   Math.round((count / total) * 100),
      color: KNOWN_COLORS[k] ?? FALLBACK_PALETTE[i % FALLBACK_PALETTE.length],
    }));
  });

  topConditions = computed((): BarItem[] => {
    const all = this._records();
    const map = new Map<string, number>();
    for (const r of all) {
      if (Array.isArray(r['chronicConditions']))
        for (const c of r['chronicConditions']) map.set(String(c), (map.get(String(c)) ?? 0) + 1);
    }
    const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7);
    const max    = sorted[0]?.[1] || 1;
    return sorted.map(([label, count]) => ({
      label, count, pct: Math.round((count / max) * 100), color: '#ef4444',
    }));
  });

  topDiagnoses = computed((): (BarItem & { code: string })[] => {
    const all = this._records();
    const map = new Map<string, { code: string; label: string; count: number }>();
    for (const r of all) {
      const code  = String(r['diagnosisCode'] ?? '').trim();
      const label = String(r['diagnosisLabel'] ?? code).trim();
      if (!code) continue;
      const ex = map.get(code);
      if (ex) ex.count++;
      else    map.set(code, { code, label, count: 1 });
    }
    const sorted  = [...map.values()].sort((a, b) => b.count - a.count).slice(0, 6);
    const max     = sorted[0]?.count || 1;
    const palette = ['#6366f1','#8b5cf6','#3b82f6','#06b6d4','#10b981','#f59e0b'];
    return sorted.map((d, i) => ({
      code: d.code, label: d.label, count: d.count,
      pct:   Math.round((d.count / max) * 100),
      color: palette[i % palette.length],
    }));
  });

  // ══════════════════════ PRESUPUESTOS ═══════════════════════════════════════

  kpiPresupuestos = computed(() => {
    const all        = this._presupuestos();
    const now        = new Date().toISOString().slice(0, 10);
    const soon       = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
    const sent       = all.filter(p => p['status'] !== 'draft');
    const approved   = all.filter(p => p['status'] === 'approved' || p['status'] === 'converted');
    const active     = all.filter(p => p['status'] !== 'rejected' && p['status'] !== 'expired');
    return {
      total:          all.length,
      pipelineValue:  active.reduce((s, p) => s + this._presTotal(p), 0),
      conversionRate: sent.length ? Math.round((approved.length / sent.length) * 100) : 0,
      expiringSoon:   all.filter(p =>
        p['status'] === 'sent' && p['fechaVencimiento'] >= now && p['fechaVencimiento'] <= soon
      ).length,
      approved:       approved.length,
      pending:        all.filter(p => p['status'] === 'sent').length,
    };
  });

  presupuestosStatusDonut = computed((): DonutSegment[] => {
    const all   = this._presupuestos();
    const total = all.length || 1;
    const defs  = [
      { key: 'approved',  label: 'Aprobado',   color: '#10b981' },
      { key: 'converted', label: 'Convertido', color: '#6366f1' },
      { key: 'sent',      label: 'Enviado',    color: '#3b82f6' },
      { key: 'draft',     label: 'Borrador',   color: '#9ca3af' },
      { key: 'rejected',  label: 'Rechazado',  color: '#ef4444' },
      { key: 'expired',   label: 'Vencido',    color: '#f59e0b' },
    ];
    return buildDonut(
      defs
        .map(d => ({
          ...d,
          count: all.filter(p => p['status'] === d.key).length,
          pct:   Math.round(all.filter(p => p['status'] === d.key).length / total * 100),
        }))
        .filter(d => d.count > 0)
    );
  });

  topSpecialtiesBudget = computed((): AmountBar[] => {
    const all     = this._presupuestos();
    const map     = new Map<string, number>();
    for (const p of all) {
      if (p['status'] === 'rejected') continue;
      const k = String(p['specialty'] || p['doctorName'] || 'Sin especificar').trim();
      map.set(k, (map.get(k) ?? 0) + this._presTotal(p));
    }
    const sorted  = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    const max     = sorted[0]?.[1] || 1;
    const palette = ['#6366f1','#8b5cf6','#3b82f6','#06b6d4','#10b981','#f59e0b'];
    return sorted.map(([label, amount], i) => ({
      label, amount, pct: Math.round((amount / max) * 100), color: palette[i],
    }));
  });

  topBudgetItems = computed((): BarItem[] => {
    const all = this._presupuestos();
    const map = new Map<string, number>();
    for (const p of all) {
      for (const item of (Array.isArray(p['items']) ? p['items'] : [])) {
        const k = String(item['description'] ?? 'Sin descripción').trim();
        if (k) map.set(k, (map.get(k) ?? 0) + (Number(item['quantity']) || 1));
      }
    }
    const sorted  = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7);
    const max     = sorted[0]?.[1] || 1;
    const palette = ['#6366f1','#8b5cf6','#3b82f6','#06b6d4','#10b981','#f59e0b','#ec4899'];
    return sorted.map(([label, count], i) => ({
      label, count, pct: Math.round((count / max) * 100), color: palette[i % palette.length],
    }));
  });

  previsionBudgetDist = computed((): BarItem[] => {
    const all = this._presupuestos();
    const map = new Map<string, number>();
    for (const p of all) {
      const k = String(p['prevision'] ?? 'particular');
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    const LABELS: Record<string, string> = {
      particular: 'Particular', fonasa: 'FONASA', banmedica: 'Banmédica',
      colmena: 'Colmena', consalud: 'Consalud', cruzblanca: 'Cruz Blanca',
      isapre: 'Isapre', capredena: 'CAPREDENA',
    };
    const COLORS: Record<string, string> = {
      particular: '#9ca3af', fonasa: '#10b981', banmedica: '#6366f1',
      colmena: '#8b5cf6', consalud: '#3b82f6', cruzblanca: '#06b6d4',
      isapre: '#f59e0b', capredena: '#ef4444',
    };
    const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]);
    const max    = sorted[0]?.[1] || 1;
    return sorted.map(([k, count]) => ({
      label: LABELS[k] ?? k, count, pct: Math.round((count / max) * 100), color: COLORS[k] ?? '#9ca3af',
    }));
  });

  private _presTotal(p: Record<string, any>): number {
    const subtotal = (Array.isArray(p['items']) ? p['items'] : []).reduce((s: number, item: any) => {
      const qty  = Math.max(0, +item['quantity']   || 0);
      const price= Math.max(0, +item['unitPrice']  || 0);
      const disc = Math.min(100, Math.max(0, +item['discountPct'] || 0));
      return s + qty * price * (1 - disc / 100);
    }, 0);
    const gDisc = Math.min(100, Math.max(0, +p['discountGlobal'] || 0));
    return Math.max(0, subtotal * (1 - gDisc / 100));
  }

  // ══════════════════════ HELPERS ════════════════════════════════════════════

  readonly donutCircumference = DONUT_C;
  readonly donutR             = DONUT_R;

  fmt(n: number): string {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `$${Math.round(n / 1_000)}k`;
    return `$${n.toLocaleString('es-CL')}`;
  }

  userName    = computed(() => this.auth.user()?.name ?? '');
  periodLabel = computed(() =>
    this.period() === '7d'  ? 'Últimos 7 días' :
    this.period() === '30d' ? 'Últimos 30 días' : 'Todo el período'
  );

  hasAnyData = computed(() =>
    this._appointments().length > 0 ||
    this._records().length > 0 ||
    this._presupuestos().length > 0
  );
}
