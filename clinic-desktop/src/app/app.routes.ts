import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./components/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/shell/shell.component').then(m => m.ShellComponent),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./components/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'entity/:entityKey',
        canActivate: [authGuard],
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
  { path: '**', redirectTo: 'login' }
];
