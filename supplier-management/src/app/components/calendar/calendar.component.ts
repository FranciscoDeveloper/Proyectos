import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule, DecimalPipe } from '@angular/common';
import { SchemaService } from '../../services/schema.service';
import { GenericCrudService } from '../../services/generic-crud.service';

interface CalEvent {
  id: number;
  title: string;
  subtitle: string;
  startDate: Date;
  endDate: Date;
  statusLabel: string;
  statusColor: string;
  entityKey: string;
  topPx: number;
  heightPx: number;
  timeLabel: string;
  endTimeLabel: string;
}

interface WeekDay {
  date: Date;
  dow: number;      // 0=Mon … 6=Sun
  isToday: boolean;
  events: CalEvent[];
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

const HOUR_HEIGHT = 64;  // px per hour in the time grid
const GRID_START  = 8;   // 08:00
const GRID_END    = 19;  // 19:00 (exclusive — 18:xx is the last slot shown)

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule, RouterLink, DecimalPipe],
  templateUrl: './calendar.component.html',
  styleUrl: './calendar.component.scss'
})
export class CalendarComponent {
  private route     = inject(ActivatedRoute);
  private schemaSvc = inject(SchemaService);
  private crudSvc   = inject(GenericCrudService);

  readonly entityKey = this.route.snapshot.paramMap.get('entityKey')!;
  readonly schema    = this.schemaSvc.getSchema(this.entityKey);

  // Anchor date drives both week and month navigation
  viewDate = signal(new Date());
  viewMode = signal<'week' | 'month'>('week');

  // Schema-driven field roles — zero hardcoded entity knowledge
  private readonly titleField    = this.schema?.fields.find(f => f.isTitle)         ?? null;
  private readonly subtitleField = this.schema?.fields.find(f => f.isSubtitle)      ?? null;
  private readonly startField    = this.schema?.fields.find(f => f.isCalendarStart) ?? null;
  private readonly endField      = this.schema?.fields.find(f => f.isCalendarEnd)   ?? null;
  private readonly statusField   = this.schema?.fields
    .find(f => f.isBadge && f.name === 'status') ?? null;

  readonly WEEK_DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  readonly MONTHS    = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                        'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  readonly HOURS     = Array.from({ length: GRID_END - GRID_START }, (_, i) => GRID_START + i);
  readonly GRID_H    = (GRID_END - GRID_START) * HOUR_HEIGHT; // total px height

  // Current-time line (computed once on load; accurate within a session)
  readonly nowLinePx = (() => {
    const now  = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    const px   = (mins - GRID_START * 60) * HOUR_HEIGHT / 60;
    return px >= 0 && px <= this.GRID_H ? px : -1;
  })();

  // ── Helpers ────────────────────────────────────────────────────────────────

  private parseDate(raw: string): Date {
    if (!raw) return new Date();
    return raw.includes('T') ? new Date(raw) : new Date(raw + 'T00:00:00');
  }

