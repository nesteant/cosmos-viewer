# NgRx SignalStore API Reference

## ConnectionsStore

Manages Cosmos DB connection configurations.

### State

```typescript
interface ConnectionsState {
  connections: CosmosConnection[];
  activeConnectionId: string | null;
  testingConnectionId: string | null;
  testResult: ConnectionTestResult | null;
  isLoading: boolean;
  error: string | null;
}
```

### Computed Signals

| Signal | Type | Description |
|--------|------|-------------|
| `activeConnection` | `Signal<CosmosConnection \| null>` | Currently active connection object |
| `connectionCount` | `Signal<number>` | Total number of saved connections |
| `sortedConnections` | `Signal<CosmosConnection[]>` | Connections sorted by last used date |
| `hasConnections` | `Signal<boolean>` | Whether any connections exist |

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `loadConnections` | `() => void` | Load connections from storage (called on init) |
| `addConnection` | `(data: Omit<CosmosConnection, 'id' \| 'createdAt'>) => void` | Add a new connection |
| `updateConnection` | `(id: string, updates: Partial<CosmosConnection>) => void` | Update an existing connection |
| `deleteConnection` | `(id: string) => void` | Delete a connection |
| `setActiveConnection` | `(id: string) => void` | Set active connection and update lastUsedAt |
| `disconnect` | `() => void` | Clear the active connection |
| `testConnection` | `(id: string) => void` | Test a connection (async via rxMethod) |
| `clearTestResult` | `() => void` | Clear the test result |
| `clearError` | `() => void` | Clear any error state |

### Usage Example

```typescript
import { Component, inject } from '@angular/core';
import { ConnectionsStore } from './store/connections.store';

@Component({ /* ... */ })
export class MyComponent {
  private store = inject(ConnectionsStore);

  // Access signals
  connections = this.store.sortedConnections;
  activeConnection = this.store.activeConnection;
  isLoading = this.store.isLoading;

  // Call methods
  onConnect(id: string) {
    this.store.setActiveConnection(id);
  }

  onTest(id: string) {
    this.store.testConnection(id);
  }
}
```

---

## ExplorerStore

Manages database and container navigation state.

### State

```typescript
interface ExplorerState {
  databases: DatabaseInfo[];
  containers: Record<string, ContainerInfo[]>;
  selectedDatabaseId: string | null;
  selectedContainerId: string | null;
  expandedNodes: Set<string>;
  isLoadingDatabases: boolean;
  isLoadingContainers: Record<string, boolean>;
  error: string | null;
}
```

### Computed Signals

| Signal | Type | Description |
|--------|------|-------------|
| `treeNodes` | `Signal<TreeNode[]>` | Hierarchical tree structure for mat-tree |
| `selectedContainer` | `Signal<ContainerInfo \| null>` | Currently selected container |
| `selectedDatabase` | `Signal<DatabaseInfo \| null>` | Currently selected database |
| `isNodeExpanded` | `Signal<(nodeId: string) => boolean>` | Check if a tree node is expanded |
| `selectionPath` | `Signal<string>` | Breadcrumb path string (e.g., "mydb > users") |

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `loadDatabases` | `() => void` | Load all databases from active connection |
| `loadContainers` | `(databaseId: string) => void` | Load containers for a database |
| `selectDatabase` | `(databaseId: string) => void` | Select a database |
| `selectContainer` | `(databaseId: string, containerId: string) => void` | Select a container |
| `toggleNode` | `(nodeId: string) => void` | Toggle tree node expansion |
| `expandNode` | `(nodeId: string) => void` | Expand a tree node |
| `clearSelection` | `() => void` | Clear current selection |
| `reset` | `() => void` | Reset entire explorer state |
| `clearError` | `() => void` | Clear error state |

### Usage Example

```typescript
import { Component, inject, OnInit } from '@angular/core';
import { ExplorerStore } from './store/explorer.store';

@Component({ /* ... */ })
export class ExplorerComponent implements OnInit {
  private store = inject(ExplorerStore);

  treeNodes = this.store.treeNodes;
  selectedContainer = this.store.selectedContainer;

  ngOnInit() {
    this.store.loadDatabases();
  }

  onNodeClick(node: TreeNode) {
    if (node.type === 'database') {
      this.store.toggleNode(node.id);
      if (!this.store.containers()[node.id]) {
        this.store.loadContainers(node.id);
      }
    } else {
      this.store.selectContainer(node.databaseId!, node.id);
    }
  }
}
```

---

## QueryStore

Manages query execution and results.

### State

```typescript
interface QueryState {
  query: string;
  results: CosmosDocument[];
  columns: ColumnDefinition[];
  continuationToken: string | null;
  hasMoreResults: boolean;
  requestCharge: number;
  isExecuting: boolean;
  executionTime: number | null;
  error: string | null;
  queryHistory: QueryHistoryItem[];
}
```

