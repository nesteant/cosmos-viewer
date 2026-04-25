import { Injectable, inject, signal } from '@angular/core';
import {
  TablePreferencesStorage,
  ColumnLayout,
  TabColumnState,
  SortState,
  FilterState,
  DEFAULT_TABLE_PREFERENCES,
  DEFAULT_SORT_STATE,
  DEFAULT_FILTER_STATE,
} from '../models';
import { ElectronService } from './electron.service';

const DEFAULT_COLUMN_WIDTH = 150;

@Injectable({ providedIn: 'root' })
export class TablePreferencesService {
  private electronService = inject(ElectronService);

  private _preferences = signal<TablePreferencesStorage>(DEFAULT_TABLE_PREFERENCES);
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;

  /** All stored preferences */
  readonly preferences = this._preferences.asReadonly();

  /** Load preferences from storage */
  async loadPreferences(): Promise<TablePreferencesStorage> {
    try {
      const prefs = await this.electronService.getTablePreferences();
      // Handle migration from old format with global
      const migrated: TablePreferencesStorage = {
        containers: prefs.containers ?? {},
        tabs: prefs.tabs ?? {},
      };
      this._preferences.set(migrated);
      return migrated;
    } catch (error) {
      console.error('Failed to load table preferences:', error);
      return DEFAULT_TABLE_PREFERENCES;
    }
  }

  /** Get effective columns for a tab, merging container → tab */
  getEffectiveColumns(
    tabId: string,
    containerKey: string,
    detectedColumnPaths: string[]
  ): ColumnLayout[] {
    const prefs = this._preferences();
    const container = prefs.containers[containerKey];
    const tab = prefs.tabs[tabId];

    // Start with detected columns as base
    let columns = this.createDefaultColumns(detectedColumnPaths);

    // Override with container preset if exists
    if (container?.columns?.length > 0) {
      columns = this.mergeColumns(columns, container.columns);
    }

    // Override with tab state if exists
    if (tab?.columns?.length > 0) {
      columns = this.mergeColumns(columns, tab.columns);
    }

    return columns;
  }

  /** Create default columns from detected paths */
  private createDefaultColumns(paths: string[]): ColumnLayout[] {
    return paths.map((path, idx) => ({
      path,
      visible: true,
      width: DEFAULT_COLUMN_WIDTH,
      order: idx,
      pinned: false,
    }));
  }

  /** Merge existing column settings with saved preferences */
  private mergeColumns(base: ColumnLayout[], saved: ColumnLayout[]): ColumnLayout[] {
    const basePaths = new Set(base.map(c => c.path));

    // Start with saved columns that still exist in base
    const merged = saved
      .filter(c => basePaths.has(c.path))
      .map(savedCol => ({
        ...savedCol,
      }));

    // Add new columns that aren't in saved, inserting before system fields
    const savedPaths = new Set(saved.map(c => c.path));
    const newColumns = base.filter(c => !savedPaths.has(c.path));

    if (newColumns.length > 0) {
      // Find the first system field order to insert user columns before it
      const firstSystemOrder = merged
        .filter(c => c.path.startsWith('_') && c.path !== '_id')
        .reduce((min, c) => Math.min(min, c.order), Infinity);

      let insertOrder = firstSystemOrder === Infinity
        ? Math.max(...merged.map(c => c.order), -1) + 1
        : firstSystemOrder;

      // Shift system fields to make room
      if (firstSystemOrder !== Infinity) {
        merged.forEach(c => {
          if (c.order >= firstSystemOrder) {
            c.order += newColumns.length;
          }
        });
      }

      newColumns.forEach((baseCol, idx) => {
        merged.push({
          ...baseCol,
          order: insertOrder + idx,
        });
      });
    }

    return merged.sort((a, b) => a.order - b.order);
  }

  /** Get sort state for a tab */
  getSortState(tabId: string): SortState {
    return this._preferences().tabs[tabId]?.sort ?? DEFAULT_SORT_STATE;
  }

  /** Get filter state for a tab */
  getFilterState(tabId: string): FilterState {
    return this._preferences().tabs[tabId]?.filter ?? DEFAULT_FILTER_STATE;
  }

  /** Update tab column preferences */
  updateTabColumns(tabId: string, columns: ColumnLayout[]): void {
    this._preferences.update(prefs => ({
      ...prefs,
      tabs: {
        ...prefs.tabs,
        [tabId]: {
          ...prefs.tabs[tabId],
          columns,
          sort: prefs.tabs[tabId]?.sort ?? DEFAULT_SORT_STATE,
          filter: prefs.tabs[tabId]?.filter ?? DEFAULT_FILTER_STATE,
        },
      },
    }));
    this.debouncedSave();
  }

  /** Update a single column property in tab state */
  updateTabColumn(tabId: string, path: string, updates: Partial<ColumnLayout>): void {
    const currentColumns = this._preferences().tabs[tabId]?.columns ?? [];
    const updatedColumns = currentColumns.map(col =>
      col.path === path ? { ...col, ...updates } : col
    );
    this.updateTabColumns(tabId, updatedColumns);
  }

