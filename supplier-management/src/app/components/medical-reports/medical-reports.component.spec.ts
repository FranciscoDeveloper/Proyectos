import { Injector, runInInjectionContext } from '@angular/core';
import { Router }                          from '@angular/router';
import { buildTestBed, seedStore }         from '../../testing/spec-helpers';
import { SchemaService }                   from '../../services/schema.service';
import { GenericCrudService }              from '../../services/generic-crud.service';
import { AuthService }                     from '../../services/auth.service';
import { MedicalReportsComponent }         from './medical-reports.component';

function buildComponent(): {
  component: MedicalReportsComponent;
  crud:      GenericCrudService;
} {
  const { crud, schema, mockRouter, injector: baseInjector } = buildTestBed();

  const injector = Injector.create({
    parent: baseInjector,
    providers: [
      { provide: SchemaService,      useValue: schema      },
      { provide: GenericCrudService, useValue: crud        },
      { provide: AuthService,        useFactory: () => new AuthService(mockRouter as unknown as Router) },
    ]
  });

  let component!: MedicalReportsComponent;
  runInInjectionContext(injector, () => { component = new MedicalReportsComponent(); });
  return { component, crud };
}

const today = new Date().toISOString().slice(0, 10);

// ─────────────────────────────────────────────────────────────────────────────
describe('MedicalReportsComponent — fmt()', () => {
  let component: MedicalReportsComponent;
  beforeEach(() => ({ component } = buildComponent()));

  it('formats small values with $', () => expect(component.fmt(500)).toBe('$500'));
  it('formats thousands as $Xk',    () => expect(component.fmt(15_000)).toBe('$15k'));
  it('formats millions as $X.XM',   () => expect(component.fmt(1_500_000)).toBe('$1.5M'));
  it('formats zero as $0',          () => expect(component.fmt(0)).toBe('$0'));
});

