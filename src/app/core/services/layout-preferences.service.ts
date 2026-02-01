import { Injectable, inject, signal } from '@angular/core';
import { LayoutPreferences, DEFAULT_LAYOUT_PREFERENCES } from '../models';
import { ElectronService } from './electron.service';

/**
 * Service for managing layout preferences.
 * Handles loading, saving, and caching of layout state.
 */
@Injectable({ providedIn: 'root' })
export class LayoutPreferencesService {
  private electronService = inject(ElectronService);

  // Cache the preferences in memory
  private _preferences = signal<LayoutPreferences>(DEFAULT_LAYOUT_PREFERENCES);

  // Debounce timer for saving
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;

  /** Current preferences as a signal */
  get preferences() {
    return this._preferences.asReadonly();
  }

  /**
   * Load preferences from storage.
   * Call this on app init.
   */
  async loadPreferences(): Promise<LayoutPreferences> {
    try {
      const prefs = await this.electronService.getLayoutPreferences();
      this._preferences.set({ ...DEFAULT_LAYOUT_PREFERENCES, ...prefs });
      return this._preferences();
    } catch (error) {
      console.error('Failed to load layout preferences:', error);
      return DEFAULT_LAYOUT_PREFERENCES;
    }
  }

  /**
   * Update preferences and save to storage.
   * Uses debouncing to avoid excessive writes during drag operations.
   */
  updatePreferences(partial: Partial<LayoutPreferences>): void {
    const updated = { ...this._preferences(), ...partial };
    this._preferences.set(updated);
    this.debouncedSave(updated);
  }

  /**
   * Save preferences immediately (no debounce).
   */
  async saveImmediately(): Promise<void> {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    await this.save(this._preferences());
  }

  private debouncedSave(prefs: LayoutPreferences): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.save(prefs);
      this.saveTimeout = null;
    }, 300); // 300ms debounce
  }

  private async save(prefs: LayoutPreferences): Promise<void> {
    try {
      await this.electronService.saveLayoutPreferences(prefs);
    } catch (error) {
      console.error('Failed to save layout preferences:', error);
    }
  }
}
