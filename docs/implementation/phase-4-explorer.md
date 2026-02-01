# Phase 4: Explorer Feature

## Overview

This phase implements the database explorer with tree navigation for databases and containers.

## Steps

### 4.1 Create Explorer Store

Create `src/app/features/explorer/store/explorer.store.ts`:

```typescript
import { computed, inject } from '@angular/core';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap, from, map } from 'rxjs';
import { tapResponse } from '@ngrx/operators';
import { DatabaseInfo, ContainerInfo, TreeNode } from '../../../core/models';
import { ElectronService } from '../../../core/services/electron.service';
import { ConnectionsStore } from '../../connections/store/connections.store';
import { NotificationService } from '../../../core/services/notification.service';

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

const initialState: ExplorerState = {
  databases: [],
  containers: {},
  selectedDatabaseId: null,
  selectedContainerId: null,
  expandedNodes: new Set(),
  isLoadingDatabases: false,
  isLoadingContainers: {},
  error: null,
};

export const ExplorerStore = signalStore(
  { providedIn: 'root' },

  withState(initialState),

  withComputed(({ databases, containers, selectedDatabaseId, selectedContainerId, expandedNodes }) => ({
    // Build tree structure for display
    treeNodes: computed((): TreeNode[] => {
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
    }),

    // Currently selected container
    selectedContainer: computed((): ContainerInfo | null => {
      const dbId = selectedDatabaseId();
      const containerId = selectedContainerId();
      if (!dbId || !containerId) return null;
      return containers()[dbId]?.find(c => c.id === containerId) ?? null;
    }),

    // Currently selected database
    selectedDatabase: computed((): DatabaseInfo | null => {
      const dbId = selectedDatabaseId();
      return databases().find(d => d.id === dbId) ?? null;
    }),

    // Check if a node is expanded
    isNodeExpanded: computed(() => (nodeId: string): boolean => {
      return expandedNodes().has(nodeId);
    }),

    // Get path string for breadcrumb
    selectionPath: computed((): string => {
      const db = databases().find(d => d.id === selectedDatabaseId());
      const containerId = selectedContainerId();
      const container = db && containerId
        ? containers()[db.id]?.find(c => c.id === containerId)
        : null;

      if (container && db) {
        return `${db.name} > ${container.name}`;
      } else if (db) {
        return db.name;
      }
      return '';
    }),
  })),

  withMethods((store) => {
    const electronService = inject(ElectronService);
    const connectionsStore = inject(ConnectionsStore);
    const notificationService = inject(NotificationService);

    return {
      // Load all databases
      loadDatabases: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { isLoadingDatabases: true, error: null })),
          switchMap(() => {
            const connection = connectionsStore.activeConnection();
            if (!connection) {
              throw new Error('No active connection');
            }
            return from(electronService.listDatabases(connection.id));
          }),
          tapResponse({
            next: (databases) => {
              patchState(store, { databases, isLoadingDatabases: false });
            },
            error: (error: Error) => {
              patchState(store, { error: error.message, isLoadingDatabases: false });
              notificationService.error('Failed to load databases');
            },
          })
        )
      ),

      // Load containers for a database
      loadContainers: rxMethod<string>(
        pipe(
          tap((databaseId) => {
            patchState(store, {
              isLoadingContainers: {
                ...store.isLoadingContainers(),
                [databaseId]: true,
              },
            });
          }),
          switchMap((databaseId) => {
            const connection = connectionsStore.activeConnection();
            if (!connection) {
              throw new Error('No active connection');
            }
            return from(electronService.listContainers(connection.id, databaseId)).pipe(
              map(containers => ({
                databaseId,
                containers: containers.map(c => ({ ...c, databaseId })),
              }))
            );
          }),
          tapResponse({
            next: ({ databaseId, containers }) => {
              const updatedContainers = {
                ...store.containers(),
                [databaseId]: containers,
              };
              const updatedLoading = { ...store.isLoadingContainers() };
              delete updatedLoading[databaseId];

              patchState(store, {
                containers: updatedContainers,
                isLoadingContainers: updatedLoading,
              });
            },
            error: (error: Error) => {
              patchState(store, { error: error.message });
              notificationService.error('Failed to load containers');
            },
          })
        )
      ),

      // Select a database
      selectDatabase: (databaseId: string) => {
        patchState(store, {
          selectedDatabaseId: databaseId,
          selectedContainerId: null,
        });
      },

      // Select a container
      selectContainer: (databaseId: string, containerId: string) => {
        patchState(store, {
          selectedDatabaseId: databaseId,
          selectedContainerId: containerId,
        });
      },

      // Toggle node expansion
      toggleNode: (nodeId: string) => {
        const expanded = new Set(store.expandedNodes());
        if (expanded.has(nodeId)) {
          expanded.delete(nodeId);
        } else {
          expanded.add(nodeId);
        }
        patchState(store, { expandedNodes: expanded });
      },

      // Expand a node
      expandNode: (nodeId: string) => {
        const expanded = new Set(store.expandedNodes());
        expanded.add(nodeId);
        patchState(store, { expandedNodes: expanded });
      },

      // Clear selection
      clearSelection: () => {
        patchState(store, {
          selectedDatabaseId: null,
          selectedContainerId: null,
        });
      },

      // Reset entire state
      reset: () => {
        patchState(store, initialState);
      },

      // Clear error
      clearError: () => {
        patchState(store, { error: null });
      },
    };
  })
);
```

