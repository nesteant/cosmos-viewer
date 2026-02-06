import { contextBridge, ipcRenderer } from 'electron';

// Provider types
type ProviderType = 'cosmos-sql' | 'cosmos-mongo' | 'mongodb' | 'jdbc';

// Types for the exposed API
export interface ElectronAPI {
  providers: {
    list: () => Promise<Array<{
      type: ProviderType;
      displayName: string;
      description: string;
      icon: string;
      color: string;
      enabled: boolean;
    }>>;
    getCapabilities: (providerType: ProviderType) => Promise<{
      supportsQueryAnalysis: boolean;
      supportsPagination: boolean;
      supportsPartitionKey: boolean;
      supportsTransactions: boolean;
      queryLanguage: 'sql' | 'mongodb' | 'custom';
    }>;
    getQueryLanguage: (providerType: ProviderType) => Promise<{
      languageId: string;
      fileExtension: string;
      keywords: string[];
      functions: string[];
      snippets: Array<{ label: string; insertText: string; description: string }>;
    }>;
  };
  db: {
    testConnection: (params: {
      providerType: ProviderType;
      config: Record<string, unknown>;
    }) => Promise<{ success: boolean; message?: string; metadata?: Record<string, unknown> }>;
    listDatabases: (connectionId: string) => Promise<Array<{
      id: string;
      name: string;
      metadata?: Record<string, unknown>;
    }>>;
    listContainers: (connectionId: string, databaseId: string) => Promise<Array<{
      id: string;
      name: string;
      databaseId: string;
      metadata?: Record<string, unknown>;
    }>>;
    executeQuery: (params: {
      connectionId: string;
      databaseId: string;
      containerId: string;
      query: string;
      pageSize?: number;
      continuationToken?: string | null;
    }) => Promise<{
      documents: unknown[];
      continuationToken?: string | null;
      hasMoreResults: boolean;
      metadata?: Record<string, unknown>;
    }>;
    analyzeQuery: (params: {
      connectionId: string;
      databaseId: string;
      containerId: string;
      query: string;
    }) => Promise<{
      indexMetrics?: string;
      executionTimeMs?: number;
      metadata?: Record<string, unknown>;
    }>;
    createDocument: (params: {
      connectionId: string;
      databaseId: string;
      containerId: string;
      document: unknown;
    }) => Promise<{ document: unknown; metadata?: Record<string, unknown> }>;
    updateDocument: (params: {
      connectionId: string;
      databaseId: string;
      containerId: string;
      document: unknown;
      partitionKey?: unknown;
    }) => Promise<{ document: unknown; metadata?: Record<string, unknown> }>;
    deleteDocument: (params: {
      connectionId: string;
      databaseId: string;
      containerId: string;
      documentId: string;
      partitionKey?: unknown;
    }) => Promise<void>;
  };
  storage: {
    getConnections: () => Promise<Array<{
      id: string;
      name: string;
      providerType: ProviderType;
      endpoint: string;
      key: string;
      defaultDatabase?: string;
      createdAt: string;
      lastUsedAt?: string;
    }>>;
    saveConnections: (connections: Array<{
      id: string;
      name: string;
      providerType: ProviderType;
      endpoint: string;
      key: string;
      defaultDatabase?: string;
      createdAt: string;
      lastUsedAt?: string;
    }>) => Promise<void>;
  };
  layout: {
    getPreferences: () => Promise<{
      sidebarWidth: number;
      queryPanelSize: number;
      sidebarCollapsed: boolean;
      queryPanelCollapsed: boolean;
    }>;
    savePreferences: (prefs: {
      sidebarWidth: number;
      queryPanelSize: number;
      sidebarCollapsed: boolean;
      queryPanelCollapsed: boolean;
    }) => Promise<void>;
  };
  tabs: {
    getPreferences: () => Promise<{
      tabs: Array<{
        id: string;
        connectionId: string;
        containerId: string;
        containerName: string;
        databaseId: string;
        partitionKeyPath: string;
        query: string;
      }>;
      activeTabId: string | null;
    }>;
    savePreferences: (prefs: {
      tabs: Array<{
        id: string;
        connectionId: string;
        containerId: string;
        containerName: string;
        databaseId: string;
        partitionKeyPath: string;
        query: string;
      }>;
      activeTabId: string | null;
    }) => Promise<void>;
  };
  table: {
    getPreferences: () => Promise<{
      containers: Record<string, { columns: Array<{ path: string; visible: boolean; width: number; order: number; pinned: boolean }> }>;
      tabs: Record<string, {
        columns: Array<{ path: string; visible: boolean; width: number; order: number; pinned: boolean }>;
        sort: { column: string | null; direction: 'asc' | 'desc' | null };
        filter: { globalSearch: string; columnFilters: Record<string, string> };
      }>;
    }>;
    savePreferences: (prefs: {
      containers: Record<string, { columns: Array<{ path: string; visible: boolean; width: number; order: number; pinned: boolean }> }>;
      tabs: Record<string, {
        columns: Array<{ path: string; visible: boolean; width: number; order: number; pinned: boolean }>;
        sort: { column: string | null; direction: 'asc' | 'desc' | null };
        filter: { globalSearch: string; columnFilters: Record<string, string> };
      }>;
    }) => Promise<void>;
  };
  updater: {
    checkForUpdates: () => Promise<void>;
    downloadUpdate: () => Promise<void>;
    installUpdate: () => Promise<void>;
    onUpdateAvailable: (callback: (info: { version: string }) => void) => void;
    onUpdateNotAvailable: (callback: () => void) => void;
    onDownloadProgress: (callback: (progress: { percent: number }) => void) => void;
    onUpdateDownloaded: (callback: () => void) => void;
    onError: (callback: (error: string) => void) => void;
    applySettings: (settings: { allowPrerelease: boolean }) => Promise<void>;
  };
  settings: {
    get: () => Promise<{
      allowPrerelease: boolean;
      autoCheckUpdates: boolean;
      fontSize: number;
      editorFontSize: number;
    }>;
    save: (settings: {
      allowPrerelease: boolean;
      autoCheckUpdates: boolean;
      fontSize: number;
      editorFontSize: number;
    }) => Promise<void>;
    onOpen: (callback: () => void) => void;
  };
}

