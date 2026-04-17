import { Injectable, signal, computed } from '@angular/core';

/**
 * Google OAuth 2.0 Client ID.
 *
 * Pasos para configurarlo:
 *  1. Ve a https://console.cloud.google.com → APIs & Services → Credentials
 *  2. Crea un "OAuth 2.0 Client ID" de tipo "Web application"
 *  3. Agrega http://localhost:4200 en "Authorized JavaScript origins" (desarrollo)
 *     y tu dominio de producción (ej. http://friquelme-firstpage.s3-website-us-east-1.amazonaws.com)
 *  4. Activa la "Google Calendar API" en APIs & Services → Library
 *  5. Pega el Client ID generado aquí abajo
 */
const GCAL_CLIENT_ID: string = '549490430485-97crbjoma2gjrusacjmlsif2q9irbku3.apps.googleusercontent.com';

const STORAGE_KEY = 'gcal_access_token';
const SCOPE       = 'https://www.googleapis.com/auth/calendar.events';
const API_URL     = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

export interface GcalEventParams {
  summary:        string;
  description?:   string;
  startIso:       string;   // "YYYY-MM-DDTHH:MM" or full ISO
  endIso?:        string;
  attendeeEmail?: string;
  location?:      string;
}

export interface GcalResult {
  success: boolean;
  link?:   string;
  error?:  'not_connected' | 'token_expired' | 'api_error' | 'network_error' | 'not_configured';
}

@Injectable({ providedIn: 'root' })
export class GoogleCalendarService {

  private readonly _token     = signal<string | null>(localStorage.getItem(STORAGE_KEY));
  private tokenClient: any    = null;
  private scriptLoaded        = false;

  /** true si el usuario ya autorizó acceso a Google Calendar */
  readonly isConnected = computed(() => !!this._token());

  /** true si el CLIENT_ID fue configurado (no es el placeholder) */
  readonly isConfigured = GCAL_CLIENT_ID !== 'YOUR_GOOGLE_OAUTH_CLIENT_ID' && GCAL_CLIENT_ID.length > 20;

  // ── Script loader ────────────────────────────────────────────────────────

  private loadScript(): Promise<void> {
    if (this.scriptLoaded || (window as any).google?.accounts) {
      this.scriptLoaded = true;
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const el  = document.createElement('script');
      el.src    = 'https://accounts.google.com/gsi/client';
      el.async  = true;
      el.onload = () => { this.scriptLoaded = true; resolve(); };
      el.onerror = () => reject(new Error('No se pudo cargar Google Identity Services'));
      document.head.appendChild(el);
    });
  }

  // ── Auth ─────────────────────────────────────────────────────────────────

  /** Abre el popup de autorización OAuth de Google */
  async connect(): Promise<void> {
    if (!this.isConfigured) {
      console.warn(
        '[GoogleCalendarService] CLIENT_ID no configurado.\n' +
        'Edita GCAL_CLIENT_ID en src/app/services/google-calendar.service.ts'
      );
      return;
    }
    await this.loadScript();
    return new Promise((resolve, reject) => {
      this.tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: GCAL_CLIENT_ID,
        scope:     SCOPE,
        callback: (response: any) => {
          if (response.error) { reject(new Error(response.error)); return; }
          this._token.set(response.access_token);
          localStorage.setItem(STORAGE_KEY, response.access_token);
          resolve();
        }
      });
      this.tokenClient.requestAccessToken({ prompt: '' });
    });
  }

  /** Revoca el token y desconecta */
  disconnect(): void {
    const tok = this._token();
    if (tok) (window as any).google?.accounts?.oauth2?.revoke(tok, () => {});
    this._token.set(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  // ── Calendar API ──────────────────────────────────────────────────────────

  async createEvent(params: GcalEventParams): Promise<GcalResult> {
    if (!this.isConfigured)  return { success: false, error: 'not_configured' };
    const token = this._token();
    if (!token)              return { success: false, error: 'not_connected' };

    // Asegurar segundos en formato datetime-local ("YYYY-MM-DDTHH:MM" → "YYYY-MM-DDTHH:MM:00")
    const toIso = (v: string) => (v.length === 16 ? v + ':00' : v);
    const tz    = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const start = toIso(params.startIso);
    const end   = params.endIso ? toIso(params.endIso) : start;

    const body: Record<string, any> = {
      summary:     params.summary,
      description: params.description || '',
      location:    params.location    || '',
      start: { dateTime: start, timeZone: tz },
      end:   { dateTime: end,   timeZone: tz }
    };

    if (params.attendeeEmail) {
      body['attendees']    = [{ email: params.attendeeEmail }];
      body['sendUpdates']  = 'all';  // envía invitación al paciente
    }

    try {
      const res = await fetch(API_URL, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify(body)
      });

      if (res.status === 401) {
        this._token.set(null);
        localStorage.removeItem(STORAGE_KEY);
        return { success: false, error: 'token_expired' };
      }
      if (!res.ok) return { success: false, error: 'api_error' };

      const created = await res.json();
      return { success: true, link: created.htmlLink };
    } catch {
      return { success: false, error: 'network_error' };
    }
  }
}
