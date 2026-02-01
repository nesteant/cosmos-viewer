# Architecture Overview

## System Architecture

Cosmos Viewer is built as an Electron desktop application with a clear separation between the main process (Node.js) and renderer process (Angular).

```
┌────────────────────────────────────────────────────────────────────────┐
│                              USER                                       │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        ELECTRON APPLICATION                             │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    RENDERER PROCESS (Angular)                     │  │
│  │                                                                   │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │  │
│  │  │   Layout    │  │   Shared    │  │       Features          │  │  │
│  │  │ Components  │  │ Components  │  │  ┌────────────────────┐ │  │  │
│  │  └─────────────┘  └─────────────┘  │  │   Connections      │ │  │  │
│  │                                     │  ├────────────────────┤ │  │  │
│  │  ┌───────────────────────────────┐ │  │   Explorer         │ │  │  │
│  │  │     NgRx SignalStore          │ │  ├────────────────────┤ │  │  │
│  │  │  ┌───────┐ ┌───────┐ ┌─────┐ │ │  │   Query Editor     │ │  │  │
│  │  │  │Connec.│ │Explor.│ │Query│ │ │  └────────────────────┘ │  │  │
│  │  │  │ Store │ │ Store │ │Store│ │ │                         │  │  │
│  │  │  └───────┘ └───────┘ └─────┘ │ └─────────────────────────┘  │  │
│  │  └───────────────────────────────┘                              │  │
│  │                                                                   │  │
│  │  ┌───────────────────────────────────────────────────────────┐  │  │
│  │  │                 Electron Service (IPC Bridge)              │  │  │
│  │  └───────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                    │                                    │
│                                    │ IPC (invoke/handle)                │
│                                    ▼                                    │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                     MAIN PROCESS (Node.js)                        │  │
│  │                                                                   │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │  │
│  │  │  Cosmos Service │  │ Storage Service │  │   IPC Handlers  │  │  │
│  │  │                 │  │                 │  │                 │  │  │
│  │  │ - testConnection│  │ - getConnections│  │ - cosmos:*      │  │  │
│  │  │ - listDatabases │  │ - saveConnections│ │ - storage:*     │  │  │
│  │  │ - listContainers│  │ - getSettings   │  │                 │  │  │
│  │  │ - executeQuery  │  │                 │  │                 │  │  │
│  │  │ - createDocument│  │                 │  │                 │  │  │
│  │  │ - updateDocument│  │                 │  │                 │  │  │
│  │  │ - deleteDocument│  │                 │  │                 │  │  │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘  │  │
│  │           │                    │                                  │  │
│  └───────────┼────────────────────┼──────────────────────────────────┘  │
└──────────────┼────────────────────┼─────────────────────────────────────┘
               │                    │
               ▼                    ▼
┌──────────────────────┐  ┌──────────────────────┐
│   Azure Cosmos DB    │  │   Local File System  │
│   (Cloud Database)   │  │   (electron-store)   │
└──────────────────────┘  └──────────────────────┘
```

## Process Separation

### Main Process (Node.js)
- Full access to Node.js APIs
- Hosts the @azure/cosmos SDK client
- Manages secure credential storage with electron-store
- Handles all database operations
- Exposes functionality via IPC handlers

### Renderer Process (Angular)
- Sandboxed browser environment
- Angular application with NgRx SignalStore
- Communicates with main process via IPC
- No direct access to Node.js or Cosmos SDK

### Preload Script (Context Bridge)
- Bridges main and renderer processes
- Exposes safe API surface to renderer
- Type-safe function signatures

## Data Flow

```
User Action
    │
    ▼
┌─────────────────┐
│   Component     │  (Presentational)
│   (Dumb)        │
└────────┬────────┘
         │ @Output()
         ▼
┌─────────────────┐
│   Container     │  (Smart)
│   Component     │
└────────┬────────┘
         │ store.method()
         ▼
┌─────────────────┐
│   SignalStore   │  (State Management)
│                 │
└────────┬────────┘
         │ electronService.method()
         ▼
┌─────────────────┐
│ Electron Service│  (IPC Bridge)
│                 │
└────────┬────────┘
         │ ipcRenderer.invoke()
         ▼
┌─────────────────┐
│  Main Process   │  (Node.js)
│  IPC Handler    │
└────────┬────────┘
         │ cosmosService.method()
         ▼
┌─────────────────┐
│  Cosmos Service │  (SDK Wrapper)
│                 │
└────────┬────────┘
         │ SDK call
         ▼
┌─────────────────┐
│  Azure Cosmos   │  (Cloud)
│  DB             │
└─────────────────┘
```

## Feature Architecture

Each feature follows the same structure:

```
feature/
├── store/
│   ├── feature.store.ts      # NgRx SignalStore
│   └── feature.models.ts     # Feature-specific types
├── services/
│   └── feature.service.ts    # Feature business logic
├── containers/
│   └── feature-page/         # Smart components
│       ├── feature-page.component.ts
│       ├── feature-page.component.html
│       └── feature-page.component.scss
└── components/               # Dumb components
    ├── component-a/
    └── component-b/
```

## State Management

NgRx SignalStore is used for all application state:

```
┌─────────────────────────────────────────────────────────────────┐
│                         Application State                        │
│                                                                  │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────┐ │
│  │ ConnectionsStore│  │ ExplorerStore  │  │    QueryStore      │ │
│  │                │  │                │  │                    │ │
│  │ - connections  │  │ - databases    │  │ - query            │ │
│  │ - activeId     │  │ - containers   │  │ - results          │ │
│  │ - testResult   │  │ - selectedDb   │  │ - columns          │ │
│  │ - isLoading    │  │ - selectedCont.│  │ - continuationToken│ │
│  │ - error        │  │ - expandedNodes│  │ - isExecuting      │ │
│  └────────────────┘  └────────────────┘  └────────────────────┘ │
│                                                                  │
│                          ┌────────────────────┐                  │
│                          │  DocumentsStore    │                  │
│                          │                    │                  │
│                          │ - originalDocs     │                  │
│                          │ - modifiedDocs     │                  │
│                          │ - dirtyPaths       │                  │
│                          │ - pendingDeletions │                  │
│                          │ - newDocuments     │                  │
│                          │ - isSaving         │                  │
│                          └────────────────────┘                  │
└─────────────────────────────────────────────────────────────────┘
```

## Security Model

1. **Credentials Storage**: Connection keys stored encrypted via electron-store
2. **Process Isolation**: Renderer has no direct Node.js access
3. **Context Bridge**: Only whitelisted APIs exposed to renderer
4. **No CORS**: Desktop app avoids browser security restrictions

## Technology Choices

| Concern | Technology | Rationale |
|---------|------------|-----------|
| Desktop Runtime | Electron | Cross-platform, Node.js access for SDK |
| Frontend | Angular 19+ | Strong typing, standalone components, dependency injection |
| State | NgRx SignalStore | Signal-based reactivity, less boilerplate than classic NgRx |
| UI | Angular Material | Comprehensive, accessible, themeable |
| Query Editor | Monaco | Industry standard, extensible |
| Cosmos SDK | @azure/cosmos | Official SDK, full feature support |
| Storage | electron-store | Secure, encrypted local storage |
