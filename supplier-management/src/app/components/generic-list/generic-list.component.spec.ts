/**
 * Unit tests for GenericListComponent using Angular's injection context.
 */
import { Injector, runInInjectionContext } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { SchemaService } from '../../services/schema.service';
import { GenericCrudService } from '../../services/generic-crud.service';
import { GenericListComponent } from './generic-list.component';
import { FieldDefinition } from '../../models/entity-schema.model';

function buildComponent(entityKey = 'suppliers'): GenericListComponent {
  const mockRouter = { navigate: jest.fn() } as unknown as Router;
  const mockRoute = {
    paramMap: of({ get: (k: string) => k === 'entityKey' ? entityKey : null })
  } as unknown as ActivatedRoute;

  const schemaService = new SchemaService();
  const crudService = new GenericCrudService(schemaService);

  const injector = Injector.create({
    providers: [
      { provide: SchemaService, useValue: schemaService },
      { provide: GenericCrudService, useValue: crudService },
      { provide: Router, useValue: mockRouter },
      { provide: ActivatedRoute, useValue: mockRoute },
    ]
  });

  let component!: GenericListComponent;
  runInInjectionContext(injector, () => { component = new GenericListComponent(); });
  component.ngOnInit();
  return component;
}

describe('GenericListComponent', () => {
  let component: GenericListComponent;

  beforeEach(() => { component = buildComponent('suppliers'); });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load suppliers schema', () => {
    expect(component.schema()?.entity.key).toBe('suppliers');
    expect(component.entityKey()).toBe('suppliers');
  });

  it('should expose list fields', () => {
    expect(component.listFields().length).toBeGreaterThan(0);
  });

  it('should have a title field', () => {
    expect(component.titleField()).toBeTruthy();
  });

  it('should have filterable fields', () => {
    expect(component.filterableFields().length).toBeGreaterThan(0);
  });

  it('should return all items with no filters', () => {
    expect(component.filteredItems().length).toBe(component.allItems().length);
  });

  it('should filter by search query', () => {
    const total = component.allItems().length;
    component.searchQuery.set('TechCorp');
    expect(component.filteredItems().length).toBeLessThan(total);
    expect(component.filteredItems().length).toBeGreaterThan(0);
  });

  it('should reset to all items when search cleared', () => {
    component.searchQuery.set('TechCorp');
    component.searchQuery.set('');
    expect(component.filteredItems().length).toBe(component.allItems().length);
  });

  it('should filter by select field', () => {
    component.setSelectFilter('status', 'active');
    expect(component.filteredItems().every(i => i['status'] === 'active')).toBe(true);
  });

  it('clearFilters resets all filters', () => {
    component.searchQuery.set('tech');
    component.setSelectFilter('status', 'active');
    component.clearFilters();
    expect(component.filteredItems().length).toBe(component.allItems().length);
    expect(component.searchQuery()).toBe('');
  });

  it('should sort ascending by name', () => {
    // sortField is already 'name' from init (title field). Ensure direction is asc.
    component.sortDir.set('asc');
    const names = component.filteredItems().map(i => i['name'] as string);
    expect(names).toEqual([...names].sort());
  });

  it('should toggle sort direction', () => {
    const currentDir = component.sortDir();
    component.setSort('name'); // toggles direction since field is already 'name'
    const expected = currentDir === 'asc' ? 'desc' : 'asc';
    expect(component.sortDir()).toBe(expected);
  });

  it('paginatedItems length <= pageSize', () => {
    expect(component.paginatedItems().length).toBeLessThanOrEqual(component.pageSize);
  });

  it('setPage changes currentPage', () => {
    if (component.totalPages() > 1) {
      component.setPage(2);
      expect(component.currentPage()).toBe(2);
    } else {
      expect(component.currentPage()).toBe(1);
    }
  });

  it('prevPage and nextPage navigate pages', () => {
    if (component.totalPages() > 1) {
      component.setPage(2);
      component.prevPage();
      expect(component.currentPage()).toBe(1);
      component.nextPage();
      expect(component.currentPage()).toBe(2);
    } else {
      expect(component.currentPage()).toBe(1);
    }
  });

  it('confirmDelete sets deleteModalId', () => {
    component.confirmDelete(5);
    expect(component.deleteModalId()).toBe(5);
  });

  it('cancelDelete clears deleteModalId', () => {
    component.confirmDelete(5);
    component.cancelDelete();
    expect(component.deleteModalId()).toBeNull();
  });

  it('executeDelete removes record', () => {
    const id = component.allItems()[0]['id'];
    const before = component.allItems().length;
    component.confirmDelete(id);
    component.executeDelete();
    expect(component.allItems().length).toBe(before - 1);
    expect(component.deleteModalId()).toBeNull();
  });

  it('navigateNew calls router with new path', () => {
    component.navigateNew();
    expect((component as any).router.navigate).toHaveBeenCalledWith(['/entity', 'suppliers', 'new']);
  });

  it('navigateEdit calls router with edit path', () => {
    component.navigateEdit(3);
    expect((component as any).router.navigate).toHaveBeenCalledWith(['/entity', 'suppliers', 3, 'edit']);
  });

  it('navigateDetail calls router with detail path', () => {
    component.navigateDetail(2);
    expect((component as any).router.navigate).toHaveBeenCalledWith(['/entity', 'suppliers', 2]);
  });

  it('hasFilters false by default', () => {
    expect(component.hasFilters()).toBe(false);
  });

  it('hasFilters true when search set', () => {
    component.searchQuery.set('x');
    expect(component.hasFilters()).toBe(true);
  });

  it('getSelectFilter returns empty string by default', () => {
    expect(component.getSelectFilter('status')).toBe('');
  });

  it('getSelectFilter returns set value', () => {
    component.setSelectFilter('status', 'active');
    expect(component.getSelectFilter('status')).toBe('active');
  });

  it('getEntitySingular returns singular name', () => {
    expect(component.getEntitySingular()).toBe('Proveedor');
  });

  describe('getCellValue()', () => {
    const mkField = (partial: Partial<FieldDefinition>) =>
      ({ name: 'v', type: 'text', label: 'V', ...partial } as FieldDefinition);

    it('returns "—" for null', () => {
      expect(component.getCellValue({ v: null }, mkField({}))).toBe('—');
    });

    it('returns "—" for empty string', () => {
      expect(component.getCellValue({ v: '' }, mkField({}))).toBe('—');
    });

    it('formats currency >= 1M', () => {
      expect(component.getCellValue({ v: 2500000 }, mkField({ format: 'currency' }))).toBe('$2.5M');
    });

    it('formats currency >= 1K', () => {
      expect(component.getCellValue({ v: 3000 }, mkField({ format: 'currency' }))).toBe('$3K');
    });

    it('formats currency < 1K', () => {
      expect(component.getCellValue({ v: 50.5 }, mkField({ format: 'currency' }))).toBe('$50.50');
    });

    it('formats date', () => {
      const val = component.getCellValue({ v: '2024-01-15' }, mkField({ format: 'date' }));
      expect(val).toContain('2024');
    });

    it('returns option label for select', () => {
      const f = mkField({ type: 'select', options: [{ value: 'active', label: 'Activo' }] });
      expect(component.getCellValue({ v: 'active' }, f)).toBe('Activo');
    });

    it('joins array for tags', () => {
      const f = mkField({ type: 'tags' });
      expect(component.getCellValue({ v: ['a', 'b'] }, f)).toBe('a, b');
    });
  });

  describe('getAvatarInitials()', () => {
    it('two-word name', () => expect(component.getAvatarInitials('Alice Johnson')).toBe('AJ'));
    it('single-word name', () => expect(component.getAvatarInitials('Zeus')).toBe('ZE'));
    it('empty name', () => expect(component.getAvatarInitials('')).toBe('?'));
  });

  describe('getStars()', () => {
    it('returns 5 booleans', () => expect(component.getStars(3).length).toBe(5));
    it('fills floor(n) stars', () => expect(component.getStars(3.9).filter(Boolean).length).toBe(3));
  });
});

describe('GenericListComponent — products entity', () => {
  it('should load products schema', () => {
    const c = buildComponent('products');
    expect(c.schema()?.entity.key).toBe('products');
    expect(c.entityKey()).toBe('products');
  });
});

describe('GenericListComponent — patients entity', () => {
  it('should load patients schema', () => {
    const c = buildComponent('patients');
    expect(c.schema()?.entity.key).toBe('patients');
  });
});

describe('GenericListComponent — unknown entity', () => {
  it('schema() is null for unknown entity key', () => {
    const c = buildComponent('unknown_entity');
    expect(c.schema()).toBeNull();
  });
});
