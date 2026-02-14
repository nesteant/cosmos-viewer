import { app, BrowserWindow, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import { getAppSettings } from './storage.service';

const isDev = process.env['NODE_ENV'] === 'development';

export function initAutoUpdater(mainWindow: BrowserWindow): void {
  const settings = getAppSettings();

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = settings.allowPrerelease;

  autoUpdater.on('update-available', (info) => {
    mainWindow.webContents.send('updater:update-available', {
      version: info.version,
      releaseNotes: info.releaseNotes,
    });
  });

  autoUpdater.on('update-not-available', () => {
    mainWindow.webContents.send('updater:update-not-available');
  });

  autoUpdater.on('download-progress', (progress) => {
    mainWindow.webContents.send('updater:download-progress', {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  autoUpdater.on('update-downloaded', () => {
    mainWindow.webContents.send('updater:update-downloaded');
  });

  autoUpdater.on('error', (error) => {
    mainWindow.webContents.send('updater:error', error?.message ?? 'Unknown update error');
  });

  if (!isDev && settings.autoCheckUpdates) {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('Auto-update check failed:', err);
    });
  }
}

export function registerUpdaterIpcHandlers(): void {
  ipcMain.handle('updater:check', async () => {
    await autoUpdater.checkForUpdates();
  });

  ipcMain.handle('updater:download', async () => {
    await autoUpdater.downloadUpdate();
  });

  ipcMain.handle('updater:install', () => {
    // Force quit on macOS — without this, the app stays open
    app.removeAllListeners('window-all-closed');
    autoUpdater.quitAndInstall(false, true);
  });

  ipcMain.handle('updater:apply-settings', async (_, settings: { allowPrerelease: boolean }) => {
    autoUpdater.allowPrerelease = settings.allowPrerelease;
  });
}
