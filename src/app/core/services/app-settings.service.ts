import { Injectable, inject, signal } from '@angular/core';
import { AppSettings, DEFAULT_APP_SETTINGS } from '../models';
import { ElectronService } from './electron.service';

@Injectable({ providedIn: 'root' })
export class AppSettingsService {
  private electronService = inject(ElectronService);

  private _settings = signal<AppSettings>(DEFAULT_APP_SETTINGS);
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;

  get settings() {
    return this._settings.asReadonly();
  }

  async loadSettings(): Promise<AppSettings> {
    try {
      const settings = await this.electronService.getAppSettings();
      this._settings.set({ ...DEFAULT_APP_SETTINGS, ...settings });
      return this._settings();
    } catch (error) {
      console.error('Failed to load app settings:', error);
      return DEFAULT_APP_SETTINGS;
    }
  }

  updateSettings(partial: Partial<AppSettings>): void {
    const updated = { ...this._settings(), ...partial };
    this._settings.set(updated);
    this.debouncedSave(updated);
  }

  async saveImmediately(): Promise<void> {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    await this.save(this._settings());
  }

  private debouncedSave(settings: AppSettings): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.save(settings);
      this.saveTimeout = null;
    }, 300);
  }

  private async save(settings: AppSettings): Promise<void> {
    try {
      await this.electronService.saveAppSettings(settings);
      await this.electronService.applyUpdaterSettings({
        allowPrerelease: settings.allowPrerelease,
      });
    } catch (error) {
      console.error('Failed to save app settings:', error);
    }
  }
}
