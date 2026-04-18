"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
/**
 * Exposes a secure `window.electronAPI` bridge to the Angular renderer.
 * The renderer calls `window.electronAPI.invoke(channel, ...args)` exactly
 * like a regular Promise — Angular services wrap this in `from()` to get Observables.
 */
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    invoke: (channel, ...args) => {
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
        return electron_1.ipcRenderer.invoke(channel, ...args);
    }
});
