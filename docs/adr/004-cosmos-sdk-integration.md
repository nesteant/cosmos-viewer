# ADR-004: Cosmos SDK Integration Pattern

## Status
**Accepted**

## Context

The application needs to interact with Azure Cosmos DB for:
- Testing connections
- Listing databases and containers
- Executing queries with pagination
- CRUD operations on documents

The @azure/cosmos SDK is designed for Node.js. In our Electron architecture, we need to determine:
- Where to instantiate and manage SDK clients
- How to handle connection pooling
- How to expose functionality to the Angular renderer

### Options Considered

1. **SDK in Renderer Process** (use cosmos SDK directly in Angular)
2. **SDK in Main Process with IPC** (SDK in main, expose via IPC)
3. **Separate Node.js Server** (spawn a local server process)

## Decision

We will use the **SDK in Main Process with IPC** pattern. All Cosmos DB operations will be handled in Electron's main process, exposed to the renderer via IPC handlers.

## Rationale

### Why Main Process?

1. **Full Node.js Environment**: SDK works without limitations
2. **Security**: Connection keys never exposed to renderer
3. **Connection Pooling**: Main process can manage client instances
4. **Cleaner Architecture**: Clear separation of concerns

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        RENDERER PROCESS                          │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    ElectronService                          │ │
│  │                                                             │ │
│  │  testConnection(config) → Promise<TestResult>              │ │
│  │  listDatabases(connId) → Promise<Database[]>               │ │
│  │  listContainers(connId, dbId) → Promise<Container[]>       │ │
│  │  executeQuery(params) → Promise<QueryResult>               │ │
│  │  createDocument(params) → Promise<Document>                │ │
│  │  updateDocument(params) → Promise<Document>                │ │
│  │  deleteDocument(params) → Promise<void>                    │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                   │
└──────────────────────────────┼───────────────────────────────────┘
                               │ ipcRenderer.invoke()
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                         MAIN PROCESS                             │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    IPC Handlers                             │ │
│  │                                                             │ │
│  │  ipcMain.handle('cosmos:test-connection', ...)             │ │
│  │  ipcMain.handle('cosmos:list-databases', ...)              │ │
│  │  ipcMain.handle('cosmos:list-containers', ...)             │ │
│  │  ipcMain.handle('cosmos:execute-query', ...)               │ │
│  │  ipcMain.handle('cosmos:create-document', ...)             │ │
│  │  ipcMain.handle('cosmos:update-document', ...)             │ │
│  │  ipcMain.handle('cosmos:delete-document', ...)             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│                              ▼                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    CosmosService                            │ │
│  │                                                             │ │
│  │  - Manages CosmosClient instances (connection pool)        │ │
│  │  - Wraps SDK operations                                    │ │
│  │  - Handles errors consistently                             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                   │
└──────────────────────────────┼───────────────────────────────────┘
                               │ @azure/cosmos
                               ▼
                    ┌─────────────────────┐
                    │   Azure Cosmos DB   │
                    └─────────────────────┘
```

## Implementation

### CosmosService (Main Process)

```typescript
// electron/services/cosmos.service.ts
import { CosmosClient, Container, Database } from '@azure/cosmos';

interface ConnectionConfig {
  id: string;
  endpoint: string;
  key: string;
}

export class CosmosService {
  private clients = new Map<string, CosmosClient>();

  // Get or create a client for a connection
  getClient(config: ConnectionConfig): CosmosClient {
    if (!this.clients.has(config.id)) {
      const client = new CosmosClient({
        endpoint: config.endpoint,
        key: config.key,
      });
      this.clients.set(config.id, client);
    }
    return this.clients.get(config.id)!;
  }

  // Dispose a client when connection is removed
  disposeClient(connectionId: string): void {
    const client = this.clients.get(connectionId);
    if (client) {
      client.dispose();
      this.clients.delete(connectionId);
    }
  }

