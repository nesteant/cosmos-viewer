# Data Flow Patterns

## Overview

This document describes how data flows through the Cosmos Viewer application, from user interactions to database operations and back.

## Unidirectional Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                          USER ACTION                             │
│                      (click, type, etc.)                         │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PRESENTATIONAL COMPONENT                      │
│                                                                  │
│  • Emits event via @Output()                                    │
│  • No business logic                                            │
│  • Pure input/output                                            │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     CONTAINER COMPONENT                          │
│                                                                  │
│  • Catches event                                                │
│  • Calls store method                                           │
│  • Minimal logic                                                │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      NgRx SIGNALSTORE                            │
│                                                                  │
│  • Updates state via patchState()                               │
│  • Triggers async operations via rxMethod()                     │
│  • Computes derived state                                       │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ELECTRON SERVICE                            │
│                                                                  │
│  • Bridges to main process                                      │
│  • Uses ipcRenderer.invoke()                                    │
│  • Returns Promise/Observable                                   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      MAIN PROCESS                                │
│                                                                  │
│  • Handles IPC message                                          │
│  • Calls CosmosService                                          │
│  • Returns result                                               │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      COSMOS SERVICE                              │
│                                                                  │
│  • Uses @azure/cosmos SDK                                       │
│  • Executes database operation                                  │
│  • Returns data                                                 │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AZURE COSMOS DB                             │
└─────────────────────────────────────────────────────────────────┘
```

## Concrete Example: Execute Query

### 1. User Clicks "Execute" Button

```html
<!-- query-input.component.html (Presentational) -->
<button mat-raised-button (click)="execute.emit()">
  Execute
</button>
```

### 2. Container Catches Event

```typescript
// query-page.component.ts (Container)
export class QueryPageComponent {
  private queryStore = inject(QueryStore);

  onExecute() {
    this.queryStore.executeQuery({ pageSize: 100 });
  }
}
```

### 3. Store Handles Action

```typescript
// query.store.ts
export const QueryStore = signalStore(
  withMethods((store) => ({
    executeQuery: rxMethod<{ pageSize: number }>(
      pipe(
        tap(() => patchState(store, { isExecuting: true, error: null })),
        switchMap(({ pageSize }) => {
          const electronService = inject(ElectronService);
          return from(electronService.executeQuery({
            connectionId: store.activeConnectionId(),
            databaseId: store.selectedDatabaseId(),
            containerId: store.selectedContainerId(),
            query: store.query(),
            pageSize,
            continuationToken: null,
          }));
        }),
        tapResponse({
          next: (result) => patchState(store, {
            results: result.documents,
            continuationToken: result.continuationToken,
            hasMoreResults: result.hasMoreResults,
            isExecuting: false,
          }),
          error: (err) => patchState(store, {
            error: err.message,
            isExecuting: false,
          }),
        })
      )
    ),
  }))
);
```

### 4. Electron Service Makes IPC Call

```typescript
// electron.service.ts
@Injectable({ providedIn: 'root' })
export class ElectronService {
  private api = (window as any).electronAPI;

