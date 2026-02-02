import { Injectable } from '@angular/core';
import {
  CosmosConnection,
  ConnectionTestResult,
  QueryParams,
  QueryResult,
  DatabaseInfo,
  ContainerInfo,
  CosmosDocument,
  LayoutPreferences,
  TabsPreferences,
  AnalyzeQueryParams,
  AnalyzeQueryResult,
  TablePreferencesStorage,
} from '../models';

@Injectable({ providedIn: 'root' })
export class ElectronService {
  private get api() {
    return window.electronAPI;
  }

  // Connection operations
  async testConnection(
    config: Omit<CosmosConnection, 'id' | 'createdAt'>
  ): Promise<ConnectionTestResult> {
    const result = await this.api.cosmos.testConnection({
      endpoint: config.endpoint,
      key: config.key,
    });
    return {
      connectionId: '',
      success: result.success,
      databaseCount: result.databaseCount,
      error: result.error,
    };
  }

  // Storage operations
  async getConnections(): Promise<CosmosConnection[]> {
    const connections = await this.api.storage.getConnections();
    return connections.map((c: any) => ({
      ...c,
      createdAt: new Date(c.createdAt),
      lastUsedAt: c.lastUsedAt ? new Date(c.lastUsedAt) : undefined,
    }));
  }

  async saveConnections(connections: CosmosConnection[]): Promise<void> {
    const serialized = connections.map((c) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
      lastUsedAt: c.lastUsedAt?.toISOString(),
    }));
    return this.api.storage.saveConnections(serialized);
  }

  // Database operations
  async listDatabases(connectionId: string): Promise<DatabaseInfo[]> {
    return this.api.cosmos.listDatabases(connectionId);
  }

  async listContainers(
    connectionId: string,
    databaseId: string
  ): Promise<ContainerInfo[]> {
    const containers = await this.api.cosmos.listContainers(
      connectionId,
      databaseId
    );
    return containers.map((c) => ({
      ...c,
      databaseId,
    }));
  }

  // Query operations
  async executeQuery(params: QueryParams): Promise<QueryResult> {
    return this.api.cosmos.executeQuery(params);
  }

  async analyzeQuery(params: AnalyzeQueryParams): Promise<AnalyzeQueryResult> {
    return this.api.cosmos.analyzeQuery(params);
  }

  // Document operations
  async createDocument(params: {
    connectionId: string;
    databaseId: string;
    containerId: string;
    document: CosmosDocument;
  }): Promise<CosmosDocument> {
    return this.api.cosmos.createDocument(params);
  }

  async updateDocument(params: {
    connectionId: string;
    databaseId: string;
    containerId: string;
    document: CosmosDocument;
    partitionKey: any;
  }): Promise<CosmosDocument> {
    return this.api.cosmos.updateDocument(params);
  }

  async deleteDocument(params: {
    connectionId: string;
    databaseId: string;
    containerId: string;
    documentId: string;
    partitionKey: any;
  }): Promise<void> {
    return this.api.cosmos.deleteDocument(params);
  }

  // Layout preferences
  async getLayoutPreferences(): Promise<LayoutPreferences> {
    return this.api.layout.getPreferences();
  }

  async saveLayoutPreferences(prefs: LayoutPreferences): Promise<void> {
    return this.api.layout.savePreferences(prefs);
  }

  // Tabs preferences
  async getTabsPreferences(): Promise<TabsPreferences> {
    const prefs = await this.api.tabs.getPreferences();
    // Filter out old tabs without connectionId (dev mode - no backward compat needed)
    const validTabs = (prefs.tabs as Array<Record<string, unknown>>).filter(
      (tab) => tab['connectionId']
    ) as unknown as TabsPreferences['tabs'];
    return { ...prefs, tabs: validTabs };
  }

  async saveTabsPreferences(prefs: TabsPreferences): Promise<void> {
    return this.api.tabs.savePreferences(prefs);
  }

  // Table preferences
  async getTablePreferences(): Promise<TablePreferencesStorage> {
    return this.api.table.getPreferences();
  }

  async saveTablePreferences(prefs: TablePreferencesStorage): Promise<void> {
    return this.api.table.savePreferences(prefs);
  }
}
