# Cosmos DB NoSQL Viewer - AI Implementation Guide

> This file provides context for AI assistants (Claude, Copilot, etc.) to understand and implement this project.

## Project Overview

**Cosmos Viewer** is an Electron desktop application for managing Azure Cosmos DB NoSQL databases, similar to DataGrip or DBeaver but specifically designed for document databases.

### Core Functionality
- **Connection Management**: Store and manage multiple Cosmos DB connections securely
- **Database Explorer**: Browse databases and containers in a tree view
- **Query Editor**: Execute CosmosSQL queries with Monaco Editor
- **Document CRUD**: Create, read, update, delete documents with change tracking
- **Import/Export**: JSON and CSV format support

## Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Desktop Runtime | Electron | Latest |
| Frontend Framework | Angular | 19+ |
| State Management | NgRx SignalStore | Latest |
| UI Components | Angular Material | 19+ |
| Query Editor | Monaco Editor | Latest |
| Cosmos SDK | @azure/cosmos | Latest |
| Secure Storage | electron-store | Latest |

## Architecture

### High-Level Structure
```
┌─────────────────────────────────────────────────────────────┐
│                     Electron Main Process                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │ electron-store  │  │  @azure/cosmos  │  │   IPC Main  │ │
│  │ (credentials)   │  │  (SDK client)   │  │   Handler   │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │ IPC
┌─────────────────────────────────────────────────────────────┐
│                   Electron Renderer Process                  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    Angular Application                   ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ││
│  │  │ Connections  │  │   Explorer   │  │ Query Editor │  ││
│  │  │   Feature    │  │   Feature    │  │   Feature    │  ││
│  │  └──────────────┘  └──────────────┘  └──────────────┘  ││
│  │  ┌─────────────────────────────────────────────────────┐││
│  │  │              NgRx SignalStore (State)               │││
│  │  └─────────────────────────────────────────────────────┘││
│  │  ┌─────────────────────────────────────────────────────┐││
│  │  │           Angular Material (UI Components)          │││
│  │  └─────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

1. **Electron for Desktop** - See [ADR-001](./adr/001-electron-platform.md)
   - Full Node.js access for @azure/cosmos SDK
   - Secure credential storage with electron-store
   - No CORS issues

2. **NgRx SignalStore** - See [ADR-002](./adr/002-ngrx-signalstore.md)
   - Signal-based reactive state management
   - Feature-scoped stores
   - Built-in RxJS integration with `rxMethod`

3. **Monaco Editor** - See [ADR-003](./adr/003-monaco-editor.md)
   - VS Code's editor for CosmosSQL queries
   - Syntax highlighting and autocomplete potential

4. **Dirty State Tracking** - See [ADR-005](./adr/005-dirty-state-tracking.md)
   - Cell-level change tracking
   - Visual highlighting of modified cells
   - Batch commit/discard operations

## Project Structure

```
cosmos-viewer/
├── docs/                        # Documentation (YOU ARE HERE)
│   ├── CLAUDE.md               # This file
│   ├── architecture/           # Architecture docs
│   ├── adr/                    # Architecture Decision Records
│   ├── features/               # Feature specifications
│   ├── implementation/         # Phase-by-phase guides
│   └── api/                    # API documentation
│
├── electron/                    # Electron main process
│   ├── main.ts                 # Main entry point
│   ├── preload.ts              # Preload script (context bridge)
│   └── services/               # Main process services
│       ├── cosmos.service.ts   # Cosmos SDK operations
│       └── storage.service.ts  # electron-store wrapper
│
├── src/                         # Angular application (renderer)
│   ├── app/
│   │   ├── app.component.ts
│   │   ├── app.config.ts
│   │   ├── app.routes.ts
│   │   │
│   │   ├── core/               # Singleton services, guards, models
│   │   │   ├── services/
│   │   │   │   ├── electron.service.ts    # IPC communication
│   │   │   │   └── notification.service.ts
│   │   │   ├── models/
│   │   │   └── utils/
│   │   │
│   │   ├── shared/             # Reusable components, pipes, directives
│   │   │   ├── components/
│   │   │   ├── pipes/
│   │   │   └── directives/
│   │   │
│   │   ├── features/           # Feature modules (lazy loaded)
│   │   │   ├── connections/
│   │   │   │   ├── store/
│   │   │   │   ├── services/
│   │   │   │   ├── containers/  # Smart components
│   │   │   │   └── components/  # Dumb components
│   │   │   ├── explorer/
│   │   │   └── query-editor/
│   │   │
│   │   └── layout/             # Layout components
│   │
│   └── styles/                 # Global styles, themes
│
├── angular.json
├── package.json
├── tsconfig.json
└── electron-builder.json       # Electron packaging config
```

## NgRx SignalStore Pattern

All stores follow this pattern:

```typescript
import { signalStore, withState, withComputed, withMethods } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';

