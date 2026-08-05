import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Keyboard } from '@capacitor/keyboard';
import { PushNotifications } from '@capacitor/push-notifications';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

/**
 * Server-side push delivery is NOT built yet. Flipping this to true makes the app
 * POST its device token to /api/devices/token on every registration.
 *
 * Before enabling, the following must exist — see the session report for detail:
 *   1. Storage for {userId, token, platform, updatedAt} keyed on (userId, token),
 *      so re-installs and multi-device users don't accumulate stale rows.
 *   2. A JWT-authenticated POST /api/devices/token route on dairi-bff that
 *      upserts the row for the caller's `sub`, plus a DELETE on logout.
 *   3. An actual sender. @capacitor/push-notifications is FCM-backed on Android,
 *      so this means either Firebase Admin SDK credentials or an SNS platform
 *      application — neither of which exists in any Lambda today.
 *
 * Until then the token is kept in `pushToken` and logged, but never transmitted:
 * posting to a route that returns 404 on every cold start would be worse than
 * not posting at all.
 */
const PUSH_TOKEN_DELIVERY_ENABLED = false;

@Injectable({ providedIn: 'root' })
export class MobileService {

  private http = inject(HttpClient);

  readonly isNative = Capacitor.isNativePlatform();
  readonly platform = Capacitor.getPlatform(); // 'ios' | 'android' | 'web'
  readonly pushToken = signal<string | null>(null);

  /**
   * Why push registration failed, when it did. Surfaced so the state is
   * inspectable rather than being swallowed into a console line nobody reads.
   */
  readonly pushError = signal<string | null>(null);

  async init(): Promise<void> {
    if (!this.isNative) return;

    // Lets global styles target the native shell (tap-highlight, callouts).
    document.body.classList.add('capacitor-native', `platform-${this.platform}`);

    // Each of these is independent: a failure in one must not prevent the rest.
    // Previously a rejection anywhere here (push registration being the likely
    // one) escaped as an unhandled rejection and skipped everything after it.
    await this.safely('splash', () => SplashScreen.hide({ fadeOutDuration: 300 }));
    await this.safely('statusbar', async () => {
      await StatusBar.setStyle({ style: Style.Light });
      await StatusBar.setBackgroundColor({ color: '#0ea5e9' });
    });

    this.initKeyboard();
    await this.initPushNotifications();
  }

  private initKeyboard(): void {
    // Applied on both platforms — iOS shows a keyboard too, and the class is
    // what lets layouts collapse non-essential chrome while typing.
    Keyboard.addListener('keyboardWillShow', () => {
      document.body.classList.add('keyboard-open');
    });
    Keyboard.addListener('keyboardWillHide', () => {
      document.body.classList.remove('keyboard-open');
    });
  }

  private async initPushNotifications(): Promise<void> {
    try {
      let permission = await PushNotifications.checkPermissions();

      if (permission.receive === 'prompt') {
        permission = await PushNotifications.requestPermissions();
      }

      if (permission.receive !== 'granted') {
        this.pushError.set('Permiso de notificaciones denegado');
        return;
      }

      // Listeners MUST be attached before register(). The 'registration' event
      // fires as soon as the platform returns a token, which on a warm start can
      // happen before the awaited register() call settles — so the previous
      // ordering (register first, then addListener) could miss the token
      // entirely and leave pushToken null with no error to show for it.
      await PushNotifications.addListener('registration', token => {
        this.pushToken.set(token.value);
        this.pushError.set(null);
        void this.deliverToken(token.value);
      });

      await PushNotifications.addListener('registrationError', err => {
        // On Android this is what fires when google-services.json is absent:
        // the plugin is FCM-backed and cannot obtain a token without it.
        const detail = JSON.stringify(err);
        this.pushError.set(detail);
        console.error(
          '[Push] registration failed. On Android this usually means ' +
          'android/app/google-services.json is missing (no Firebase project configured).',
          detail
        );
      });

      await PushNotifications.addListener('pushNotificationReceived', notification => {
        console.log('[Push] received:', notification);
      });

      await PushNotifications.addListener('pushNotificationActionPerformed', action => {
        console.log('[Push] action:', action);
      });

      await PushNotifications.register();
    } catch (err) {
      this.pushError.set(String(err));
      console.error('[Push] init failed:', err);
    }
  }

  /**
   * Sends the device token to the backend so it can target this device later.
   * Inert until the backend described at PUSH_TOKEN_DELIVERY_ENABLED exists.
   */
  private async deliverToken(token: string): Promise<void> {
    if (!PUSH_TOKEN_DELIVERY_ENABLED) {
      console.warn(
        '[Push] Device token obtained but NOT sent to the backend — there is no ' +
        'endpoint to receive it and no service able to send a notification. ' +
        'Token:', token
      );
      return;
    }

    try {
      await this.http.post('/api/devices/token', {
        token,
        platform: this.platform,
      }).toPromise();
    } catch (err) {
      // Non-fatal: the app is fully usable without push.
      console.error('[Push] token delivery failed:', err);
    }
  }

  /** Runs a native call without letting its failure abort startup. */
  private async safely(label: string, fn: () => Promise<unknown>): Promise<void> {
    try {
      await fn();
    } catch (err) {
      console.error(`[Mobile] ${label} failed:`, err);
    }
  }

  // Feedback táctil para botones importantes
  async impact(style: 'light' | 'medium' | 'heavy' = 'light'): Promise<void> {
    if (!this.isNative) return;
    const map = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy };
    try {
      await Haptics.impact({ style: map[style] });
    } catch { /* haptics unavailable on this device — never worth failing a tap over */ }
  }
}
