import { ipcMain } from 'electron';
import { cosmosService } from './cosmos.service';
import {
  getConnections,
  saveConnections,
  getLayoutPreferences,
  saveLayoutPreferences,
} from './storage.service';

/**
 * Register all IPC handlers for main process communication
 */
export function registerIpcHandlers(): void {
  // Storage handlers
  ipcMain.handle('storage:get-connections', async () => {
    try {
      return getConnections();
    } catch (error: any) {
      console.error('Failed to get connections:', error);
      throw error;
    }
  });

  ipcMain.handle('storage:save-connections', async (_, connections) => {
    try {
      saveConnections(connections);
    } catch (error: any) {
      console.error('Failed to save connections:', error);
      throw error;
    }
  });

  // Cosmos DB handlers
  ipcMain.handle('cosmos:test-connection', async (_, config) => {
    try {
      return await cosmosService.testConnection(config);
    } catch (error: any) {
      console.error('Failed to test connection:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('cosmos:list-databases', async (_, connectionId) => {
    try {
      return await cosmosService.listDatabases(connectionId);
    } catch (error: any) {
      console.error('Failed to list databases:', error);
      throw error;
    }
  });

  ipcMain.handle(
    'cosmos:list-containers',
    async (_, connectionId, databaseId) => {
      try {
        return await cosmosService.listContainers(connectionId, databaseId);
      } catch (error: any) {
        console.error('Failed to list containers:', error);
        throw error;
      }
    }
  );

  ipcMain.handle('cosmos:execute-query', async (_, params) => {
    try {
      return await cosmosService.executeQuery(params);
    } catch (error: any) {
      console.error('Failed to execute query:', error);
      throw error;
    }
  });

  ipcMain.handle('cosmos:create-document', async (_, params) => {
    try {
      return await cosmosService.createDocument(params);
    } catch (error: any) {
      console.error('Failed to create document:', error);
      throw error;
    }
  });

  ipcMain.handle('cosmos:update-document', async (_, params) => {
    try {
      return await cosmosService.updateDocument(params);
    } catch (error: any) {
      console.error('Failed to update document:', error);
      throw error;
    }
  });

  ipcMain.handle('cosmos:delete-document', async (_, params) => {
    try {
      return await cosmosService.deleteDocument(params);
    } catch (error: any) {
      console.error('Failed to delete document:', error);
      throw error;
    }
  });

  // Layout preferences handlers
  ipcMain.handle('layout:get-preferences', async () => {
    try {
      return getLayoutPreferences();
    } catch (error: any) {
      console.error('Failed to get layout preferences:', error);
      throw error;
    }
  });

  ipcMain.handle('layout:save-preferences', async (_, prefs) => {
    try {
      saveLayoutPreferences(prefs);
    } catch (error: any) {
      console.error('Failed to save layout preferences:', error);
      throw error;
    }
  });
}
