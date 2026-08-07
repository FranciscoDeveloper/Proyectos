import { Routes } from '@angular/router';
import { authGuard, guestGuard, onboardingGuard, completedOnboardingGuard, docsAuthGuard } from './guards/auth.guard';
import { CLINICAL_ROUTES } from './components/clinical/clinical.routes';

export const routes: Routes = [
  // ── Landing (public root) ────────────────────────────────────────────────────
  {
    path: '',
    pathMatch: 'full',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./components/landing/landing.component').then(m => m.LandingComponent)
  },

  // ── Public: register (Starter plan) ─────────────────────────────────────────
  {
    path: 'register',
    loadComponent: () =>
      import('./components/register/register.component').then(m => m.RegisterComponent)
  },

  // ── Public: account activation (link from email) ─────────────────────────────
  {
    path: 'activate',
    loadComponent: () =>
      import('./components/activate/activate.component').then(m => m.ActivateComponent)
  },

  // ── Docs: own login, same auth backend ────────────────────────────────────────
  // Documentation used to be fully public. It's now gated behind docsAuthGuard,
  // which sends an unauthenticated visitor to /docs-login — a distinct interface
  // (see docs-login.component.ts) that authenticates through the exact same
  // AuthService.login() / POST /api/auth/login as the main app. Any authenticated
  // account can read the docs; this doesn't add a new role or permission tier.
  {
    path: 'docs',
    canActivate: [docsAuthGuard],
    loadComponent: () =>
      import('./components/docs/docs.component').then(m => m.DocsComponent)
  },
  {
    path: 'docs-login',
    loadComponent: () =>
      import('./components/docs-login/docs-login.component').then(m => m.DocsLoginComponent)
  },

  // ── Public: account deletion (Google Play requirement) ───────────────────────
  // Deliberately guard-free. Google Play requires a web-reachable deletion path
  // usable WITHOUT installing the app, so a logged-out visitor must be able to
  // land here and sign in on the page itself; guestGuard would bounce a
  // logged-in user to the dashboard, which would break the in-app flow's twin.
  {
    path: 'eliminar-cuenta',
    loadComponent: () =>
      import('./components/delete-account/delete-account.component').then(m => m.DeleteAccountComponent)
  },

  // ── Protected: onboarding (post-registration) ─────────────────────────────
  {
    path: 'onboarding',
    canActivate: [authGuard, completedOnboardingGuard],
    loadComponent: () =>
      import('./components/onboarding/onboarding.component').then(m => m.OnboardingComponent)
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
    canActivate: [authGuard, onboardingGuard],
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
      },
      {
        path: 'import',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./components/import/import.component').then(m => m.ImportComponent)
      },
      {
        path: 'presupuestos',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./components/presupuestos/presupuestos.component').then(m => m.PresupuestosComponent)
      },
      {
        path: 'admin',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./components/user-management/user-management.component').then(m => m.UserManagementComponent)
      },
      {
        // Account settings — hosts the in-app "Eliminar cuenta" control that
        // Apple App Review 5.1.1(v) requires.
        path: 'cuenta',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./components/account/account.component').then(m => m.AccountComponent)
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
    // Payment return: Flow redirects here with ?token=xxx after checkout
    path: 'book/payment-result',
    loadComponent: () =>
      import('./components/payment-result/payment-result.component').then(m => m.PaymentResultComponent)
  },
  {
    path: 'book/:token',
    loadComponent: () =>
      import('./components/patient-booking/patient-booking.component').then(m => m.PatientBookingComponent)
  },

  // ── Fallback ─────────────────────────────────────────────────────────────────
  { path: '**', redirectTo: '' }
];
