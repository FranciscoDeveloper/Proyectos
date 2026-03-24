import { Injector, runInInjectionContext } from '@angular/core';
import { Router } from '@angular/router';
import { SchemaService } from './schema.service';
import { AuthService } from './auth.service';

function buildSchemaService(): SchemaService {
  const mockRouter = { navigate: jest.fn() } as unknown as Router;
  // Provide AuthService in the injector so inject(AuthService) resolves during SchemaService construction
  const injector = Injector.create({
    providers: [
      { provide: Router, useValue: mockRouter },
      { provide: AuthService, useFactory: () => new AuthService(mockRouter) }
    ]
  });
  let service!: SchemaService;
  runInInjectionContext(injector, () => { service = new SchemaService(); });
  return service;
}

describe('SchemaService', () => {
  let service: SchemaService;

  beforeEach(() => {
    service = buildSchemaService();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getAvailableEntities()', () => {
    it('should return at least 3 entities', () => {
      expect(service.getAvailableEntities().length).toBeGreaterThanOrEqual(3);
    });

    it('should include suppliers, products and patients', () => {
      const keys = service.getAvailableEntities().map(e => e.key);
      expect(keys).toContain('suppliers');
      expect(keys).toContain('products');
      expect(keys).toContain('patients');
    });

    it('each entity should have key, singular, plural and icon', () => {
      service.getAvailableEntities().forEach(e => {
        expect(e.key).toBeTruthy();
        expect(e.singular).toBeTruthy();
        expect(e.plural).toBeTruthy();
        expect(e.icon).toBeTruthy();
      });
    });
  });

  describe('getSchema(key)', () => {
    it('should return a schema for "suppliers"', () => {
      const schema = service.getSchema('suppliers');
      expect(schema).toBeTruthy();
      expect(schema!.entity.key).toBe('suppliers');
    });

    it('should return a schema for "products"', () => {
      const schema = service.getSchema('products');
      expect(schema!.entity.key).toBe('products');
    });

    it('should return a schema for "patients"', () => {
      const schema = service.getSchema('patients');
      expect(schema!.entity.key).toBe('patients');
    });

    it('should return null for unknown keys', () => {
      expect(service.getSchema('unknown_entity')).toBeNull();
    });

    it('each schema should have at least one field', () => {
      ['suppliers', 'products', 'patients'].forEach(key => {
        expect(service.getSchema(key)!.fields.length).toBeGreaterThan(0);
      });
    });

    it('each schema should have at least one isTitle field', () => {
      ['suppliers', 'products', 'patients'].forEach(key => {
        const titleField = service.getSchema(key)!.fields.find(f => f.isTitle);
        expect(titleField).toBeTruthy();
      });
    });

    it('required fields should have required: true', () => {
      const schema = service.getSchema('suppliers')!;
      const required = schema.fields.filter(f => f.required);
      expect(required.length).toBeGreaterThan(0);
    });

    it('select fields should have options', () => {
      ['suppliers', 'products', 'patients'].forEach(key => {
        const schema = service.getSchema(key)!;
        const selectFields = schema.fields.filter(f => f.type === 'select');
        selectFields.forEach(f => {
          expect(f.options).toBeDefined();
          expect(f.options!.length).toBeGreaterThan(0);
        });
      });
    });

    it('badge fields should have badgeColors', () => {
      const schema = service.getSchema('suppliers')!;
      const badgeFields = schema.fields.filter(f => f.isBadge);
      badgeFields.forEach(f => {
        expect(f.badgeColors).toBeDefined();
      });
    });
  });

  describe('getEntityPayload(key)', () => {
    it('should return schema and data for "suppliers"', () => {
      const payload = service.getEntityPayload('suppliers');
      expect(payload).toBeTruthy();
      expect(payload!.schema).toBeTruthy();
      expect(payload!.data.length).toBeGreaterThan(0);
    });

    it('should return data for "products"', () => {
      expect(service.getEntityPayload('products')!.data.length).toBeGreaterThan(0);
    });

    it('should return data for "patients"', () => {
      expect(service.getEntityPayload('patients')!.data.length).toBeGreaterThan(0);
    });

    it('should return null for unknown key', () => {
      expect(service.getEntityPayload('nonexistent')).toBeNull();
    });

    it('data records should have an id field', () => {
      ['suppliers', 'products', 'patients'].forEach(key => {
        service.getEntityPayload(key)!.data.forEach(record => {
          expect(record['id']).toBeDefined();
        });
      });
    });
  });
});
