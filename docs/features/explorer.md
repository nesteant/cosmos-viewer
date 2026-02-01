# Feature: Database Explorer

## Overview

The Explorer feature provides a tree-view navigation of databases and containers within the active Cosmos DB connection. Users can browse the structure and select a container to query.

## User Stories

1. **As a user**, I want to see all databases in my Cosmos DB account
2. **As a user**, I want to expand a database to see its containers
3. **As a user**, I want to select a container to open the query editor
4. **As a user**, I want to refresh the database/container list
5. **As a user**, I want to see container properties (partition key)
6. **As a user**, I want to switch to a different connection

## UI Design

### Explorer Layout (Sidebar + Main Content)

```
┌────────────────────────────────────────────────────────────────────────┐
│  Cosmos Viewer                     [🔗 Production Account ▾] [Settings]│
├─────────────────────┬──────────────────────────────────────────────────┤
│                     │                                                   │
│  DATABASES      [↻] │                                                   │
│  ─────────────────  │     Select a container from the sidebar          │
│                     │     to start querying documents.                  │
│  ▼ 📁 mydb          │                                                   │
│    ├─ 📄 users      │                                                   │
│    ├─ 📄 orders     │                                                   │
│    └─ 📄 products   │                                                   │
│                     │                                                   │
│  ▶ 📁 analytics     │                                                   │
│                     │                                                   │
│  ▶ 📁 logs          │                                                   │
│                     │                                                   │
│                     │                                                   │
│                     │                                                   │
│                     │                                                   │
│                     │                                                   │
│                     │                                                   │
│                     │                                                   │
│                     │                                                   │
│                     │                                                   │
│                     │                                                   │
└─────────────────────┴──────────────────────────────────────────────────┘
```

### With Container Selected (Query Editor Visible)

```
┌────────────────────────────────────────────────────────────────────────┐
│  Cosmos Viewer                     [🔗 Production Account ▾] [Settings]│
├─────────────────────┬──────────────────────────────────────────────────┤
│                     │ mydb > users                          [Import ▾] │
│  DATABASES      [↻] ├──────────────────────────────────────────────────┤
│  ─────────────────  │ ┌──────────────────────────────────────────────┐ │
│                     │ │ SELECT * FROM c                              │ │
│  ▼ 📁 mydb          │ │ WHERE c.status = "active"                    │ │
│    ├─ 📄 users  ◀── │ │                                              │ │
│    ├─ 📄 orders     │ └──────────────────────────────────────────────┘ │
│    └─ 📄 products   │                    [Execute (F5)] [Format Query] │
│                     ├──────────────────────────────────────────────────┤
│  ▶ 📁 analytics     │ Results (147 documents)        2.3 RU  |  124ms │
│                     ├──────────────────────────────────────────────────┤
│  ▶ 📁 logs          │ │ id      │ name    │ email     │ status  │ ··· │
│                     │ ├─────────┼─────────┼───────────┼─────────┼─────│
│                     │ │ user-1  │ Alice   │ alice@... │ active  │     │
│                     │ │ user-2  │ Bob     │ bob@...   │ active  │     │
│                     │ │ user-3  │ Carol   │ carol@... │ active  │     │
│                     │ └─────────┴─────────┴───────────┴─────────┴─────┘
│                     │                               [Load More (47...)]│
│                     │──────────────────────────────────────────────────│
│                     │ ⚠ 2 modified │ [Discard] [Commit Changes]        │
└─────────────────────┴──────────────────────────────────────────────────┘
```

### Context Menu

```
┌─────────────────────┐
│ 📄 Refresh          │
│ ─────────────────── │
│ 📋 Copy Name        │
│ 📋 Copy Path        │
│ ─────────────────── │
│ ℹ️ Properties        │
└─────────────────────┘
```

## Components

### Smart Components (Containers)

#### ExplorerPageComponent
- **Location**: `features/explorer/containers/explorer-page/`
- **Responsibilities**:
  - Inject `ExplorerStore`, `ConnectionsStore`
  - Load databases on init
  - Handle container selection
  - Render sidebar with tree and main content area

