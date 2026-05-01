import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { GoogleCalendarService } from '../../services/google-calendar.service';

type GcalStatus = 'idle' | 'connecting' | 'syncing' | 'synced' | 'error' | 'url_opened';

interface ProfessionalSummary {
  id:            string;
  nombre:        string;
  especialidad:  string;
  duration:      number;
  workDays:      number[];
  videoconsulta: boolean;
}

interface BookingInfo {
  professionalId: string;
  doctorName:     string;
  specialty:      string;
  clinicName:     string;
  duration:       number;
  workDays:       number[];
  videoconsulta:  boolean;
}

interface CalDay {
  date:         Date;
  currentMonth: boolean;
  available:    boolean;
  past:         boolean;
}

interface BookingResult {
  appointmentId: string;
  confirmCode:   string;
  doctorName:    string;
  clinicName:    string;
  specialty:     string;
  date:          string;
  time:          string;
  patientName:   string;
  modality:      string;
  meetLink?:     string;
}

@Component({
  selector: 'app-patient-booking',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './patient-booking.component.html',
  styleUrl: './patient-booking.component.scss'
})
export class PatientBookingComponent implements OnInit {
  private route    = inject(ActivatedRoute);
  private http     = inject(HttpClient);
  readonly gcalSvc = inject(GoogleCalendarService);

  // Step 0: professional list
  professionals    = signal<ProfessionalSummary[]>([]);
  loadingProfs     = signal(false);

  // Selected professional
  professionalId   = signal('');
  bookingInfo      = signal<BookingInfo | null>(null);
  loading          = signal(false);
  error            = signal('');

  // Steps 1-4
  step           = signal(0);   // 0 = professional picker
  calendarMonth  = signal(new Date());
  selectedDate   = signal<Date | null>(null);
  selectedTime   = signal('');
  availableSlots = signal<string[]>([]);
  loadingSlots   = signal(false);

  patientName  = signal('');
  patientEmail = signal('');
  patientPhone = signal('');
  patientRut   = signal('');
  reason       = signal('');
  modality     = signal<'presencial' | 'video'>('presencial');
  submitting   = signal(false);
  submitError  = signal('');

  bookingResult = signal<BookingResult | null>(null);

  gcalStatus = signal<GcalStatus>('idle');
  gcalLink   = signal('');
  meetLink   = signal('');

  readonly DOW_LABELS   = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  readonly MONTH_NAMES  = [
    'Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
  ];

  readonly calendarDays = computed<CalDay[]>(() => {
    const ref      = this.calendarMonth();
    const year     = ref.getFullYear();
    const month    = ref.getMonth();
    const first    = new Date(year, month, 1);
    const last     = new Date(year, month + 1, 0);
    const workDays = this.bookingInfo()?.workDays ?? [1, 2, 3, 4, 5];
    const today    = new Date(); today.setHours(0, 0, 0, 0);
    const days: CalDay[] = [];

    const startDow = (first.getDay() + 6) % 7;
    for (let i = startDow - 1; i >= 0; i--)
      days.push({ date: new Date(year, month, -i), currentMonth: false, available: false, past: true });

    for (let d = 1; d <= last.getDate(); d++) {
      const date = new Date(year, month, d);
      const past = date < today;
      days.push({ date, currentMonth: true, available: !past && workDays.includes(date.getDay()), past });
    }

    while (days.length % 7 !== 0) {
      const next = new Date(days[days.length - 1].date);
      next.setDate(next.getDate() + 1);
      days.push({ date: next, currentMonth: false, available: false, past: true });
    }
    return days;
  });

