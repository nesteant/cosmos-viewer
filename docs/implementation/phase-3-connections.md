# Phase 3: Connections Feature

## Overview

This phase implements the connection management feature, including the store, components, and routing.

## Steps

### 3.1 Create Connections Store

Create `src/app/features/connections/store/connections.store.ts`:

```typescript
import { computed, inject } from '@angular/core';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  withHooks,
  patchState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap, from } from 'rxjs';
import { tapResponse } from '@ngrx/operators';
import { CosmosConnection, ConnectionTestResult } from '../../../core/models';
import { ElectronService } from '../../../core/services/electron.service';
import { NotificationService } from '../../../core/services/notification.service';

interface ConnectionsState {
  connections: CosmosConnection[];
  activeConnectionId: string | null;
  testingConnectionId: string | null;
  testResult: ConnectionTestResult | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: ConnectionsState = {
  connections: [],
  activeConnectionId: null,
  testingConnectionId: null,
  testResult: null,
  isLoading: false,
  error: null,
};

export const ConnectionsStore = signalStore(
  { providedIn: 'root' },

  withState(initialState),

  withComputed(({ connections, activeConnectionId }) => ({
    activeConnection: computed(() =>
      connections().find(c => c.id === activeConnectionId()) ?? null
    ),
    connectionCount: computed(() => connections().length),
    sortedConnections: computed(() =>
      [...connections()].sort((a, b) => {
        const aTime = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0;
        const bTime = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0;
        return bTime - aTime;
      })
    ),
    hasConnections: computed(() => connections().length > 0),
  })),

  withMethods((store) => {
    const electronService = inject(ElectronService);
    const notificationService = inject(NotificationService);

    return {
      // Load connections from storage
      loadConnections: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { isLoading: true })),
          switchMap(() => from(electronService.getConnections())),
          tapResponse({
            next: (connections) => {
              patchState(store, {
                connections: connections.map(c => ({
                  ...c,
                  createdAt: new Date(c.createdAt),
                  lastUsedAt: c.lastUsedAt ? new Date(c.lastUsedAt) : undefined,
                })),
                isLoading: false,
              });
            },
            error: (error: Error) => {
              patchState(store, { error: error.message, isLoading: false });
              notificationService.error('Failed to load connections');
            },
          })
        )
      ),

      // Add new connection
      addConnection: (data: Omit<CosmosConnection, 'id' | 'createdAt'>) => {
        const newConnection: CosmosConnection = {
          ...data,
          id: crypto.randomUUID(),
          createdAt: new Date(),
        };
        const updated = [...store.connections(), newConnection];
        patchState(store, { connections: updated });
        electronService.saveConnections(updated);
        notificationService.success('Connection added');
      },

      // Update existing connection
      updateConnection: (id: string, updates: Partial<CosmosConnection>) => {
        const updated = store.connections().map(c =>
          c.id === id ? { ...c, ...updates } : c
        );
        patchState(store, { connections: updated });
        electronService.saveConnections(updated);
        notificationService.success('Connection updated');
      },

      // Delete connection
      deleteConnection: (id: string) => {
        const updated = store.connections().filter(c => c.id !== id);
        patchState(store, {
          connections: updated,
          activeConnectionId:
            store.activeConnectionId() === id ? null : store.activeConnectionId(),
        });
        electronService.saveConnections(updated);
        notificationService.success('Connection deleted');
      },

      // Set active connection
      setActiveConnection: (id: string) => {
        patchState(store, { activeConnectionId: id, error: null });

        // Update lastUsedAt
        const updated = store.connections().map(c =>
          c.id === id ? { ...c, lastUsedAt: new Date() } : c
        );
        patchState(store, { connections: updated });
        electronService.saveConnections(updated);
      },

      // Disconnect (clear active connection)
      disconnect: () => {
        patchState(store, { activeConnectionId: null });
      },

      // Test connection
      testConnection: rxMethod<string>(
        pipe(
          tap((connectionId) =>
            patchState(store, { testingConnectionId: connectionId, testResult: null })
          ),
          switchMap((connectionId) => {
            const connection = store.connections().find(c => c.id === connectionId);
            if (!connection) {
              throw new Error('Connection not found');
            }
            return from(
              electronService.testConnection({
                name: connection.name,
                endpoint: connection.endpoint,
                key: connection.key,
              })
            ).pipe(
              tap((result) => {
                const testResult: ConnectionTestResult = {
                  connectionId,
                  success: result.success,
                  databaseCount: result.databaseCount,
                  error: result.error,
                };
                patchState(store, { testResult, testingConnectionId: null });

                if (result.success) {
                  notificationService.success(
                    `Connection successful (${result.databaseCount} databases)`
                  );
                } else {
                  notificationService.error(`Connection failed: ${result.error}`);
                }
              })
            );
          }),
          tapResponse({
            next: () => {},
            error: (error: Error) => {
              patchState(store, {
                testResult: {
                  connectionId: store.testingConnectionId()!,
                  success: false,
                  error: error.message,
                },
                testingConnectionId: null,
              });
              notificationService.error(`Test failed: ${error.message}`);
            },
          })
        )
      ),

      // Clear test result
      clearTestResult: () => {
        patchState(store, { testResult: null });
      },

      // Clear error
      clearError: () => {
        patchState(store, { error: null });
      },
    };
  }),

  withHooks({
    onInit(store) {
      store.loadConnections();
    },
  })
);
```