interface FeatureState {
  items: Item[];
  selectedId: string | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: FeatureState = {
  items: [],
  selectedId: null,
  isLoading: false,
  error: null,
};

export const FeatureStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ items, selectedId }) => ({
    selectedItem: computed(() => items().find(i => i.id === selectedId())),
  })),
  withMethods((store) => ({
    // Sync methods
    select: (id: string) => patchState(store, { selectedId: id }),

    // Async methods with rxMethod
    loadItems: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { isLoading: true })),
        switchMap(() => inject(ApiService).getItems()),
        tapResponse({
          next: (items) => patchState(store, { items, isLoading: false }),
          error: (err) => patchState(store, { error: err.message, isLoading: false }),
        })
      )
    ),
  }))
);
```

## Electron IPC Pattern

Communication between main and renderer processes:

```typescript
// electron/preload.ts - Expose API to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  cosmos: {
    testConnection: (config: ConnectionConfig) =>
      ipcRenderer.invoke('cosmos:test-connection', config),
    listDatabases: (connectionId: string) =>
      ipcRenderer.invoke('cosmos:list-databases', connectionId),
    executeQuery: (params: QueryParams) =>
      ipcRenderer.invoke('cosmos:execute-query', params),
  },
  storage: {
    getConnections: () => ipcRenderer.invoke('storage:get-connections'),
    saveConnections: (connections: Connection[]) =>
      ipcRenderer.invoke('storage:save-connections', connections),
  },
});

// src/app/core/services/electron.service.ts - Use in Angular
@Injectable({ providedIn: 'root' })
export class ElectronService {
  private api = (window as any).electronAPI;

  testConnection(config: ConnectionConfig): Promise<TestResult> {
    return this.api.cosmos.testConnection(config);
  }
}
```

## Key Implementation Files

### Stores (State Management)
| Store | Purpose | Location |
|-------|---------|----------|
| ConnectionsStore | Manage saved connections | `features/connections/store/connections.store.ts` |
| ExplorerStore | Database/container tree state | `features/explorer/store/explorer.store.ts` |
| QueryStore | Query execution, results, pagination | `features/query-editor/store/query.store.ts` |
| DocumentsStore | Dirty state tracking, CRUD operations | `features/query-editor/store/documents.store.ts` |

### Core Services
| Service | Purpose | Location |
|---------|---------|----------|
| ElectronService | IPC bridge to main process | `core/services/electron.service.ts` |
| NotificationService | Snackbar notifications | `core/services/notification.service.ts` |

### Electron Main Services
| Service | Purpose | Location |
|---------|---------|----------|
| CosmosService | @azure/cosmos SDK wrapper | `electron/services/cosmos.service.ts` |
| StorageService | electron-store for credentials | `electron/services/storage.service.ts` |

### Key Components
| Component | Purpose |
|-----------|---------|
| ConnectionsPageComponent | Smart component for connection management |
| ExplorerPageComponent | Smart component with database tree |
| QueryPageComponent | Smart component with query editor and results |
| ResultsTableComponent | Editable table with dirty state highlighting |
| EditableCellComponent | Inline cell editing with type support |

## Implementation Order

Follow the implementation guides in order:

1. **[Phase 1: Setup](./implementation/phase-1-setup.md)** - Electron + Angular bootstrap
2. **[Phase 2: Core](./implementation/phase-2-core.md)** - Models, services, utilities
3. **[Phase 3: Connections](./implementation/phase-3-connections.md)** - Connection management
4. **[Phase 4: Explorer](./implementation/phase-4-explorer.md)** - Database navigation
5. **[Phase 5: Query](./implementation/phase-5-query.md)** - Query editor and CRUD
6. **[Phase 6: Polish](./implementation/phase-6-polish.md)** - Error handling, UX

## Common Patterns

### Smart/Dumb Components
- **Smart (Container)**: Inject stores, handle business logic, in `containers/` folder
- **Dumb (Presentational)**: Pure inputs/outputs, in `components/` folder

### Error Handling
```typescript
// In rxMethod pipelines
tapResponse({
  next: (result) => { /* success */ },
  error: (error: Error) => patchState(store, { error: error.message }),
})
```

### Loading States
```typescript
// Always set loading before async operations
tap(() => patchState(store, { isLoading: true })),
// Clear loading in both success and error
finalize(() => patchState(store, { isLoading: false })),
```

## Feature Specifications

- [Connections Feature](./features/connections.md)
- [Explorer Feature](./features/explorer.md)
- [Query Editor Feature](./features/query-editor.md)
- [CRUD Operations](./features/crud-operations.md)

## Quick Reference

### Run the app
```bash
npm run start        # Development mode
npm run build        # Production build
npm run package      # Create distributable
```

### Key Dependencies
```json
{
  "@angular/core": "^19.x",
  "@ngrx/signals": "^19.x",
  "@angular/material": "^19.x",
  "@azure/cosmos": "^4.x",
  "electron": "^33.x",
  "electron-store": "^10.x",
  "ngx-monaco-editor-v2": "^19.x"
}
```

## Notes for AI Assistants

1. **Always use standalone components** - No NgModules
2. **Prefer signals over observables** where possible
3. **Use `inject()` function** instead of constructor injection
4. **Follow the store pattern** exactly as shown above
5. **Check existing code** before adding new patterns
6. **Electron operations go in main process** - Never use @azure/cosmos directly in renderer
7. **All Cosmos operations are async** - Use IPC invoke pattern
