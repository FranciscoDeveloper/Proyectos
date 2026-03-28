import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ElectronApiService } from './electron-api.service';
import { LoginCredentials, AuthResponse, AuthState } from '../models/auth.model';
import { EntitySchema } from '../models/entity-schema.model';

const SESSION_KEY = 'auth_session';
const SESSION_VERSION = 1;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _state = signal<AuthState>(this.loadFromStorage());
  private api     = inject(ElectronApiService);

  readonly user             = computed(() => this._state().user);
  readonly token            = computed(() => this._state().token);
  readonly schemas          = computed(() => this._state().schemas);
  readonly isAuthenticated  = computed(() => this._state().authenticated);

  constructor(private router: Router) {}

  /**
   * Calls the Electron main process via IPC channel `auth:login`.
   * The main process validates credentials and returns the AuthResponse with
   * the list of schemas authorized for this user — driving the entire frontend.
   */
  login(credentials: LoginCredentials): Observable<AuthResponse> {
    return this.api.invoke<AuthResponse>('auth:login', credentials).pipe(
      catchError(err => throwError(() =>
        new Error(err.message ?? 'Credenciales inválidas. Verifique su email y contraseña.')
      ))
    );
  }

  /** Persist auth state and update reactive signals */
  handleAuthResponse(response: AuthResponse): void {
    const state: AuthState = {
      authenticated: true,
      token: response.token,
      user: response.user,
      schemas: response.schemas
    };
    this._state.set(state);
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ ...state, _v: SESSION_VERSION }));
    } catch { /* storage unavailable */ }
  }

  logout(): void {
    this._state.set({ authenticated: false, token: null, user: null, schemas: [] });
    localStorage.removeItem(SESSION_KEY);
    this.router.navigate(['/login']);
  }

  getAuthorizedSchemas(): EntitySchema[] {
    return this._state().schemas;
  }

  canAccessEntity(key: string): boolean {
    return this._state().schemas.some(s => s.entity.key === key);
  }

  private loadFromStorage(): AuthState {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AuthState & { _v?: number };
        if (parsed._v !== SESSION_VERSION) {
          localStorage.removeItem(SESSION_KEY);
          return { authenticated: false, token: null, user: null, schemas: [] };
        }
        return parsed;
      }
    } catch { /* ignore */ }
    return { authenticated: false, token: null, user: null, schemas: [] };
  }
}
