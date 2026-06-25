import { Injector, runInInjectionContext } from '@angular/core';
import { ActivatedRoute, Router }          from '@angular/router';
import { FormBuilder }                     from '@angular/forms';
import { buildTestBed, seedStore }         from '../../testing/spec-helpers';
import { SchemaService }                   from '../../services/schema.service';
import { GenericCrudService }              from '../../services/generic-crud.service';
import { GenericFormComponent }            from './generic-form.component';
import { FieldDefinition }                 from '../../models/entity-schema.model';

function buildComponent(entityKey: string, recordId?: number): {
  component: GenericFormComponent;
  crud:      GenericCrudService;
  mockRouter: { navigate: jest.Mock };
} {
  const { crud, schema, mockRouter, injector: baseInjector } = buildTestBed();

  const mockRoute = {
    snapshot: {
      data: {},
      paramMap: {
        get: (k: string) => {
          if (k === 'entityKey') return entityKey;
          if (k === 'id')        return recordId != null ? String(recordId) : null;
          return null;
        }
      }
    }
  };

  const injector = Injector.create({
    parent: baseInjector,
    providers: [
      { provide: ActivatedRoute, useValue: mockRoute  },
      { provide: Router,         useValue: mockRouter },
      { provide: FormBuilder                          },
      { provide: SchemaService,      useValue: schema },
      { provide: GenericCrudService, useValue: crud   },
    ]
  });

  // Seed record for edit mode
  if (recordId != null) {
    crud.initStore(entityKey);
    const existing = crud.getAll(entityKey)();
    if (!existing.find(r => r['id'] === recordId)) {
      seedStore(crud, entityKey, [{ id: recordId, name: 'Test Record', code: 'T-001', status: 'active' }]);
    }
  }

  let component!: GenericFormComponent;
  runInInjectionContext(injector, () => { component = new GenericFormComponent(); });
  component.ngOnInit();
  return { component, crud, mockRouter };
}

// ─────────────────────────────────────────────────────────────────────────────
describe('GenericFormComponent — CREATE mode (products)', () => {
  let component: GenericFormComponent;
  let crud: GenericCrudService;
  let mockRouter: { navigate: jest.Mock };

  beforeEach(() => { ({ component, crud, mockRouter } = buildComponent('products')); });

  it('should create', () => expect(component).toBeTruthy());

  it('is in create mode', () => {
    expect(component.isEdit()).toBe(false);
    expect(component.recordId()).toBeNull();
  });

  it('loads schema for "products"', () => {
    expect(component.schema()?.entity.key).toBe('products');
    expect(component.entityKey()).toBe('products');
  });

  it('builds a form control for every schema field', () => {
    component.schema()!.fields.forEach(f => {
      expect(component.form.get(f.name)).toBeTruthy();
    });
  });

  it('form is invalid when required fields are empty', () => {
    component.form.reset();
    expect(component.form.invalid).toBe(true);
  });

  it('isInvalid() is true for touched invalid required field', () => {
    const f = component.schema()!.fields.find(f => f.required && f.type === 'text')!;
    component.form.get(f.name)!.setValue('');
    component.form.get(f.name)!.markAsTouched();
    expect(component.isInvalid(f.name)).toBe(true);
  });

  it('isInvalid() is false for valid field', () => {
    component.form.get('name')!.setValue('Valid Product');
    component.form.get('name')!.markAsTouched();
    expect(component.isInvalid('name')).toBe(false);
  });

  it('getError() contains "obligatorio" for required empty field', () => {
    const nameField = component.schema()!.fields.find(f => f.name === 'name')!;
    component.form.get('name')!.setValue('');
    component.form.get('name')!.markAsTouched();
    expect(component.getError('name', nameField)).toContain('obligatorio');
  });

  it('submit() marks all fields as touched when form is invalid', () => {
    component.form.reset();
    component.submit();
    expect(Object.values(component.form.controls).every(c => c.touched)).toBe(true);
  });

  it('submit() does not set saving when form is invalid', () => {
    component.form.reset();
    component.submit();
    expect(component.saving()).toBe(false);
  });

  it('cancel() navigates to the entity list', () => {
    component.cancel();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/app/entity', 'products']);
  });

  it('getInputType() returns "text" for tags field', () => {
    const f: FieldDefinition = { name: 't', type: 'tags', label: 'Tags' };
    expect(component.getInputType(f)).toBe('text');
  });

  it('getInputType() passes through non-tags types', () => {
    const f: FieldDefinition = { name: 'e', type: 'email', label: 'Email' };
    expect(component.getInputType(f)).toBe('email');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('GenericFormComponent — EDIT mode (suppliers, id=1)', () => {
  let component: GenericFormComponent;
  let mockRouter: { navigate: jest.Mock };

  beforeEach(() => {
    ({ component, mockRouter } = buildComponent('suppliers', 1));
  });

  it('is in edit mode', () => {
    expect(component.isEdit()).toBe(true);
    expect(component.recordId()).toBe(1);
  });

  it('cancel() navigates back to suppliers list', () => {
    component.cancel();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/app/entity', 'suppliers']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('GenericFormComponent — submit guard', () => {
  it('does not enter saving state when form is invalid', () => {
    const { component } = buildComponent('products');
    component.form.reset();
    component.submit();
    expect(component.saving()).toBe(false);
  });

  it('enters saving state when valid form is submitted', () => {
    const { component } = buildComponent('products');
    component.form.patchValue({
      name:     'Valid Product',
      sku:      'ELC-0001',
      category: 'electronics',
      status:   'available',
      price:    100,
      stock:    10,
      supplier: 'Test Supplier',
    });
    expect(component.form.valid).toBe(true);
    component.submit();
    expect(component.saving()).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('GenericFormComponent — getFieldOptions() lookupEntity', () => {
  it('returns options from the crud store using lookupValueField/lookupLabelField', () => {
    const { component, crud } = buildComponent('clinical-records');
    seedStore(crud, 'previsiones', [
      { id: 1, nombre: 'FONASA A' },
      { id: 2, nombre: 'ISAPRE'   },
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

  it('returns static options when there is no lookupEntity', () => {
    const { component } = buildComponent('products');
    const field: FieldDefinition = {
      name: 'status', type: 'select', label: 'Estado',
      options: [{ value: 'active', label: 'Activo' }]
    };
    expect(component.getFieldOptions(field)).toEqual(field.options ?? []);
  });
});