  private fmtTime(d: Date): string {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  private getMonday(d: Date): Date {
    const c   = new Date(d);
    const dow = c.getDay();
    c.setDate(c.getDate() + (dow === 0 ? -6 : 1 - dow));
    c.setHours(0, 0, 0, 0);
    return c;
  }

  // ── All events (schema-driven, with grid positioning) ─────────────────────

  readonly allEvents = computed<CalEvent[]>(() => {
    if (!this.startField) return [];
    const data = this.crudSvc.getAll(this.entityKey)();

    return data.map(item => {
      const startDate = this.parseDate(String(item[this.startField!.name] ?? ''));
      const rawEnd    = this.endField ? item[this.endField.name] : null;
      const endDate   = rawEnd
        ? this.parseDate(String(rawEnd))
        : new Date(startDate.getTime() + 60 * 60 * 1000); // fallback +1h

      const startMins = startDate.getHours() * 60 + startDate.getMinutes();
      const endMins   = endDate.getHours()   * 60 + endDate.getMinutes();
      const topPx     = Math.max(0, (startMins - GRID_START * 60) * HOUR_HEIGHT / 60);
      const heightPx  = Math.max(28, (endMins - startMins)        * HOUR_HEIGHT / 60);

      const statusVal = this.statusField ? item[this.statusField.name] : null;

      return {
        id:           item['id'],
        title:        this.titleField    ? String(item[this.titleField.name]    ?? '') : `#${item['id']}`,
        subtitle:     this.subtitleField ? String(item[this.subtitleField.name] ?? '') : '',
        startDate,
        endDate,
        statusLabel:  this.statusField?.options?.find(o => o.value === statusVal)?.label ?? '',
        statusColor:  this.statusField?.badgeColors?.[statusVal] ?? '#6b7280',
        entityKey:    this.entityKey,
        topPx,
        heightPx,
        timeLabel:    this.fmtTime(startDate),
        endTimeLabel: this.fmtTime(endDate)
      };
    });
  });

  // ── Week view ─────────────────────────────────────────────────────────────

  readonly weekDays = computed<WeekDay[]>(() => {
    const monday = this.getMonday(this.viewDate());
    const today  = new Date();
    const evs    = this.allEvents();

    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      const events = evs
        .filter(e =>
          e.startDate.getFullYear() === date.getFullYear() &&
          e.startDate.getMonth()    === date.getMonth()    &&
          e.startDate.getDate()     === date.getDate()
        )
        .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
      return { date, dow: i, isToday: date.toDateString() === today.toDateString(), events };
    });
  });

  readonly weekLabel = computed(() => {
    const days  = this.weekDays();
    const first = days[0].date;
    const last  = days[6].date;
    if (first.getMonth() === last.getMonth()) {
      return `${first.getDate()} – ${last.getDate()} ${this.MONTHS[first.getMonth()]} ${first.getFullYear()}`;
    }
    return `${first.getDate()} ${this.MONTHS[first.getMonth()].slice(0,3)} – ` +
           `${last.getDate()}  ${this.MONTHS[last.getMonth()].slice(0,3)} ${last.getFullYear()}`;
  });

  // ── Month view ────────────────────────────────────────────────────────────

  readonly calDays = computed<CalDay[]>(() => {
    const year  = this.viewDate().getFullYear();
    const month = this.viewDate().getMonth();
    const today = new Date();
    const evs   = this.allEvents();

    const firstDay = new Date(year, month, 1);
    const lastDay  = new Date(year, month + 1, 0);
    let   startDow = firstDay.getDay();
    startDow = startDow === 0 ? 6 : startDow - 1;

    const days: CalDay[] = [];
    for (let i = startDow - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: d, dayNum: d.getDate(), isCurrentMonth: false, isToday: false, events: [] });
    }
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date   = new Date(year, month, d);
      const isToday = date.toDateString() === today.toDateString();
      const events = evs
        .filter(e => e.startDate.getFullYear() === year &&
                     e.startDate.getMonth()    === month &&
                     e.startDate.getDate()     === d)
        .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
      days.push({ date, dayNum: d, isCurrentMonth: true, isToday, events });
    }
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
    `${this.MONTHS[this.viewDate().getMonth()]} ${this.viewDate().getFullYear()}`
  );

  // ── Stats & upcoming ──────────────────────────────────────────────────────

  readonly statsPeriod = computed(() => {
    let periodEvs: CalEvent[];
    if (this.viewMode() === 'week') {
      const days  = this.weekDays();
      const start = days[0].date;
      const end   = new Date(days[6].date); end.setHours(23, 59, 59);
      periodEvs = this.allEvents().filter(e => e.startDate >= start && e.startDate <= end);
    } else {
      const y = this.viewDate().getFullYear(), m = this.viewDate().getMonth();
      periodEvs = this.allEvents().filter(
        e => e.startDate.getFullYear() === y && e.startDate.getMonth() === m
      );
    }
    const map = new Map<string, StatusStat>();
    for (const ev of periodEvs) {
      const key = ev.statusLabel || '—';
      if (!map.has(key)) map.set(key, { label: key, color: ev.statusColor, count: 0 });
      map.get(key)!.count++;
    }
    return { total: periodEvs.length, statusStats: [...map.values()] };
  });

  readonly upcomingEvents = computed(() => {
    const now = new Date();
    return this.allEvents()
      .filter(e => e.startDate >= now)
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
      .slice(0, 6);
  });

  // ── Navigation ────────────────────────────────────────────────────────────

  prev() {
    const d = new Date(this.viewDate());
    if (this.viewMode() === 'week') d.setDate(d.getDate() - 7);
    else d.setMonth(d.getMonth() - 1);
    this.viewDate.set(d);
  }

  next() {
    const d = new Date(this.viewDate());
    if (this.viewMode() === 'week') d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
    this.viewDate.set(d);
  }

  goToToday() { this.viewDate.set(new Date()); }
  setViewMode(m: 'week' | 'month') { this.viewMode.set(m); }
}
