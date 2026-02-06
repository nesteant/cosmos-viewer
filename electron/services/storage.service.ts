import Store from 'electron-store';

type ProviderType = 'cosmos-sql' | 'cosmos-mongo' | 'mongodb' | 'jdbc';

interface DatabaseConnectionData {
  id: string;
  name: string;
  providerType: ProviderType;
  endpoint: string;
  key: string;
  defaultDatabase?: string;
  createdAt: string;
  lastUsedAt?: string;
}

interface LayoutPreferences {
  sidebarWidth: number;
  queryPanelSize: number;
  sidebarCollapsed: boolean;
  queryPanelCollapsed: boolean;
}

interface TabState {
  id: string;
  containerId: string;
  containerName: string;
  databaseId: string;
  partitionKeyPath: string;
  query: string;
}

interface TabsPreferences {
  tabs: TabState[];
  activeTabId: string | null;
}

interface ColumnLayout {
  path: string;
  visible: boolean;
  width: number;
  order: number;
  pinned: boolean;
}

interface ContainerColumnPreset {
  columns: ColumnLayout[];
}

interface SortState {
  column: string | null;
  direction: 'asc' | 'desc' | null;
}

interface FilterState {
  globalSearch: string;
  columnFilters: Record<string, string>;
}

interface TabColumnState {
  columns: ColumnLayout[];
  sort: SortState;
  filter: FilterState;
}

interface TablePreferencesData {
  containers: Record<string, ContainerColumnPreset>;
  tabs: Record<string, TabColumnState>;
}

interface AppSettingsData {
  allowPrerelease: boolean;
  autoCheckUpdates: boolean;
  fontSize: number;
  editorFontSize: number;
}

interface StoreSchema {
  connections: DatabaseConnectionData[];
  layoutPreferences: LayoutPreferences;
  tabsPreferences: TabsPreferences;
  tablePreferences: TablePreferencesData;
  appSettings: AppSettingsData;
}

const DEFAULT_LAYOUT: LayoutPreferences = {
  sidebarWidth: 280,
  queryPanelSize: 25,
  sidebarCollapsed: false,
  queryPanelCollapsed: false,
};

const DEFAULT_TABS: TabsPreferences = {
  tabs: [],
  activeTabId: null,
};

const DEFAULT_TABLE_PREFERENCES: TablePreferencesData = {
  containers: {},
  tabs: {},
};

const DEFAULT_APP_SETTINGS: AppSettingsData = {
  allowPrerelease: true,
  autoCheckUpdates: true,
  fontSize: 13,
  editorFontSize: 14,
};

const store = new Store<StoreSchema>({
  name: 'cosmos-viewer',
  encryptionKey: 'cosmos-viewer-secure-storage-key',
  schema: {
    connections: {
      type: 'array',
      default: [],
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          providerType: { type: 'string', default: 'cosmos-sql' },
          endpoint: { type: 'string' },
          key: { type: 'string' },
          defaultDatabase: { type: 'string' },
          settings: { type: 'object' },
          createdAt: { type: 'string' },
          lastUsedAt: { type: 'string' },
        },
        required: ['id', 'name', 'createdAt'],
      },
    },
    layoutPreferences: {
      type: 'object',
      default: DEFAULT_LAYOUT,
      properties: {
        sidebarWidth: { type: 'number' },
        queryPanelSize: { type: 'number' },
        sidebarCollapsed: { type: 'boolean' },
        queryPanelCollapsed: { type: 'boolean' },
      },
    },
    tabsPreferences: {
      type: 'object',
      default: DEFAULT_TABS,
      properties: {
        tabs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              containerId: { type: 'string' },
              containerName: { type: 'string' },
              databaseId: { type: 'string' },
              partitionKeyPath: { type: 'string' },
              query: { type: 'string' },
            },
            required: ['id', 'containerId', 'containerName', 'databaseId', 'query'],
          },
        },
        activeTabId: { type: ['string', 'null'] },
      },
    },
    tablePreferences: {
      type: 'object',
      default: DEFAULT_TABLE_PREFERENCES,
      additionalProperties: true,
    },
    appSettings: {
      type: 'object',
      default: DEFAULT_APP_SETTINGS,
      properties: {
        allowPrerelease: { type: 'boolean' },
        autoCheckUpdates: { type: 'boolean' },
        fontSize: { type: 'number' },
        editorFontSize: { type: 'number' },
      },
    },
  },
});

export function getConnections(): DatabaseConnectionData[] {
  return store.get('connections', []);
}

export function saveConnections(connections: DatabaseConnectionData[]): void {
  store.set('connections', connections);
}

export function getConnectionById(id: string): DatabaseConnectionData | undefined {
  return getConnections().find((c) => c.id === id);
}

export function clearAllData(): void {
  store.clear();
}

export function getLayoutPreferences(): LayoutPreferences {
  return store.get('layoutPreferences', DEFAULT_LAYOUT);
}

export function saveLayoutPreferences(prefs: LayoutPreferences): void {
  store.set('layoutPreferences', prefs);
}

export function getTabsPreferences(): TabsPreferences {
  return store.get('tabsPreferences', DEFAULT_TABS);
}

export function saveTabsPreferences(prefs: TabsPreferences): void {
  store.set('tabsPreferences', prefs);
}

export function getTablePreferences(): TablePreferencesData {
  return store.get('tablePreferences', DEFAULT_TABLE_PREFERENCES);
}

export function saveTablePreferences(prefs: TablePreferencesData): void {
  store.set('tablePreferences', prefs);
}

export function getAppSettings(): AppSettingsData {
  return store.get('appSettings', DEFAULT_APP_SETTINGS);
}

export function saveAppSettings(settings: AppSettingsData): void {
  store.set('appSettings', settings);
}
