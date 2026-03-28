import { EntitySchema } from './entity-schema.model';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'viewer';
  avatar: string;
}

/**
 * The backend responds to a login request with a token, the user profile,
 * and the list of entity schemas the user is authorized to manage.
 * The frontend uses those schemas to build all navigation and CRUD screens.
 */
export interface AuthResponse {
  token: string;
  expiresAt: string;
  user: AuthUser;
  /** Schemas authorized for this user — drives the entire frontend */
  schemas: EntitySchema[];
}

export interface AuthState {
  authenticated: boolean;
  token: string | null;
  user: AuthUser | null;
  schemas: EntitySchema[];
}
