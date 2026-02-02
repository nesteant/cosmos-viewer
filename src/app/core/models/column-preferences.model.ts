export type SortDirection = 'asc' | 'desc' | null;

// Column layout preferences (saved to presets)
export interface ColumnLayout {
  path: string;
  visible: boolean;
  width: number;
  order: number;
  pinned: boolean;
}

// Container preset - saved column configuration per container
export interface ContainerColumnPreset {
  columns: ColumnLayout[];
}

// Tab state - inherits from container, includes ephemeral sort/filter
export interface TabColumnState {
  columns: ColumnLayout[];
  sort: SortState;
  filter: FilterState;
}

export interface SortState {
  column: string | null;
  direction: SortDirection;
}

export interface FilterState {
  globalSearch: string;
  columnFilters: Record<string, string>;
}

// Storage structure (two levels: container and tab)
export interface TablePreferencesStorage {
  containers: Record<string, ContainerColumnPreset>;  // key: connectionId:databaseId:containerId
  tabs: Record<string, TabColumnState>;               // key: tabId
}

export const DEFAULT_SORT_STATE: SortState = {
  column: null,
  direction: null,
};

export const DEFAULT_FILTER_STATE: FilterState = {
  globalSearch: '',
  columnFilters: {},
};

export const DEFAULT_TABLE_PREFERENCES: TablePreferencesStorage = {
  containers: {},
  tabs: {},
};

// Helper to create container key
export function createContainerKey(connectionId: string, databaseId: string, containerId: string): string {
  return `${connectionId}:${databaseId}:${containerId}`;
}
