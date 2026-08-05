import { Component, inject, signal, computed, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

/** The word the user has to type out before the delete button unlocks. */
export const CONFIRM_PHRASE = 'ELIMINAR';

/**
 * The account-deletion control itself — the warning copy, the two-factor
 * confirmation (typed phrase + password) and the call to the backend.
 *
 * Deliberately a shared component rather than duplicated markup: it is mounted
 * in two places that must never drift apart, because the stores audit them as
 * one feature —
 *   · /app/cuenta        → the in-app path Apple 5.1.1(v) requires
 *   · /eliminar-cuenta   → the public web path Google Play requires
 *
 * The caller owns what happens afterwards (the two hosts navigate differently),
 * so this component only reports success through `deleted`.
 */
@Component({
  selector: 'app-delete-account-panel',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './delete-account-panel.component.html',
  styleUrl: './delete-account-panel.component.scss'
})
export class DeleteAccountPanelComponent {
  private fb   = inject(FormBuilder);
  readonly auth = inject(AuthService);

  /** Emitted once the backend has confirmed the deletion. */
  readonly deleted = output<void>();

  readonly confirmPhrase = CONFIRM_PHRASE;

  loading  = signal(false);
  error    = signal('');
  showPass = signal(false);

  form = this.fb.group({
    password: ['', [Validators.required]],
    confirm:  ['', [Validators.required]]
  });

  private confirmValue = signal('');

  /**
   * Both factors must be present: the typed phrase (which stops an accidental
   * click) and the password (which the server actually verifies).
   */
  readonly canSubmit = computed(() =>
    !this.loading() &&
    this.confirmValue().trim().toUpperCase() === CONFIRM_PHRASE
  );

  onConfirmInput(event: Event): void {
    this.confirmValue.set((event.target as HTMLInputElement).value);
  }

  submit(): void {
    const password = this.form.value.password ?? '';
    if (!password) {
      this.error.set('Ingresa tu contraseña para confirmar.');
      return;
    }
    if (!this.canSubmit()) return;

    this.loading.set(true);
    this.error.set('');

    this.auth.deleteAccount(password).subscribe({
      next: () => {
        this.loading.set(false);
        this.deleted.emit();
      },
      error: (err: Error) => {
        this.loading.set(false);
        this.error.set(err.message);
      }
    });
  }
}
