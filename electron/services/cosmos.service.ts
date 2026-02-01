import { CosmosClient } from '@azure/cosmos';
import { getConnectionById } from './storage.service';

interface ConnectionConfig {
  endpoint: string;
  key: string;
}

interface TestResult {
  success: boolean;
  databaseCount?: number;
  error?: string;
}

interface DatabaseInfo {
  id: string;
  name: string;
}

interface ContainerInfo {
  id: string;
  name: string;
  partitionKeyPath: string;
}

interface QueryParams {
  connectionId: string;
  databaseId: string;
  containerId: string;
  query: string;
  pageSize: number;
  continuationToken: string | null;
}

interface QueryResult {
  documents: any[];
  continuationToken: string | null;
  hasMoreResults: boolean;
  requestCharge: number;
}

class CosmosService {
  private clients = new Map<string, CosmosClient>();

  /**
   * Get or create a CosmosClient for a connection
   */
  getClient(connectionId: string): CosmosClient {
    if (!this.clients.has(connectionId)) {
      const config = getConnectionById(connectionId);
      if (!config) {
        throw new Error(`Connection not found: ${connectionId}`);
      }
      const client = new CosmosClient({
        endpoint: config.endpoint,
        key: config.key,
      });
      this.clients.set(connectionId, client);
    }
    return this.clients.get(connectionId)!;
  }

  /**
   * Dispose a client when no longer needed
   */
  disposeClient(connectionId: string): void {
    const client = this.clients.get(connectionId);
    if (client) {
      client.dispose();
      this.clients.delete(connectionId);
    }
  }

  /**
   * Test a connection without saving it
   */
  async testConnection(config: ConnectionConfig): Promise<TestResult> {
    try {
      const client = new CosmosClient({
        endpoint: config.endpoint,
        key: config.key,
      });

      const { resources } = await client.databases.readAll().fetchAll();
      client.dispose();

      return {
        success: true,
        databaseCount: resources.length,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Unknown error occurred',
      };
    }
  }

  /**
   * List all databases in the account
   */
  async listDatabases(connectionId: string): Promise<DatabaseInfo[]> {
    const client = this.getClient(connectionId);
    const { resources } = await client.databases.readAll().fetchAll();

    return resources.map((db) => ({
      id: db.id,
      name: db.id,
    }));
  }

  /**
   * List all containers in a database
   */
  async listContainers(
    connectionId: string,
    databaseId: string
  ): Promise<ContainerInfo[]> {
    const client = this.getClient(connectionId);
    const database = client.database(databaseId);
    const { resources } = await database.containers.readAll().fetchAll();

    return resources.map((container) => ({
      id: container.id,
      name: container.id,
      partitionKeyPath: container.partitionKey?.paths?.[0] ?? '/id',
    }));
  }

  /**
   * Execute a query with pagination support
   */
  async executeQuery(params: QueryParams): Promise<QueryResult> {
    const client = this.getClient(params.connectionId);
    const container = client
      .database(params.databaseId)
      .container(params.containerId);

    const queryIterator = container.items.query(params.query, {
      maxItemCount: params.pageSize,
      continuationToken: params.continuationToken ?? undefined,
    });

    const response = await queryIterator.fetchNext();

    return {
      documents: response.resources || [],
      continuationToken: response.continuationToken ?? null,
      hasMoreResults: response.hasMoreResults,
      requestCharge: response.requestCharge,
    };
  }

  /**
   * Create a new document
   */
  async createDocument(params: {
    connectionId: string;
    databaseId: string;
    containerId: string;
    document: any;
  }): Promise<any> {
    const client = this.getClient(params.connectionId);
    const container = client
      .database(params.databaseId)
      .container(params.containerId);

    const { resource } = await container.items.create(params.document);
    return resource;
  }

  /**
   * Update an existing document
   */
  async updateDocument(params: {
    connectionId: string;
    databaseId: string;
    containerId: string;
    document: any;
    partitionKey: any;
  }): Promise<any> {
    const client = this.getClient(params.connectionId);
    const container = client
      .database(params.databaseId)
      .container(params.containerId);

    const { resource } = await container
      .item(params.document.id, params.partitionKey)
      .replace(params.document);

    return resource;
  }

  /**
   * Delete a document
   */
  async deleteDocument(params: {
    connectionId: string;
    databaseId: string;
    containerId: string;
    documentId: string;
    partitionKey: any;
  }): Promise<void> {
    const client = this.getClient(params.connectionId);
    const container = client
      .database(params.databaseId)
      .container(params.containerId);

    await container.item(params.documentId, params.partitionKey).delete();
  }
}

export const cosmosService = new CosmosService();
