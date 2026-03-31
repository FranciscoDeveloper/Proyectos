import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SchemaService } from '../../services/schema.service';
import { GenericCrudService } from '../../services/generic-crud.service';
import { GoogleCalendarService } from '../../services/google-calendar.service';

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
  initials: string;
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
  isSelected: boolean;
  events: CalEvent[];
}

interface StatusStat {
  label: string;
  color: string;
  count: number;
}

const HOUR_HEIGHT = 72;   // px per hour
const GRID_START  = 7;    // 07:00
const GRID_END    = 20;   // 20:00 (exclusive)

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
  readonly gcalSvc  = inject(GoogleCalendarService);
  gcalConnecting    = signal(false);

  connectGcal(): void {
    this.gcalConnecting.set(true);
    this.gcalSvc.connect()
      .catch(err => console.error('[GCal] connect error:', err))
      .finally(() => this.gcalConnecting.set(false));
  }

  readonly entityKey = this.route.snapshot.paramMap.get('entityKey')!;
  readonly schema    = this.schemaSvc.getSchema(this.entityKey);

  viewDate          = signal(new Date());
  viewMode          = signal<'day' | 'week' | 'month'>('week');
  miniCalMonth      = signal(new Date());
  searchTerm        = signal('');
  activeStatusFilter = signal('');

  private readonly titleField    = this.schema?.fields.find(f => f.isTitle)         ?? null;
  private readonly subtitleField = this.schema?.fields.find(f => f.isSubtitle)      ?? null;
  private readonly startField    = this.schema?.fields.find(f => f.isCalendarStart) ?? null;
  private readonly endField      = this.schema?.fields.find(f => f.isCalendarEnd)   ?? null;
  private readonly statusField   = this.schema?.fields
    .find(f => f.isBadge && f.name === 'status') ?? null;

  readonly WEEK_DAYS  = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  readonly WEEK_FULL  = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  readonly MONTHS     = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                         'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  readonly HOURS      = Array.from({ length: GRID_END - GRID_START }, (_, i) => GRID_START + i);
  readonly GRID_H     = (GRID_END - GRID_START) * HOUR_HEIGHT;

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

  private getInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }

  fmtShortDate(d: Date): string {
    const dows = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    return `${dows[d.getDay()]} ${d.getDate()} ${this.MONTHS[d.getMonth()].slice(0, 3)}`;
  }

  // ── Raw events (all items mapped to CalEvent) ─────────────────────────────

  readonly rawEvents = computed<CalEvent[]>(() => {
    if (!this.startField) return [];
    const data = this.crudSvc.getAll(this.entityKey)();

    return data.map(item => {
      const startDate = this.parseDate(String(item[this.startField!.name] ?? ''));
      const rawEnd    = this.endField ? item[this.endField.name] : null;
      const endDate   = rawEnd
        ? this.parseDate(String(rawEnd))
        : new Date(startDate.getTime() + 60 * 60 * 1000);

      const startMins = startDate.getHours() * 60 + startDate.getMinutes();
      const endMins   = endDate.getHours()   * 60 + endDate.getMinutes();
      const topPx     = Math.max(0, (startMins - GRID_START * 60) * HOUR_HEIGHT / 60);
      const heightPx  = Math.max(32, (endMins - startMins) * HOUR_HEIGHT / 60);

      const statusVal = this.statusField ? item[this.statusField.name] : null;
      const titleVal  = this.titleField ? String(item[this.titleField.name] ?? '') : `#${item['id']}`;
      const subVal    = this.subtitleField ? String(item[this.subtitleField.name] ?? '') : '';

      return {
        id:           item['id'],
        title:        titleVal,
        subtitle:     subVal,
        startDate,
        endDate,
        statusLabel:  this.statusField?.options?.find(o => o.value === statusVal)?.label ?? '',
        statusColor:  this.statusField?.badgeColors?.[statusVal] ?? '#6b7280',
        entityKey:    this.entityKey,
        topPx,
        heightPx,
        timeLabel:    this.fmtTime(startDate),
        endTimeLabel: this.fmtTime(endDate),
        initials:     this.getInitials(subVal || titleVal)
      };
    });
  });

  // ── Filtered events (search + status filter applied) ─────────────────────

  readonly allEvents = computed<CalEvent[]>(() => {
    const evs    = this.rawEvents();
    const search = this.searchTerm().toLowerCase().trim();
    const status = this.activeStatusFilter();
    return evs.filter(ev => {
      const matchSearch = !search ||
        ev.title.toLowerCase().includes(search) ||
        ev.subtitle.toLowerCase().includes(search);
      const matchStatus = !status || ev.statusLabel === status;
      return matchSearch && matchStatus;
    });
  });

  // ── Status options for filter chips ──────────────────────────────────────

  readonly statusOptions = computed(() => {
    const map = new Map<string, string>();
    for (const ev of this.rawEvents()) {
      if (ev.statusLabel) map.set(ev.statusLabel, ev.statusColor);
    }
    return [...map.entries()].map(([label, color]) => ({ label, color }));
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
           `${last.getDate()} ${this.MONTHS[last.getMonth()].slice(0,3)} ${last.getFullYear()}`;
  });

  // ── Day view ──────────────────────────────────────────────────────────────

  readonly dayEvents = computed(() => {
    const d   = this.viewDate();
    const evs = this.allEvents();
    return evs
      .filter(e =>
        e.startDate.getFullYear() === d.getFullYear() &&
        e.startDate.getMonth()    === d.getMonth()    &&
        e.startDate.getDate()     === d.getDate()
      )
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  });

  readonly dayLabel = computed(() => {
    const d      = this.viewDate();
    const idx    = d.getDay() === 0 ? 6 : d.getDay() - 1;
    return {
      dow:    this.WEEK_FULL[idx],
      date:   d.getDate(),
      month:  this.MONTHS[d.getMonth()],
      year:   d.getFullYear(),
      isToday: d.toDateString() === new Date().toDateString()
    };
  });

  readonly isDayToday = computed(() =>
    this.viewDate().toDateString() === new Date().toDateString()
  );

  // ── Month view ────────────────────────────────────────────────────────────

  private buildMonthGrid(year: number, month: number, evs: CalEvent[], vDate: Date): CalDay[] {
    const today    = new Date();
    const firstDay = new Date(year, month, 1);
    const lastDay  = new Date(year, month + 1, 0);
    let   startDow = firstDay.getDay();
    startDow = startDow === 0 ? 6 : startDow - 1;

    const days: CalDay[] = [];
    for (let i = startDow - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: d, dayNum: d.getDate(), isCurrentMonth: false, isToday: false, isSelected: false, events: [] });
    }
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date     = new Date(year, month, d);
      const isToday  = date.toDateString() === today.toDateString();
      const isSelected = date.toDateString() === vDate.toDateString();
      const events   = evs
        .filter(e => e.startDate.getFullYear() === year &&
                     e.startDate.getMonth()    === month &&
                     e.startDate.getDate()     === d)
        .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
      days.push({ date, dayNum: d, isCurrentMonth: true, isToday, isSelected, events });
    }
    const tail = 7 - (days.length % 7);
    if (tail < 7) {
      for (let i = 1; i <= tail; i++) {
        const d = new Date(year, month + 1, i);
        days.push({ date: d, dayNum: d.getDate(), isCurrentMonth: false, isToday: false, isSelected: false, events: [] });
      }
    }
    return days;
  }

  readonly calDays = computed<CalDay[]>(() =>
    this.buildMonthGrid(
      this.viewDate().getFullYear(),
      this.viewDate().getMonth(),
      this.allEvents(),
      this.viewDate()
    )
  );

  readonly monthLabel = computed(() =>
    `${this.MONTHS[this.viewDate().getMonth()]} ${this.viewDate().getFullYear()}`
  );

  // ── Mini calendar ─────────────────────────────────────────────────────────

  readonly miniCalDays = computed<CalDay[]>(() =>
    this.buildMonthGrid(
      this.miniCalMonth().getFullYear(),
      this.miniCalMonth().getMonth(),
      this.rawEvents(),
      this.viewDate()
    )
  );

  readonly miniCalLabel = computed(() =>
    `${this.MONTHS[this.miniCalMonth().getMonth()]} ${this.miniCalMonth().getFullYear()}`
  );

  miniCalPrev() {
    const d = new Date(this.miniCalMonth()); d.setMonth(d.getMonth() - 1); this.miniCalMonth.set(d);
  }
  miniCalNext() {
    const d = new Date(this.miniCalMonth()); d.setMonth(d.getMonth() + 1); this.miniCalMonth.set(d);
  }

  jumpToDate(date: Date) {
    this.viewDate.set(new Date(date));
    this.miniCalMonth.set(new Date(date));
    if (this.viewMode() !== 'month') this.viewMode.set('day');
  }

  // ── Stats & upcoming ──────────────────────────────────────────────────────

  readonly statsPeriod = computed(() => {
    let periodEvs: CalEvent[];
    if (this.viewMode() === 'day') {
      periodEvs = this.dayEvents();
    } else if (this.viewMode() === 'week') {
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

  readonly upcomingEvents = computed(() =>
    this.rawEvents()
      .filter(e => e.startDate >= new Date())
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
      .slice(0, 5)
  );

  // ── Navigation ────────────────────────────────────────────────────────────

  prev() {
    const d = new Date(this.viewDate());
    if (this.viewMode() === 'day')        d.setDate(d.getDate() - 1);
    else if (this.viewMode() === 'week')  d.setDate(d.getDate() - 7);
    else                                  d.setMonth(d.getMonth() - 1);
    this.viewDate.set(d);
    this.miniCalMonth.set(new Date(d));
  }

  next() {
    const d = new Date(this.viewDate());
    if (this.viewMode() === 'day')        d.setDate(d.getDate() + 1);
    else if (this.viewMode() === 'week')  d.setDate(d.getDate() + 7);
    else                                  d.setMonth(d.getMonth() + 1);
    this.viewDate.set(d);
    this.miniCalMonth.set(new Date(d));
  }

  goToToday() {
    const today = new Date();
    this.viewDate.set(today);
    this.miniCalMonth.set(new Date(today));
  }

  setViewMode(m: 'day' | 'week' | 'month') { this.viewMode.set(m); }

  setStatusFilter(label: string) {
    this.activeStatusFilter.set(this.activeStatusFilter() === label ? '' : label);
  }
}
