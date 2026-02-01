import { contextBridge, ipcRenderer } from 'electron';

// Types for the exposed API
export interface ElectronAPI {
  cosmos: {
    testConnection: (config: {
      endpoint: string;
      key: string;
    }) => Promise<{ success: boolean; databaseCount?: number; error?: string }>;
    listDatabases: (
      connectionId: string
    ) => Promise<Array<{ id: string; name: string }>>;
    listContainers: (
      connectionId: string,
      databaseId: string
    ) => Promise<
      Array<{ id: string; name: string; partitionKeyPath: string }>
    >;
    executeQuery: (params: {
      connectionId: string;
      databaseId: string;
      containerId: string;
      query: string;
      pageSize?: number;
      continuationToken?: string | null;
    }) => Promise<{
      documents: any[];
      continuationToken?: string | null;
      hasMoreResults: boolean;
      requestCharge?: number;
    }>;
    createDocument: (params: {
      connectionId: string;
      databaseId: string;
      containerId: string;
      document: any;
    }) => Promise<any>;
    updateDocument: (params: {
      connectionId: string;
      databaseId: string;
      containerId: string;
      document: any;
      partitionKey: any;
    }) => Promise<any>;
    deleteDocument: (params: {
      connectionId: string;
      databaseId: string;
      containerId: string;
      documentId: string;
      partitionKey: any;
    }) => Promise<void>;
  };
  storage: {
    getConnections: () => Promise<any[]>;
    saveConnections: (connections: any[]) => Promise<void>;
  };
}

const electronAPI: ElectronAPI = {
  cosmos: {
    testConnection: (config) =>
      ipcRenderer.invoke('cosmos:test-connection', config),
    listDatabases: (connectionId) =>
      ipcRenderer.invoke('cosmos:list-databases', connectionId),
    listContainers: (connectionId, databaseId) =>
      ipcRenderer.invoke('cosmos:list-containers', connectionId, databaseId),
    executeQuery: (params) =>
      ipcRenderer.invoke('cosmos:execute-query', params),
    createDocument: (params) =>
      ipcRenderer.invoke('cosmos:create-document', params),
    updateDocument: (params) =>
      ipcRenderer.invoke('cosmos:update-document', params),
    deleteDocument: (params) =>
      ipcRenderer.invoke('cosmos:delete-document', params),
  },
  storage: {
    getConnections: () => ipcRenderer.invoke('storage:get-connections'),
    saveConnections: (connections) =>
      ipcRenderer.invoke('storage:save-connections', connections),
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
