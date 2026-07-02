import { Injector, runInInjectionContext, signal, WritableSignal } from '@angular/core';
import { MedicalReportsComponent } from './medical-reports.component';
import { GenericCrudService } from '../../services/generic-crud.service';
import { AuthService } from '../../services/auth.service';

// ─── Constants ────────────────────────────────────────────────────────────────

const DONUT_R = 40;
const DONUT_C = 2 * Math.PI * DONUT_R; // ≈ 251.327

// Fixed clock: 2026-06-01 noon UTC
const FAKE_NOW = new Date('2026-06-01T12:00:00.000Z');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** ISO datetime string for FAKE_NOW minus N days */
function daysAgo(n: number): string {
  const d = new Date(2026, 5, 1); // 2026-06-01 (local)
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

/** ISO date string (no time) for FAKE_NOW minus N days */
function dateAgo(n: number): string {
  return daysAgo(n).slice(0, 10);
}

function makeAppointment(overrides: Record<string, any> = {}): Record<string, any> {
  return { id: Math.random(), dateTime: daysAgo(0), status: 'COMPLETADA', service: 'Consulta médica', ...overrides };
}

function makePayment(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    id: Math.random(),
    date: dateAgo(0),
    amount: 50000,
    concept: 'consulta',
    paymentMethod: 'efectivo',
    professionalName: 'Dra. Test',
    commissionAmount: 10000,
    commissionStatus: 'pagada',
    ...overrides,
  };
}

function makePatient(overrides: Record<string, any> = {}): Record<string, any> {
  return { id: Math.random(), status: 'active', insurance: 'fonasa_b', chronicConditions: [], ...overrides };
}

function makeRecord(overrides: Record<string, any> = {}): Record<string, any> {
  return { id: Math.random(), chronicConditions: [], diagnosisCode: '', diagnosisLabel: '', ...overrides };
}

// ─── Factory ─────────────────────────────────────────────────────────────────

interface TestContext {
  component:    MedicalReportsComponent;
  appointments: WritableSignal<Record<string, any>[]>;
  patients:     WritableSignal<Record<string, any>[]>;
  records:      WritableSignal<Record<string, any>[]>;
  payments:     WritableSignal<Record<string, any>[]>;
  user:         WritableSignal<any>;
}