  /** Update sort state (tab-only, ephemeral) */
  updateSort(tabId: string, sort: SortState): void {
    this._preferences.update(prefs => ({
      ...prefs,
      tabs: {
        ...prefs.tabs,
        [tabId]: {
          ...prefs.tabs[tabId],
          columns: prefs.tabs[tabId]?.columns ?? [],
          sort,
          filter: prefs.tabs[tabId]?.filter ?? DEFAULT_FILTER_STATE,
        },
      },
    }));
    // Don't save sort state to disk (ephemeral)
  }

  /** Update filter state (tab-only, ephemeral) */
  updateFilter(tabId: string, filter: Partial<FilterState>): void {
    const currentFilter = this._preferences().tabs[tabId]?.filter ?? DEFAULT_FILTER_STATE;
    this._preferences.update(prefs => ({
      ...prefs,
      tabs: {
        ...prefs.tabs,
        [tabId]: {
          ...prefs.tabs[tabId],
          columns: prefs.tabs[tabId]?.columns ?? [],
          sort: prefs.tabs[tabId]?.sort ?? DEFAULT_SORT_STATE,
          filter: { ...currentFilter, ...filter },
        },
      },
    }));
    // Don't save filter state to disk (ephemeral)
  }

  /** Reorder columns via drag-drop */
  reorderColumns(tabId: string, fromIndex: number, toIndex: number): void {
    const columns = [...(this._preferences().tabs[tabId]?.columns ?? [])];
    const [moved] = columns.splice(fromIndex, 1);
    columns.splice(toIndex, 0, moved);
    columns.forEach((col, idx) => col.order = idx);
    this.updateTabColumns(tabId, columns);
  }

  /** Save current tab columns as container preset */
  saveAsContainerPreset(tabId: string, containerKey: string): void {
    const tabColumns = this._preferences().tabs[tabId]?.columns ?? [];
    if (tabColumns.length === 0) return;

    this._preferences.update(prefs => ({
      ...prefs,
      containers: {
        ...prefs.containers,
        [containerKey]: { columns: tabColumns },
      },
    }));
    this.debouncedSave();
  }

  /** Reset tab to container preset */
  resetToContainerPreset(tabId: string, containerKey: string): void {
    const containerPreset = this._preferences().containers[containerKey];
    if (!containerPreset) return;

    this._preferences.update(prefs => ({
      ...prefs,
      tabs: {
        ...prefs.tabs,
        [tabId]: {
          columns: [...containerPreset.columns],
          sort: DEFAULT_SORT_STATE,
          filter: DEFAULT_FILTER_STATE,
        },
      },
    }));
    this.debouncedSave();
  }

  /** Initialize tab state from detected columns */
  initializeTabColumns(
    tabId: string,
    containerKey: string,
    detectedColumnPaths: string[]
  ): ColumnLayout[] {
    const effectiveColumns = this.getEffectiveColumns(tabId, containerKey, detectedColumnPaths);

    // Only update if column set actually changed (avoids infinite signal loops)
    const currentColumns = this._preferences().tabs[tabId]?.columns ?? [];
    const currentPaths = new Set(currentColumns.map(c => c.path));
    const effectivePaths = new Set(effectiveColumns.map(c => c.path));
    const columnsChanged =
      currentColumns.length === 0 ||
      effectivePaths.size !== currentPaths.size ||
      [...effectivePaths].some(p => !currentPaths.has(p));

    if (columnsChanged) {
      this.updateTabColumns(tabId, effectiveColumns);
    }

    return this._preferences().tabs[tabId]?.columns ?? effectiveColumns;
  }

  /** Clear tab state when tab is closed */
  clearTabState(tabId: string): void {
    this._preferences.update(prefs => {
      const { [tabId]: _, ...remainingTabs } = prefs.tabs;
      return {
        ...prefs,
        tabs: remainingTabs,
      };
    });
    this.debouncedSave();
  }

  private debouncedSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.save();
      this.saveTimeout = null;
    }, 300);
  }

  private async save(): Promise<void> {
    try {
      // Create a version without ephemeral sort/filter data
      const prefs = this._preferences();
      const tabsWithoutEphemeral: Record<string, TabColumnState> = {};

      for (const [tabId, tabState] of Object.entries(prefs.tabs)) {
        tabsWithoutEphemeral[tabId] = {
          columns: tabState.columns,
          sort: DEFAULT_SORT_STATE,  // Don't persist sort
          filter: DEFAULT_FILTER_STATE,  // Don't persist filter
        };
      }

      await this.electronService.saveTablePreferences({
        ...prefs,
        tabs: tabsWithoutEphemeral,
      });
    } catch (error) {
      console.error('Failed to save table preferences:', error);
    }
  }

  async saveImmediately(): Promise<void> {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    await this.save();
  }
}
