/**
 * Shared test utilities for component and service specs.
 *
 * All services in this project use inject() for dependencies, so every
 * instantiation must happen inside a proper Angular injection context.
 * A single Injector provides all mocked deps: HttpClient, CryptoService,
 * Router, AuthService, SchemaService, and GenericCrudService.
 */
import { Injector, runInInjectionContext } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router }     from '@angular/router';
import { of }         from 'rxjs';
import { SchemaService }          from '../services/schema.service';
import { GenericCrudService }     from '../services/generic-crud.service';
import { AuthService }            from '../services/auth.service';
import { CryptoService }          from '../services/crypto.service';
import { GoogleCalendarService }  from '../services/google-calendar.service';

/** Pass-through crypto mock — no real encryption in unit tests. */
export const MOCK_CRYPTO = {
  encryptRecord: jest.fn().mockImplementation((data: any) => Promise.resolve(data)),
  decryptRecord: jest.fn().mockImplementation((data: any) => Promise.resolve(data)),
  enabled:       false,
  toggle:        jest.fn(),
  setZkEnabled:  jest.fn(),
  clearKey:      jest.fn(),
};

/**
 * HTTP mock: GET always fails synchronously so initStore falls back to
 * schema seed data. Mutations record calls without triggering store updates.
 */
export function buildMockHttp() {
  return {
    get:    jest.fn().mockImplementation(() => ({
      subscribe: ({ error }: any) => error(new Error('offline'))
    })),
    post:   jest.fn().mockReturnValue({ subscribe: jest.fn() }),
    put:    jest.fn().mockReturnValue({ subscribe: jest.fn() }),
    delete: jest.fn().mockReturnValue(of(null)),
  };
}

export interface TestBed {
  crud:       GenericCrudService;
  schema:     SchemaService;
  mockHttp:   ReturnType<typeof buildMockHttp>;
  mockRouter: { navigate: jest.Mock };
  injector:   Injector;
}

/**
 * Builds a single injector that provides all mocked deps, then instantiates
 * SchemaService, AuthService, and GenericCrudService within that context.
 *
 * Using useClass (not useFactory + new) lets Angular's DI system call each
 * service constructor inside the injector context, so their inject() calls
 * resolve correctly.
 */
export function buildTestBed(): TestBed {
  const mockRouter = { navigate: jest.fn() };
  const mockHttp   = buildMockHttp();

  const mockGcal = {
    isConnected:  () => false,
    isConfigured: false,
    connect:      jest.fn(),
    disconnect:   jest.fn(),
    createEvent:  jest.fn().mockResolvedValue(null),
  };

  const injector = Injector.create({
    providers: [
      { provide: HttpClient,           useValue: mockHttp    },
      { provide: CryptoService,        useValue: MOCK_CRYPTO },
      { provide: Router,               useValue: mockRouter  },
      { provide: AuthService,          useClass: AuthService },
      { provide: SchemaService,        useClass: SchemaService },
      { provide: GoogleCalendarService, useValue: mockGcal   },
    ]
  });

  let schema!: SchemaService;
  let crud!: GenericCrudService;
  runInInjectionContext(injector, () => {
    schema = injector.get(SchemaService);
    crud   = new GenericCrudService();
  });

  return { crud, schema, mockHttp, mockRouter: mockRouter as { navigate: jest.Mock }, injector };
}

/**
 * Seeds a store with test data, bypassing HTTP.
 * The store is created via initStore() if it doesn't exist yet.
 */
export function seedStore(
  crud: GenericCrudService,
  key: string,
  data: Record<string, any>[]
): void {
  crud.initStore(key);
  (crud as any).stores.get(key)!.set(data);
}