### 4.2 Create Database Tree Component

Create `src/app/features/explorer/components/database-tree/database-tree.component.ts`:

```typescript
import { Component, Input, Output, EventEmitter, Signal, signal } from '@angular/core';
import { MatTreeModule, MatTreeNestedDataSource } from '@angular/material/tree';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { NestedTreeControl } from '@angular/cdk/tree';
import { TreeNode } from '../../../../core/models';

@Component({
  selector: 'app-database-tree',
  standalone: true,
  imports: [
    MatTreeModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="tree-container">
      <mat-tree [dataSource]="dataSource" [treeControl]="treeControl">
        <!-- Leaf node (container) -->
        <mat-tree-node *matTreeNodeDef="let node" matTreeNodeToggle>
          <div class="tree-node leaf"
               [class.selected]="selectedContainerId() === node.id"
               (click)="onContainerClick(node)"
               (contextmenu)="onContextMenu($event, node)">
            <button mat-icon-button disabled class="toggle-placeholder"></button>
            <mat-icon class="node-icon">description</mat-icon>
            <span class="node-name">{{ node.name }}</span>
            <span class="partition-key">{{ node.partitionKeyPath }}</span>
          </div>
        </mat-tree-node>

        <!-- Parent node (database) -->
        <mat-nested-tree-node *matTreeNodeDef="let node; when: hasChildren">
          <div class="tree-node parent"
               (contextmenu)="onContextMenu($event, node)">
            <button mat-icon-button
                    matTreeNodeToggle
                    (click)="onDatabaseToggle(node)">
              <mat-icon>
                {{ isExpanded(node) ? 'expand_more' : 'chevron_right' }}
              </mat-icon>
            </button>
            <mat-icon class="node-icon">folder</mat-icon>
            <span class="node-name">{{ node.name }}</span>
            @if (isLoadingContainers(node.id)) {
              <mat-spinner diameter="16" />
            }
          </div>

          <div class="nested-nodes" [class.hidden]="!isExpanded(node)">
            <ng-container matTreeNodeOutlet></ng-container>
          </div>
        </mat-nested-tree-node>
      </mat-tree>
    </div>
  `,
  styles: [`
    .tree-container {
      padding: 8px 0;
    }
    .tree-node {
      display: flex;
      align-items: center;
      padding: 4px 8px;
      cursor: pointer;
      border-radius: 4px;
    }
    .tree-node:hover {
      background-color: rgba(255, 255, 255, 0.05);
    }
    .tree-node.selected {
      background-color: rgba(63, 81, 181, 0.2);
    }
    .toggle-placeholder {
      width: 40px;
    }
    .node-icon {
      margin-right: 8px;
      color: #888;
    }
    .node-name {
      flex: 1;
    }
    .partition-key {
      color: #666;
      font-size: 12px;
      margin-left: 8px;
    }
    .nested-nodes {
      padding-left: 24px;
    }
    .nested-nodes.hidden {
      display: none;
    }
    mat-spinner {
      margin-left: 8px;
    }
  `],
})
export class DatabaseTreeComponent {
  @Input({ required: true }) nodes!: Signal<TreeNode[]>;
  @Input() selectedContainerId: Signal<string | null> = signal(null);
  @Input() expandedNodes: Signal<Set<string>> = signal(new Set());
  @Input() loadingContainers: Signal<Record<string, boolean>> = signal({});

