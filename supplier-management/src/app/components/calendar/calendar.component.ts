import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SchemaService } from '../../services/schema.service';
import { GenericCrudService } from '../../services/generic-crud.service';

interface CalEvent {
  id: number;
  title: string;
  subtitle: string;
  date: Date;
  statusLabel: string;
  statusColor: string;
  entityKey: string;
}

interface CalDay {
  date: Date;
  dayNum: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: CalEvent[];
}

interface StatusStat {
  label: string;
  color: string;
  count: number;
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './calendar.component.html',
  styleUrl: './calendar.component.scss'
})
export class CalendarComponent {
  private route     = inject(ActivatedRoute);
  private schemaSvc = inject(SchemaService);
  private crudSvc   = inject(GenericCrudService);

  readonly entityKey = this.route.snapshot.paramMap.get('entityKey')!;
  readonly schema    = this.schemaSvc.getSchema(this.entityKey);

  // Month navigation state
  viewYear  = signal(new Date().getFullYear());
  viewMonth = signal(new Date().getMonth()); // 0-indexed

  // Schema-driven field roles — no hardcoded entity knowledge
  private readonly titleField    = this.schema?.fields.find(f => f.isTitle)         ?? null;
  private readonly subtitleField = this.schema?.fields.find(f => f.isSubtitle)      ?? null;
  private readonly startField    = this.schema?.fields.find(f => f.isCalendarStart) ?? null;
  private readonly statusField   = this.schema?.fields.find(f => f.isBadge && f.name === 'status') ?? null;

  readonly WEEK_DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  readonly MONTHS    = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                        'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  // All events derived from schema + generic data store
  readonly allEvents = computed<CalEvent[]>(() => {
    if (!this.startField) return [];
    const data = this.crudSvc.getAll(this.entityKey)();
    return data.map(item => {
      const rawDate   = item[this.startField!.name];
      // Append T00:00:00 so local-timezone Date parsing doesn't shift to previous day
      const date      = rawDate ? new Date(String(rawDate) + 'T00:00:00') : new Date();
      const statusVal = this.statusField ? item[this.statusField.name] : null;
      return {
        id:          item['id'],
        title:       this.titleField    ? String(item[this.titleField.name]    ?? '') : `#${item['id']}`,
        subtitle:    this.subtitleField ? String(item[this.subtitleField.name] ?? '') : '',
        date,
        statusLabel: this.statusField?.options?.find(o => o.value === statusVal)?.label ?? '',
        statusColor: this.statusField?.badgeColors?.[statusVal] ?? '#6b7280',
        entityKey:   this.entityKey
      };
    });
  });

  // Calendar grid: padded Mon-first, 7-col rows
  readonly calDays = computed<CalDay[]>(() => {
    const year  = this.viewYear();
    const month = this.viewMonth();
    const today = new Date();
    const evs   = this.allEvents();

    const firstDay = new Date(year, month, 1);
    const lastDay  = new Date(year, month + 1, 0);

    // Mon-first: Sun(0)→6, Mon(1)→0 … Sat(6)→5
    let startDow = firstDay.getDay();
    startDow = startDow === 0 ? 6 : startDow - 1;

    const days: CalDay[] = [];

    // Trailing days from previous month
    for (let i = startDow - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: d, dayNum: d.getDate(), isCurrentMonth: false, isToday: false, events: [] });
    }

    // Current month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date    = new Date(year, month, d);
      const isToday = date.toDateString() === today.toDateString();
      const dayEvs  = evs.filter(
        e => e.date.getFullYear() === year && e.date.getMonth() === month && e.date.getDate() === d
      );
      days.push({ date, dayNum: d, isCurrentMonth: true, isToday, events: dayEvs });
    }

    // Fill last row to multiple of 7
    const tail = 7 - (days.length % 7);
    if (tail < 7) {
      for (let i = 1; i <= tail; i++) {
        const d = new Date(year, month + 1, i);
        days.push({ date: d, dayNum: d.getDate(), isCurrentMonth: false, isToday: false, events: [] });
      }
    }

    return days;
  });

  readonly monthLabel = computed(() =>
    `${this.MONTHS[this.viewMonth()]} ${this.viewYear()}`
  );

  // ── Stats ───────────────────────────────────────────────────────────────────

  readonly statsThisMonth = computed(() => {
    const y = this.viewYear(), m = this.viewMonth();
    const monthEvs = this.allEvents().filter(
      e => e.date.getFullYear() === y && e.date.getMonth() === m
    );
    // Build per-status counts preserving color
    const map = new Map<string, StatusStat>();
    for (const ev of monthEvs) {
      const key = ev.statusLabel || '—';
      if (!map.has(key)) map.set(key, { label: key, color: ev.statusColor, count: 0 });
      map.get(key)!.count++;
    }
    return { total: monthEvs.length, statusStats: [...map.values()] };
  });

  readonly upcomingEvents = computed(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.allEvents()
      .filter(e => e.date >= today)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 6);
  });

  // ── Navigation ──────────────────────────────────────────────────────────────

  prevMonth() {
    if (this.viewMonth() === 0) { this.viewMonth.set(11); this.viewYear.update(y => y - 1); }
    else { this.viewMonth.update(m => m - 1); }
  }

  nextMonth() {
    if (this.viewMonth() === 11) { this.viewMonth.set(0); this.viewYear.update(y => y + 1); }
    else { this.viewMonth.update(m => m + 1); }
  }

  goToToday() {
    const t = new Date();
    this.viewMonth.set(t.getMonth());
    this.viewYear.set(t.getFullYear());
  }
}
