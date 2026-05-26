import { Injectable } from '@angular/core';

const STORAGE_KEY = 'dairi_onboarding_v1';

@Injectable({ providedIn: 'root' })
export class OnboardingService {
  needsOnboarding(userId: number): boolean {
    try {
      return !localStorage.getItem(`${STORAGE_KEY}_${userId}`);
    } catch {
      return false;
    }
  }

  markComplete(userId: number): void {
    try {
      localStorage.setItem(
        `${STORAGE_KEY}_${userId}`,
        JSON.stringify({ complete: true, completedAt: new Date().toISOString() })
      );
    } catch { /* quota exceeded or private mode */ }
  }
}