  @Output() nodeToggle = new EventEmitter<string>();
  @Output() containerSelect = new EventEmitter<{ databaseId: string; containerId: string }>();
  @Output() contextMenu = new EventEmitter<{ event: MouseEvent; node: TreeNode }>();

  treeControl = new NestedTreeControl<TreeNode>(node => node.children);
  dataSource = new MatTreeNestedDataSource<TreeNode>();

  constructor() {
    // Update data source when nodes change
    // Note: In a real implementation, use effect() to watch for changes
  }

  ngOnChanges() {
    this.dataSource.data = this.nodes();
  }

  hasChildren = (_: number, node: TreeNode): boolean => {
    return node.type === 'database';
  };

  isExpanded(node: TreeNode): boolean {
    return this.expandedNodes().has(node.id);
  }

  isLoadingContainers(nodeId: string): boolean {
    return this.loadingContainers()[nodeId] ?? false;
  }

  onDatabaseToggle(node: TreeNode) {
    this.nodeToggle.emit(node.id);
  }

  onContainerClick(node: TreeNode) {
    if (node.type === 'container' && node.databaseId) {
      this.containerSelect.emit({
        databaseId: node.databaseId,
        containerId: node.id,
      });
    }
  }

  onContextMenu(event: MouseEvent, node: TreeNode) {
    event.preventDefault();
    this.contextMenu.emit({ event, node });
  }
}
```

### 4.3 Create Explorer Page Container

Create `src/app/features/explorer/containers/explorer-page/explorer-page.component.ts`:

```typescript
import { Component, inject, OnInit, effect } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { DatabaseTreeComponent } from '../../components/database-tree/database-tree.component';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { ExplorerStore } from '../../store/explorer.store';
import { ConnectionsStore } from '../../../connections/store/connections.store';

@Component({
  selector: 'app-explorer-page',
  standalone: true,
  imports: [
    RouterOutlet,
    MatSidenavModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatDividerModule,
    DatabaseTreeComponent,
    LoadingSpinnerComponent,
  ],
  template: `
    <mat-sidenav-container class="explorer-container">
      <!-- Sidebar -->
      <mat-sidenav mode="side" opened class="sidebar">
        <div class="sidebar-header">
          <span class="title">DATABASES</span>
          <button mat-icon-button (click)="onRefresh()">
            <mat-icon>refresh</mat-icon>
          </button>
        </div>

        @if (explorerStore.isLoadingDatabases()) {
          <app-loading-spinner message="Loading databases..." />
        } @else if (explorerStore.error()) {
          <div class="error-state">
            <mat-icon>error</mat-icon>
            <p>{{ explorerStore.error() }}</p>
            <button mat-button (click)="onRefresh()">Retry</button>
          </div>
        } @else {
          <app-database-tree
            [nodes]="explorerStore.treeNodes"
            [selectedContainerId]="explorerStore.selectedContainerId"
            [expandedNodes]="explorerStore.expandedNodes"
            [loadingContainers]="explorerStore.isLoadingContainers"
            (nodeToggle)="onNodeToggle($event)"
            (containerSelect)="onContainerSelect($event)"
          />
        }
      </mat-sidenav>

      <!-- Main content -->
      <mat-sidenav-content class="main-content">
        <mat-toolbar class="content-toolbar">
          <span class="breadcrumb">{{ explorerStore.selectionPath() || 'Select a container' }}</span>
          <span class="spacer"></span>

          <button mat-button [matMenuTriggerFor]="connectionMenu">
            <mat-icon>cloud</mat-icon>
            {{ connectionsStore.activeConnection()?.name }}
            <mat-icon>arrow_drop_down</mat-icon>
          </button>
          <mat-menu #connectionMenu="matMenu">
            <button mat-menu-item (click)="onDisconnect()">
              <mat-icon>logout</mat-icon>
              Disconnect
            </button>
          </mat-menu>
        </mat-toolbar>

        <div class="content-area">
          @if (explorerStore.selectedContainer()) {
            <router-outlet />
          } @else {
            <div class="empty-state">
              <mat-icon>table_chart</mat-icon>
              <h3>Select a Container</h3>
              <p>Choose a container from the sidebar to start querying documents.</p>
            </div>
          }
        </div>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [`
    .explorer-container {
      height: 100vh;
    }
    .sidebar {
      width: 280px;
      background-color: #252526;
      border-right: 1px solid #3c3c3c;
    }
    .sidebar-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid #3c3c3c;
    }
    .sidebar-header .title {
      font-size: 11px;
      font-weight: 600;
      color: #888;
      letter-spacing: 1px;
    }
    .main-content {
      display: flex;
      flex-direction: column;
      background-color: #1e1e1e;
    }
    .content-toolbar {
      background-color: #2d2d2d;
      border-bottom: 1px solid #3c3c3c;
      height: 48px;
    }
    .breadcrumb {
      font-size: 14px;
      color: #ccc;
    }
    .spacer {
      flex: 1;
    }
    .content-area {
      flex: 1;
      overflow: auto;
    }
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: #888;
    }
    .empty-state mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      margin-bottom: 16px;
    }
    .error-state {
      padding: 24px;
      text-align: center;
      color: #f44336;
    }
  `],
})
export class ExplorerPageComponent implements OnInit {
  explorerStore = inject(ExplorerStore);
  connectionsStore = inject(ConnectionsStore);
  private router = inject(Router);

  constructor() {
    // React to container selection
    effect(() => {
      const container = this.explorerStore.selectedContainer();
      if (container) {
        this.router.navigate(['/explorer/query']);
      }
    });
  }

  ngOnInit() {
    // Check for active connection
    if (!this.connectionsStore.activeConnection()) {
      this.router.navigate(['/connections']);
      return;
    }

    // Load databases
    this.explorerStore.loadDatabases();
  }

  onRefresh() {
    this.explorerStore.loadDatabases();
  }

  onNodeToggle(nodeId: string) {
    this.explorerStore.toggleNode(nodeId);

    // Load containers if not already loaded
    if (
      this.explorerStore.isNodeExpanded()(nodeId) &&
      !this.explorerStore.containers()[nodeId]
    ) {
      this.explorerStore.loadContainers(nodeId);
    }
  }

  onContainerSelect(event: { databaseId: string; containerId: string }) {
    this.explorerStore.selectContainer(event.databaseId, event.containerId);
  }

  onDisconnect() {
    this.connectionsStore.disconnect();
    this.explorerStore.reset();
    this.router.navigate(['/connections']);
  }
}
```