### 3.2 Create Connection Form Component

Create `src/app/features/connections/components/connection-form/connection-form.component.ts`:

```typescript
import { Component, inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CosmosConnection } from '../../../../core/models';
import { ElectronService } from '../../../../core/services/electron.service';

interface DialogData {
  connection?: CosmosConnection;
}

@Component({
  selector: 'app-connection-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <h2 mat-dialog-title>
      {{ isEditMode ? 'Edit Connection' : 'Add Connection' }}
    </h2>

    <mat-dialog-content>
      <form [formGroup]="form" class="connection-form">
        <mat-form-field appearance="outline">
          <mat-label>Connection Name</mat-label>
          <input matInput formControlName="name" placeholder="My Cosmos DB" />
          @if (form.controls.name.hasError('required')) {
            <mat-error>Name is required</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Account Endpoint</mat-label>
          <input matInput formControlName="endpoint"
                 placeholder="https://myaccount.documents.azure.com" />
          @if (form.controls.endpoint.hasError('required')) {
            <mat-error>Endpoint is required</mat-error>
          }
          @if (form.controls.endpoint.hasError('pattern')) {
            <mat-error>Invalid endpoint URL</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Account Key</mat-label>
          <input matInput formControlName="key"
                 [type]="showKey ? 'text' : 'password'" />
          <button mat-icon-button matSuffix
                  type="button"
                  (click)="showKey = !showKey">
            <mat-icon>{{ showKey ? 'visibility_off' : 'visibility' }}</mat-icon>
          </button>
          @if (form.controls.key.hasError('required')) {
            <mat-error>Key is required</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Default Database (optional)</mat-label>
          <input matInput formControlName="defaultDatabase" />
        </mat-form-field>
      </form>

      <div class="test-section">
        <button mat-stroked-button
                [disabled]="!form.valid || isTesting"
                (click)="testConnection()">
          @if (isTesting) {
            <mat-spinner diameter="20" />
          } @else {
            <mat-icon>wifi_tethering</mat-icon>
          }
          Test Connection
        </button>

        @if (testResult) {
          <div class="test-result" [class.success]="testResult.success"
                                   [class.error]="!testResult.success">
            @if (testResult.success) {
              <mat-icon>check_circle</mat-icon>
              <span>Connection successful ({{ testResult.databaseCount }} databases)</span>
            } @else {
              <mat-icon>error</mat-icon>
              <span>{{ testResult.error }}</span>
            }
          </div>
        }
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close()">Cancel</button>
      <button mat-raised-button color="primary"
              [disabled]="!form.valid"
              (click)="save()">
        {{ isEditMode ? 'Save Changes' : 'Add Connection' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .connection-form {
      display: flex;
      flex-direction: column;
      min-width: 400px;
      gap: 8px;
    }
    mat-form-field {
      width: 100%;
    }
    .test-section {
      margin-top: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .test-result {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 4px;
    }
    .test-result.success {
      background-color: rgba(76, 175, 80, 0.1);
      color: #4caf50;
    }
    .test-result.error {
      background-color: rgba(244, 67, 54, 0.1);
      color: #f44336;
    }
  `],
})
export class ConnectionFormComponent implements OnInit {
  dialogRef = inject(MatDialogRef<ConnectionFormComponent>);
  data = inject<DialogData>(MAT_DIALOG_DATA, { optional: true });
  electronService = inject(ElectronService);