const electronAPI: ElectronAPI = {
  providers: {
    list: () => ipcRenderer.invoke('providers:list'),
    getCapabilities: (providerType) => ipcRenderer.invoke('providers:get-capabilities', providerType),
    getQueryLanguage: (providerType) => ipcRenderer.invoke('providers:get-query-language', providerType),
  },
  db: {
    testConnection: (params) => ipcRenderer.invoke('db:test-connection', params),
    listDatabases: (connectionId) => ipcRenderer.invoke('db:list-databases', connectionId),
    listContainers: (connectionId, databaseId) => ipcRenderer.invoke('db:list-containers', connectionId, databaseId),
    executeQuery: (params) => ipcRenderer.invoke('db:execute-query', params),
    analyzeQuery: (params) => ipcRenderer.invoke('db:analyze-query', params),
    createDocument: (params) => ipcRenderer.invoke('db:create-document', params),
    updateDocument: (params) => ipcRenderer.invoke('db:update-document', params),
    deleteDocument: (params) => ipcRenderer.invoke('db:delete-document', params),
  },
  storage: {
    getConnections: () => ipcRenderer.invoke('storage:get-connections'),
    saveConnections: (connections) => ipcRenderer.invoke('storage:save-connections', connections),
  },
  layout: {
    getPreferences: () => ipcRenderer.invoke('layout:get-preferences'),
    savePreferences: (prefs) => ipcRenderer.invoke('layout:save-preferences', prefs),
  },
  tabs: {
    getPreferences: () => ipcRenderer.invoke('tabs:get-preferences'),
    savePreferences: (prefs) => ipcRenderer.invoke('tabs:save-preferences', prefs),
  },
  table: {
    getPreferences: () => ipcRenderer.invoke('table:get-preferences'),
    savePreferences: (prefs) => ipcRenderer.invoke('table:save-preferences', prefs),
  },
  updater: {
    checkForUpdates: () => ipcRenderer.invoke('updater:check'),
    downloadUpdate: () => ipcRenderer.invoke('updater:download'),
    installUpdate: () => ipcRenderer.invoke('updater:install'),
    onUpdateAvailable: (callback) => { ipcRenderer.on('updater:update-available', (_, info) => callback(info)); },
    onUpdateNotAvailable: (callback) => { ipcRenderer.on('updater:update-not-available', () => callback()); },
    onDownloadProgress: (callback) => { ipcRenderer.on('updater:download-progress', (_, progress) => callback(progress)); },
    onUpdateDownloaded: (callback) => { ipcRenderer.on('updater:update-downloaded', () => callback()); },
    onError: (callback) => { ipcRenderer.on('updater:error', (_, error) => callback(error)); },
    applySettings: (settings) => ipcRenderer.invoke('updater:apply-settings', settings),
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    save: (settings) => ipcRenderer.invoke('settings:save', settings),
    onOpen: (callback) => { ipcRenderer.on('settings:open', () => callback()); },
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