### 4.4 Create Explorer Routes

Create `src/app/features/explorer/explorer.routes.ts`:

```typescript
import { Routes } from '@angular/router';
import { ExplorerPageComponent } from './containers/explorer-page/explorer-page.component';
import { connectionGuard } from '../../core/guards/connection.guard';

export const EXPLORER_ROUTES: Routes = [
  {
    path: '',
    component: ExplorerPageComponent,
    canActivate: [connectionGuard],
    children: [
      {
        path: 'query',
        loadChildren: () =>
          import('../query-editor/query-editor.routes').then(
            m => m.QUERY_EDITOR_ROUTES
          ),
      },
    ],
  },
];
```

### 4.5 Create Placeholder Query Routes

Create `src/app/features/query-editor/query-editor.routes.ts`:

```typescript
import { Routes } from '@angular/router';

export const QUERY_EDITOR_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./containers/query-page/query-page.component').then(
        m => m.QueryPageComponent
      ),
  },
];
```

Create placeholder `src/app/features/query-editor/containers/query-page/query-page.component.ts`:

```typescript
import { Component } from '@angular/core';

@Component({
  selector: 'app-query-page',
  standalone: true,
  template: `
    <div class="query-page-placeholder">
      <h2>Query Editor</h2>
      <p>Query editor will be implemented in Phase 5</p>
    </div>
  `,
  styles: [`
    .query-page-placeholder {
      padding: 24px;
      text-align: center;
      color: #888;
    }
  `],
})
export class QueryPageComponent {}
```

## Verification

1. Run the app:
   ```bash
   npm run electron:start
   ```

2. Test scenarios:
   - Connect to a Cosmos DB account
   - Databases load in the sidebar
   - Click database to expand and load containers
   - Click container to select it
   - Breadcrumb updates to show selection
   - Refresh button reloads databases
   - Disconnect returns to connections page
   - Guard redirects if no active connection

## Checklist

- [ ] ExplorerStore with database/container loading
- [ ] DatabaseTreeComponent with expand/collapse
- [ ] ExplorerPageComponent with sidebar layout
- [ ] Routes configured with lazy loading
- [ ] Connection guard working
- [ ] Tree expands and loads containers on demand
- [ ] Container selection updates breadcrumb
- [ ] Disconnect clears state and navigates back

## Next Phase

Proceed to [Phase 5: Query Editor](./phase-5-query.md)