  form = new FormGroup({
    name: new FormControl('', [Validators.required, Validators.maxLength(100)]),
    endpoint: new FormControl('', [
      Validators.required,
      Validators.pattern(/^https:\/\/[\w-]+\.documents\.azure\.com/),
    ]),
    key: new FormControl('', [Validators.required]),
    defaultDatabase: new FormControl(''),
  });

  showKey = false;
  isTesting = false;
  testResult: { success: boolean; databaseCount?: number; error?: string } | null = null;

  get isEditMode(): boolean {
    return !!this.data?.connection;
  }

  ngOnInit() {
    if (this.data?.connection) {
      this.form.patchValue({
        name: this.data.connection.name,
        endpoint: this.data.connection.endpoint,
        key: this.data.connection.key,
        defaultDatabase: this.data.connection.defaultDatabase ?? '',
      });
    }
  }

  async testConnection() {
    if (!this.form.valid) return;

    this.isTesting = true;
    this.testResult = null;

    try {
      this.testResult = await this.electronService.testConnection({
        name: this.form.value.name!,
        endpoint: this.form.value.endpoint!,
        key: this.form.value.key!,
      });
    } catch (error: any) {
      this.testResult = { success: false, error: error.message };
    } finally {
      this.isTesting = false;
    }
  }

  save() {
    if (!this.form.valid) return;

    const result = {
      name: this.form.value.name!,
      endpoint: this.form.value.endpoint!,
      key: this.form.value.key!,
      defaultDatabase: this.form.value.defaultDatabase || undefined,
    };

    this.dialogRef.close(result);
  }
}
```

### 3.3 Create Connection Card Component

Create `src/app/features/connections/components/connection-card/connection-card.component.ts`:

```typescript
import { Component, Input, Output, EventEmitter, Signal, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DatePipe } from '@angular/common';
import { CosmosConnection, ConnectionTestResult } from '../../../../core/models';

@Component({
  selector: 'app-connection-card',
  standalone: true,
  imports: [
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    DatePipe,
  ],
  template: `
    <mat-card [class.active]="isActive()">
      <mat-card-header>
        <mat-icon mat-card-avatar [class.connected]="isActive()">
          {{ isActive() ? 'cloud_done' : 'cloud_queue' }}
        </mat-icon>
        <mat-card-title>{{ connection().name }}</mat-card-title>
        <mat-card-subtitle>{{ truncatedEndpoint }}</mat-card-subtitle>
      </mat-card-header>

      <mat-card-content>
        <p class="last-used">
          @if (connection().lastUsedAt) {
            Last used: {{ connection().lastUsedAt | date:'short' }}
          } @else {
            Never used
          }
        </p>

        @if (testResult()?.connectionId === connection().id) {
          <div class="test-result" [class.success]="testResult()!.success"
                                   [class.error]="!testResult()!.success">
            @if (testResult()!.success) {
              <mat-icon>check_circle</mat-icon>
              {{ testResult()!.databaseCount }} databases
            } @else {
              <mat-icon>error</mat-icon>
              Failed
            }
          </div>
        }
      </mat-card-content>

      <mat-card-actions>
        <button mat-button color="primary"
                [disabled]="isActive()"
                (click)="connect.emit()">
          @if (isActive()) {
            Connected
          } @else {
            Connect
          }
        </button>

        <button mat-button
                [disabled]="isTesting()"
                (click)="test.emit()">
          @if (isTesting()) {
            <mat-spinner diameter="16" />
          } @else {
            Test
          }
        </button>

        <button mat-icon-button [matMenuTriggerFor]="menu">
          <mat-icon>more_vert</mat-icon>
        </button>
        <mat-menu #menu="matMenu">
          <button mat-menu-item (click)="edit.emit()">
            <mat-icon>edit</mat-icon> Edit
          </button>
          <button mat-menu-item (click)="delete.emit()">
            <mat-icon>delete</mat-icon> Delete
          </button>
        </mat-menu>
      </mat-card-actions>
    </mat-card>
  `,
  styles: [`
    mat-card {
      width: 300px;
      transition: border-color 0.2s;
    }
    mat-card.active {
      border: 2px solid #4caf50;
    }
    mat-icon.connected {
      color: #4caf50;
    }
    .last-used {
      color: #888;
      font-size: 12px;
      margin: 0;
    }
    .test-result {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-top: 8px;
      font-size: 12px;
    }
    .test-result.success {
      color: #4caf50;
    }
    .test-result.error {
      color: #f44336;
    }
    mat-card-actions {
      display: flex;
      gap: 8px;
    }
    mat-spinner {
      display: inline-block;
    }
  `],
})
export class ConnectionCardComponent {
  @Input({ required: true }) connection!: Signal<CosmosConnection>;
  @Input() isActive: Signal<boolean> = signal(false);
  @Input() isTesting: Signal<boolean> = signal(false);
  @Input() testResult: Signal<ConnectionTestResult | null> = signal(null);

