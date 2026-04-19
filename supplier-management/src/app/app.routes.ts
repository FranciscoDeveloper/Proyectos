import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './guards/auth.guard';
import { CLINICAL_ROUTES } from './components/clinical/clinical.routes';

export const routes: Routes = [
  // ── Landing (public root) ────────────────────────────────────────────────────
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./components/landing/landing.component').then(m => m.LandingComponent)
  },

  // ── Public: register (Starter plan) ─────────────────────────────────────────
  {
    path: 'register',
    loadComponent: () =>
      import('./components/register/register.component').then(m => m.RegisterComponent)
  },

  // ── Public: login ────────────────────────────────────────────────────────────
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
    path: 'app',
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
        canActivate: [authGuard],
        loadComponent: () =>
          import('./components/generic-list/generic-list.component').then(m => m.GenericListComponent)
      },
      {
        // Calendar-type modules use this route instead of /app/entity/:entityKey
        path: 'module/:entityKey',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./components/calendar/calendar.component').then(m => m.CalendarComponent)
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
      },
      {
        path: 'chat',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./components/chat/chat.component').then(m => m.ChatComponent)
      },
      {
        path: 'commissions',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./components/commission-report/commission-report.component').then(m => m.CommissionReportComponent)
      },
      {
        path: 'reports',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./components/medical-reports/medical-reports.component').then(m => m.MedicalReportsComponent)
      },
      {
        // Clinical record module: /app/clinical/:entityKey and sub-routes
        path: 'clinical',
        children: CLINICAL_ROUTES
      }
    ]
  },

  // ── Public: patient self-booking (with or without UUID token) ───────────────
  {
    path: 'book',
    loadComponent: () =>
      import('./components/patient-booking/patient-booking.component').then(m => m.PatientBookingComponent)
  },
  {
    path: 'book/:token',
    loadComponent: () =>
      import('./components/patient-booking/patient-booking.component').then(m => m.PatientBookingComponent)
  },

  // ── Fallback ─────────────────────────────────────────────────────────────────
  { path: '**', redirectTo: '' }
];
