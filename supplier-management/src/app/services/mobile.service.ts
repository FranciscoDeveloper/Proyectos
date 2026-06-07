import { Injectable, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Keyboard } from '@capacitor/keyboard';
import { PushNotifications } from '@capacitor/push-notifications';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

@Injectable({ providedIn: 'root' })
export class MobileService {

  readonly isNative = Capacitor.isNativePlatform();
  readonly platform = Capacitor.getPlatform(); // 'ios' | 'android' | 'web'
  readonly pushToken = signal<string | null>(null);

  async init(): Promise<void> {
    if (!this.isNative) return;

    await SplashScreen.hide({ fadeOutDuration: 300 });

    await StatusBar.setStyle({ style: Style.Light });
    await StatusBar.setBackgroundColor({ color: '#0ea5e9' });

    if (this.platform === 'android') {
      Keyboard.addListener('keyboardWillShow', () => {
        document.body.classList.add('keyboard-open');
      });
      Keyboard.addListener('keyboardWillHide', () => {
        document.body.classList.remove('keyboard-open');
      });
    }

    await this.initPushNotifications();
  }

  private async initPushNotifications(): Promise<void> {
    let permission = await PushNotifications.checkPermissions();

    if (permission.receive === 'prompt') {
      permission = await PushNotifications.requestPermissions();
    }

    if (permission.receive !== 'granted') return;

    await PushNotifications.register();

    PushNotifications.addListener('registration', token => {
      this.pushToken.set(token.value);
      console.log('[Push] token:', token.value);
    });

    PushNotifications.addListener('pushNotificationReceived', notification => {
      console.log('[Push] received:', notification);
    });

    PushNotifications.addListener('pushNotificationActionPerformed', action => {
      console.log('[Push] action:', action);
    });
  }

  // Feedback táctil para botones importantes
  async impact(style: 'light' | 'medium' | 'heavy' = 'light'): Promise<void> {
    if (!this.isNative) return;
    const map = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy };
    await Haptics.impact({ style: map[style] });
  }
}
