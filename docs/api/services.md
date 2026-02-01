# Services API Reference

## ElectronService

Bridge between Angular renderer process and Electron main process.

**Location:** `src/app/core/services/electron.service.ts`

### Methods

#### Connection Operations

```typescript
testConnection(config: Omit<CosmosConnection, 'id' | 'createdAt'>): Promise<ConnectionTestResult>
```
Test a Cosmos DB connection without saving it.

**Parameters:**
- `config` - Connection configuration (name, endpoint, key)

**Returns:** Test result with success status and database count or error

---

#### Storage Operations

```typescript
getConnections(): Promise<CosmosConnection[]>
```
Load all saved connections from electron-store.

**Returns:** Array of saved connections

---

```typescript
saveConnections(connections: CosmosConnection[]): Promise<void>
```
Save connections to electron-store.

**Parameters:**
- `connections` - Full array of connections to save

---

#### Database Operations

```typescript
listDatabases(connectionId: string): Promise<DatabaseInfo[]>
```
List all databases in a Cosmos DB account.

**Parameters:**
- `connectionId` - ID of the saved connection to use

**Returns:** Array of database information

---

```typescript
listContainers(connectionId: string, databaseId: string): Promise<ContainerInfo[]>
```
List all containers in a database.

**Parameters:**
- `connectionId` - ID of the saved connection
- `databaseId` - ID of the database

**Returns:** Array of container information including partition key paths

---

#### Query Operations

```typescript
executeQuery(params: QueryParams): Promise<QueryResult>
```
Execute a CosmosSQL query with pagination support.

**Parameters:**
```typescript
interface QueryParams {
  connectionId: string;
  databaseId: string;
  containerId: string;
  query: string;
  pageSize: number;
  continuationToken: string | null;
}
```

**Returns:**
```typescript
interface QueryResult {
  documents: CosmosDocument[];
  continuationToken: string | null;
  hasMoreResults: boolean;
  requestCharge: number;
}
```

---

#### Document Operations

```typescript
createDocument(params: CreateDocumentParams): Promise<CosmosDocument>
```
Create a new document in a container.

**Parameters:**
```typescript
interface CreateDocumentParams {
  connectionId: string;
  databaseId: string;
  containerId: string;
  document: CosmosDocument;
}
```

**Returns:** Created document with system properties

---

```typescript
updateDocument(params: UpdateDocumentParams): Promise<CosmosDocument>
```
Update an existing document.

**Parameters:**
```typescript
interface UpdateDocumentParams {
  connectionId: string;
  databaseId: string;
  containerId: string;
  document: CosmosDocument;
  partitionKey: any;
}
```

**Returns:** Updated document

---

```typescript
deleteDocument(params: DeleteDocumentParams): Promise<void>
```
Delete a document.

**Parameters:**
```typescript
interface DeleteDocumentParams {
  connectionId: string;
  databaseId: string;
  containerId: string;
  documentId: string;
  partitionKey: any;
}
```

---

### Usage Example

```typescript
import { inject } from '@angular/core';
import { ElectronService } from './electron.service';

@Injectable()
export class MyService {
  private electronService = inject(ElectronService);

  async loadDatabases(connectionId: string) {
    try {
      const databases = await this.electronService.listDatabases(connectionId);
      console.log('Databases:', databases);
    } catch (error) {
      console.error('Failed to load databases:', error);
    }
  }
}
```

---

## NotificationService

Display snackbar notifications to users.

**Location:** `src/app/core/services/notification.service.ts`

### Methods

```typescript
success(message: string, duration?: number): void
```
Display a success notification (green).

**Parameters:**
- `message` - Message to display
- `duration` - Duration in ms (default: 3000)

---

```typescript
error(message: string, action?: string): void
```
Display an error notification (red).

**Parameters:**
- `message` - Error message to display
- `action` - Action button text (default: 'Dismiss')

---

```typescript
info(message: string, duration?: number): void
```
Display an info notification (blue).

**Parameters:**
- `message` - Message to display
- `duration` - Duration in ms (default: 4000)

---

```typescript
warn(message: string, duration?: number): void
```
Display a warning notification (orange).

**Parameters:**
- `message` - Warning message to display
- `duration` - Duration in ms (default: 5000)

---

### Usage Example

```typescript
import { inject } from '@angular/core';
import { NotificationService } from './notification.service';

@Component({ /* ... */ })
export class MyComponent {
  private notify = inject(NotificationService);

  onSave() {
    try {
      // save logic
      this.notify.success('Changes saved successfully');
    } catch (error) {
      this.notify.error('Failed to save: ' + error.message);
    }
  }
}
```

---

## Main Process Services

These services run in Electron's main process (Node.js).

### CosmosService

**Location:** `electron/services/cosmos.service.ts`

Wrapper around the @azure/cosmos SDK.

#### Methods

```typescript
getClient(connectionId: string): CosmosClient
```
Get or create a CosmosClient for a connection.

---

```typescript
disposeClient(connectionId: string): void
```
Dispose a client when no longer needed.

---

```typescript
testConnection(config: { endpoint: string; key: string }): Promise<TestResult>
```
Test connection credentials.

---

```typescript
listDatabases(connectionId: string): Promise<DatabaseInfo[]>
```
List all databases.

---

```typescript
listContainers(connectionId: string, databaseId: string): Promise<ContainerInfo[]>
```
List containers in a database.

---

```typescript
executeQuery(params: QueryParams): Promise<QueryResult>
```
Execute a query with pagination.

---

```typescript
createDocument(params: CreateParams): Promise<Document>
```
Create a document.

---

```typescript
updateDocument(params: UpdateParams): Promise<Document>
```
Update a document.

---

```typescript
deleteDocument(params: DeleteParams): Promise<void>
```
Delete a document.

---

### StorageService

**Location:** `electron/services/storage.service.ts`

Secure storage using electron-store with encryption.

#### Methods

```typescript
getConnections(): ConnectionData[]
```
Get all saved connections.

---

```typescript
saveConnections(connections: ConnectionData[]): void
```
Save connections (encrypted at rest).

---

```typescript
getConnectionById(id: string): ConnectionData | undefined
```
Get a specific connection by ID.

---

### IPC Handlers

**Location:** `electron/services/ipc-handlers.ts`

Registers IPC handlers that bridge main and renderer processes.

#### Registered Channels

| Channel | Handler | Description |
|---------|---------|-------------|
| `storage:get-connections` | `getConnections()` | Load connections |
| `storage:save-connections` | `saveConnections(data)` | Save connections |
| `cosmos:test-connection` | `cosmosService.testConnection(config)` | Test connection |
| `cosmos:list-databases` | `cosmosService.listDatabases(id)` | List databases |
| `cosmos:list-containers` | `cosmosService.listContainers(id, dbId)` | List containers |
| `cosmos:execute-query` | `cosmosService.executeQuery(params)` | Execute query |
| `cosmos:create-document` | `cosmosService.createDocument(params)` | Create document |
| `cosmos:update-document` | `cosmosService.updateDocument(params)` | Update document |
| `cosmos:delete-document` | `cosmosService.deleteDocument(params)` | Delete document |
