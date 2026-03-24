/**
 * Unit tests for GenericFormComponent using Angular's injection context.
 */
import { Injector, runInInjectionContext } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder } from '@angular/forms';
import { SchemaService } from '../../services/schema.service';
import { GenericCrudService } from '../../services/generic-crud.service';
import { GenericFormComponent } from './generic-form.component';
import { FieldDefinition } from '../../models/entity-schema.model';

function buildComponent(entityKey: string, recordId?: number): {
  component: GenericFormComponent;
  crud: GenericCrudService;
  mockRouter: { navigate: jest.Mock };
} {
  const mockRouter = { navigate: jest.fn() };
  const mockRoute = {
    snapshot: {
      paramMap: {
        get: (k: string) => {
          if (k === 'entityKey') return entityKey;
          if (k === 'id') return recordId != null ? String(recordId) : null;
          return null;
        }
      }
    }
  };

  const schema = new SchemaService();
  const crud = new GenericCrudService(schema);

  const injector = Injector.create({
    providers: [
      { provide: SchemaService, useValue: schema },
      { provide: GenericCrudService, useValue: crud },
      { provide: FormBuilder },
      { provide: Router, useValue: mockRouter },
      { provide: ActivatedRoute, useValue: mockRoute },
    ]
  });

  let component!: GenericFormComponent;
  runInInjectionContext(injector, () => { component = new GenericFormComponent(); });
  component.ngOnInit();
  return { component, crud, mockRouter };
}

describe('GenericFormComponent — CREATE mode (products)', () => {
  let component: GenericFormComponent;
  let crud: GenericCrudService;
  let mockRouter: { navigate: jest.Mock };

  beforeEach(() => {
    ({ component, crud, mockRouter } = buildComponent('products'));
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should be in create mode', () => {
    expect(component.isEdit()).toBe(false);
    expect(component.recordId()).toBeNull();
  });

  it('should load schema for "products"', () => {
    expect(component.schema()?.entity.key).toBe('products');
    expect(component.entityKey()).toBe('products');
  });

  it('should build a form control for every schema field', () => {
    component.schema()!.fields.forEach(f => {
      expect(component.form.get(f.name)).toBeTruthy();
    });
  });

  it('should be invalid when required fields are empty', () => {
    component.form.reset();
    expect(component.form.invalid).toBe(true);
  });

  it('isInvalid() returns true for touched invalid required field', () => {
    const f = component.schema()!.fields.find(f => f.required && f.type === 'text')!;
    component.form.get(f.name)!.setValue('');
    component.form.get(f.name)!.markAsTouched();
    expect(component.isInvalid(f.name)).toBe(true);
  });

  it('isInvalid() returns false for valid field', () => {
    component.form.get('name')!.setValue('Valid Product Name');
    component.form.get('name')!.markAsTouched();
    expect(component.isInvalid('name')).toBe(false);
  });

  it('getError() returns required message', () => {
    const nameField = component.schema()!.fields.find(f => f.name === 'name')!;
    component.form.get('name')!.setValue('');
    component.form.get('name')!.markAsTouched();
    expect(component.getError('name', nameField)).toContain('obligatorio');
  });

  it('submit() marks all fields as touched on invalid', () => {
    component.form.reset();
    component.submit();
    expect(Object.values(component.form.controls).every(c => c.touched)).toBe(true);
  });

  it('submit() does not call create() when form is invalid', () => {
    const spy = jest.spyOn(crud, 'create');
    component.form.reset();
    component.submit();
    expect(spy).not.toHaveBeenCalled();
  });

  it('cancel() navigates to entity list', () => {
    component.cancel();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/entity', 'products']);
  });

  it('getInputType() returns "text" for tags field', () => {
    const f: FieldDefinition = { name: 't', type: 'tags', label: 'Tags' };
    expect(component.getInputType(f)).toBe('text');
  });

  it('getInputType() returns original type for non-tags', () => {
    const f: FieldDefinition = { name: 'e', type: 'email', label: 'Email' };
    expect(component.getInputType(f)).toBe('email');
  });

  it('should validate email format', () => {
    const emailField = component.schema()!.fields.find(f => f.name === 'email');
    if (emailField) {
      const ctrl = component.form.get('email')!;
      ctrl.setValue('not-an-email');
      ctrl.markAsTouched();
      expect(component.isInvalid('email')).toBe(true);
      expect(component.getError('email', emailField)).toContain('válido');
    }
  });
});

describe('GenericFormComponent — EDIT mode (suppliers, id=1)', () => {
  let component: GenericFormComponent;
  let crud: GenericCrudService;
  let mockRouter: { navigate: jest.Mock };

  beforeEach(() => {
    ({ component, crud, mockRouter } = buildComponent('suppliers', 1));
  });

  it('should be in edit mode', () => {
    expect(component.isEdit()).toBe(true);
    expect(component.recordId()).toBe(1);
  });

  it('should pre-populate the name field', () => {
    expect(component.form.get('name')!.value).toBeTruthy();
  });

  it('should pre-populate the code field', () => {
    expect(component.form.get('code')!.value).toBeTruthy();
  });

  it('should enter saving state on valid submit (edit mode)', () => {
    component.schema()!.fields.filter(f => f.required).forEach(f => {
      const ctrl = component.form.get(f.name);
      if (ctrl && !ctrl.value) {
        if (f.type === 'number' || f.type === 'range') ctrl.setValue(1);
        else if (f.type === 'select' && f.options?.length) ctrl.setValue(f.options[0].value);
        else ctrl.setValue('TestValue');
      }
    });
    component.submit();
    // After valid submit, saving() becomes true (async delay is simulating API call)
    expect(component.saving()).toBe(true);
  });

  it('cancel() navigates back to suppliers list', () => {
    component.cancel();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/entity', 'suppliers']);
  });
});

describe('GenericFormComponent — patients schema', () => {
  let component: GenericFormComponent;

  beforeEach(() => {
    ({ component } = buildComponent('patients'));
  });

  it('should load patients schema', () => {
    expect(component.schema()?.entity.key).toBe('patients');
  });

  it('fullName control exists', () => {
    expect(component.form.get('fullName')).toBeTruthy();
  });

  it('patientId validates pattern PAC-NNNNN', () => {
    const ctrl = component.form.get('patientId')!;
    ctrl.setValue('WRONG');
    expect(ctrl.hasError('pattern')).toBe(true);
    ctrl.setValue('PAC-00001');
    expect(ctrl.valid || !ctrl.hasError('pattern')).toBe(true);
  });

  it('age field has min/max validation', () => {
    const ctrl = component.form.get('age')!;
    ctrl.setValue(-1);
    expect(ctrl.hasError('min')).toBe(true);
  });
});

describe('GenericFormComponent — submit guard', () => {
  it('should NOT enter saving state when form is invalid', () => {
    const { component } = buildComponent('products');
    component.form.reset();
    component.submit();
    // form is invalid, submit returns early — saving stays false
    expect(component.saving()).toBe(false);
  });

  it('should mark form as saving when form is valid', () => {
    const { component } = buildComponent('patients');
    // Fill all required fields with valid values for patients
    component.form.patchValue({
      fullName: 'Test Patient',
      patientId: 'PAC-00099',
      status: 'active',
      age: 30,
      gender: 'male',
      bloodType: 'O+',
      phone: '+34 600 000 000',
      doctor: 'Dr. Test',
      admissionDate: '2024-01-01',
      diagnosis: 'Test diagnosis'
    });
    expect(component.form.valid).toBe(true);
    component.submit();
    expect(component.saving()).toBe(true);
  });
});