  @Output() connect = new EventEmitter<void>();
  @Output() test = new EventEmitter<void>();
  @Output() edit = new EventEmitter<void>();
  @Output() delete = new EventEmitter<void>();

  get truncatedEndpoint(): string {
    const endpoint = this.connection().endpoint;
    const match = endpoint.match(/https:\/\/([\w-]+)/);
    return match ? match[1] : endpoint;
  }
}
```

### 3.4 Create Connection List Component

Create `src/app/features/connections/components/connection-list/connection-list.component.ts`:

```typescript
import { Component, Input, Output, EventEmitter, Signal, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ConnectionCardComponent } from '../connection-card/connection-card.component';
import { CosmosConnection, ConnectionTestResult } from '../../../../core/models';

@Component({
  selector: 'app-connection-list',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, ConnectionCardComponent],
  template: `
    <div class="connection-list-header">
      <h2>Your Connections</h2>
      <button mat-raised-button color="primary" (click)="add.emit()">
        <mat-icon>add</mat-icon>
        Add Connection
      </button>
    </div>

    @if (connections().length === 0) {
      <div class="empty-state">
        <mat-icon>cloud_off</mat-icon>
        <h3>No connections yet</h3>
        <p>Add a connection to get started</p>
      </div>
    } @else {
      <div class="connection-grid">
        @for (connection of connections(); track connection.id) {
          <app-connection-card
            [connection]="asSignal(connection)"
            [isActive]="asSignal(activeConnectionId() === connection.id)"
            [isTesting]="asSignal(testingConnectionId() === connection.id)"
            [testResult]="testResult"
            (connect)="connect.emit(connection.id)"
            (test)="test.emit(connection.id)"
            (edit)="edit.emit(connection)"
            (delete)="delete.emit(connection.id)"
          />
        }
      </div>
    }
  `,
  styles: [`
    .connection-list-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }
    .connection-list-header h2 {
      margin: 0;
    }
    .connection-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
    }
    .empty-state {
      text-align: center;
      padding: 48px;
      color: #888;
    }
    .empty-state mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
    }
  `],
})
export class ConnectionListComponent {
  @Input({ required: true }) connections!: Signal<CosmosConnection[]>;
  @Input() activeConnectionId: Signal<string | null> = signal(null);
  @Input() testingConnectionId: Signal<string | null> = signal(null);
  @Input() testResult: Signal<ConnectionTestResult | null> = signal(null);

  @Output() add = new EventEmitter<void>();
  @Output() connect = new EventEmitter<string>();
  @Output() test = new EventEmitter<string>();
  @Output() edit = new EventEmitter<CosmosConnection>();
  @Output() delete = new EventEmitter<string>();

