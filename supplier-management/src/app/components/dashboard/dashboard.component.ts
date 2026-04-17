import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { GenericCrudService } from '../../services/generic-crud.service';
import { EntitySchema, FieldDefinition } from '../../models/entity-schema.model';

interface EntityCard {
  schema: EntitySchema;
  total: number;
  statusField: FieldDefinition | null;
  statusDist: { label: string; value: string; count: number; color: string; pct: number }[];
  currencyTotals: { label: string; total: number }[];
  ratingAvg: number | null;
  titleField: FieldDefinition | null;
  subtitleField: FieldDefinition | null;
}

interface RecentItem {
  id: number;
  title: string;
  subtitle: string;
  entityKey: string;
  entityPlural: string;
  statusLabel: string;
  statusColor: string;
  hasStatus: boolean;
  updatedAt: string;
}

interface ApptRow {
  id: number;
  patientName: string;
  time: string;
  service: string;
  professional: string;
  status: string;
  statusLabel: string;
  statusColor: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {
  readonly auth   = inject(AuthService);
  private crudSvc = inject(GenericCrudService);

  // ── Clinic profile detection ───────────────────────────────────────────────
  isClinicProfile = computed(() =>
    this.auth.schemas().some(s => s.entity.key === 'appointments')
  );

  // ── Today's date string (YYYY-MM-DD) ──────────────────────────────────────
  private readonly today = new Date().toISOString().slice(0, 10);
  private readonly monthYear = this.today.slice(0, 7);

  // ── Clinic KPI stats ──────────────────────────────────────────────────────
  clinicKpis = computed(() => {
    const appts    = this.crudSvc.getAll('appointments')();
    const patients = this.crudSvc.getAll('paciente')();
    const payments = this.crudSvc.getAll('payments')();

    const todayAppts   = appts.filter(a => String(a['dateTime'] ?? '').startsWith(this.today));
    const pendingAppts = appts.filter(a => a['status'] === 'AGENDADA');
    const monthRev     = payments
      .filter(p => String(p['date'] ?? '').startsWith(this.monthYear))
      .reduce((s, p) => s + (Number(p['amount']) || 0), 0);

    return {
      todayCount:   todayAppts.length,
      revenue:      monthRev,
      totalPatients: patients.length,
      pendingCount: pendingAppts.length
    };
  });

  // ── Today's appointments sorted by time ───────────────────────────────────
  todayAppointments = computed<ApptRow[]>(() => {
    const STATUS_LABELS: Record<string, string> = {
      AGENDADA: 'Agendada', COMPLETADA: 'Completada',
      CANCELADA: 'Cancelada', NO_ASISTIO: 'No asistió'
    };
    const STATUS_COLORS: Record<string, string> = {
      AGENDADA: '#3b82f6', COMPLETADA: '#10b981',
      CANCELADA: '#ef4444', NO_ASISTIO: '#f59e0b'
    };

    return this.crudSvc.getAll('appointments')()
      .filter(a => String(a['dateTime'] ?? '').startsWith(this.today))
      .sort((a, b) => String(a['dateTime']).localeCompare(String(b['dateTime'])))
      .map(a => ({
        id:           Number(a['id']),
        patientName:  String(a['patientName'] ?? ''),
        time:         this.formatTime(String(a['dateTime'] ?? '')),
        service:      String(a['service'] ?? ''),
        professional: String(a['professionalName'] ?? ''),
        status:       String(a['status'] ?? ''),
        statusLabel:  STATUS_LABELS[String(a['status'])] ?? String(a['status']),
        statusColor:  STATUS_COLORS[String(a['status'])] ?? '#6b7280'
      }));
  });

  // ── Generic entity cards (non-clinic profiles) ────────────────────────────
  entityCards = computed<EntityCard[]>(() =>
    this.auth.schemas().map(schema => {
      const data        = this.crudSvc.getAll(schema.entity.key)();
      const statusField = schema.fields.find(f => f.name === 'status' && f.isBadge && f.type === 'select') ?? null;
      const titleField  = schema.fields.find(f => f.isTitle)    ?? null;
      const subtitleField = schema.fields.find(f => f.isSubtitle) ?? null;
      const ratingField = schema.fields.find(f => f.format === 'stars') ?? null;
      const currencyFields = schema.fields.filter(f => f.format === 'currency' && f.showInList);

      const statusDist = (statusField?.options ?? []).map(opt => {
        const count = data.filter(item => item[statusField!.name] === opt.value).length;
        return {
          label: opt.label, value: opt.value, count,
          color: statusField!.badgeColors?.[opt.value] ?? '#6b7280',
          pct: data.length ? Math.round((count / data.length) * 100) : 0
        };
      });

      const currencyTotals = currencyFields.map(f => ({
        label: f.label,
        total: data.reduce((sum, item) => sum + (Number(item[f.name]) || 0), 0)
      }));

      const ratingAvg = (ratingField && data.length)
        ? data.reduce((sum, item) => sum + (Number(item[ratingField.name]) || 0), 0) / data.length
        : null;

      return { schema, total: data.length, statusField, statusDist, currencyTotals, ratingAvg, titleField, subtitleField };
    })
  );

  recentActivity = computed<RecentItem[]>(() => {
    const items: RecentItem[] = [];
    for (const schema of this.auth.schemas()) {
      const data          = this.crudSvc.getAll(schema.entity.key)();
      const titleField    = schema.fields.find(f => f.isTitle);
      const subtitleField = schema.fields.find(f => f.isSubtitle);
      const statusField   = schema.fields.find(f => f.name === 'status' && f.isBadge);

      [...data]
        .sort((a, b) => new Date(b['updatedAt'] ?? 0).getTime() - new Date(a['updatedAt'] ?? 0).getTime())
        .slice(0, 4)
        .forEach(item => items.push({
          id:           item['id'],
          title:        titleField    ? String(item[titleField.name]    ?? '') : `#${item['id']}`,
          subtitle:     subtitleField ? String(item[subtitleField.name] ?? '') : '',
          entityKey:    schema.entity.key,
          entityPlural: schema.entity.plural,
          statusLabel:  statusField?.options?.find(o => o.value === item[statusField.name])?.label ?? '',
          statusColor:  statusField?.badgeColors?.[item[statusField.name]] ?? '#6b7280',
          hasStatus:    !!statusField && !!item[statusField.name],
          updatedAt:    String(item['updatedAt'] ?? '')
        }));
    }
    return items
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 8);
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  private formatTime(dateTime: string): string {
    const d = new Date(dateTime);
    return isNaN(d.getTime()) ? dateTime :
      d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  formatCurrency(value: number): string {
    if (value >= 1_000_000) return '$' + (value / 1_000_000).toFixed(1) + 'M';
    if (value >= 1_000)     return '$' + (value / 1_000).toFixed(0) + 'K';
    return '$' + value.toFixed(0);
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const diffDays = Math.floor((Date.now() - d.getTime()) / 86_400_000);
    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 30)  return `Hace ${diffDays}d`;
    return d.toLocaleDateString('es', { day: '2-digit', month: 'short' });
  }

  getAvatarColor(name: string): string {
    const colors = [
      'linear-gradient(135deg,#6366f1,#8b5cf6)',
      'linear-gradient(135deg,#10b981,#059669)',
      'linear-gradient(135deg,#3b82f6,#2563eb)',
      'linear-gradient(135deg,#f59e0b,#d97706)',
      'linear-gradient(135deg,#ef4444,#dc2626)',
      'linear-gradient(135deg,#06b6d4,#0891b2)',
      'linear-gradient(135deg,#ec4899,#db2777)',
    ];
    return colors[name.charCodeAt(0) % colors.length];
  }

  get todayLabel(): string {
    return new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
  }
}
