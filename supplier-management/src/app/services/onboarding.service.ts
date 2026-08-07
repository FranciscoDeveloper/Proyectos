import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

const STORAGE_KEY = 'dairi_onboarding_v1';

interface UserConfigResponse {
  zkEnabled?: boolean;
  onboardingCompleted?: boolean;
  onboardingCompletedAt?: string | null;
}

/**
 * Estado de finalización del onboarding.
 *
 * Antes esto vivía SÓLO en localStorage: `needsOnboarding()` devolvía true cuando
 * la clave no estaba, y `onboardingGuard` reenviaba a /onboarding en cada entrada
 * a /app/*. Consecuencia: limpiar los datos del navegador, cambiar de navegador o
 * entrar desde un segundo dispositivo re-disparaba el onboarding de una cuenta que
 * YA lo había completado, porque no existía ningún registro en el servidor.
 *
 * Ahora la finalización se persiste en `user_config.onboarding_completed_at`
 * (migración 016) y la escribe POST /api/professionals/onboarding. localStorage
 * pasa a ser una caché: se consulta primero (ruta rápida, sin red) y sólo en MISS
 * se pregunta al servidor, re-sembrando la caché con la respuesta. La navegación
 * normal no paga ninguna llamada extra.
 */
@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private http = inject(HttpClient);

  /** Lectura sincrónica de la caché local. */
  private cachedLocally(userId: number): boolean {
    try {
      return !!localStorage.getItem(`${STORAGE_KEY}_${userId}`);
    } catch {
      // Modo privado / storage bloqueado: sin caché utilizable.
      return false;
    }
  }

  /**
   * Resuelve si el usuario todavía debe pasar por el onboarding.
   *
   * Caché local presente → false sin tocar la red.
   * Caché ausente → se consulta el servidor. Si el servidor dice que ya se
   * completó, se re-siembra la caché y se deja pasar.
   * Si la consulta falla (offline, 5xx) se cae al comportamiento anterior
   * (mandar a onboarding): es el default seguro, ya que el onboarding es
   * idempotente — reenviarlo actualiza la misma fila, no duplica nada.
   */
  async needsOnboarding(userId: number): Promise<boolean> {
    if (this.cachedLocally(userId)) return false;

    try {
      const cfg = await firstValueFrom(
        this.http.get<UserConfigResponse>('/api/user/config')
      );
      if (cfg?.onboardingCompleted) {
        this.markCompleteLocally(userId);
        return false;
      }
      return true;
    } catch {
      return true;
    }
  }

  /** Sólo la caché local; el servidor ya fue actualizado por el endpoint de onboarding. */
  markCompleteLocally(userId: number): void {
    try {
      localStorage.setItem(
        `${STORAGE_KEY}_${userId}`,
        JSON.stringify({ complete: true, completedAt: new Date().toISOString() })
      );
    } catch { /* quota exceeded or private mode */ }
  }

  /** Compatibilidad con los llamadores existentes. */
  markComplete(userId: number): void {
    this.markCompleteLocally(userId);
  }
}
