/**
 * Unit tests for authGuard and guestGuard.
 * Guards are CanActivateFn functions that use inject(); we run them inside
 * runInInjectionContext so the Angular DI context is available.
 */
import { Injector, runInInjectionContext } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { authGuard, guestGuard } from './auth.guard';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildMockRoute(entityKey?: string): ActivatedRouteSnapshot {
  return {
    paramMap: {
      get: (key: string) => (key === 'entityKey' ? (entityKey ?? null) : null)
    }
  } as unknown as ActivatedRouteSnapshot;
}

function buildMockState(url = '/dashboard'): RouterStateSnapshot {
  return { url } as RouterStateSnapshot;
}

function buildInjector(isAuthenticated: boolean, authorizedKeys: string[] = []) {
  const navigateFn = jest.fn().mockResolvedValue(true);
  const mockRouter = { navigate: navigateFn } as unknown as Router;

  const mockAuth = {
    isAuthenticated: () => isAuthenticated,
    canAccessEntity: (key: string) => authorizedKeys.includes(key)
  } as unknown as AuthService;

  const injector = Injector.create({
    providers: [
      { provide: Router, useValue: mockRouter },
      { provide: AuthService, useValue: mockAuth }
    ]
  });

  return { injector, navigateFn };
}

// ─── authGuard ────────────────────────────────────────────────────────────────

describe('authGuard', () => {

  it('allows access when user is authenticated and no entityKey', () => {
    const { injector } = buildInjector(true);
    const route = buildMockRoute();
    const state = buildMockState('/dashboard');
    let result!: boolean;
    runInInjectionContext(injector, () => { result = authGuard(route, state) as boolean; });
    expect(result).toBe(true);
  });

  it('redirects to /login when not authenticated', () => {
    const { injector, navigateFn } = buildInjector(false);
    const route = buildMockRoute();
    const state = buildMockState('/dashboard');
    let result!: boolean;
    runInInjectionContext(injector, () => { result = authGuard(route, state) as boolean; });
    expect(result).toBe(false);
    expect(navigateFn).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/dashboard' } });
  });

  it('preserves returnUrl query param when redirecting to login', () => {
    const { injector, navigateFn } = buildInjector(false);
    const route = buildMockRoute();
    const state = buildMockState('/entity/suppliers');
    runInInjectionContext(injector, () => { authGuard(route, state); });
    expect(navigateFn).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/entity/suppliers' } });
  });

  it('allows access to authorized entity', () => {
    const { injector } = buildInjector(true, ['suppliers']);
    const route = buildMockRoute('suppliers');
    const state = buildMockState('/entity/suppliers');
    let result!: boolean;
    runInInjectionContext(injector, () => { result = authGuard(route, state) as boolean; });
    expect(result).toBe(true);
  });

  it('redirects to /dashboard for unauthorized entity', () => {
    const { injector, navigateFn } = buildInjector(true, ['suppliers']);
    const route = buildMockRoute('patients');
    const state = buildMockState('/entity/patients');
    let result!: boolean;
    runInInjectionContext(injector, () => { result = authGuard(route, state) as boolean; });
    expect(result).toBe(false);
    expect(navigateFn).toHaveBeenCalledWith(['/dashboard']);
  });

  it('allows access to dashboard (no entityKey) when authenticated', () => {
    const { injector } = buildInjector(true);
    const route = buildMockRoute(); // no entityKey
    const state = buildMockState('/dashboard');
    let result!: boolean;
    runInInjectionContext(injector, () => { result = authGuard(route, state) as boolean; });
    expect(result).toBe(true);
  });

  it('returns false (not true) when unauthenticated', () => {
    const { injector } = buildInjector(false);
    const route = buildMockRoute();
    const state = buildMockState('/dashboard');
    let result!: boolean;
    runInInjectionContext(injector, () => { result = authGuard(route, state) as boolean; });
    expect(result).not.toBe(true);
  });

  it('allows entity access when all entities are authorized', () => {
    const { injector } = buildInjector(true, ['suppliers', 'products', 'patients']);
    (['suppliers', 'products', 'patients'] as const).forEach(key => {
      const route = buildMockRoute(key);
      const state = buildMockState(`/entity/${key}`);
      let result!: boolean;
      runInInjectionContext(injector, () => { result = authGuard(route, state) as boolean; });
      expect(result).toBe(true);
    });
  });
});

// ─── guestGuard ───────────────────────────────────────────────────────────────

describe('guestGuard', () => {
  const dummyRoute = {} as ActivatedRouteSnapshot;
  const dummyState = {} as RouterStateSnapshot;

  it('allows access when not authenticated', () => {
    const { injector } = buildInjector(false);
    let result!: boolean;
    runInInjectionContext(injector, () => { result = guestGuard(dummyRoute, dummyState) as boolean; });
    expect(result).toBe(true);
  });

  it('redirects to /dashboard when already authenticated', () => {
    const { injector, navigateFn } = buildInjector(true);
    let result!: boolean;
    runInInjectionContext(injector, () => { result = guestGuard(dummyRoute, dummyState) as boolean; });
    expect(result).toBe(false);
    expect(navigateFn).toHaveBeenCalledWith(['/dashboard']);
  });

  it('does not call navigate when not authenticated', () => {
    const { injector, navigateFn } = buildInjector(false);
    runInInjectionContext(injector, () => { guestGuard(dummyRoute, dummyState); });
    expect(navigateFn).not.toHaveBeenCalled();
  });

  it('returns false (not true) when already authenticated', () => {
    const { injector } = buildInjector(true);
    let result!: boolean;
    runInInjectionContext(injector, () => { result = guestGuard(dummyRoute, dummyState) as boolean; });
    expect(result).not.toBe(true);
  });
});
