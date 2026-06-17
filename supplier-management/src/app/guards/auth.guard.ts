import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { OnboardingService } from '../services/onboarding.service';

/**
 * Protects all entity routes.
 * - Redirects to /login if not authenticated, preserving the intended URL.
 * - Redirects to /dashboard if the entity key is not in the authorized schemas.
 */
export const authGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  // For entity routes, verify the entity key is authorized by the backend
  const entityKey = route.paramMap.get('entityKey');
  if (entityKey && !auth.canAccessEntity(entityKey)) {
    router.navigate(['/app/dashboard']);
    return false;
  }

  return true;
};

/**
 * Prevents authenticated users from accessing the login page.
 */
export const guestGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    router.navigate(['/app/dashboard']);
    return false;
  }

  return true;
};

/**
 * Redirects to /onboarding when the authenticated user hasn't completed onboarding yet.
 * Applied to the /app shell so any attempt to enter the app triggers the check.
 */
export const onboardingGuard: CanActivateFn = () => {
  const auth         = inject(AuthService);
  const onboarding   = inject(OnboardingService);
  const router       = inject(Router);

  const user = auth.user();
  if (user && onboarding.needsOnboarding(user.id)) {
    router.navigate(['/onboarding']);
    return false;
  }
  return true;
};

/**
 * Prevents a user who has already completed onboarding from accessing /onboarding again.
 * Redirects to /app/dashboard if onboarding is already complete.
 */
export const completedOnboardingGuard: CanActivateFn = () => {
  const auth         = inject(AuthService);
  const onboarding   = inject(OnboardingService);
  const router       = inject(Router);

  const user = auth.user();
  if (user && !onboarding.needsOnboarding(user.id)) {
    router.navigate(['/app/dashboard']);
    return false;
  }
  return true;
};
