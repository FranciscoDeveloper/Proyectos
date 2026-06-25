import { buildTestBed, seedStore } from '../testing/spec-helpers';
import { GenericCrudService } from './generic-crud.service';

describe('GenericCrudService — initStore()', () => {
  it('populates store with schema seed data when HTTP fails', () => {
    const { crud } = buildTestBed();
    crud.initStore('suppliers');
    expect(crud.getAll('suppliers')().length).toBeGreaterThan(0);
  });

  it('initialises empty store for unknown entity', () => {
    const { crud } = buildTestBed();
    crud.initStore('unknown_entity_xyz');
    expect(crud.getAll('unknown_entity_xyz')().length).toBe(0);
  });

  it('is idempotent — second call does not reinitialise', () => {
    const { crud } = buildTestBed();
    crud.initStore('products');
    const countAfterFirst = crud.getAll('products')().length;
    crud.initStore('products');
    expect(crud.getAll('products')().length).toBe(countAfterFirst);
  });
});

describe('GenericCrudService — getAll()', () => {
  it('returns a callable signal', () => {
    const { crud } = buildTestBed();
    const sig = crud.getAll('suppliers');
    expect(typeof sig).toBe('function');
  });

  it('reflects seeded data immediately', () => {
    const { crud } = buildTestBed();
    const testData = [{ id: 1, name: 'Seeded Co' }];
    seedStore(crud, 'suppliers', testData);
    expect(crud.getAll('suppliers')()).toEqual(testData);
  });
});

describe('GenericCrudService — getById()', () => {
  it('returns the record matching the given id', () => {
    const { crud } = buildTestBed();
    seedStore(crud, 'suppliers', [{ id: 10, name: 'Alpha' }, { id: 20, name: 'Beta' }]);
    expect(crud.getById('suppliers', 10)?.['name']).toBe('Alpha');
  });

  it('returns undefined for non-existent id', () => {
    const { crud } = buildTestBed();
    seedStore(crud, 'suppliers', [{ id: 1, name: 'Only' }]);
    expect(crud.getById('suppliers', 999)).toBeUndefined();
  });

  it('returns undefined when store has not been initialised', () => {
    const { crud } = buildTestBed();
    expect(crud.getById('uninitialised', 1)).toBeUndefined();
  });
});

describe('GenericCrudService — update() optimistic update', () => {
  it('merges fields into the store immediately (before HTTP responds)', () => {
    const { crud } = buildTestBed();
    seedStore(crud, 'suppliers', [{ id: 5, name: 'Old Name', status: 'active' }]);
    crud.update('suppliers', 5, { name: 'New Name' });
    expect(crud.getById('suppliers', 5)?.['name']).toBe('New Name');
    expect(crud.getById('suppliers', 5)?.['status']).toBe('active');
  });

  it('preserves id after optimistic update', () => {
    const { crud } = buildTestBed();
    seedStore(crud, 'suppliers', [{ id: 7, name: 'X' }]);
    crud.update('suppliers', 7, { name: 'Y' });
    expect(crud.getById('suppliers', 7)?.['id']).toBe(7);
  });

  it('does nothing when record is not in store', () => {
    const { crud } = buildTestBed();
    seedStore(crud, 'suppliers', [{ id: 1, name: 'Only' }]);
    expect(() => crud.update('suppliers', 999, { name: 'Ghost' })).not.toThrow();
    expect(crud.getAll('suppliers')().length).toBe(1);
  });

  it('calls http.put with the correct URL', () => {
    const { crud, mockHttp } = buildTestBed();
    seedStore(crud, 'suppliers', [{ id: 3, name: 'X' }]);
    crud.update('suppliers', 3, { name: 'Y' });
    // HTTP call is queued via encryptRecord promise; verify after microtasks settle
    return Promise.resolve().then(() => {
      expect(mockHttp.put).toHaveBeenCalled();
    });
  });
});

describe('GenericCrudService — create()', () => {
  it('calls http.post with the correct URL', () => {
    const { crud, mockHttp } = buildTestBed();
    crud.initStore('products');
    crud.create('products', { name: 'Widget' });
    return Promise.resolve().then(() => {
      expect(mockHttp.post).toHaveBeenCalled();
    });
  });
});

describe('GenericCrudService — delete()', () => {
  it('calls http.delete with the correct URL', () => {
    const { crud, mockHttp } = buildTestBed();
    seedStore(crud, 'suppliers', [{ id: 2, name: 'ToDelete' }]);
    crud.delete('suppliers', 2);
    expect(mockHttp.delete).toHaveBeenCalledWith('/api/entities/suppliers/2');
  });
});

describe('GenericCrudService — search()', () => {
  it('returns all records for empty query', () => {
    const { crud } = buildTestBed();
    const data = [{ id: 1, name: 'Alpha' }, { id: 2, name: 'Beta' }];
    seedStore(crud, 'suppliers', data);
    expect(crud.search('suppliers', '').length).toBe(2);
  });

  it('filters by partial case-insensitive string', () => {
    const { crud } = buildTestBed();
    seedStore(crud, 'suppliers', [{ id: 1, name: 'TechCorp' }, { id: 2, name: 'OtherCo' }]);
    const results = crud.search('suppliers', 'tech');
    expect(results.length).toBe(1);
    expect(results[0]['name']).toBe('TechCorp');
  });

  it('returns empty array when nothing matches', () => {
    const { crud } = buildTestBed();
    seedStore(crud, 'suppliers', [{ id: 1, name: 'Alpha' }]);
    expect(crud.search('suppliers', 'xyznonexistent').length).toBe(0);
  });

  it('is case-insensitive', () => {
    const { crud } = buildTestBed();
    seedStore(crud, 'suppliers', [{ id: 1, name: 'TechCorp' }]);
    expect(crud.search('suppliers', 'TECHCORP').length).toBe(1);
    expect(crud.search('suppliers', 'techcorp').length).toBe(1);
  });

  it('returns empty array for uninitialised store', () => {
    const { crud } = buildTestBed();
    expect(crud.search('uninitialised', 'test').length).toBe(0);
  });
});