function buildComponent(): TestContext {
  const appointments = signal<Record<string, any>[]>([]);
  const patients     = signal<Record<string, any>[]>([]);
  const records      = signal<Record<string, any>[]>([]);
  const payments     = signal<Record<string, any>[]>([]);
  const user         = signal<any>({ id: 1, name: 'Dra. Test', email: 'test@clinica.com', role: 'manager', avatar: 'DT' });

  const mockCrud = {
    getAll: (key: string) => {
      if (key === 'appointments')     return appointments.asReadonly();
      if (key === 'patients')         return patients.asReadonly();
      if (key === 'clinical-records') return records.asReadonly();
      if (key === 'payments')         return payments.asReadonly();
      return signal<Record<string, any>[]>([]).asReadonly();
    },
    initStore: jest.fn(),
  };

  const mockAuth = { user };

  const injector = Injector.create({
    providers: [
      { provide: GenericCrudService, useValue: mockCrud },
      { provide: AuthService,        useValue: mockAuth },
    ],
  });

  let component!: MedicalReportsComponent;
  runInInjectionContext(injector, () => { component = new MedicalReportsComponent(); });

  return { component, appointments, patients, records, payments, user };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('MedicalReportsComponent', () => {
  let ctx: TestContext;
  let component: MedicalReportsComponent;
  let appointments: WritableSignal<Record<string, any>[]>;
  let patients:     WritableSignal<Record<string, any>[]>;
  let records:      WritableSignal<Record<string, any>[]>;
  let payments:     WritableSignal<Record<string, any>[]>;
  let user:         WritableSignal<any>;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FAKE_NOW);
    ctx = buildComponent();
    ({ component, appointments, patients, records, payments, user } = ctx);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ── Period filter ──────────────────────────────────────────────────────────

  describe('setPeriod() / period filter', () => {
    it('default period is 30d', () => {
      expect(component.period()).toBe('30d');
    });

    it('setPeriod updates period signal', () => {
      component.setPeriod('7d');
      expect(component.period()).toBe('7d');
    });

    it('7d filter includes appointments from last 7 days', () => {
      appointments.set([
        makeAppointment({ dateTime: daysAgo(3) }),
        makeAppointment({ dateTime: daysAgo(10) }),
      ]);
      component.setPeriod('7d');
      expect(component.kpiAppt().total).toBe(1);
    });

    it('30d filter includes appointments from last 30 days', () => {
      appointments.set([
        makeAppointment({ dateTime: daysAgo(20) }),
        makeAppointment({ dateTime: daysAgo(31) }),
      ]);
      component.setPeriod('30d');
      expect(component.kpiAppt().total).toBe(1);
    });

    it('all filter includes appointments regardless of date', () => {
      appointments.set([
        makeAppointment({ dateTime: daysAgo(365) }),
        makeAppointment({ dateTime: daysAgo(0) }),
      ]);
      component.setPeriod('all');
      expect(component.kpiAppt().total).toBe(2);
    });
  });

  // ── kpiAppt ────────────────────────────────────────────────────────────────

  describe('kpiAppt()', () => {
    it('total = 0 with no appointments', () => {
      component.setPeriod('all');
      expect(component.kpiAppt().total).toBe(0);
    });

    it('counts each status correctly', () => {
      appointments.set([
        makeAppointment({ status: 'COMPLETADA' }),
        makeAppointment({ status: 'COMPLETADA' }),
        makeAppointment({ status: 'AGENDADA' }),
        makeAppointment({ status: 'NO_ASISTIO' }),
        makeAppointment({ status: 'CANCELADA' }),
      ]);
      component.setPeriod('all');
      const k = component.kpiAppt();
      expect(k.total).toBe(5);
      expect(k.completed).toBe(2);
      expect(k.scheduled).toBe(1);
      expect(k.noShow).toBe(1);
      expect(k.cancelled).toBe(1);
    });

    it('attendanceRate = 0 when total is 0', () => {
      component.setPeriod('all');
      expect(component.kpiAppt().attendanceRate).toBe(0);
    });

    it('attendanceRate = 100 when all are COMPLETADA', () => {
      appointments.set([
        makeAppointment({ status: 'COMPLETADA' }),
        makeAppointment({ status: 'COMPLETADA' }),
      ]);
      component.setPeriod('all');
      expect(component.kpiAppt().attendanceRate).toBe(100);
    });

    it('attendanceRate rounds correctly (2 of 3 = 67%)', () => {
      appointments.set([
        makeAppointment({ status: 'COMPLETADA' }),
        makeAppointment({ status: 'COMPLETADA' }),
        makeAppointment({ status: 'CANCELADA' }),
      ]);
      component.setPeriod('all');
      expect(component.kpiAppt().attendanceRate).toBe(67);
    });
  });

  // ── kpiPatients ────────────────────────────────────────────────────────────

  describe('kpiPatients()', () => {
    it('returns 0 counts with no patients', () => {
      const k = component.kpiPatients();
      expect(k.total).toBe(0);
      expect(k.active).toBe(0);
      expect(k.critical).toBe(0);
    });

    it('counts active and critical separately', () => {
      patients.set([
        makePatient({ status: 'active' }),
        makePatient({ status: 'active' }),
        makePatient({ status: 'critical' }),
        makePatient({ status: 'scheduled' }),
      ]);
      const k = component.kpiPatients();
      expect(k.total).toBe(4);
      expect(k.active).toBe(2);
      expect(k.critical).toBe(1);
    });

    it('total includes all statuses', () => {
      patients.set([
        makePatient({ status: 'active' }),
        makePatient({ status: 'discharged' }),
      ]);
      expect(component.kpiPatients().total).toBe(2);
    });
  });

  // ── kpiRevenue ─────────────────────────────────────────────────────────────

  describe('kpiRevenue()', () => {
    it('revenue = 0 with no payments', () => {
      component.setPeriod('all');
      expect(component.kpiRevenue().revenue).toBe(0);
    });

    it('revenue sums all payment amounts in period', () => {
      payments.set([
        makePayment({ amount: 50000 }),
        makePayment({ amount: 30000 }),
      ]);
      component.setPeriod('all');
      expect(component.kpiRevenue().revenue).toBe(80000);
    });

    it('myComm only includes MY (professionalName match) commissions', () => {
      user.set({ name: 'Dra. Test' });
      payments.set([
        makePayment({ professionalName: 'Dra. Test', commissionAmount: 10000, commissionStatus: 'pagada' }),
        makePayment({ professionalName: 'Dr. Otro',  commissionAmount: 99999, commissionStatus: 'pagada' }),
      ]);
      component.setPeriod('all');
      expect(component.kpiRevenue().myComm).toBe(10000);
    });

    it('myComm = paid + pending (no_aplica excluded)', () => {
      user.set({ name: 'Dra. Test' });
      payments.set([
        makePayment({ professionalName: 'Dra. Test', commissionAmount: 10000, commissionStatus: 'pagada' }),
        makePayment({ professionalName: 'Dra. Test', commissionAmount: 5000,  commissionStatus: 'pendiente' }),
        makePayment({ professionalName: 'Dra. Test', commissionAmount: 99999, commissionStatus: 'no_aplica' }),
      ]);
      component.setPeriod('all');
      const { myComm, pending } = component.kpiRevenue();
      expect(myComm).toBe(15000);
      expect(pending).toBe(5000);
    });

    it('pending = sum of pendiente commissions only', () => {
      user.set({ name: 'Dra. Test' });
      payments.set([
        makePayment({ professionalName: 'Dra. Test', commissionAmount: 8000, commissionStatus: 'pendiente' }),
        makePayment({ professionalName: 'Dra. Test', commissionAmount: 2000, commissionStatus: 'pendiente' }),
        makePayment({ professionalName: 'Dra. Test', commissionAmount: 5000, commissionStatus: 'pagada' }),
      ]);
      component.setPeriod('all');
      expect(component.kpiRevenue().pending).toBe(10000);
    });

    it('period filter applies to revenue', () => {
      payments.set([
        makePayment({ date: dateAgo(5),  amount: 10000 }),
        makePayment({ date: dateAgo(40), amount: 50000 }),
      ]);
      component.setPeriod('30d');
      expect(component.kpiRevenue().revenue).toBe(10000);
    });
  });

  // ── commPaidPct ────────────────────────────────────────────────────────────

  describe('commPaidPct()', () => {
    beforeEach(() => {
      user.set({ name: 'Dra. Test' });
      component.setPeriod('all');
    });

    it('returns 0 when myComm = 0', () => {
      expect(component.commPaidPct()).toBe(0);
    });

    it('returns 100 when all commissions are paid', () => {
      payments.set([
        makePayment({ professionalName: 'Dra. Test', commissionAmount: 10000, commissionStatus: 'pagada' }),
      ]);
      expect(component.commPaidPct()).toBe(100);
    });

    it('returns 0 when all commissions are pending', () => {
      payments.set([
        makePayment({ professionalName: 'Dra. Test', commissionAmount: 10000, commissionStatus: 'pendiente' }),
      ]);
      expect(component.commPaidPct()).toBe(0);
    });

    it('returns 50 when half paid half pending', () => {
      payments.set([
        makePayment({ professionalName: 'Dra. Test', commissionAmount: 5000, commissionStatus: 'pagada' }),
        makePayment({ professionalName: 'Dra. Test', commissionAmount: 5000, commissionStatus: 'pendiente' }),
      ]);
      expect(component.commPaidPct()).toBe(50);
    });

    it('no_aplica rows do not inflate the pct', () => {
      payments.set([
        makePayment({ professionalName: 'Dra. Test', commissionAmount: 5000,  commissionStatus: 'pagada' }),
        makePayment({ professionalName: 'Dra. Test', commissionAmount: 5000,  commissionStatus: 'pendiente' }),
        makePayment({ professionalName: 'Dra. Test', commissionAmount: 99999, commissionStatus: 'no_aplica' }),
      ]);
      expect(component.commPaidPct()).toBe(50);
    });
  });

  // ── kpiRecords ─────────────────────────────────────────────────────────────

  describe('kpiRecords()', () => {
    it('returns total count of clinical records', () => {
      records.set([makeRecord(), makeRecord(), makeRecord()]);
      expect(component.kpiRecords().total).toBe(3);
    });
  });

  // ── apptStatusDonut ────────────────────────────────────────────────────────

  describe('apptStatusDonut()', () => {
    beforeEach(() => { component.setPeriod('all'); });

    it('returns 4 segments (one per status)', () => {
      appointments.set([makeAppointment({ status: 'COMPLETADA' })]);
      const segs = component.apptStatusDonut();
      expect(segs.length).toBe(4);
    });

    it('all segment arcs sum to DONUT_C (no gaps)', () => {
      appointments.set([
        makeAppointment({ status: 'COMPLETADA' }),
        makeAppointment({ status: 'AGENDADA' }),
        makeAppointment({ status: 'CANCELADA' }),
      ]);
      const segs  = component.apptStatusDonut();
      const total = segs.reduce((s, seg) => s + parseFloat(seg.dashArray.split(' ')[0]), 0);
      expect(total).toBeCloseTo(DONUT_C, 1);
    });

    it('first segment has dashOffset = 0 (starts at 12 o\'clock)', () => {
      appointments.set([makeAppointment({ status: 'COMPLETADA' })]);
      expect(component.apptStatusDonut()[0].dashOffset).toBeCloseTo(0, 5);
    });

    it('each subsequent segment dashOffset = NEGATIVE cumulative arc (shifts clockwise)', () => {
      appointments.set([
        makeAppointment({ status: 'COMPLETADA' }),
        makeAppointment({ status: 'AGENDADA' }),
      ]);
      const segs    = component.apptStatusDonut();
      const seg0Len = parseFloat(segs[0].dashArray.split(' ')[0]);
      expect(segs[1].dashOffset).toBeCloseTo(-seg0Len, 1);
    });

    it('segment pct reflects proportion of appointments', () => {
      appointments.set([
        makeAppointment({ status: 'COMPLETADA' }),
        makeAppointment({ status: 'COMPLETADA' }),
        makeAppointment({ status: 'AGENDADA' }),
        makeAppointment({ status: 'AGENDADA' }),
      ]);
      const completedSeg = component.apptStatusDonut().find(s => s.label === 'Completada')!;
      expect(completedSeg.pct).toBe(50);
    });
  });

  // ── revenueByConceptBars ───────────────────────────────────────────────────

  describe('revenueByConceptBars()', () => {
    beforeEach(() => { component.setPeriod('all'); });

    it('returns empty array when no payments', () => {
      expect(component.revenueByConceptBars().length).toBe(0);
    });

    it('groups by concept and sums amounts', () => {
      payments.set([
        makePayment({ concept: 'consulta', amount: 50000 }),
        makePayment({ concept: 'consulta', amount: 30000 }),
        makePayment({ concept: 'examenes', amount: 20000 }),
      ]);
      const bars = component.revenueByConceptBars();
      const consulta = bars.find(b => b.label === 'Consulta')!;
      expect(consulta.amount).toBe(80000);
    });

    it('sorted descending by amount', () => {
      payments.set([
        makePayment({ concept: 'examenes',    amount: 10000 }),
        makePayment({ concept: 'consulta',    amount: 50000 }),
        makePayment({ concept: 'procedimiento', amount: 30000 }),
      ]);
      const amounts = component.revenueByConceptBars().map(b => b.amount);
      expect(amounts[0]).toBeGreaterThanOrEqual(amounts[1]);
      expect(amounts[1]).toBeGreaterThanOrEqual(amounts[2]);
    });

    it('top bar has pct = 100', () => {
      payments.set([
        makePayment({ concept: 'consulta', amount: 50000 }),
        makePayment({ concept: 'examenes', amount: 25000 }),
      ]);
      const top = component.revenueByConceptBars()[0];
      expect(top.pct).toBe(100);
    });
  });

  // ── apptByDow ──────────────────────────────────────────────────────────────

  describe('apptByDow()', () => {
    beforeEach(() => { component.setPeriod('all'); });

    it('returns 7 day buckets', () => {
      expect(component.apptByDow().length).toBe(7);
    });

    it('day labels are in Spanish', () => {
      const labels = component.apptByDow().map(d => d.label);
      expect(labels).toContain('Lun');
      expect(labels).toContain('Sáb');
    });

    it('busiest day has pct = 100', () => {
      // 2026-06-01 is a Monday (getDay() = 1)
      appointments.set([
        makeAppointment({ dateTime: daysAgo(0) }), // Monday
        makeAppointment({ dateTime: daysAgo(0) }), // Monday
        makeAppointment({ dateTime: daysAgo(1) }), // Sunday
      ]);
      const pcts = component.apptByDow().map(d => d.pct);
      expect(Math.max(...pcts)).toBe(100);
    });
  });

  // ── paymentMethodDonut ─────────────────────────────────────────────────────

  describe('paymentMethodDonut()', () => {
    beforeEach(() => { component.setPeriod('all'); });

    it('returns empty array when no payments', () => {
      expect(component.paymentMethodDonut().length).toBe(0);
    });

    it('all arcs sum to DONUT_C', () => {
      payments.set([
        makePayment({ paymentMethod: 'efectivo' }),
        makePayment({ paymentMethod: 'efectivo' }),
        makePayment({ paymentMethod: 'debito' }),
      ]);
      const segs  = component.paymentMethodDonut();
      const total = segs.reduce((s, seg) => s + parseFloat(seg.dashArray.split(' ')[0]), 0);
      expect(total).toBeCloseTo(DONUT_C, 1);
    });

    it('first segment dashOffset = 0', () => {
      payments.set([makePayment({ paymentMethod: 'efectivo' })]);
      expect(component.paymentMethodDonut()[0].dashOffset).toBeCloseTo(0, 5);
    });
  });

  // ── topConditions ──────────────────────────────────────────────────────────

  describe('topConditions()', () => {
    it('returns empty array when no records', () => {
      expect(component.topConditions().length).toBe(0);
    });

    it('counts occurrences of each condition', () => {
      records.set([
        makeRecord({ chronicConditions: ['diabetes', 'hipertensión'] }),
        makeRecord({ chronicConditions: ['diabetes'] }),
      ]);
      const conds = component.topConditions();
      const diabetes = conds.find(c => c.label === 'diabetes')!;
      expect(diabetes.count).toBe(2);
    });

    it('limits to top 7 conditions', () => {
      const allConds = ['a','b','c','d','e','f','g','h'].map(c =>
        makeRecord({ chronicConditions: [c] })
      );
      records.set(allConds);
      expect(component.topConditions().length).toBe(7);
    });

    it('top condition has pct = 100 (relative scale)', () => {
      records.set([
        makeRecord({ chronicConditions: ['diabetes'] }),
        makeRecord({ chronicConditions: ['diabetes'] }),
        makeRecord({ chronicConditions: ['hipertensión'] }),
      ]);
      const top = component.topConditions()[0];
      expect(top.pct).toBe(100);
    });

    it('ignores records with non-array chronicConditions', () => {
      records.set([
        makeRecord({ chronicConditions: null }),
        makeRecord({ chronicConditions: 'diabetes' }),
        makeRecord({ chronicConditions: ['diabetes'] }),
      ]);
      const conds = component.topConditions();
      expect(conds.length).toBe(1);
      expect(conds[0].count).toBe(1);
    });
  });

  // ── userName / periodLabel ─────────────────────────────────────────────────

  describe('userName()', () => {
    it('returns name from auth user', () => {
      user.set({ name: 'Dr. House' });
      expect(component.userName()).toBe('Dr. House');
    });

    it('returns empty string when no user', () => {
      user.set(null);
      expect(component.userName()).toBe('');
    });
  });

  describe('periodLabel()', () => {
    it('7d', () => { component.setPeriod('7d');  expect(component.periodLabel()).toContain('7'); });
    it('30d', () => { component.setPeriod('30d'); expect(component.periodLabel()).toContain('30'); });
    it('all', () => { component.setPeriod('all'); expect(component.periodLabel().length).toBeGreaterThan(0); });
  });

  // ── fmt ────────────────────────────────────────────────────────────────────

  describe('fmt()', () => {
    it('formats millions', () => expect(component.fmt(2000000)).toBe('$2.0M'));
    it('formats thousands', () => expect(component.fmt(5000)).toBe('$5k'));
    it('formats small amounts', () => expect(component.fmt(999)).toBe('$999'));
  });
});
