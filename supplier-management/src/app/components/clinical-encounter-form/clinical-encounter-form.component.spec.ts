import { Injector, runInInjectionContext } from '@angular/core';
import { ActivatedRoute, Router }          from '@angular/router';
import { FormBuilder }                     from '@angular/forms';
import { buildTestBed, seedStore }         from '../../testing/spec-helpers';
import { SchemaService }                   from '../../services/schema.service';
import { GenericCrudService }              from '../../services/generic-crud.service';
import { AudioRecorderService }            from '../../services/audio-recorder.service';
import { ClinicalEncounterFormComponent }  from './clinical-encounter-form.component';
import { FieldDefinition }                 from '../../models/entity-schema.model';

const MOCK_AUDIO: Partial<AudioRecorderService> = {
  isRecording: false,
  start: jest.fn(),
  stop:  jest.fn(),
};

function buildComponent(entityKey: string, recordId?: number): {
  component:  ClinicalEncounterFormComponent;
  crud:       GenericCrudService;
  mockRouter: { navigate: jest.Mock };
} {
  const { crud, schema, mockRouter, injector: baseInjector } = buildTestBed();

  const mockRoute = {
    snapshot: {
      paramMap: {
        get: (k: string) => {
          if (k === 'entityKey') return entityKey;
          if (k === 'id')        return recordId != null ? String(recordId) : null;
          return null;
        }
      }
    }
  };

  if (recordId != null) {
    seedStore(crud, entityKey, [{ id: recordId, fullName: 'Test Patient', insurance: 'FONASA A' }]);
  }

  const injector = Injector.create({
    parent: baseInjector,
    providers: [
      { provide: ActivatedRoute,       useValue: mockRoute      },
      { provide: Router,               useValue: mockRouter     },
      { provide: FormBuilder                                     },
      { provide: SchemaService,        useValue: schema         },
      { provide: GenericCrudService,   useValue: crud           },
      { provide: AudioRecorderService, useValue: MOCK_AUDIO     },
    ]
  });

  let component!: ClinicalEncounterFormComponent;
  runInInjectionContext(injector, () => { component = new ClinicalEncounterFormComponent(); });
  component.ngOnInit();
  return { component, crud, mockRouter };
}