  // Test a connection
  async testConnection(config: ConnectionConfig): Promise<TestResult> {
    try {
      const client = new CosmosClient({
        endpoint: config.endpoint,
        key: config.key,
      });

      // Try to read database list to verify connection
      const { resources } = await client.databases.readAll().fetchAll();

      client.dispose();

      return {
        success: true,
        databaseCount: resources.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // List databases
  async listDatabases(connectionId: string): Promise<DatabaseInfo[]> {
    const config = await this.getConnectionConfig(connectionId);
    const client = this.getClient(config);

    const { resources } = await client.databases.readAll().fetchAll();

    return resources.map(db => ({
      id: db.id,
      name: db.id,
    }));
  }

  // List containers
  async listContainers(
    connectionId: string,
    databaseId: string
  ): Promise<ContainerInfo[]> {
    const config = await this.getConnectionConfig(connectionId);
    const client = this.getClient(config);
    const database = client.database(databaseId);

    const { resources } = await database.containers.readAll().fetchAll();

    return resources.map(container => ({
      id: container.id,
      name: container.id,
      partitionKeyPath: container.partitionKey?.paths?.[0] ?? '/id',
    }));
  }

  // Execute query with pagination
  async executeQuery(params: QueryParams): Promise<QueryResult> {
    const config = await this.getConnectionConfig(params.connectionId);
    const client = this.getClient(config);
    const container = client
      .database(params.databaseId)
      .container(params.containerId);

    const queryIterator = container.items.query(params.query, {
      maxItemCount: params.pageSize,
      continuationToken: params.continuationToken ?? undefined,
    });

    const response = await queryIterator.fetchNext();

    return {
      documents: response.resources,
      continuationToken: response.continuationToken ?? null,
      hasMoreResults: response.hasMoreResults,
      requestCharge: response.requestCharge,
    };
  }

  // Create document
  async createDocument(params: CreateParams): Promise<any> {
    const config = await this.getConnectionConfig(params.connectionId);
    const container = this.getClient(config)
      .database(params.databaseId)
      .container(params.containerId);

    const { resource } = await container.items.create(params.document);
    return resource;
  }

  // Update document
  async updateDocument(params: UpdateParams): Promise<any> {
    const config = await this.getConnectionConfig(params.connectionId);
    const container = this.getClient(config)
      .database(params.databaseId)
      .container(params.containerId);

    const { resource } = await container
      .item(params.document.id, params.partitionKey)
      .replace(params.document);

    return resource;
  }

  // Delete document
  async deleteDocument(params: DeleteParams): Promise<void> {
    const config = await this.getConnectionConfig(params.connectionId);
    const container = this.getClient(config)
      .database(params.databaseId)
      .container(params.containerId);

    await container.item(params.documentId, params.partitionKey).delete();
  }

  private async getConnectionConfig(connectionId: string): Promise<ConnectionConfig> {
    // Get from storage service
    const storage = getStorageService();
    const connections = storage.getConnections();
    const config = connections.find(c => c.id === connectionId);

    if (!config) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    return config;
  }
}
```

### IPC Handlers

```typescript
// electron/services/ipc-handlers.ts
import { ipcMain } from 'electron';
import { cosmosService } from './cosmos.service';

export function registerCosmosHandlers() {
  ipcMain.handle('cosmos:test-connection', async (event, config) => {
    return cosmosService.testConnection(config);
  });

  ipcMain.handle('cosmos:list-databases', async (event, connectionId) => {
    return cosmosService.listDatabases(connectionId);
  });

  ipcMain.handle('cosmos:list-containers', async (event, connectionId, databaseId) => {
    return cosmosService.listContainers(connectionId, databaseId);
  });

  ipcMain.handle('cosmos:execute-query', async (event, params) => {
    return cosmosService.executeQuery(params);
  });

  ipcMain.handle('cosmos:create-document', async (event, params) => {
    return cosmosService.createDocument(params);
  });

  ipcMain.handle('cosmos:update-document', async (event, params) => {
    return cosmosService.updateDocument(params);
  });

  ipcMain.handle('cosmos:delete-document', async (event, params) => {
    return cosmosService.deleteDocument(params);
  });
}
```

### Preload Script

```typescript
// electron/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  cosmos: {
    testConnection: (config: ConnectionConfig) =>
      ipcRenderer.invoke('cosmos:test-connection', config),

    listDatabases: (connectionId: string) =>
      ipcRenderer.invoke('cosmos:list-databases', connectionId),

    listContainers: (connectionId: string, databaseId: string) =>
      ipcRenderer.invoke('cosmos:list-containers', connectionId, databaseId),

    executeQuery: (params: QueryParams) =>
      ipcRenderer.invoke('cosmos:execute-query', params),

    createDocument: (params: CreateParams) =>
      ipcRenderer.invoke('cosmos:create-document', params),

    updateDocument: (params: UpdateParams) =>
      ipcRenderer.invoke('cosmos:update-document', params),

    deleteDocument: (params: DeleteParams) =>
      ipcRenderer.invoke('cosmos:delete-document', params),
  },
});
```

### Angular Service

```typescript
// src/app/core/services/electron.service.ts
@Injectable({ providedIn: 'root' })
export class ElectronService {
  private api = (window as any).electronAPI;

  testConnection(config: ConnectionConfig): Promise<TestResult> {
    return this.api.cosmos.testConnection(config);
  }

  listDatabases(connectionId: string): Promise<DatabaseInfo[]> {
    return this.api.cosmos.listDatabases(connectionId);
  }

  listContainers(connectionId: string, databaseId: string): Promise<ContainerInfo[]> {
    return this.api.cosmos.listContainers(connectionId, databaseId);
  }

  executeQuery(params: QueryParams): Promise<QueryResult> {
    return this.api.cosmos.executeQuery(params);
  }

  createDocument(params: CreateParams): Promise<any> {
    return this.api.cosmos.createDocument(params);
  }

  updateDocument(params: UpdateParams): Promise<any> {
    return this.api.cosmos.updateDocument(params);
  }

  deleteDocument(params: DeleteParams): Promise<void> {
    return this.api.cosmos.deleteDocument(params);
  }
}
```

## Pagination Note

The Cosmos SDK has a known behavior where `continuationToken` may not be returned for some `ORDER BY` queries. We handle this by checking `hasMoreResults`:

```typescript
// In query execution
const response = await queryIterator.fetchNext();

return {
  documents: response.resources,
  continuationToken: response.continuationToken ?? null,
  hasMoreResults: response.hasMoreResults,  // More reliable than checking token
  requestCharge: response.requestCharge,
};
```

## Consequences

### Positive
- Clean separation between UI and data layer
- Secure - keys never in renderer
- Connection pooling in main process
- Consistent error handling

### Negative
- IPC overhead for every operation
- Need to serialize/deserialize data across processes
- More complex debugging (two processes)

### Neutral
- All Cosmos types need to be defined in both processes
- Need to handle IPC errors gracefully

## References

- [@azure/cosmos SDK](https://docs.microsoft.com/en-us/javascript/api/@azure/cosmos/)
- [Electron IPC](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [Cosmos DB Query Pagination](https://docs.microsoft.com/en-us/azure/cosmos-db/nosql/query/pagination)