### Computed Signals

| Signal | Type | Description |
|--------|------|-------------|
| `flattenedResults` | `Signal<FlatDocument[]>` | Documents flattened for table display |
| `columnKeys` | `Signal<string[]>` | Array of column keys |
| `isEmpty` | `Signal<boolean>` | Whether results are empty |
| `resultCount` | `Signal<number>` | Number of results |

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `setQuery` | `(query: string) => void` | Update the query text |
| `executeQuery` | `(options: { pageSize?: number }) => void` | Execute query (resets results) |
| `loadMoreResults` | `(options: { pageSize?: number }) => void` | Load next page using continuation token |
| `clearResults` | `() => void` | Clear current results |
| `clearError` | `() => void` | Clear error state |
| `reset` | `() => void` | Reset to initial state (keeps history) |

### Usage Example

```typescript
import { Component, inject } from '@angular/core';
import { QueryStore } from './store/query.store';

@Component({ /* ... */ })
export class QueryEditorComponent {
  private store = inject(QueryStore);

  query = this.store.query;
  results = this.store.flattenedResults;
  columns = this.store.columns;
  isExecuting = this.store.isExecuting;
  hasMore = this.store.hasMoreResults;

  onExecute() {
    this.store.executeQuery({ pageSize: 100 });
  }

  onLoadMore() {
    this.store.loadMoreResults({ pageSize: 100 });
  }

  onQueryChange(query: string) {
    this.store.setQuery(query);
  }
}
```

---

## DocumentsStore

Manages document editing with dirty state tracking.

### State

```typescript
interface DocumentsState {
  originalDocuments: Record<string, CosmosDocument>;
  modifiedDocuments: Record<string, CosmosDocument>;
  dirtyPaths: Record<string, Set<string>>;
  pendingDeletions: Set<string>;
  newDocuments: CosmosDocument[];
  isSaving: boolean;
  saveProgress: { completed: number; total: number } | null;
  saveErrors: Array<{ documentId: string; error: string }>;
}
```

### Computed Signals

| Signal | Type | Description |
|--------|------|-------------|
| `hasDirtyChanges` | `Signal<boolean>` | Whether there are any unsaved changes |
| `pendingChangesCount` | `Signal<number>` | Total count of pending changes |
| `changesSummary` | `Signal<{ modified: number; deleted: number; created: number }>` | Summary of changes |
| `isCellDirty` | `Signal<(docId: string, path: string) => boolean>` | Check if a cell is dirty |
| `isDocumentDirty` | `Signal<(docId: string) => boolean>` | Check if a document has changes |
| `isPendingDelete` | `Signal<(docId: string) => boolean>` | Check if document is pending deletion |
| `newDocumentIds` | `Signal<Set<string>>` | Set of new document IDs |

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `trackDocuments` | `(documents: CosmosDocument[]) => void` | Initialize tracking for documents |
| `updateCell` | `(docId: string, path: string, value: any) => void` | Update a cell value |
| `revertCell` | `(docId: string, path: string) => void` | Revert a cell to original |
| `revertDocument` | `(docId: string) => void` | Revert all changes for a document |
| `markForDeletion` | `(docId: string) => void` | Mark document for deletion |
| `unmarkDeletion` | `(docId: string) => void` | Remove deletion mark |
| `addNewDocument` | `(doc?: Partial<CosmosDocument>) => CosmosDocument` | Add new document |
| `updateNewDocument` | `(docId: string, updates: Partial<CosmosDocument>) => void` | Update new document |
| `removeNewDocument` | `(docId: string) => void` | Remove new document |
| `commitChanges` | `() => void` | Commit all pending changes |
| `discardAllChanges` | `() => void` | Discard all pending changes |
| `reset` | `() => void` | Reset store state |

### Usage Example

```typescript
import { Component, inject, effect } from '@angular/core';
import { DocumentsStore } from './store/documents.store';
import { QueryStore } from './store/query.store';

@Component({ /* ... */ })
export class ResultsComponent {
  private documentsStore = inject(DocumentsStore);
  private queryStore = inject(QueryStore);

  isCellDirty = this.documentsStore.isCellDirty;
  isPendingDelete = this.documentsStore.isPendingDelete;
  hasDirtyChanges = this.documentsStore.hasDirtyChanges;
  changesSummary = this.documentsStore.changesSummary;

  constructor() {
    // Track documents when query results change
    effect(() => {
      const results = this.queryStore.results();
      if (results.length > 0) {
        this.documentsStore.trackDocuments(results);
      }
    });
  }

  onCellEdit(docId: string, path: string, value: any) {
    this.documentsStore.updateCell(docId, path, value);
  }

  onDelete(docId: string) {
    this.documentsStore.markForDeletion(docId);
  }

  onCommit() {
    this.documentsStore.commitChanges();
  }

  onDiscard() {
    this.documentsStore.discardAllChanges();
  }
}
```
