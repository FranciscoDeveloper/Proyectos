import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { DeleteAccountPanelComponent } from '../delete-account/delete-account-panel.component';

/**
 * In-app account settings — /app/cuenta
 *
 * Exists primarily to host the account-deletion control that Apple App Review
 * 5.1.1(v) requires to be reachable *from inside the app* (see
 * MOBILE_STORE_PUBLISHING.md §0.3). Reached from the account button in the
 * shell sidebar footer, next to "Cerrar sesión".
 *
 * The control itself is the shared DeleteAccountPanelComponent, which is also
 * mounted on the public /eliminar-cuenta page that Google Play requires — the
 * two paths are the same feature and must not drift.
 */
@Component({
  selector: 'app-account',
  standalone: true,
  imports: [CommonModule, DeleteAccountPanelComponent],
  templateUrl: './account.component.html',
  styleUrl: './account.component.scss'
})
export class AccountComponent {
  readonly auth = inject(AuthService);
  private router = inject(Router);

  onDeleted(): void {
    // The server-side session is already gone, so clear local state directly
    // instead of logout() — logout() would fire a doomed /api/auth/logout call
    // and then redirect to /login, which reads as "you got signed out", not as
    // "your account was deleted". Land on the landing page with an explicit
    // acknowledgment instead.
    this.auth.clearLocalSession();
    this.router.navigate(['/'], { queryParams: { cuenta: 'eliminada' } });
  }
}
