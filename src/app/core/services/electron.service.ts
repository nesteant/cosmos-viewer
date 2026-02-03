import { Injectable } from '@angular/core';
import {
  DatabaseConnection,
  ConnectionTestResult,
  ProviderType,
  ProviderInfo,
  ProviderCapabilities,
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

  // Provider operations
  async listProviders(): Promise<ProviderInfo[]> {
    return this.api.providers.list();
  }

  async getProviderCapabilities(providerType: ProviderType): Promise<ProviderCapabilities> {
    return this.api.providers.getCapabilities(providerType);
  }

  async getQueryLanguageConfig(providerType: ProviderType) {
    return this.api.providers.getQueryLanguage(providerType);
  }

  // Connection operations
  async testConnection(
    providerType: ProviderType,
    config: { endpoint?: string; key?: string; connectionString?: string }
  ): Promise<ConnectionTestResult> {
    return this.api.db.testConnection({
      providerType,
      config,
    });
  }

  // Storage operations
  async getConnections(): Promise<DatabaseConnection[]> {
    const connections = await this.api.storage.getConnections();
    return connections.map((c) => ({
      ...c,
      createdAt: new Date(c.createdAt),
      lastUsedAt: c.lastUsedAt ? new Date(c.lastUsedAt) : undefined,
    }));
  }

  async saveConnections(connections: DatabaseConnection[]): Promise<void> {
    const serialized = connections.map((c) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
      lastUsedAt: c.lastUsedAt?.toISOString(),
    }));
    return this.api.storage.saveConnections(serialized);
  }

  // Database operations
  async listDatabases(connectionId: string): Promise<DatabaseInfo[]> {
    return this.api.db.listDatabases(connectionId);
  }

  async listContainers(
    connectionId: string,
    databaseId: string
  ): Promise<ContainerInfo[]> {
    const containers = await this.api.db.listContainers(connectionId, databaseId);
    return containers.map((c) => ({
      id: c.id,
      name: c.name,
      databaseId: c.databaseId,
      partitionKeyPath: (c.metadata?.['partitionKeyPath'] as string) ?? '/id',
    }));
  }

  // Query operations
  async executeQuery(params: QueryParams): Promise<QueryResult> {
    const result = await this.api.db.executeQuery(params);
    return {
      documents: result.documents as CosmosDocument[],
      continuationToken: result.continuationToken,
      hasMoreResults: result.hasMoreResults,
      requestCharge: result.metadata?.['requestCharge'] as number | undefined,
    };
  }

  async analyzeQuery(params: AnalyzeQueryParams): Promise<AnalyzeQueryResult> {
    const result = await this.api.db.analyzeQuery(params);
    return {
      indexMetrics: result.indexMetrics ?? '{}',
      executionTimeMs: result.executionTimeMs ?? 0,
      requestCharge: (result.metadata?.['requestCharge'] as number) ?? 0,
      retrievedDocumentCount: (result.metadata?.['retrievedDocumentCount'] as number) ?? 0,
    };
  }

  // Document operations
  async createDocument(params: {
    connectionId: string;
    databaseId: string;
    containerId: string;
    document: CosmosDocument;
  }): Promise<CosmosDocument> {
    const result = await this.api.db.createDocument(params);
    return result.document as CosmosDocument;
  }

  async updateDocument(params: {
    connectionId: string;
    databaseId: string;
    containerId: string;
    document: CosmosDocument;
    partitionKey: unknown;
  }): Promise<CosmosDocument> {
    const result = await this.api.db.updateDocument(params);
    return result.document as CosmosDocument;
  }

  async deleteDocument(params: {
    connectionId: string;
    databaseId: string;
    containerId: string;
    documentId: string;
    partitionKey: unknown;
  }): Promise<void> {
    return this.api.db.deleteDocument(params);
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
    return this.api.tabs.getPreferences();
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
