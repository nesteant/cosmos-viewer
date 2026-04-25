import { ipcMain } from 'electron';
import { providerManager, initializeProviders, ProviderType } from '../providers';
import {
  getConnections,
  saveConnections,
  getConnectionById,
  getLayoutPreferences,
  saveLayoutPreferences,
  getTabsPreferences,
  saveTabsPreferences,
  getTablePreferences,
  saveTablePreferences,
  getAppSettings,
  saveAppSettings,
} from './storage.service';

/**
 * Get document ID (supports both CosmosSQL 'id' and MongoDB '_id' with EJSON)
 */
function getDocumentId(doc: any): string {
  // CosmosSQL uses 'id'
  if (doc.id !== undefined) return doc.id;

  // MongoDB uses '_id' which can be a complex EJSON object
  const id = doc._id;
  if (id === null || id === undefined) return '';

  // Handle string/number directly
  if (typeof id === 'string') return id;
  if (typeof id === 'number') return String(id);

  // Handle Extended JSON object formats
  if (typeof id === 'object') {
    // ObjectId: { "$oid": "..." }
    if (id.$oid) return id.$oid;

    // UUID: { "$uuid": "..." }
    if (id.$uuid) return id.$uuid;

    // Binary (UUID subtype): { "$binary": { "base64": "...", "subType": "04" } }
    if (id.$binary) {
      const subType = id.$binary.subType;
      if (subType === '03' || subType === '04' || subType === 3 || subType === 4) {
        return binaryToUuid(id.$binary.base64);
      }
      return id.$binary.base64 || JSON.stringify(id);
    }

    // NumberLong: { "$numberLong": "..." }
    if (id.$numberLong) return id.$numberLong;

    // Fallback: stringify
    return JSON.stringify(id);
  }

  return String(id);
}

/**
 * Convert base64 binary to UUID string
 */
function binaryToUuid(base64: string): string {
  try {
    const binaryStr = Buffer.from(base64, 'base64').toString('binary');
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    if (bytes.length !== 16) {
      return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    }

    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  } catch {
    return base64;
  }
}

/**
 * Register all IPC handlers for main process communication
 */
