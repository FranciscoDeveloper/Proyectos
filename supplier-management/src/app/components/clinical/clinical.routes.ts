import { Routes } from '@angular/router';
import { authGuard } from '../../guards/auth.guard';

export const CLINICAL_ROUTES: Routes = [
  {
    path: ':entityKey',
    canActivate: [authGuard],
    loadComponent: () =>
      import('../clinical-record/clinical-record.component').then(m => m.ClinicalRecordComponent)
  },
  {
    path: ':entityKey/new',
    canActivate: [authGuard],
    loadComponent: () =>
      import('../generic-form/generic-form.component').then(m => m.GenericFormComponent)
  },
  {
    path: ':entityKey/:id/edit',
    canActivate: [authGuard],
    loadComponent: () =>
      import('../generic-form/generic-form.component').then(m => m.GenericFormComponent)
  },
  {
    path: ':entityKey/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('../clinical-detail/clinical-detail.component').then(m => m.ClinicalDetailComponent)
  }
];