```typescript
@Component({
  selector: 'app-explorer-page',
  standalone: true,
  imports: [DatabaseTreeComponent, RouterOutlet],
  templateUrl: './explorer-page.component.html',
})
export class ExplorerPageComponent implements OnInit {
  private explorerStore = inject(ExplorerStore);
  private connectionsStore = inject(ConnectionsStore);
  private router = inject(Router);

  treeNodes = this.explorerStore.treeNodes;
  expandedNodes = this.explorerStore.expandedNodes;
  selectedContainer = this.explorerStore.selectedContainer;
  isLoadingDatabases = this.explorerStore.isLoadingDatabases;

  activeConnection = this.connectionsStore.activeConnection;

  ngOnInit() {
    if (!this.activeConnection()) {
      this.router.navigate(['/connections']);
      return;
    }
    this.explorerStore.loadDatabases();
  }

  onNodeToggle(nodeId: string) {
    this.explorerStore.toggleNode(nodeId);

    // Load containers if expanding database
    const node = this.findNode(nodeId);
    if (node?.type === 'database' && !this.explorerStore.containers()[nodeId]) {
      this.explorerStore.loadContainers(nodeId);
    }
  }

  onContainerSelect(databaseId: string, containerId: string) {
    this.explorerStore.selectContainer(databaseId, containerId);
    this.router.navigate(['/explorer/query']);
  }

  onRefresh() {
    this.explorerStore.loadDatabases();
  }

  onConnectionChange() {
    this.router.navigate(['/connections']);
  }
}
```

### Presentational Components

#### DatabaseTreeComponent
- **Location**: `features/explorer/components/database-tree/`
- **Inputs**: `nodes`, `expandedNodes`, `selectedContainerId`, `loadingContainers`
- **Outputs**: `nodeToggle`, `nodeSelect`, `nodeContextMenu`

Uses Angular Material Tree (`mat-tree`) with nested data source.

```typescript
@Component({
  selector: 'app-database-tree',
  standalone: true,
  imports: [MatTreeModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <mat-tree [dataSource]="dataSource" [childrenAccessor]="childrenAccessor">
      <!-- Database node -->
      <mat-tree-node *matTreeNodeDef="let node" matTreeNodeToggle>
        <button mat-icon-button disabled></button>
        <mat-icon>description</mat-icon>
        <span
          [class.selected]="node.id === selectedContainerId()"
          (click)="selectNode(node)"
          (contextmenu)="onContextMenu($event, node)"
        >
          {{ node.name }}
        </span>
      </mat-tree-node>

      <!-- Expandable database node -->
      <mat-nested-tree-node *matTreeNodeDef="let node; when: hasChildren">
        <div class="mat-tree-node">
          <button mat-icon-button matTreeNodeToggle
                  (click)="toggleNode(node)">
            <mat-icon>
              {{ isExpanded(node) ? 'expand_more' : 'chevron_right' }}
            </mat-icon>
          </button>
          <mat-icon>folder</mat-icon>
          <span>{{ node.name }}</span>
          <mat-spinner *ngIf="isLoading(node)" diameter="16" />
        </div>
        <div [class.hidden]="!isExpanded(node)">
          <ng-container matTreeNodeOutlet></ng-container>
        </div>
      </mat-nested-tree-node>
    </mat-tree>
  `,
})
export class DatabaseTreeComponent {
  @Input({ required: true }) nodes!: Signal<TreeNode[]>;
  @Input({ required: true }) expandedNodes!: Signal<Set<string>>;
  @Input({ required: true }) selectedContainerId!: Signal<string | null>;
  @Input() loadingContainers: Signal<Record<string, boolean>> = signal({});

  @Output() nodeToggle = new EventEmitter<string>();
  @Output() nodeSelect = new EventEmitter<{ databaseId: string; containerId: string }>();
  @Output() nodeContextMenu = new EventEmitter<{ event: MouseEvent; node: TreeNode }>();

  dataSource = computed(() => this.nodes());
  childrenAccessor = (node: TreeNode) => node.children ?? [];
  hasChildren = (node: TreeNode) => node.type === 'database';

  isExpanded(node: TreeNode): boolean {
    return this.expandedNodes().has(node.id);
  }

  isLoading(node: TreeNode): boolean {
    return this.loadingContainers()[node.id] ?? false;
  }

