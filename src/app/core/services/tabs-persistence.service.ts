import { Injectable, inject, signal } from '@angular/core';
import { TabsPreferences, DEFAULT_TABS_PREFERENCES } from '../models';
import { ElectronService } from './electron.service';

/**
 * Service for managing tabs preferences.
 * Handles loading, saving, and caching of tabs state.
 */
@Injectable({ providedIn: 'root' })
export class TabsPersistenceService {
  private electronService = inject(ElectronService);

  // Cache the preferences in memory
  private _preferences = signal<TabsPreferences>(DEFAULT_TABS_PREFERENCES);

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
  async loadPreferences(): Promise<TabsPreferences> {
    try {
      const prefs = await this.electronService.getTabsPreferences();
      this._preferences.set({ ...DEFAULT_TABS_PREFERENCES, ...prefs });
      return this._preferences();
    } catch (error) {
      console.error('Failed to load tabs preferences:', error);
      return DEFAULT_TABS_PREFERENCES;
    }
  }

  /**
   * Update preferences and save to storage.
   * Uses debouncing to avoid excessive writes.
   */
  updatePreferences(partial: Partial<TabsPreferences>): void {
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

  private debouncedSave(prefs: TabsPreferences): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.save(prefs);
      this.saveTimeout = null;
    }, 300); // 300ms debounce
  }

  private async save(prefs: TabsPreferences): Promise<void> {
    try {
      await this.electronService.saveTabsPreferences(prefs);
    } catch (error) {
      console.error('Failed to save tabs preferences:', error);
    }
  }
}
