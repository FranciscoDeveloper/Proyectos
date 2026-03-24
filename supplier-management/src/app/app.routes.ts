import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./components/dashboard/dashboard.component').then(m => m.DashboardComponent)
  },
  // Generic entity routes — schema-driven CRUD
  {
    path: 'entity/:entityKey',
    loadComponent: () => import('./components/generic-list/generic-list.component').then(m => m.GenericListComponent)
  },
  {
    path: 'entity/:entityKey/new',
    loadComponent: () => import('./components/generic-form/generic-form.component').then(m => m.GenericFormComponent)
  },
  {
    path: 'entity/:entityKey/:id/edit',
    loadComponent: () => import('./components/generic-form/generic-form.component').then(m => m.GenericFormComponent)
  },
  {
    path: 'entity/:entityKey/:id',
    loadComponent: () => import('./components/generic-detail/generic-detail.component').then(m => m.GenericDetailComponent)
  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