  readonly calendarMonthLabel = computed(() => {
    const d = this.calendarMonth();
    return `${this.MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  });

  readonly selectedDateLabel = computed(() => {
    const d = this.selectedDate();
    if (!d) return '';
    const dow = this.DOW_LABELS[(d.getDay() + 6) % 7];
    return `${dow} ${d.getDate()} de ${this.MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  });

  readonly formValid = computed(() =>
    this.patientName().trim().length >= 3 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.patientEmail().trim()) &&
    this.patientRut().trim().length >= 9
  );

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('token') ?? '';
    if (idParam) {
      this.professionalId.set(idParam);
      this.loadBookingInfo(idParam);
    } else {
      this.loadProfessionals();
    }
  }

  // ── Step 0 ─────────────────────────────────────────────────────────────────

  loadProfessionals(): void {
    this.loadingProfs.set(true);
    this.http.get<ProfessionalSummary[]>('/api/book').subscribe({
      next: list => { this.professionals.set(list); this.loadingProfs.set(false); },
      error: ()  => { this.error.set('load_error');  this.loadingProfs.set(false); }
    });
  }

  selectProfessional(prof: ProfessionalSummary): void {
    this.professionalId.set(prof.id);
    this.bookingInfo.set({
      professionalId: prof.id,
      doctorName:     prof.nombre,
      specialty:      prof.especialidad,
      clinicName:     'Dairi Clínica',
      duration:       prof.duration,
      workDays:       prof.workDays,
      videoconsulta:  prof.videoconsulta
    });
    this.step.set(1);
  }

  private loadBookingInfo(id: string): void {
    this.loading.set(true);
    this.http.get<BookingInfo>(`/api/book/${id}`).subscribe({
      next: info => { this.bookingInfo.set(info); this.loading.set(false); this.step.set(1); },
      error: ()  => { this.error.set('invalid');   this.loading.set(false); }
    });
  }

  // ── Calendar ───────────────────────────────────────────────────────────────

  prevMonth(): void {
    const d = this.calendarMonth();
    this.calendarMonth.set(new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }

  nextMonth(): void {
    const d = this.calendarMonth();
    this.calendarMonth.set(new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  selectDate(day: CalDay): void {
    if (!day.available || !day.currentMonth) return;
    this.selectedDate.set(day.date);
    this.selectedTime.set('');
    this.loadSlots(day.date);
  }

  isSelected(day: CalDay): boolean {
    const sel = this.selectedDate();
    return !!sel && sel.toDateString() === day.date.toDateString();
  }

  isToday(day: CalDay): boolean {
    return day.date.toDateString() === new Date().toDateString();
  }

  private loadSlots(date: Date): void {
    this.loadingSlots.set(true);
    const dateStr = date.toISOString().slice(0, 10);
    this.http.get<string[]>(`/api/book/${this.professionalId()}/slots?date=${dateStr}`).subscribe({
      next: slots => {
        this.availableSlots.set(slots);
        this.loadingSlots.set(false);
        this.step.set(2);
      },
      error: () => this.loadingSlots.set(false)
    });
  }

  selectTime(time: string): void {
    this.selectedTime.set(time);
    this.step.set(3);
  }

  back(): void {
    if (this.step() > 0) {
      if (this.step() === 1 && !this.route.snapshot.paramMap.get('token')) {
        // Volver al selector de profesionales
        this.professionalId.set('');
        this.bookingInfo.set(null);
        this.selectedDate.set(null);
        this.step.set(0);
      } else {
        this.step.update(s => s - 1);
      }
    }
  }

  // ── Booking ────────────────────────────────────────────────────────────────

  submitBooking(): void {
    if (!this.formValid()) return;
    this.submitting.set(true);
    this.submitError.set('');

    const payload = {
      date:         this.selectedDate()!.toISOString().slice(0, 10),
      time:         this.selectedTime(),
      patientName:  this.patientName().trim(),
      patientEmail: this.patientEmail().trim(),
      patientPhone: this.patientPhone().trim(),
      patientRut:   this.patientRut().trim(),
      reason:       this.reason().trim(),
      modality:     this.modality()
    };

    this.http.post<BookingResult>(`/api/book/${this.professionalId()}`, payload).subscribe({
      next: result => {
        this.bookingResult.set(result);
        this.step.set(4);
        this.submitting.set(false);
      },
      error: () => {
        this.submitError.set('No se pudo confirmar la cita. Intenta nuevamente.');
        this.submitting.set(false);
      }
    });
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const d   = new Date(dateStr + 'T00:00:00');
    const dow = this.DOW_LABELS[(d.getDay() + 6) % 7];
    return `${dow} ${d.getDate()} de ${this.MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  }

  // ── Google Calendar + Meet ─────────────────────────────────────────────────

  buildGcalUrl(): string {
    const booking = this.bookingResult();
    if (!booking) return '';
    const info     = this.bookingInfo();
    const duration = info?.duration ?? 45;
    const startLocal = booking.date.replace(/-/g, '') + 'T' + booking.time.replace(':', '') + '00';
    const startMs    = new Date(`${booking.date}T${booking.time}:00`).getTime();
    const endDate    = new Date(startMs + duration * 60_000);
    const pad        = (n: number) => String(n).padStart(2, '0');
    const endLocal   = `${endDate.getFullYear()}${pad(endDate.getMonth()+1)}${pad(endDate.getDate())}` +
                       `T${pad(endDate.getHours())}${pad(endDate.getMinutes())}00`;
    const params = new URLSearchParams({
      action:   'TEMPLATE',
      text:     `Cita con ${booking.doctorName} — ${booking.specialty}`,
      dates:    `${startLocal}/${endLocal}`,
      details:  `Clínica: ${booking.clinicName}\nCódigo: ${booking.confirmCode}`,
      location: booking.clinicName
    });
    return `https://calendar.google.com/calendar/render?${params}`;
  }

  async addToGoogleCalendar(): Promise<void> {
    const booking = this.bookingResult();
    if (!booking) return;

    const isVideo = this.modality() === 'video';

    if (!this.gcalSvc.isConfigured) {
      window.open(this.buildGcalUrl(), '_blank', 'noopener');
      this.gcalStatus.set('url_opened');
      return;
    }

    try {
      if (!this.gcalSvc.isConnected()) {
        this.gcalStatus.set('connecting');
        await this.gcalSvc.connect();
      }

      this.gcalStatus.set('syncing');
      const info     = this.bookingInfo();
      const duration = info?.duration ?? 45;
      const startMs  = new Date(`${booking.date}T${booking.time}:00`).getTime();
      const endIso   = new Date(startMs + duration * 60_000).toISOString().slice(0, 16);

      const eventParams = {
        summary:       `Cita con ${booking.doctorName} — ${booking.specialty}`,
        description:   `Clínica: ${booking.clinicName}\n` +
                       `Motivo: ${this.reason() || 'Consulta médica'}\n` +
                       `Código: ${booking.confirmCode}`,
        startIso:      `${booking.date}T${booking.time}`,
        endIso,
        attendeeEmail: this.patientEmail(),
        location:      booking.clinicName,
        withVideo:     isVideo
      };

      let result = await this.gcalSvc.createEvent(eventParams);

      // Token expirado o revocado → reconectar y reintentar una vez
      if (result.error === 'token_expired') {
        this.gcalStatus.set('connecting');
        await this.gcalSvc.connect();
        this.gcalStatus.set('syncing');
        result = await this.gcalSvc.createEvent(eventParams);
      }

      if (result.success) {
        this.gcalStatus.set('synced');
        this.gcalLink.set(result.link ?? '');
        if (result.meetLink) {
          this.meetLink.set(result.meetLink);
          this.http.put(`/api/book/appointment/${booking.appointmentId}/meet-link`, {
            meetLink: result.meetLink
          }).subscribe();
        }
      } else {
        this.gcalStatus.set('error');
      }
    } catch {
      this.gcalStatus.set('error');
    }
  }
}