  toggleNode(node: TreeNode) {
    this.nodeToggle.emit(node.id);
  }

  selectNode(node: TreeNode) {
    if (node.type === 'container') {
      this.nodeSelect.emit({
        databaseId: node.databaseId!,
        containerId: node.id,
      });
    }
  }

  onContextMenu(event: MouseEvent, node: TreeNode) {
    event.preventDefault();
    this.nodeContextMenu.emit({ event, node });
  }
}
```

#### ContextMenuComponent
- **Location**: `features/explorer/components/context-menu/`
- **Inputs**: `position`, `options`
- **Outputs**: `action`, `close`

## Store

### State

```typescript
interface ExplorerState {
  databases: DatabaseInfo[];
  containers: Record<string, ContainerInfo[]>;  // keyed by databaseId
  selectedDatabaseId: string | null;
  selectedContainerId: string | null;
  expandedNodes: Set<string>;
  isLoadingDatabases: boolean;
  isLoadingContainers: Record<string, boolean>;
  error: string | null;
}

interface DatabaseInfo {
  id: string;
  name: string;
}

interface ContainerInfo {
  id: string;
  name: string;
  partitionKeyPath: string;
  databaseId: string;
}

interface TreeNode {
  id: string;
  name: string;
  type: 'database' | 'container';
  partitionKeyPath?: string;
  databaseId?: string;
  children?: TreeNode[];
}
```

### Computed Signals

```typescript
// Tree structure for mat-tree
treeNodes: computed(() => {
  return databases().map(db => ({
    id: db.id,
    name: db.name,
    type: 'database' as const,
    children: (containers()[db.id] ?? []).map(container => ({
      id: container.id,
      name: container.name,
      type: 'container' as const,
      partitionKeyPath: container.partitionKeyPath,
      databaseId: db.id,
    })),
  }));
})

// Currently selected container object
selectedContainer: computed(() => {
  const dbId = selectedDatabaseId();
  const containerId = selectedContainerId();
  if (!dbId || !containerId) return null;
  return containers()[dbId]?.find(c => c.id === containerId) ?? null;
})

// Currently selected database object
selectedDatabase: computed(() => {
  const dbId = selectedDatabaseId();
  return databases().find(d => d.id === dbId) ?? null;
})
```

### Methods

| Method | Purpose |
|--------|---------|
| `loadDatabases()` | Fetch all databases from active connection |
| `loadContainers(databaseId)` | Fetch containers for a database |
| `selectDatabase(databaseId)` | Set selected database |
| `selectContainer(databaseId, containerId)` | Set selected container |
| `toggleNode(nodeId)` | Expand/collapse tree node |
| `reset()` | Clear all state (on disconnect) |

## Guard

```typescript
// core/guards/connection.guard.ts
export const connectionGuard: CanActivateFn = () => {
  const connectionsStore = inject(ConnectionsStore);
  const router = inject(Router);

  if (connectionsStore.activeConnection()) {
    return true;
  }

  return router.createUrlTree(['/connections']);
};
```

## Routing

```typescript
// features/explorer/explorer.routes.ts
export const EXPLORER_ROUTES: Routes = [
  {
    path: '',
    component: ExplorerPageComponent,
    canActivate: [connectionGuard],
    children: [
      {
        path: '',
        component: ExplorerEmptyStateComponent,
      },
      {
        path: 'query',
        loadChildren: () =>
          import('../query-editor/query-editor.routes')
            .then(m => m.QUERY_EDITOR_ROUTES),
      },
    ],
  },
];
```

## Error Handling

| Error | User Message |
|-------|--------------|
| Network error | "Unable to load databases. Check your connection." |
| 401 Unauthorized | "Session expired. Please reconnect." |
| 403 Forbidden | "Access denied. Check your permissions." |
| Empty database list | "No databases found in this account." |

## Testing Checklist

- [ ] Databases load on page init
- [ ] Expanding database loads containers
- [ ] Containers show partition key icon/info
- [ ] Selecting container navigates to query editor
- [ ] Refresh button reloads data
- [ ] Loading spinners show during fetch
- [ ] Error message displays on failure
- [ ] Context menu appears on right-click
- [ ] Connection dropdown shows current connection
- [ ] Guard redirects to connections if none active