// ─────────────────────────────────────────────────────────────────────────────
describe('ClinicalEncounterFormComponent — initialisation', () => {
  let component: ClinicalEncounterFormComponent;

  beforeEach(() => ({ component } = buildComponent('clinical-records')));

  it('creates the component', () => expect(component).toBeTruthy());

  it('sets entityKey from route', () => expect(component.entityKey()).toBe('clinical-records'));

  it('loads schema for the entity', () => {
    expect(component.schema()?.entity.key).toBe('clinical-records');
  });

  it('recordId is null when no id param', () => expect(component.recordId()).toBeNull());

  it('builds a FormGroup with controls', () => {
    expect(component.form).toBeTruthy();
    expect(Object.keys(component.form.controls).length).toBeGreaterThan(0);
  });

  it('includes encounterDate control', () => {
    expect(component.form.get('encounterDate')).toBeTruthy();
  });

  it('defaults encounterDate to today', () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(component.form.get('encounterDate')!.value).toBe(today);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('ClinicalEncounterFormComponent — editableFields()', () => {
  let component: ClinicalEncounterFormComponent;

  beforeEach(() => ({ component } = buildComponent('clinical-records')));

  const ENCOUNTER_SECTIONS = new Set(['vitals', 'diagnosis', 'soap']);

  it('returns only vitals/diagnosis/soap section fields', () => {
    component.editableFields().forEach(f =>
      expect(ENCOUNTER_SECTIONS.has(f.section ?? '')).toBe(true)
    );
  });

  it('excludes isStable fields', () => {
    component.editableFields().forEach(f => expect(f.isStable).toBeFalsy());
  });

  it('excludes hideInEncounterMode fields', () => {
    component.editableFields().forEach(f => expect(f.hideInEncounterMode).toBeFalsy());
  });

  it('excludes object-list and chart types', () => {
    const COMPLEX = new Set(['object-list', 'dental-chart', 'periodontal-chart']);
    component.editableFields().forEach(f => expect(COMPLEX.has(f.type)).toBe(false));
  });

  it('contains core vitals and soap fields', () => {
    const names = component.editableFields().map(f => f.name);
    expect(names).toContain('heartRate');
    expect(names).toContain('soapSubjective');
    expect(names).toContain('diagnosisLabel');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('ClinicalEncounterFormComponent — stableFields()', () => {
  let component: ClinicalEncounterFormComponent;

  beforeEach(() => ({ component } = buildComponent('clinical-records')));

  it('contains only isStable fields', () => {
    component.stableFields().forEach(f => expect(f.isStable).toBe(true));
  });

  it('excludes entity-select types', () => {
    component.stableFields().forEach(f => expect(f.type).not.toBe('entity-select'));
  });

  it('stable fields are disabled in the FormGroup', () => {
    component.stableFields().forEach(f => {
      const ctrl = component.form.get(f.name);
      if (ctrl) expect(ctrl.disabled).toBe(true);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('ClinicalEncounterFormComponent — getFieldOptions()', () => {
  let component: ClinicalEncounterFormComponent;
  let crud: GenericCrudService;

  beforeEach(() => ({ component, crud } = buildComponent('clinical-records')));

  it('returns static options when no lookupEntity', () => {
    const field: FieldDefinition = {
      name: 's', type: 'select', label: 'S',
      options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]
    };
    expect(component.getFieldOptions(field).length).toBe(2);
  });

  it('returns empty array for field with no options and no lookupEntity', () => {
    const field: FieldDefinition = { name: 'x', type: 'select', label: 'X' };
    expect(component.getFieldOptions(field)).toEqual([]);
  });

  it('uses lookupValueField and lookupLabelField — not hardcoded id/label', () => {
    seedStore(crud, 'previsiones', [
      { id: 1, nombre: 'FONASA A' },
      { id: 2, nombre: 'FONASA B' },
    ]);
    const field: FieldDefinition = {
      name: 'insurance', type: 'select', label: 'Previsión',
      lookupEntity: 'previsiones', lookupValueField: 'nombre', lookupLabelField: 'nombre'
    };
    const opts = component.getFieldOptions(field);
    expect(opts.length).toBe(2);
    expect(opts[0].value).toBe('FONASA A');
    expect(opts[0].label).toBe('FONASA A');
  });

  it('does not produce "undefined" values for medicos lookup', () => {
    seedStore(crud, 'medicos', [{ id: 1, nombre: 'Dr. Test' }]);
    const field: FieldDefinition = {
      name: 'doctor', type: 'select', label: 'Médico',
      lookupEntity: 'medicos', lookupValueField: 'nombre', lookupLabelField: 'nombre'
    };
    const opts = component.getFieldOptions(field);
    expect(opts[0].value).toBe('Dr. Test');
    expect(opts[0].label).toBe('Dr. Test');
  });

  it('falls back to id/label when lookupValueField/lookupLabelField are absent', () => {
    seedStore(crud, 'misc', [{ id: 42, label: 'Item A' }]);
    const field: FieldDefinition = { name: 'misc', type: 'select', label: 'Misc', lookupEntity: 'misc' };
    const opts = component.getFieldOptions(field);
    expect(opts[0].value).toBe('42');
    expect(opts[0].label).toBe('Item A');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('ClinicalEncounterFormComponent — editableFieldsBySection()', () => {
  let component: ClinicalEncounterFormComponent;

  beforeEach(() => ({ component } = buildComponent('clinical-records')));

  it('returns one group per encounter section present in the schema', () => {
    const groups = component.editableFieldsBySection();
    const sections = groups.map(g => g.section);
    expect(sections).toEqual([...new Set(sections)]);  // no duplicates
  });

  it('labels vitals group "Signos Vitales"', () => {
    const grp = component.editableFieldsBySection().find(g => g.section === 'vitals');
    if (grp) expect(grp.label).toBe('Signos Vitales');
  });

  it('labels diagnosis group "Diagnóstico"', () => {
    const grp = component.editableFieldsBySection().find(g => g.section === 'diagnosis');
    if (grp) expect(grp.label).toBe('Diagnóstico');
  });

  it('labels soap group "Nota SOAP"', () => {
    const grp = component.editableFieldsBySection().find(g => g.section === 'soap');
    if (grp) expect(grp.label).toBe('Nota SOAP');
  });

  it('all fields in each group belong to that section', () => {
    for (const grp of component.editableFieldsBySection()) {
      expect(grp.fields.every(f => f.section === grp.section)).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('ClinicalEncounterFormComponent — getInputType()', () => {
  let component: ClinicalEncounterFormComponent;
  beforeEach(() => ({ component } = buildComponent('clinical-records')));

  it('returns "text" for tags', () => {
    expect(component.getInputType({ name: 't', type: 'tags',     label: 'T' })).toBe('text');
  });
  it('returns "datetime-local" for datetime', () => {
    expect(component.getInputType({ name: 'd', type: 'datetime', label: 'D' })).toBe('datetime-local');
  });
  it('passes through number, email, textarea unchanged', () => {
    expect(component.getInputType({ name: 'n', type: 'number',   label: 'N' })).toBe('number');
    expect(component.getInputType({ name: 'e', type: 'email',    label: 'E' })).toBe('email');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('ClinicalEncounterFormComponent — getError()', () => {
  let component: ClinicalEncounterFormComponent;
  beforeEach(() => ({ component } = buildComponent('clinical-records')));

  it('returns required message for empty required field', () => {
    const ctrl = component.form.get('encounterDate')!;
    ctrl.setValue('');
    const f: FieldDefinition = { name: 'encounterDate', type: 'date', label: 'Fecha', required: true };
    expect(component.getError('encounterDate', f)).toContain('obligatorio');
  });

  it('returns empty string when field has no errors', () => {
    component.form.get('encounterDate')!.setValue('2026-01-01');
    const f: FieldDefinition = { name: 'encounterDate', type: 'date', label: 'Fecha' };
    expect(component.getError('encounterDate', f)).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('ClinicalEncounterFormComponent — isInvalid()', () => {
  let component: ClinicalEncounterFormComponent;
  beforeEach(() => ({ component } = buildComponent('clinical-records')));

  it('returns false for untouched field', () => {
    expect(component.isInvalid('encounterDate')).toBe(false);
  });

  it('returns true for touched invalid field', () => {
    const ctrl = component.form.get('encounterDate')!;
    ctrl.setValue('');
    ctrl.markAsTouched();
    expect(component.isInvalid('encounterDate')).toBe(true);
  });

  it('returns false for valid touched field', () => {
    const ctrl = component.form.get('encounterDate')!;
    ctrl.setValue('2026-06-01');
    ctrl.markAsTouched();
    expect(component.isInvalid('encounterDate')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('ClinicalEncounterFormComponent — submit()', () => {
  it('marks all controls as touched when form is invalid', () => {
    const { component } = buildComponent('clinical-records', 1);
    component.form.get('encounterDate')!.setValue('');
    component.submit();
    const allTouched = Object.values(component.form.controls).every(c => c.touched);
    expect(allTouched).toBe(true);
  });

  it('does not set saving when form is invalid', () => {
    const { component } = buildComponent('clinical-records', 1);
    component.form.get('encounterDate')!.setValue('');
    component.submit();
    expect(component.saving()).toBe(false);
  });

  it('sets saving to true when form is valid', () => {
    const { component } = buildComponent('clinical-records', 1);
    component.form.get('encounterDate')!.setValue('2026-01-01');
    component.submit();
    expect(component.saving()).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('ClinicalEncounterFormComponent — cancel()', () => {
  it('navigates back to the clinical record', () => {
    const { component, mockRouter } = buildComponent('clinical-records', 5);
    component.cancel();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/app/clinical', 'clinical-records', 5]);
  });
});
