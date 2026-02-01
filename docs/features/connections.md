# Feature: Connection Management

## Overview

The Connections feature allows users to configure, store, and manage connections to Azure Cosmos DB accounts. This is the entry point of the application.

## User Stories

1. **As a user**, I want to add a new Cosmos DB connection so I can access my databases
2. **As a user**, I want to test a connection before saving it to verify it works
3. **As a user**, I want to see a list of saved connections so I can quickly connect
4. **As a user**, I want to edit an existing connection to update credentials
5. **As a user**, I want to delete connections I no longer need
6. **As a user**, I want to select a connection to start browsing databases

## UI Design

### Connections Page Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  Cosmos Viewer                                              [Settings]│
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│   ┌─────────────────────────────────────────────────────────────────┐│
│   │                     Your Connections                      [+ Add]││
│   ├─────────────────────────────────────────────────────────────────┤│
│   │                                                                  ││
│   │  ┌──────────────────────────┐  ┌──────────────────────────┐    ││
│   │  │ 🔵 Production Account    │  │ 🔵 Development Account   │    ││
│   │  │                          │  │                          │    ││
│   │  │ cosmos-prod.documents... │  │ cosmos-dev.documents...  │    ││
│   │  │ Last used: 2 hours ago   │  │ Last used: Yesterday     │    ││
│   │  │                          │  │                          │    ││
│   │  │ [Connect] [Test] [···]   │  │ [Connect] [Test] [···]   │    ││
│   │  └──────────────────────────┘  └──────────────────────────┘    ││
│   │                                                                  ││
│   │  ┌──────────────────────────┐                                   ││
│   │  │ ○ Staging Account        │                                   ││
│   │  │                          │                                   ││
│   │  │ cosmos-stg.documents...  │                                   ││
│   │  │ Never used               │                                   ││
│   │  │                          │                                   ││
│   │  │ [Connect] [Test] [···]   │                                   ││
│   │  └──────────────────────────┘                                   ││
│   │                                                                  ││
│   └─────────────────────────────────────────────────────────────────┘│
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### Connection Form Dialog

```
┌────────────────────────────────────────────────┐
│  Add Connection                            [X] │
├────────────────────────────────────────────────┤
│                                                │
│  Connection Name *                             │
│  ┌──────────────────────────────────────────┐ │
│  │ My Production Cosmos DB                  │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  Account Endpoint *                            │
│  ┌──────────────────────────────────────────┐ │
│  │ https://myaccount.documents.azure.com    │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  Account Key *                                 │
│  ┌──────────────────────────────────────────┐ │
│  │ ········································ │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  Default Database (optional)                   │
│  ┌──────────────────────────────────────────┐ │
│  │ mydb                                     │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│       [Test Connection]                        │
│       ✓ Connection successful (3 databases)   │
│                                                │
│                    [Cancel]  [Save Connection] │
└────────────────────────────────────────────────┘
```

## Components

### Smart Components (Containers)

#### ConnectionsPageComponent
- **Location**: `features/connections/containers/connections-page/`
- **Responsibilities**:
  - Inject `ConnectionsStore`
  - Handle routing after connection selection
  - Orchestrate dialog opening for add/edit

```typescript
@Component({
  selector: 'app-connections-page',
  standalone: true,
  imports: [ConnectionListComponent, MatDialog],
  templateUrl: './connections-page.component.html',
})
export class ConnectionsPageComponent {
  private store = inject(ConnectionsStore);
  private router = inject(Router);
  private dialog = inject(MatDialog);

  connections = this.store.sortedConnections;
  activeConnectionId = this.store.activeConnectionId;
  testingConnectionId = this.store.testingConnectionId;
  testResult = this.store.testResult;

  onAddConnection() {
    const dialogRef = this.dialog.open(ConnectionFormComponent);
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.store.addConnection(result);
      }
    });
  }

  onEditConnection(connection: CosmosConnection) {
    const dialogRef = this.dialog.open(ConnectionFormComponent, {
      data: { connection }
    });
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.store.updateConnection(connection.id, result);
      }
    });
  }

  onDeleteConnection(id: string) {
    // Show confirmation dialog first
    this.store.deleteConnection(id);
  }

  onTestConnection(id: string) {
    this.store.testConnection(id);
  }

  onConnect(id: string) {
    this.store.setActiveConnection(id);
    this.router.navigate(['/explorer']);
  }
}
```

### Presentational Components

#### ConnectionListComponent
- **Location**: `features/connections/components/connection-list/`
- **Inputs**: `connections`, `activeConnectionId`, `testingConnectionId`, `testResult`
- **Outputs**: `connect`, `edit`, `delete`, `test`, `add`

