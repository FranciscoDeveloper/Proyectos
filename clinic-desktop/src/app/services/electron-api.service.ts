import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';

/**
 * Thin wrapper around `window.electronAPI` that converts IPC calls into Observables.
 *
 * This is the ONLY place in the Angular app that knows about Electron.
 * All other services depend on this one, keeping the rest of the app
 * agnostic about the transport layer (IPC vs HTTP).
 *
 * In a web/cloud version of this app, you would swap this service for one
 * that uses HttpClient — the services and components above this layer are unchanged.
 */

// ── Extend the global Window type so TypeScript knows about the preload bridge ──
declare global {
  interface Window {
    electronAPI: {
      invoke: (channel: string, ...args: any[]) => Promise<any>;
    };
  }
}

@Injectable({ providedIn: 'root' })
export class ElectronApiService {
  /**
   * Invokes an IPC channel and returns an Observable.
   * Errors thrown in the main process are surfaced as Observable errors.
   */
  invoke<T>(channel: string, ...args: any[]): Observable<T> {
    return from(window.electronAPI.invoke(channel, ...args)) as Observable<T>;
  }
}
