import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './guards/auth.guard';

export const routes: Routes = [
  // ── Public ──────────────────────────────────────────────────────────────────
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./components/login/login.component').then(m => m.LoginComponent)
  },

  // ── Protected: Shell wraps all authenticated routes ──────────────────────────
  // AppComponent has a single always-present <router-outlet>.
  // ShellComponent renders the sidebar + header and has its own <router-outlet>
  // for the child routes. This avoids the double-outlet timing bug.
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/shell/shell.component').then(m => m.ShellComponent),
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./components/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'entity/:entityKey',
        canActivate: [authGuard],   // also checks entity-level access
        loadComponent: () =>
          import('./components/generic-list/generic-list.component').then(m => m.GenericListComponent)
      },
      {
        path: 'entity/:entityKey/new',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./components/generic-form/generic-form.component').then(m => m.GenericFormComponent)
      },
      {
        path: 'entity/:entityKey/:id/edit',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./components/generic-form/generic-form.component').then(m => m.GenericFormComponent)
      },
      {
        path: 'entity/:entityKey/:id',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./components/generic-detail/generic-detail.component').then(m => m.GenericDetailComponent)
      }
    ]
  },

  // ── Fallback ─────────────────────────────────────────────────────────────────
  { path: '**', redirectTo: 'login' }
];