export function registerIpcHandlers(): void {
  // Initialize providers
  initializeProviders();

  // Storage handlers
  ipcMain.handle('storage:get-connections', async () => {
    try {
      return getConnections();
    } catch (error: unknown) {
      console.error('Failed to get connections:', error);
      throw error;
    }
  });

  ipcMain.handle('storage:save-connections', async (_, connections) => {
    try {
      saveConnections(connections);
    } catch (error: unknown) {
      console.error('Failed to save connections:', error);
      throw error;
    }
  });

  // Provider management handlers
  ipcMain.handle('providers:list', async () => {
    try {
      return providerManager.listProviders();
    } catch (error: unknown) {
      console.error('Failed to list providers:', error);
      throw error;
    }
  });

  ipcMain.handle('providers:get-capabilities', async (_, providerType: ProviderType) => {
    try {
      return providerManager.getCapabilities(providerType);
    } catch (error: unknown) {
      console.error('Failed to get provider capabilities:', error);
      throw error;
    }
  });

  ipcMain.handle('providers:get-query-language', async (_, providerType: ProviderType) => {
    try {
      const provider = providerManager.get(providerType);
      return provider.getQueryLanguage();
    } catch (error: unknown) {
      console.error('Failed to get query language config:', error);
      throw error;
    }
  });

  // Database handlers - route through provider manager
  ipcMain.handle('db:test-connection', async (_, { providerType, config }) => {
    try {
      const provider = providerManager.get(providerType || 'cosmos-sql');
      return await provider.testConnection({
        type: providerType || 'cosmos-sql',
        settings: config,
      });
    } catch (error: unknown) {
      console.error('Failed to test connection:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, message };
    }
  });

  ipcMain.handle('db:list-databases', async (_, connectionId) => {
    try {
      const provider = providerManager.getForConnection(connectionId);
      return await provider.listDatabases(connectionId);
    } catch (error: unknown) {
      console.error('Failed to list databases:', error);
      throw error;
    }
  });

  ipcMain.handle('db:list-containers', async (_, connectionId, databaseId) => {
    try {
      const provider = providerManager.getForConnection(connectionId);
      return await provider.listCollections(connectionId, databaseId);
    } catch (error: unknown) {
      console.error('Failed to list containers:', error);
      throw error;
    }
  });

  ipcMain.handle('db:execute-query', async (_, params) => {
    try {
      const provider = providerManager.getForConnection(params.connectionId);
      return await provider.executeQuery({
        ...params,
        collectionId: params.containerId, // Map containerId to collectionId
      });
    } catch (error: unknown) {
      console.error('Failed to execute query:', error);
      throw error;
    }
  });

  ipcMain.handle('db:analyze-query', async (_, params) => {
    try {
      const provider = providerManager.getForConnection(params.connectionId);
      if (!provider.analyzeQuery) {
        throw new Error('Query analysis not supported by this provider');
      }
      return await provider.analyzeQuery({
        ...params,
        collectionId: params.containerId,
      });
    } catch (error: unknown) {
      console.error('Failed to analyze query:', error);
      throw error;
    }
  });

  ipcMain.handle('db:create-document', async (_, params) => {
    try {
      const provider = providerManager.getForConnection(params.connectionId);
      return await provider.createDocument({
        connectionId: params.connectionId,
        databaseId: params.databaseId,
        collectionId: params.containerId,
        document: params.document,
      });
    } catch (error: unknown) {
      console.error('Failed to create document:', error);
      throw error;
    }
  });

  ipcMain.handle('db:upsert-document', async (_, params) => {
    try {
      const provider = providerManager.getForConnection(params.connectionId);
      return await provider.upsertDocument({
        connectionId: params.connectionId,
        databaseId: params.databaseId,
        collectionId: params.containerId,
        document: params.document,
      });
    } catch (error: unknown) {
      console.error('Failed to upsert document:', error);
      throw error;
    }
  });

  ipcMain.handle('db:update-document', async (_, params) => {
    try {
      const provider = providerManager.getForConnection(params.connectionId);
      // Support both CosmosSQL 'id' and MongoDB '_id'
      const documentId = getDocumentId(params.document);
      return await provider.updateDocument({
        connectionId: params.connectionId,
        databaseId: params.databaseId,
        collectionId: params.containerId,
        documentId,
        document: params.document,
        options: { partitionKey: params.partitionKey },
      });
    } catch (error: unknown) {
      console.error('Failed to update document:', error);
      throw error;
    }
  });

  ipcMain.handle('db:delete-document', async (_, params) => {
    try {
      const provider = providerManager.getForConnection(params.connectionId);
      await provider.deleteDocument({
        connectionId: params.connectionId,
        databaseId: params.databaseId,
        collectionId: params.containerId,
        documentId: params.documentId,
        options: { partitionKey: params.partitionKey },
      });
    } catch (error: unknown) {
      console.error('Failed to delete document:', error);
      throw error;
    }
  });

  // Layout preferences handlers
  ipcMain.handle('layout:get-preferences', async () => {
    try {
      return getLayoutPreferences();
    } catch (error: unknown) {
      console.error('Failed to get layout preferences:', error);
      throw error;
    }
  });

  ipcMain.handle('layout:save-preferences', async (_, prefs) => {
    try {
      saveLayoutPreferences(prefs);
    } catch (error: unknown) {
      console.error('Failed to save layout preferences:', error);
      throw error;
    }
  });

  // Tabs preferences handlers
  ipcMain.handle('tabs:get-preferences', async () => {
    try {
      return getTabsPreferences();
    } catch (error: unknown) {
      console.error('Failed to get tabs preferences:', error);
      throw error;
    }
  });

  ipcMain.handle('tabs:save-preferences', async (_, prefs) => {
    try {
      saveTabsPreferences(prefs);
    } catch (error: unknown) {
      console.error('Failed to save tabs preferences:', error);
      throw error;
    }
  });

  // Table preferences handlers
  ipcMain.handle('table:get-preferences', async () => {
    try {
      return getTablePreferences();
    } catch (error: unknown) {
      console.error('Failed to get table preferences:', error);
      throw error;
    }
  });

  ipcMain.handle('table:save-preferences', async (_, prefs) => {
    try {
      saveTablePreferences(prefs);
    } catch (error: unknown) {
      console.error('Failed to save table preferences:', error);
      throw error;
    }
  });

  // App settings handlers
  ipcMain.handle('settings:get', async () => {
    try {
      return getAppSettings();
    } catch (error: unknown) {
      console.error('Failed to get app settings:', error);
      throw error;
    }
  });

  ipcMain.handle('settings:save', async (_, settings) => {
    try {
      saveAppSettings(settings);
    } catch (error: unknown) {
      console.error('Failed to save app settings:', error);
      throw error;
    }
  });
}
