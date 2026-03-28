import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { registerAuthHandlers } from './handlers/auth.handler';
import { registerEntityHandlers } from './handlers/entity.handler';

const isDev = process.env['ELECTRON_DEV'] === 'true';

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Clínica Desktop',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#f9fafb',
  });

  if (isDev) {
    win.loadURL('http://localhost:4200');
    win.webContents.openDevTools();
  } else {
    const indexPath = path.join(__dirname, '..', 'dist', 'clinic-desktop', 'browser', 'index.html');
    win.loadFile(indexPath);
  }

  win.on('closed', () => app.quit());
}

// Register all IPC handlers before any window is created
registerAuthHandlers(ipcMain);
registerEntityHandlers(ipcMain);

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
