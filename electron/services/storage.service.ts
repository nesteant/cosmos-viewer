import Store from 'electron-store';

interface ConnectionData {
  id: string;
  name: string;
  endpoint: string;
  key: string;
  defaultDatabase?: string;
  createdAt: string;
  lastUsedAt?: string;
}

interface LayoutPreferences {
  sidebarSize: number;
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

interface StoreSchema {
  connections: ConnectionData[];
  layoutPreferences: LayoutPreferences;
  tabsPreferences: TabsPreferences;
}

const DEFAULT_LAYOUT: LayoutPreferences = {
  sidebarSize: 20,
  queryPanelSize: 25,
  sidebarCollapsed: false,
  queryPanelCollapsed: false,
};

const DEFAULT_TABS: TabsPreferences = {
  tabs: [],
  activeTabId: null,
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
          endpoint: { type: 'string' },
          key: { type: 'string' },
          defaultDatabase: { type: 'string' },
          createdAt: { type: 'string' },
          lastUsedAt: { type: 'string' },
        },
        required: ['id', 'name', 'endpoint', 'key', 'createdAt'],
      },
    },
    layoutPreferences: {
      type: 'object',
      default: DEFAULT_LAYOUT,
      properties: {
        sidebarSize: { type: 'number' },
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
  },
});

export function getConnections(): ConnectionData[] {
  return store.get('connections', []);
}

export function saveConnections(connections: ConnectionData[]): void {
  store.set('connections', connections);
}

export function getConnectionById(id: string): ConnectionData | undefined {
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
