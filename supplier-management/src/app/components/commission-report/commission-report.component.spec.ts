import { Injector, runInInjectionContext, signal, WritableSignal } from '@angular/core';
import { CommissionReportComponent, ProfCommission } from './commission-report.component';
import { GenericCrudService } from '../../services/generic-crud.service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePayment(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    id: Math.floor(Math.random() * 9999),
    patientName: 'Paciente Ejemplo',
    date: '2026-06-01',
    concept: 'consulta',
    amount: 50000,
    paymentMethod: 'efectivo',
    status: 'pagado',
    professionalName: 'Dr. Test',
    commissionRate: 20,
    commissionAmount: 10000,
    commissionStatus: 'pendiente',
    ...overrides,
  };
}

// ─── Setup ───────────────────────────────────────────────────────────────────

function buildComponent(): { component: CommissionReportComponent; payments: WritableSignal<Record<string, any>[]>; mockUpdate: jest.Mock } {
  const payments = signal<Record<string, any>[]>([]);
  const mockUpdate = jest.fn();

  const mockCrud = {
    getAll:    (_key: string) => payments.asReadonly(),
    initStore: jest.fn(),
    update:    mockUpdate,
  };

  const injector = Injector.create({
    providers: [{ provide: GenericCrudService, useValue: mockCrud }],
  });

  let component!: CommissionReportComponent;
  runInInjectionContext(injector, () => { component = new CommissionReportComponent(); });
  component.ngOnInit();

  return { component, payments, mockUpdate };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('CommissionReportComponent', () => {
  let component: CommissionReportComponent;
  let payments: WritableSignal<Record<string, any>[]>;
  let mockUpdate: jest.Mock;

  beforeEach(() => {
    ({ component, payments, mockUpdate } = buildComponent());
  });

  // ── Grouping ───────────────────────────────────────────────────────────────

  describe('professionals() grouping', () => {
    it('returns empty list when no payments', () => {
      expect(component.professionals()).toEqual([]);
    });

    it('excludes payments without professionalName', () => {
      payments.set([
        makePayment({ professionalName: '' }),
        makePayment({ professionalName: null }),
      ]);
      expect(component.professionals().length).toBe(0);
    });

    it('groups payments by professional name', () => {
      payments.set([
        makePayment({ professionalName: 'Dr. A', id: 1 }),
        makePayment({ professionalName: 'Dr. A', id: 2 }),
        makePayment({ professionalName: 'Dra. B', id: 3 }),
      ]);
      expect(component.professionals().length).toBe(2);
    });

    it('each professional has correct totalPayments count', () => {
      payments.set([
        makePayment({ professionalName: 'Dr. A', id: 1 }),
        makePayment({ professionalName: 'Dr. A', id: 2 }),
        makePayment({ professionalName: 'Dr. A', id: 3 }),
      ]);
      const prof = component.professionals()[0];
      expect(prof.totalPayments).toBe(3);
    });
  });

  // ── Amount calculations ────────────────────────────────────────────────────

  describe('per-professional amounts', () => {
    it('paidCommission sums commissionAmount for pagada rows only', () => {
      payments.set([
        makePayment({ id: 1, commissionAmount: 10000, commissionStatus: 'pagada' }),
        makePayment({ id: 2, commissionAmount: 5000,  commissionStatus: 'pagada' }),
        makePayment({ id: 3, commissionAmount: 8000,  commissionStatus: 'pendiente' }),
      ]);
      const prof = component.professionals()[0];
      expect(prof.paidCommission).toBe(15000);
    });

    it('pendingCommission sums commissionAmount for pendiente rows only', () => {
      payments.set([
        makePayment({ id: 1, commissionAmount: 10000, commissionStatus: 'pendiente' }),
        makePayment({ id: 2, commissionAmount: 3000,  commissionStatus: 'pendiente' }),
        makePayment({ id: 3, commissionAmount: 8000,  commissionStatus: 'pagada' }),
      ]);
      const prof = component.professionals()[0];
      expect(prof.pendingCommission).toBe(13000);
    });

    it('totalCommission = paidCommission + pendingCommission (no_aplica excluded)', () => {
      payments.set([
        makePayment({ id: 1, commissionAmount: 10000, commissionStatus: 'pagada' }),
        makePayment({ id: 2, commissionAmount: 5000,  commissionStatus: 'pendiente' }),
        makePayment({ id: 3, commissionAmount: 99999, commissionStatus: 'no_aplica' }),
        makePayment({ id: 4, commissionAmount: 9999,  commissionStatus: null }),
      ]);
      const prof = component.professionals()[0];
      expect(prof.totalCommission).toBe(prof.paidCommission + prof.pendingCommission);
      expect(prof.totalCommission).toBe(15000);
    });

    it('no_aplica rows do NOT contribute to totalCommission', () => {
      payments.set([
        makePayment({ id: 1, commissionAmount: 10000, commissionStatus: 'no_aplica' }),
      ]);
      // With only no_aplica rows, both paid and pending are 0 → professional is filtered out
      expect(component.professionals().length).toBe(0);
    });

    it('totalInvoiced sums amount across ALL rows (including no_aplica)', () => {
      payments.set([
        makePayment({ id: 1, amount: 50000, commissionStatus: 'pagada' }),
        makePayment({ id: 2, amount: 30000, commissionStatus: 'pendiente' }),
        makePayment({ id: 3, amount: 20000, commissionStatus: 'no_aplica' }),
      ]);
      const prof = component.professionals()[0];
      expect(prof.totalInvoiced).toBe(100000);
    });

    it('avgRate is average of commissionRate across all rows', () => {
      payments.set([
        makePayment({ id: 1, commissionRate: 20, commissionStatus: 'pagada' }),
        makePayment({ id: 2, commissionRate: 30, commissionStatus: 'pendiente' }),
      ]);
      const prof = component.professionals()[0];
      expect(prof.avgRate).toBe(25);
    });

    it('handles non-numeric commissionAmount gracefully (treats as 0)', () => {
      payments.set([
        makePayment({ id: 1, commissionAmount: 'NaN', commissionStatus: 'pagada' }),
        makePayment({ id: 2, commissionAmount: 5000,  commissionStatus: 'pendiente' }),
      ]);
      const prof = component.professionals()[0];
      expect(prof.paidCommission).toBe(0);
      expect(prof.pendingCommission).toBe(5000);
    });

    it('initials derived correctly (strips title prefix)', () => {
      payments.set([makePayment({ professionalName: 'Dra. Ana García' })]);
      const prof = component.professionals()[0];
      expect(prof.initials).toBe('AG');
    });

    it('initials without prefix', () => {
      payments.set([makePayment({ professionalName: 'Juan Pérez' })]);
      const prof = component.professionals()[0];
      expect(prof.initials).toBe('JP');
    });

    it('pendingCount returns count of pendiente payments for a prof', () => {
      payments.set([
        makePayment({ id: 1, commissionStatus: 'pendiente' }),
        makePayment({ id: 2, commissionStatus: 'pagada' }),
        makePayment({ id: 3, commissionStatus: 'pendiente' }),
      ]);
      const prof = component.professionals()[0];
      expect(component.pendingCount(prof)).toBe(2);
    });
  });

  // ── Sorting ────────────────────────────────────────────────────────────────

  describe('professionals() sorting', () => {
    it('sorted descending by totalCommission', () => {
      payments.set([
        makePayment({ id: 1, professionalName: 'Dr. Low',  commissionAmount: 1000,  commissionStatus: 'pagada' }),
        makePayment({ id: 2, professionalName: 'Dr. High', commissionAmount: 50000, commissionStatus: 'pagada' }),
      ]);
      const profs = component.professionals();
      expect(profs[0].name).toBe('Dr. High');
      expect(profs[1].name).toBe('Dr. Low');
    });

    it('payments within a professional sorted descending by date', () => {
      payments.set([
        makePayment({ id: 1, date: '2026-01-01', commissionStatus: 'pagada' }),
        makePayment({ id: 2, date: '2026-06-01', commissionStatus: 'pendiente' }),
        makePayment({ id: 3, date: '2026-03-01', commissionStatus: 'pendiente' }),
      ]);
      const prof = component.professionals()[0];
      const dates = prof.payments.map(p => p['date']);
      expect(dates[0]).toBe('2026-06-01');
      expect(dates[1]).toBe('2026-03-01');
      expect(dates[2]).toBe('2026-01-01');
    });
  });

  // ── Filter ─────────────────────────────────────────────────────────────────

  describe('filterStatus()', () => {
    beforeEach(() => {
      payments.set([
        makePayment({ id: 1, professionalName: 'Dr. A', commissionAmount: 10000, commissionStatus: 'pagada' }),
        makePayment({ id: 2, professionalName: 'Dr. B', commissionAmount: 5000,  commissionStatus: 'pendiente' }),
        makePayment({ id: 3, professionalName: 'Dr. C', commissionAmount: 3000,  commissionStatus: 'pagada' }),
        makePayment({ id: 4, professionalName: 'Dr. C', commissionAmount: 2000,  commissionStatus: 'pendiente' }),
      ]);
    });

    it('default filter = all shows all professionals', () => {
      expect(component.professionals().length).toBe(3);
    });

    it('filter pendiente shows only professionals with pending commissions', () => {
      component.setFilter('pendiente');
      const names = component.professionals().map(p => p.name);
      expect(names).toContain('Dr. B');
      expect(names).toContain('Dr. C');
      expect(names).not.toContain('Dr. A');
    });

    it('filter pagada shows only professionals with paid commissions', () => {
      component.setFilter('pagada');
      const names = component.professionals().map(p => p.name);
      expect(names).toContain('Dr. A');
      expect(names).toContain('Dr. C');
      expect(names).not.toContain('Dr. B');
    });

    it('setFilter also collapses expanded professional', () => {
      component.toggleExpand('Dr. A');
      expect(component.isExpanded('Dr. A')).toBe(true);
      component.setFilter('pendiente');
      expect(component.isExpanded('Dr. A')).toBe(false);
    });

    it('setting filter back to all restores all professionals', () => {
      component.setFilter('pendiente');
      component.setFilter('all');
      expect(component.professionals().length).toBe(3);
    });

    it('filterStatus signal reflects current filter', () => {
      component.setFilter('pagada');
      expect(component.filterStatus()).toBe('pagada');
    });
  });

  // ── Totals ─────────────────────────────────────────────────────────────────

  describe('totals()', () => {
    it('count = number of unique professionals visible', () => {
      payments.set([
        makePayment({ id: 1, professionalName: 'Dr. A', commissionStatus: 'pagada',   commissionAmount: 1000 }),
        makePayment({ id: 2, professionalName: 'Dra. B', commissionStatus: 'pendiente', commissionAmount: 2000 }),
      ]);
      expect(component.totals().count).toBe(2);
    });

    it('invoiced = sum of all amounts across visible professionals', () => {
      payments.set([
        makePayment({ id: 1, amount: 50000, commissionStatus: 'pagada' }),
        makePayment({ id: 2, amount: 30000, commissionStatus: 'pendiente' }),
      ]);
      expect(component.totals().invoiced).toBe(80000);
    });

    it('commission = sum of totalCommission across visible professionals', () => {
      payments.set([
        makePayment({ id: 1, commissionAmount: 10000, commissionStatus: 'pagada' }),
        makePayment({ id: 2, commissionAmount: 5000,  commissionStatus: 'pendiente' }),
      ]);
      expect(component.totals().commission).toBe(15000);
    });

    it('paid = sum of paidCommission across visible professionals', () => {
      payments.set([
        makePayment({ id: 1, professionalName: 'Dr. A', commissionAmount: 10000, commissionStatus: 'pagada' }),
        makePayment({ id: 2, professionalName: 'Dra. B', commissionAmount: 5000,  commissionStatus: 'pagada' }),
      ]);
      expect(component.totals().paid).toBe(15000);
    });

    it('pending = sum of pendingCommission across visible professionals', () => {
      payments.set([
        makePayment({ id: 1, professionalName: 'Dr. A', commissionAmount: 8000, commissionStatus: 'pendiente' }),
        makePayment({ id: 2, professionalName: 'Dra. B', commissionAmount: 3000, commissionStatus: 'pendiente' }),
      ]);
      expect(component.totals().pending).toBe(11000);
    });
  });

  // ── Actions ────────────────────────────────────────────────────────────────

  describe('markPaid()', () => {
    it('calls crud.update with commissionStatus=pagada', () => {
      component.markPaid(42);
      expect(mockUpdate).toHaveBeenCalledWith('payments', 42, { commissionStatus: 'pagada' });
    });

    it('adds id to paying set immediately', () => {
      component.markPaid(7);
      expect(component.isPaying(7)).toBe(true);
    });
  });

  describe('markAllPending()', () => {
    it('marks all pending payments of a prof as paid', () => {
      const prof: ProfCommission = {
        name: 'Dr. Test',
        initials: 'DT',
        color: '#fff',
        specialty: 'Consulta',
        totalPayments: 3,
        totalInvoiced: 150000,
        avgRate: 20,
        totalCommission: 20000,
        paidCommission: 10000,
        pendingCommission: 10000,
        payments: [
          { id: 1, commissionStatus: 'pendiente' },
          { id: 2, commissionStatus: 'pagada' },
          { id: 3, commissionStatus: 'pendiente' },
        ],
      };
      component.markAllPending(prof);
      expect(mockUpdate).toHaveBeenCalledTimes(2);
      expect(mockUpdate).toHaveBeenCalledWith('payments', 1, { commissionStatus: 'pagada' });
      expect(mockUpdate).toHaveBeenCalledWith('payments', 3, { commissionStatus: 'pagada' });
    });
  });

  // ── Expand ─────────────────────────────────────────────────────────────────

  describe('toggleExpand()', () => {
    it('expands a professional', () => {
      component.toggleExpand('Dr. A');
      expect(component.isExpanded('Dr. A')).toBe(true);
    });

    it('collapses a professional that is already expanded', () => {
      component.toggleExpand('Dr. A');
      component.toggleExpand('Dr. A');
      expect(component.isExpanded('Dr. A')).toBe(false);
    });

    it('expanding one collapses others (only one expanded at a time)', () => {
      component.toggleExpand('Dr. A');
      component.toggleExpand('Dr. B');
      expect(component.isExpanded('Dr. A')).toBe(false);
      expect(component.isExpanded('Dr. B')).toBe(true);
    });
  });

  // ── Formatting ─────────────────────────────────────────────────────────────

  describe('fmtCurrency()', () => {
    it('formats millions', () => expect(component.fmtCurrency(1500000)).toBe('$1.5M'));
    it('formats thousands', () => expect(component.fmtCurrency(3000)).toBe('$3k'));
    it('formats small amounts', () => expect(component.fmtCurrency(500)).toBe('$500'));
  });

  describe('fmtFull()', () => {
    it('formats full amount with $ prefix', () => {
      const result = component.fmtFull(10000);
      expect(result.startsWith('$')).toBe(true);
    });
  });

  describe('fmtDate()', () => {
    it('formats ISO date string', () => {
      const result = component.fmtDate('2026-06-01');
      expect(result).toContain('2026');
    });

    it('returns empty string for empty input', () => {
      expect(component.fmtDate('')).toBe('');
    });
  });

  describe('conceptLabel()', () => {
    it('maps consulta to Consulta', () => expect(component.conceptLabel('consulta')).toBe('Consulta'));
    it('returns raw key for unknown concept', () => expect(component.conceptLabel('unknown')).toBe('unknown'));
  });
});