  // Helper to convert values to signals for child components
  asSignal<T>(value: T): Signal<T> {
    return signal(value);
  }
}
```

### 3.5 Create Connections Page Container

Create `src/app/features/connections/containers/connections-page/connections-page.component.ts`:

```typescript
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { ConnectionListComponent } from '../../components/connection-list/connection-list.component';
import { ConnectionFormComponent } from '../../components/connection-form/connection-form.component';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { ConnectionsStore } from '../../store/connections.store';
import { CosmosConnection } from '../../../../core/models';

@Component({
  selector: 'app-connections-page',
  standalone: true,
  imports: [ConnectionListComponent],
  template: `
    <div class="connections-page">
      <app-connection-list
        [connections]="store.sortedConnections"
        [activeConnectionId]="store.activeConnectionId"
        [testingConnectionId]="store.testingConnectionId"
        [testResult]="store.testResult"
        (add)="onAdd()"
        (connect)="onConnect($event)"
        (test)="onTest($event)"
        (edit)="onEdit($event)"
        (delete)="onDelete($event)"
      />
    </div>
  `,
  styles: [`
    .connections-page {
      padding: 24px;
      max-width: 1200px;
      margin: 0 auto;
    }
  `],
})
export class ConnectionsPageComponent {
  store = inject(ConnectionsStore);
  private router = inject(Router);
  private dialog = inject(MatDialog);

  onAdd() {
    const dialogRef = this.dialog.open(ConnectionFormComponent, {
      width: '500px',
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.store.addConnection(result);
      }
    });
  }

  onConnect(id: string) {
    this.store.setActiveConnection(id);
    this.router.navigate(['/explorer']);
  }

  onTest(id: string) {
    this.store.testConnection(id);
  }

  onEdit(connection: CosmosConnection) {
    const dialogRef = this.dialog.open(ConnectionFormComponent, {
      width: '500px',
      data: { connection },
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.store.updateConnection(connection.id, result);
      }
    });
  }

  onDelete(id: string) {
    const connection = this.store.connections().find(c => c.id === id);
    if (!connection) return;

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete Connection',
        message: `Are you sure you want to delete "${connection.name}"?`,
        confirmText: 'Delete',
        confirmColor: 'warn',
      },
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.store.deleteConnection(id);
      }
    });
  }
}
```

### 3.6 Create Routes

Create `src/app/features/connections/connections.routes.ts`:

```typescript
import { Routes } from '@angular/router';
import { ConnectionsPageComponent } from './containers/connections-page/connections-page.component';

export const CONNECTIONS_ROUTES: Routes = [
  {
    path: '',
    component: ConnectionsPageComponent,
  },
];
```

### 3.7 Update App Routes

Update `src/app/app.routes.ts`:

```typescript
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'connections',
    pathMatch: 'full',
  },
  {
    path: 'connections',
    loadChildren: () =>
      import('./features/connections/connections.routes').then(
        m => m.CONNECTIONS_ROUTES
      ),
  },
  {
    path: 'explorer',
    loadChildren: () =>
      import('./features/explorer/explorer.routes').then(
        m => m.EXPLORER_ROUTES
      ),
  },
];
```

### 3.8 Update App Component

Update `src/app/app.component.ts`:

```typescript
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <div class="app-container">
      <router-outlet />
    </div>
  `,
  styles: [`
    .app-container {
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
  `],
})
export class AppComponent {}
```

## Verification

1. Run the app:
   ```bash
   npm run electron:start
   ```

2. Test scenarios:
   - Add a new connection (should appear in the list)
   - Test connection (should show success/failure)
   - Edit connection (should update)
   - Delete connection (should confirm and remove)
   - Connect (should navigate to explorer)
   - Close and reopen app (connections should persist)

## Checklist

- [ ] ConnectionsStore with all methods
- [ ] ConnectionFormComponent with validation and testing
- [ ] ConnectionCardComponent with actions
- [ ] ConnectionListComponent with grid display
- [ ] ConnectionsPageComponent orchestrating
- [ ] Routes configured
- [ ] Connections persist in electron-store
- [ ] Test connection works
- [ ] Add/Edit/Delete work correctly
- [ ] Connect navigates to explorer

## Next Phase

Proceed to [Phase 4: Explorer Feature](./phase-4-explorer.md)
