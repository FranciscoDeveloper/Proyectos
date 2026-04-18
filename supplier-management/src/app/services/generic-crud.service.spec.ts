import { Injector, runInInjectionContext } from '@angular/core';
import { Router } from '@angular/router';
import { SchemaService } from './schema.service';
import { GenericCrudService } from './generic-crud.service';
import { AuthService } from './auth.service';

function buildServices(): { service: GenericCrudService; schemaService: SchemaService } {
  const mockRouter = { navigate: jest.fn() } as unknown as Router;
  const injector = Injector.create({
    providers: [
      { provide: Router, useValue: mockRouter },
      { provide: AuthService, useFactory: () => new AuthService(mockRouter) }
    ]
  });
  let schemaService!: SchemaService;
  runInInjectionContext(injector, () => { schemaService = new SchemaService(); });
  const service = new GenericCrudService(schemaService);
  return { service, schemaService };
}

describe('GenericCrudService', () => {
  let service: GenericCrudService;
  let schemaService: SchemaService;

  beforeEach(() => {
    const built = buildServices();
    service = built.service;
    schemaService = built.schemaService;
  });

  describe('initStore()', () => {
    it('should initialize store with data from SchemaService', () => {
      service.initStore('suppliers');
      expect(service.getAll('suppliers')().length).toBeGreaterThan(0);
    });

    it('should initialize empty store for unknown entity', () => {
      service.initStore('unknown');
      expect(service.getAll('unknown')().length).toBe(0);
    });

    it('should not reinitialize if store already exists', () => {
      service.initStore('products');
      const count = service.getAll('products')().length;
      service.initStore('products');
      expect(service.getAll('products')().length).toBe(count);
    });
  });

  describe('getAll()', () => {
    it('should return a reactive signal (callable function)', () => {
      const sig = service.getAll('suppliers');
      expect(typeof sig).toBe('function');
    });

    it('should reflect new items after create', () => {
      service.initStore('suppliers');
      const before = service.getAll('suppliers')().length;
      service.create('suppliers', { name: 'New Co', code: 'NC-001' });
      expect(service.getAll('suppliers')().length).toBe(before + 1);
    });
  });

  describe('getById()', () => {
    it('should return the correct record by id', () => {
      service.initStore('suppliers');
      const first = service.getAll('suppliers')()[0];
      expect(service.getById('suppliers', first['id'])).toEqual(first);
    });

    it('should return undefined for non-existent id', () => {
      service.initStore('suppliers');
      expect(service.getById('suppliers', 999999)).toBeUndefined();
    });
  });

  describe('create()', () => {
    it('should add a record and assign a numeric id', () => {
      service.initStore('products');
      const before = service.getAll('products')().length;
      const created = service.create('products', { name: 'Nuevo', sku: 'NEW-0001' });
      expect(service.getAll('products')().length).toBe(before + 1);
      expect(typeof created['id']).toBe('number');
    });

    it('should include createdAt and updatedAt timestamps', () => {
      service.initStore('products');
      const created = service.create('products', { name: 'Test' });
      expect(created['createdAt']).toBeDefined();
      expect(created['updatedAt']).toBeDefined();
    });

    it('should preserve provided fields in the new record', () => {
      service.initStore('products');
      const created = service.create('products', { name: 'Widget', price: 9.99 });
      expect(created['name']).toBe('Widget');
      expect(created['price']).toBe(9.99);
    });
  });

  describe('update()', () => {
    it('should update an existing record', () => {
      service.initStore('suppliers');
      const id = service.getAll('suppliers')()[0]['id'];
      const updated = service.update('suppliers', id, { name: 'Updated Name' });
      expect(updated!['name']).toBe('Updated Name');
    });

    it('should preserve the id after update', () => {
      service.initStore('suppliers');
      const id = service.getAll('suppliers')()[0]['id'];
      const updated = service.update('suppliers', id, { name: 'X' });
      expect(updated!['id']).toBe(id);
    });

    it('should return null when record not found', () => {
      service.initStore('suppliers');
      expect(service.update('suppliers', 999999, { name: 'X' })).toBeNull();
    });

    it('should refresh updatedAt timestamp', () => {
      service.initStore('patients');
      const id = service.getAll('patients')()[0]['id'];
      const before = service.getById('patients', id)!['updatedAt'];
      const updated = service.update('patients', id, { fullName: 'New Name' });
      expect(updated!['updatedAt']).not.toBe(before);
    });
  });

  describe('delete()', () => {
    it('should remove a record', () => {
      service.initStore('patients');
      const before = service.getAll('patients')().length;
      const id = service.getAll('patients')()[0]['id'];
      service.delete('patients', id);
      expect(service.getAll('patients')().length).toBe(before - 1);
    });

    it('should not remove other records', () => {
      service.initStore('patients');
      const ids = service.getAll('patients')().map(r => r['id']);
      service.delete('patients', ids[0]);
      expect(service.getById('patients', ids[1])).toBeTruthy();
    });

    it('should be a no-op for non-existent id', () => {
      service.initStore('products');
      const before = service.getAll('products')().length;
      service.delete('products', 999999);
      expect(service.getAll('products')().length).toBe(before);
    });
  });

  describe('search()', () => {
    it('should return all records for empty query', () => {
      service.initStore('suppliers');
      const count = service.getAll('suppliers')().length;
      expect(service.search('suppliers', '').length).toBe(count);
    });

    it('should filter by partial string match', () => {
      service.initStore('suppliers');
      const results = service.search('suppliers', 'TechCorp');
      expect(results.length).toBeGreaterThan(0);
      results.forEach(r =>
        expect(JSON.stringify(r).toLowerCase()).toContain('techcorp')
      );
    });

    it('should return empty array for no match', () => {
      service.initStore('suppliers');
      expect(service.search('suppliers', 'xyznonexistent12345abc').length).toBe(0);
    });

    it('should be case-insensitive', () => {
      service.initStore('suppliers');
      const lower = service.search('suppliers', 'techcorp');
      const upper = service.search('suppliers', 'TECHCORP');
      expect(lower.length).toBe(upper.length);
    });
  });
});
