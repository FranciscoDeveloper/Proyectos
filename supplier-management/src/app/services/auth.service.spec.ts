/**
 * Unit tests for AuthService.
 * AuthService uses Angular signals and DI (Router), so we use
 * Injector.create() + runInInjectionContext() to instantiate it.
 */
import { Injector, runInInjectionContext } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

function buildService(): { service: AuthService; mockRouter: jest.Mock } {
  const navigateFn = jest.fn().mockResolvedValue(true);
  const mockRouter = { navigate: navigateFn } as unknown as Router;

  const injector = Injector.create({
    providers: [
      { provide: Router, useValue: mockRouter },
      { provide: AuthService, useClass: AuthService }
    ]
  });

  let service!: AuthService;
  runInInjectionContext(injector, () => { service = new AuthService(mockRouter); });
  return { service, mockRouter: navigateFn };
}

describe('AuthService', () => {
  let service: AuthService;
  let navigateFn: jest.Mock;

  beforeEach(() => {
    sessionStorage.clear();
    const built = buildService();
    service = built.service;
    navigateFn = built.mockRouter;
  });

  // ── Initial state ──────────────────────────────────────────────────────────

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should start unauthenticated when sessionStorage is empty', () => {
    expect(service.isAuthenticated()).toBe(false);
  });

  it('should have no user initially', () => {
    expect(service.user()).toBeNull();
  });

  it('should have no token initially', () => {
    expect(service.token()).toBeNull();
  });

  it('should have empty schemas initially', () => {
    expect(service.schemas()).toEqual([]);
    expect(service.getAuthorizedSchemas()).toEqual([]);
  });

  // ── login() ───────────────────────────────────────────────────────────────

  it('login() should return an observable', () => {
    const obs = service.login({ email: 'admin@empresa.com', password: 'admin123' });
    expect(obs).toBeDefined();
    expect(typeof obs.subscribe).toBe('function');
  });

  it('login() with valid credentials resolves with token and user', (done) => {
    service.login({ email: 'admin@empresa.com', password: 'admin123' }).subscribe({
      next: (res) => {
        expect(res.token).toBeTruthy();
        expect(res.user.email).toBe('admin@empresa.com');
        expect(res.user.role).toBe('admin');
        expect(res.schemas.length).toBe(3); // admin sees all 3 entities
        done();
      },
      error: done.fail
    });
  }, 2000);

  it('login() for compras user returns 2 schemas', (done) => {
    service.login({ email: 'compras@empresa.com', password: 'compras123' }).subscribe({
      next: (res) => {
        expect(res.schemas.length).toBe(2);
        const keys = res.schemas.map(s => s.entity.key);
        expect(keys).toContain('suppliers');
        expect(keys).toContain('products');
        done();
      },
      error: done.fail
    });
  }, 2000);

  it('login() for medico user returns only patients schema', (done) => {
    service.login({ email: 'medico@hospital.com', password: 'medico123' }).subscribe({
      next: (res) => {
        expect(res.schemas.length).toBe(1);
        expect(res.schemas[0].entity.key).toBe('patients');
        done();
      },
      error: done.fail
    });
  }, 2000);

  it('login() for auditor user returns only suppliers schema', (done) => {
    service.login({ email: 'auditor@empresa.com', password: 'viewer123' }).subscribe({
      next: (res) => {
        expect(res.schemas.length).toBe(1);
        expect(res.schemas[0].entity.key).toBe('suppliers');
        done();
      },
      error: done.fail
    });
  }, 2000);

  it('login() with wrong password returns an error observable', (done) => {
    service.login({ email: 'admin@empresa.com', password: 'wrongpass' }).subscribe({
      next: () => done.fail('Should have errored'),
      error: (err: Error) => {
        expect(err.message).toContain('Credenciales inválidas');
        done();
      }
    });
  });

  it('login() with unknown email returns an error observable', (done) => {
    service.login({ email: 'nobody@nowhere.com', password: '123456' }).subscribe({
      next: () => done.fail('Should have errored'),
      error: (err: Error) => {
        expect(err.message).toBeTruthy();
        done();
      }
    });
  });

  // ── handleAuthResponse() ──────────────────────────────────────────────────

  it('handleAuthResponse() should update isAuthenticated to true', (done) => {
    service.login({ email: 'admin@empresa.com', password: 'admin123' }).subscribe({
      next: (res) => {
        service.handleAuthResponse(res);
        expect(service.isAuthenticated()).toBe(true);
        done();
      },
      error: done.fail
    });
  }, 2000);

  it('handleAuthResponse() should store user data in signals', (done) => {
    service.login({ email: 'admin@empresa.com', password: 'admin123' }).subscribe({
      next: (res) => {
        service.handleAuthResponse(res);
        expect(service.user()?.email).toBe('admin@empresa.com');
        expect(service.user()?.role).toBe('admin');
        expect(service.token()).toBeTruthy();
        done();
      },
      error: done.fail
    });
  }, 2000);

  it('handleAuthResponse() should persist session to sessionStorage', (done) => {
    service.login({ email: 'admin@empresa.com', password: 'admin123' }).subscribe({
      next: (res) => {
        service.handleAuthResponse(res);
        const stored = sessionStorage.getItem('auth_session');
        expect(stored).toBeTruthy();
        const parsed = JSON.parse(stored!);
        expect(parsed.authenticated).toBe(true);
        expect(parsed.user.email).toBe('admin@empresa.com');
        done();
      },
      error: done.fail
    });
  }, 2000);

  it('handleAuthResponse() should populate getAuthorizedSchemas()', (done) => {
    service.login({ email: 'admin@empresa.com', password: 'admin123' }).subscribe({
      next: (res) => {
        service.handleAuthResponse(res);
        expect(service.getAuthorizedSchemas().length).toBe(3);
        done();
      },
      error: done.fail
    });
  }, 2000);

  // ── logout() ──────────────────────────────────────────────────────────────

  it('logout() should set isAuthenticated to false', (done) => {
    service.login({ email: 'admin@empresa.com', password: 'admin123' }).subscribe({
      next: (res) => {
        service.handleAuthResponse(res);
        service.logout();
        expect(service.isAuthenticated()).toBe(false);
        done();
      },
      error: done.fail
    });
  }, 2000);

  it('logout() should clear user and token', (done) => {
    service.login({ email: 'admin@empresa.com', password: 'admin123' }).subscribe({
      next: (res) => {
        service.handleAuthResponse(res);
        service.logout();
        expect(service.user()).toBeNull();
        expect(service.token()).toBeNull();
        done();
      },
      error: done.fail
    });
  }, 2000);

  it('logout() should clear schemas', (done) => {
    service.login({ email: 'admin@empresa.com', password: 'admin123' }).subscribe({
      next: (res) => {
        service.handleAuthResponse(res);
        service.logout();
        expect(service.schemas()).toEqual([]);
        done();
      },
      error: done.fail
    });
  }, 2000);

  it('logout() should remove session from sessionStorage', (done) => {
    service.login({ email: 'admin@empresa.com', password: 'admin123' }).subscribe({
      next: (res) => {
        service.handleAuthResponse(res);
        service.logout();
        expect(sessionStorage.getItem('auth_session')).toBeNull();
        done();
      },
      error: done.fail
    });
  }, 2000);

  it('logout() should navigate to /login', (done) => {
    service.login({ email: 'admin@empresa.com', password: 'admin123' }).subscribe({
      next: (res) => {
        service.handleAuthResponse(res);
        navigateFn.mockClear();
        service.logout();
        expect(navigateFn).toHaveBeenCalledWith(['/login']);
        done();
      },
      error: done.fail
    });
  }, 2000);

  // ── canAccessEntity() ─────────────────────────────────────────────────────

  it('canAccessEntity() returns false when not authenticated', () => {
    expect(service.canAccessEntity('suppliers')).toBe(false);
  });

  it('canAccessEntity() returns true for authorized entity', (done) => {
    service.login({ email: 'admin@empresa.com', password: 'admin123' }).subscribe({
      next: (res) => {
        service.handleAuthResponse(res);
        expect(service.canAccessEntity('suppliers')).toBe(true);
        expect(service.canAccessEntity('products')).toBe(true);
        expect(service.canAccessEntity('patients')).toBe(true);
        done();
      },
      error: done.fail
    });
  }, 2000);

  it('canAccessEntity() returns false for unauthorized entity', (done) => {
    service.login({ email: 'medico@hospital.com', password: 'medico123' }).subscribe({
      next: (res) => {
        service.handleAuthResponse(res);
        expect(service.canAccessEntity('patients')).toBe(true);
        expect(service.canAccessEntity('suppliers')).toBe(false);
        expect(service.canAccessEntity('products')).toBe(false);
        done();
      },
      error: done.fail
    });
  }, 2000);

  it('canAccessEntity() returns false for unknown entity key', (done) => {
    service.login({ email: 'admin@empresa.com', password: 'admin123' }).subscribe({
      next: (res) => {
        service.handleAuthResponse(res);
        expect(service.canAccessEntity('invoices')).toBe(false);
        done();
      },
      error: done.fail
    });
  }, 2000);

  // ── Session restore ───────────────────────────────────────────────────────

  it('should restore session from sessionStorage on construction', (done) => {
    service.login({ email: 'admin@empresa.com', password: 'admin123' }).subscribe({
      next: (res) => {
        service.handleAuthResponse(res);

        // Build a new service instance — it should read from sessionStorage
        const { service: service2 } = buildService();
        expect(service2.isAuthenticated()).toBe(true);
        expect(service2.user()?.email).toBe('admin@empresa.com');
        done();
      },
      error: done.fail
    });
  }, 2000);
});
