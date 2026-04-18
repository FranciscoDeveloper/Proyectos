import { contextBridge, ipcRenderer } from 'electron';

/**
 * Exposes a secure `window.electronAPI` bridge to the Angular renderer.
 * The renderer calls `window.electronAPI.invoke(channel, ...args)` exactly
 * like a regular Promise — Angular services wrap this in `from()` to get Observables.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel: string, ...args: any[]): Promise<any> => {
    // Whitelist allowed IPC channels for security
    const allowed = [
      'auth:login',
      'entity:list',
      'entity:create',
      'entity:update',
      'entity:delete',
    ];
    if (!allowed.includes(channel)) {
      return Promise.reject(new Error(`IPC channel not allowed: ${channel}`));
    }
    return ipcRenderer.invoke(channel, ...args);
  }
});