#### ConnectionCardComponent
- **Location**: `features/connections/components/connection-card/`
- **Inputs**: `connection`, `isActive`, `isTesting`, `testResult`
- **Outputs**: `connect`, `edit`, `delete`, `test`

#### ConnectionFormComponent
- **Location**: `features/connections/components/connection-form/`
- **Inputs**: `connection?` (for edit mode)
- **Outputs**: Dialog result with connection data

## Store

### State

```typescript
interface ConnectionsState {
  connections: CosmosConnection[];
  activeConnectionId: string | null;
  testingConnectionId: string | null;
  testResult: TestResult | null;
  isLoading: boolean;
  error: string | null;
}

interface CosmosConnection {
  id: string;
  name: string;
  endpoint: string;
  key: string;
  defaultDatabase?: string;
  createdAt: Date;
  lastUsedAt?: Date;
}

interface TestResult {
  connectionId: string;
  success: boolean;
  databaseCount?: number;
  error?: string;
}
```

### Computed Signals

```typescript
// Active connection object
activeConnection: computed(() =>
  connections().find(c => c.id === activeConnectionId())
)

// Connections sorted by last used
sortedConnections: computed(() =>
  [...connections()].sort((a, b) =>
    (b.lastUsedAt?.getTime() ?? 0) - (a.lastUsedAt?.getTime() ?? 0)
  )
)
```

### Methods

| Method | Purpose |
|--------|---------|
| `loadConnections()` | Load from electron-store on init |
| `addConnection(data)` | Add new connection |
| `updateConnection(id, data)` | Update existing connection |
| `deleteConnection(id)` | Remove connection |
| `setActiveConnection(id)` | Set active and update lastUsedAt |
| `testConnection(id)` | Test connection via IPC |
| `clearTestResult()` | Clear test result |

## Storage

Connections are stored using electron-store in the main process:

```typescript
// electron/services/storage.service.ts
import Store from 'electron-store';

const store = new Store({
  encryptionKey: 'your-encryption-key', // For credential encryption
  schema: {
    connections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          endpoint: { type: 'string' },
          key: { type: 'string' },
          defaultDatabase: { type: 'string' },
          createdAt: { type: 'string' },
          lastUsedAt: { type: 'string' },
        },
        required: ['id', 'name', 'endpoint', 'key'],
      },
    },
  },
});

export function getConnections(): CosmosConnection[] {
  return store.get('connections', []);
}

export function saveConnections(connections: CosmosConnection[]): void {
  store.set('connections', connections);
}
```

## Validation

### Connection Form Validation

| Field | Rules |
|-------|-------|
| Name | Required, max 100 chars |
| Endpoint | Required, valid URL starting with `https://` |
| Key | Required, appears to be base64 encoded |
| Default Database | Optional, alphanumeric |

```typescript
// connection-form.component.ts
form = new FormGroup({
  name: new FormControl('', [
    Validators.required,
    Validators.maxLength(100),
  ]),
  endpoint: new FormControl('', [
    Validators.required,
    Validators.pattern(/^https:\/\/[\w-]+\.documents\.azure\.com/),
  ]),
  key: new FormControl('', [
    Validators.required,
    Validators.pattern(/^[A-Za-z0-9+/=]+$/), // Base64-ish
  ]),
  defaultDatabase: new FormControl(''),
});
```

## Error Handling

| Error | User Message |
|-------|--------------|
| Network error | "Unable to connect. Check your network connection." |
| 401 Unauthorized | "Invalid account key. Please check your credentials." |
| Invalid endpoint | "Invalid endpoint URL format." |
| Timeout | "Connection timed out. The server may be unavailable." |

## Routing

```typescript
// features/connections/connections.routes.ts
export const CONNECTIONS_ROUTES: Routes = [
  {
    path: '',
    component: ConnectionsPageComponent,
  },
];

// app.routes.ts
export const APP_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'connections',
    pathMatch: 'full',
  },
  {
    path: 'connections',
    loadChildren: () =>
      import('./features/connections/connections.routes')
        .then(m => m.CONNECTIONS_ROUTES),
  },
  // ...
];
```

## Testing Checklist

- [ ] Add new connection with valid credentials
- [ ] Add connection with invalid credentials (shows error)
- [ ] Edit existing connection
- [ ] Delete connection with confirmation
- [ ] Test connection shows success/failure
- [ ] Connect navigates to explorer
- [ ] Connections persist after app restart
- [ ] Last used timestamp updates on connect
