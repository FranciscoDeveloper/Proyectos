import { EntitySchema } from './entity-schema.model';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: 'superadmin' | 'admin' | 'manager' | 'viewer' | 'professional' | 'receptionist' | 'staff';
  avatar: string;
  professionalId?: number | null;
  professionalName?: string | null;

  /**
   * Tipo de cuenta / plan. Lo emite el backend y ya llegaba en la respuesta de
   * login — `handleAuthResponse` guarda `response.user` entero, así que el valor
   * estaba disponible en runtime pero no declarado acá.
   *
   * Sólo las sesiones Starter lo traen: lambda-auth `signAgendaSession` firma con
   * `accountType:'agenda'`, mientras que `handleLoginDairi` (Pro/Enterprise) y el
   * login legacy contra Postgres firman SIN el campo. Por eso la comprobación
   * correcta es `accountType === 'agenda'` para Starter y "ausente" para Pro, y
   * NO al revés: no existe ningún `accountType:'dairi'` en un token de sesión
   * (sólo en los JWT de activación).
   */
  accountType?: 'agenda' | 'dairi' | string;
  /** Alias que el backend manda junto a accountType en las cuentas Starter. */
  plan?: string;
}

/**
 * The backend responds to a login request with a token, the user profile,
 * and the list of entity schemas the user is authorized to manage.
 * The frontend uses those schemas to build all navigation and CRUD screens.
 */
export interface AuthResponse {
  token: string;
  refreshToken?: string;
  expiresAt: string;
  user: AuthUser;
  /** Whether Zero-Knowledge encryption is enabled for this user */
  zkEnabled?: boolean;
  /** Schemas authorized for this user — drives the entire frontend */
  schemas: EntitySchema[];
}

export interface AuthState {
  authenticated: boolean;
  token: string | null;
  user: AuthUser | null;
  schemas: EntitySchema[];
  zkEnabled?: boolean;
}