// ─────────────────────────────────────────────────────────────────────────────
describe('MedicalReportsComponent — periodLabel()', () => {
  let component: MedicalReportsComponent;
  beforeEach(() => ({ component } = buildComponent()));

  it('returns "Últimos 7 días" for 7d',      () => { component.setPeriod('7d');  expect(component.periodLabel()).toBe('Últimos 7 días'); });
  it('returns "Últimos 30 días" for 30d',    () => { component.setPeriod('30d'); expect(component.periodLabel()).toBe('Últimos 30 días'); });
  it('returns "Todo el período" for all',    () => { component.setPeriod('all'); expect(component.periodLabel()).toBe('Todo el período'); });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('MedicalReportsComponent — hasAnyData()', () => {
  it('is false when all stores are empty', () => {
    const { component, crud } = buildComponent();
    seedStore(crud, 'appointments',    []);
    seedStore(crud, 'clinical-records', []);
    seedStore(crud, 'presupuestos',    []);
    expect(component.hasAnyData()).toBe(false);
  });

  it('is true when appointments has records', () => {
    const { component, crud } = buildComponent();
    seedStore(crud, 'appointments', [{ id: 1, status: 'completed', dateTime: today }]);
    expect(component.hasAnyData()).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('MedicalReportsComponent — kpiAppt uses DB status keys', () => {
  let component: MedicalReportsComponent;
  let crud:      GenericCrudService;

  beforeEach(() => {
    ({ component, crud } = buildComponent());
    component.setPeriod('all');
    seedStore(crud, 'appointments', [
      { id: 1, status: 'completed',  dateTime: '2026-01-10' },
      { id: 2, status: 'completed',  dateTime: '2026-01-11' },
      { id: 3, status: 'scheduled',  dateTime: '2026-06-01' },
      { id: 4, status: 'confirmed',  dateTime: '2026-06-02' },
      { id: 5, status: 'no_show',    dateTime: '2026-02-01' },
      { id: 6, status: 'cancelled',  dateTime: '2026-02-02' },
    ]);
  });

  it('counts total',              () => expect(component.kpiAppt().total).toBe(6));
  it('counts completed',          () => expect(component.kpiAppt().completed).toBe(2));
  it('counts scheduled+confirmed',() => expect(component.kpiAppt().scheduled).toBe(2));
  it('counts no_show',            () => expect(component.kpiAppt().noShow).toBe(1));
  it('counts cancelled',          () => expect(component.kpiAppt().cancelled).toBe(1));

  it('calculates attendance rate: 2/6 = 33%', () => {
    expect(component.kpiAppt().attendanceRate).toBe(33);
  });

  it('returns zeros with empty store', () => {
    seedStore(crud, 'appointments', []);
    const kpi = component.kpiAppt();
    expect(kpi.total).toBe(0);
    expect(kpi.attendanceRate).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('MedicalReportsComponent — apptStatusDonut', () => {
  it('produces correct labels for DB status values', () => {
    const { component, crud } = buildComponent();
    component.setPeriod('all');
    seedStore(crud, 'appointments', [
      { id: 1, status: 'completed', dateTime: today },
      { id: 2, status: 'cancelled', dateTime: today },
      { id: 3, status: 'no_show',   dateTime: today },
    ]);
    const labels = component.apptStatusDonut().map(s => s.label);
    expect(labels).toContain('Completada');
    expect(labels).toContain('Cancelada');
    expect(labels).toContain('No asistió');
  });

  it('total pct across all segments is ~100', () => {
    const { component, crud } = buildComponent();
    component.setPeriod('all');
    seedStore(crud, 'appointments', [
      { id: 1, status: 'completed', dateTime: today },
      { id: 2, status: 'no_show',   dateTime: today },
    ]);
    const total = component.apptStatusDonut().reduce((s, seg) => s + seg.pct, 0);
    expect(total).toBeGreaterThanOrEqual(95);
    expect(total).toBeLessThanOrEqual(105);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('MedicalReportsComponent — apptModalityDonut uses DB keys', () => {
  it('maps in_person → Presencial and video → Videoconsulta', () => {
    const { component, crud } = buildComponent();
    component.setPeriod('all');
    seedStore(crud, 'appointments', [
      { id: 1, dateTime: today, modality: 'in_person' },
      { id: 2, dateTime: today, modality: 'video'     },
      { id: 3, dateTime: today, modality: 'phone'     },
    ]);
    const labels = component.apptModalityDonut().map(s => s.label);
    expect(labels).toContain('Presencial');
    expect(labels).toContain('Videoconsulta');
    expect(labels).toContain('Teléfono');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('MedicalReportsComponent — insuranceDist handles new DB format', () => {
  it('groups by nombre value from prevision table', () => {
    const { component, crud } = buildComponent();
    seedStore(crud, 'clinical-records', [
      { id: 1, insurance: 'FONASA A' },
      { id: 2, insurance: 'FONASA A' },
      { id: 3, insurance: 'ISAPRE'   },
    ]);
    const dist    = component.insuranceDist();
    const fonasaA = dist.find(d => d.label === 'FONASA A');
    expect(fonasaA?.count).toBe(2);
    expect(fonasaA?.color).toBe('#10b981');
  });

  it('also handles legacy fonasa_a format', () => {
    const { component, crud } = buildComponent();
    seedStore(crud, 'clinical-records', [
      { id: 1, insurance: 'fonasa_a' },
      { id: 2, insurance: 'fonasa_b' },
    ]);
    expect(component.insuranceDist().length).toBe(2);
  });

  it('sorts by count descending', () => {
    const { component, crud } = buildComponent();
    seedStore(crud, 'clinical-records', [
      { id: 1, insurance: 'FONASA A' },
      { id: 2, insurance: 'FONASA A' },
      { id: 3, insurance: 'ISAPRE'   },
    ]);
    const dist = component.insuranceDist();
    for (let i = 1; i < dist.length; i++) {
      expect(dist[i - 1].count).toBeGreaterThanOrEqual(dist[i].count);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('MedicalReportsComponent — kpiRecords', () => {
  it('counts totals and encounters', () => {
    const { component, crud } = buildComponent();
    seedStore(crud, 'clinical-records', [
      { id: 1, encounters: [{ d: '1' }, { d: '2' }] },
      { id: 2, encounters: [{ d: '3' }]             },
      { id: 3, encounters: []                        },
    ]);
    const kpi = component.kpiRecords();
    expect(kpi.total).toBe(3);
    expect(kpi.encounters).toBe(3);
    expect(kpi.avgEncounters).toBe(1.0);
  });

  it('counts records with alerts', () => {
    const { component, crud } = buildComponent();
    seedStore(crud, 'clinical-records', [
      { id: 1, allergies: ['penicilina'], alertNotes: '' },
      { id: 2, allergies: [],            alertNotes: 'precaución' },
      { id: 3, allergies: [],            alertNotes: '' },
    ]);
    expect(component.kpiRecords().withAlerts).toBe(2);
  });

  it('returns zeros for empty store', () => {
    const { component, crud } = buildComponent();
    seedStore(crud, 'clinical-records', []);
    const kpi = component.kpiRecords();
    expect(kpi.total).toBe(0);
    expect(kpi.avgEncounters).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('MedicalReportsComponent — _presTotal()', () => {
  let component: MedicalReportsComponent;
  beforeEach(() => ({ component } = buildComponent()));

  const total = (p: any) => (component as any)._presTotal(p);

  it('sums items with no discounts',             () => expect(total({ items: [{ quantity: 2, unitPrice: 1000, discountPct: 0 }] })).toBe(2000));
  it('applies item-level discount',              () => expect(total({ items: [{ quantity: 1, unitPrice: 1000, discountPct: 10 }] })).toBe(900));
  it('applies global discount',                  () => expect(total({ items: [{ quantity: 1, unitPrice: 1000, discountPct: 0 }], discountGlobal: 20 })).toBe(800));
  it('returns 0 for empty items',                () => expect(total({ items: [] })).toBe(0));
  it('returns 0 when items is absent',           () => expect(total({})).toBe(0));
  it('clamps discount >100% to 0',               () => expect(total({ items: [{ quantity: 1, unitPrice: 1000, discountPct: 150 }] })).toBe(0));
  it('clamps negative unit price to 0',          () => expect(total({ items: [{ quantity: 1, unitPrice: -500, discountPct: 0 }] })).toBeGreaterThanOrEqual(0));
});

// ─────────────────────────────────────────────────────────────────────────────
describe('MedicalReportsComponent — period filter', () => {
  it('all period includes all appointments', () => {
    const { component, crud } = buildComponent();
    component.setPeriod('all');
    seedStore(crud, 'appointments', [
      { id: 1, status: 'completed', dateTime: '2020-01-01' },
      { id: 2, status: 'completed', dateTime: today        },
    ]);
    expect(component.kpiAppt().total).toBe(2);
  });

  it('7d period excludes old appointments', () => {
    const { component, crud } = buildComponent();
    component.setPeriod('7d');
    seedStore(crud, 'appointments', [
      { id: 1, status: 'completed', dateTime: '2020-01-01' },
      { id: 2, status: 'completed', dateTime: today        },
    ]);
    expect(component.kpiAppt().total).toBe(1);
  });
});
