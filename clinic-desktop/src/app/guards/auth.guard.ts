import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  _state: RouterStateSnapshot
) => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    router.navigate(['/login']);
    return false;
  }

  const entityKey = route.paramMap.get('entityKey');
  if (entityKey && !auth.canAccessEntity(entityKey)) {
    router.navigate(['/dashboard']);
    return false;
  }

  return true;
};

export const guestGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    router.navigate(['/dashboard']);
    return false;
  }
  return true;
};