  executeQuery(params: QueryParams): Promise<QueryResult> {
    return this.api.cosmos.executeQuery(params);
  }
}
```

### 5. Preload Script Exposes API

```typescript
// electron/preload.ts
contextBridge.exposeInMainWorld('electronAPI', {
  cosmos: {
    executeQuery: (params: QueryParams) =>
      ipcRenderer.invoke('cosmos:execute-query', params),
  },
});
```

### 6. Main Process Handles Request

```typescript
// electron/services/ipc-handlers.ts
ipcMain.handle('cosmos:execute-query', async (event, params: QueryParams) => {
  const cosmosService = getCosmosService();
  return cosmosService.executeQuery(params);
});
```

### 7. Cosmos Service Executes Query

```typescript
// electron/services/cosmos.service.ts
export class CosmosService {
  async executeQuery(params: QueryParams): Promise<QueryResult> {
    const client = this.getClient(params.connectionId);
    const container = client
      .database(params.databaseId)
      .container(params.containerId);

    const iterator = container.items.query(params.query, {
      maxItemCount: params.pageSize,
      continuationToken: params.continuationToken ?? undefined,
    });

    const response = await iterator.fetchNext();

    return {
      documents: response.resources,
      continuationToken: response.continuationToken ?? null,
      hasMoreResults: response.hasMoreResults,
      requestCharge: response.requestCharge,
    };
  }
}
```

### 8. Data Flows Back

The result propagates back up through each layer, ultimately updating the SignalStore state, which triggers Angular's change detection and updates the UI.

## State Update Pattern

### Synchronous Updates

```typescript
// Direct state mutation
selectItem: (id: string) => {
  patchState(store, { selectedId: id });
}
```

### Asynchronous Updates with rxMethod

```typescript
// Async operations with loading/error states
loadItems: rxMethod<void>(
  pipe(
    // 1. Set loading state
    tap(() => patchState(store, { isLoading: true, error: null })),

    // 2. Make async call
    switchMap(() => from(electronService.getItems())),

    // 3. Handle response
    tapResponse({
      next: (items) => patchState(store, {
        items,
        isLoading: false,
      }),
      error: (err: Error) => patchState(store, {
        error: err.message,
        isLoading: false,
      }),
    })
  )
)
```

## Document Editing Data Flow

### Cell Edit Flow

```
User edits cell
       │
       ▼
EditableCellComponent emits valueChange
       │
       ▼
ResultsTableComponent emits cellEdit
       │
       ▼
QueryPageComponent calls documentsStore.updateCell()
       │
       ▼
DocumentsStore:
  1. Clones original document if not already modified
  2. Updates value at JSON path
  3. Adds path to dirtyPaths set
  4. Updates modifiedDocuments map
       │
       ▼
UI updates:
  - Cell shows as "dirty" (highlighted)
  - Changes toolbar shows pending change count
```

### Commit Flow

```
User clicks "Commit Changes"
       │
       ▼
ChangesToolbarComponent emits commit
       │
       ▼
QueryPageComponent calls documentsStore.commitChanges()
       │
       ▼
DocumentsStore.commitChanges():
       │
       ├─► For each modified document:
       │     electronService.updateDocument()
       │
       ├─► For each pending deletion:
       │     electronService.deleteDocument()
       │
       └─► For each new document:
             electronService.createDocument()
       │
       ▼
On success:
  - Clear modifiedDocuments
  - Clear dirtyPaths
  - Clear pendingDeletions
  - Clear newDocuments
  - Re-execute query to refresh
```

## Pagination Data Flow

```
User clicks "Load More"
       │
       ▼
PaginationControlsComponent emits loadMore
       │
       ▼
QueryPageComponent calls queryStore.loadMoreResults()
       │
       ▼
QueryStore.loadMoreResults():
  1. Check hasMoreResults && !isExecuting
  2. Call executeQuery with continuationToken
  3. Append results to existing results
  4. Merge new columns with existing columns
  5. Update continuationToken for next page
```

## Cross-Store Communication

Stores can depend on each other:

```typescript
// QueryStore depends on ExplorerStore and ConnectionsStore
export const QueryStore = signalStore(
  withMethods((store) => {
    const explorerStore = inject(ExplorerStore);
    const connectionsStore = inject(ConnectionsStore);

    return {
      executeQuery: rxMethod<void>(
        pipe(
          switchMap(() => {
            // Read from other stores
            const connection = connectionsStore.activeConnection();
            const database = explorerStore.selectedDatabase();
            const container = explorerStore.selectedContainer();

            if (!connection || !database || !container) {
              throw new Error('No database/container selected');
            }

            // Use values from other stores
            return from(electronService.executeQuery({
              connectionId: connection.id,
              databaseId: database.id,
              containerId: container.id,
              query: store.query(),
            }));
          }),
        )
      ),
    };
  })
);
```

## Error Handling Pattern

```typescript
// In stores
tapResponse({
  next: (result) => { /* success */ },
  error: (error: Error) => {
    // Update store error state
    patchState(store, { error: error.message, isLoading: false });

    // Optionally notify user
    inject(NotificationService).error(error.message);
  },
})

// In components - display error from store
@if (store.error(); as error) {
  <app-error-display [message]="error" (dismiss)="store.clearError()" />
}
```
