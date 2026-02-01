# Phase 2: Core Infrastructure

## Overview

This phase implements the core models, services, and utilities that other features depend on.

## Steps

### 2.1 Create Core Models

#### Connection Model

Create `src/app/core/models/connection.model.ts`:

```typescript
export interface CosmosConnection {
  id: string;
  name: string;
  endpoint: string;
  key: string;
  defaultDatabase?: string;
  createdAt: Date;
  lastUsedAt?: Date;
}

export interface ConnectionTestResult {
  connectionId: string;
  success: boolean;
  databaseCount?: number;
  error?: string;
}
```

#### Document Model

Create `src/app/core/models/document.model.ts`:

```typescript
export interface CosmosDocument {
  id: string;
  [key: string]: any;
  // System properties
  _rid?: string;
  _self?: string;
  _etag?: string;
  _attachments?: string;
  _ts?: number;
}

export interface FlatDocument {
  id: string;
  [path: string]: any;
}
```

#### Query Model

Create `src/app/core/models/query.model.ts`:

```typescript
export interface QueryParams {
  connectionId: string;
  databaseId: string;
  containerId: string;
  query: string;
  pageSize: number;
  continuationToken: string | null;
}

export interface QueryResult {
  documents: CosmosDocument[];
  continuationToken: string | null;
  hasMoreResults: boolean;
  requestCharge: number;
}

export interface QueryHistoryItem {
  query: string;
  executedAt: Date;
  databaseId: string;
  containerId: string;
}

export interface ColumnDefinition {
  key: string;
  displayName: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null';
  isNested: boolean;
  width?: number;
}
```

#### Tree Node Model

Create `src/app/core/models/tree-node.model.ts`:

```typescript
export interface DatabaseInfo {
  id: string;
  name: string;
}

export interface ContainerInfo {
  id: string;
  name: string;
  partitionKeyPath: string;
  databaseId: string;
}

export interface TreeNode {
  id: string;
  name: string;
  type: 'database' | 'container';
  partitionKeyPath?: string;
  databaseId?: string;
  children?: TreeNode[];
}
```

#### Index Barrel

Create `src/app/core/models/index.ts`:

```typescript
export * from './connection.model';
export * from './document.model';
export * from './query.model';
export * from './tree-node.model';
```

### 2.2 Create Electron Service

Create `src/app/core/services/electron.service.ts`:

```typescript
import { Injectable } from '@angular/core';
import {
  CosmosConnection,
  ConnectionTestResult,
  QueryParams,
  QueryResult,
  DatabaseInfo,
  ContainerInfo,
  CosmosDocument,
} from '../models';

@Injectable({ providedIn: 'root' })
export class ElectronService {
  private get api() {
    return window.electronAPI;
  }

  // Connection operations
  async testConnection(config: Omit<CosmosConnection, 'id' | 'createdAt'>): Promise<ConnectionTestResult> {
    return this.api.cosmos.testConnection(config);
  }

  // Storage operations
  async getConnections(): Promise<CosmosConnection[]> {
    return this.api.storage.getConnections();
  }

  async saveConnections(connections: CosmosConnection[]): Promise<void> {
    return this.api.storage.saveConnections(connections);
  }

  // Database operations
  async listDatabases(connectionId: string): Promise<DatabaseInfo[]> {
    return this.api.cosmos.listDatabases(connectionId);
  }

  async listContainers(connectionId: string, databaseId: string): Promise<ContainerInfo[]> {
    return this.api.cosmos.listContainers(connectionId, databaseId);
  }

  // Query operations
  async executeQuery(params: QueryParams): Promise<QueryResult> {
    return this.api.cosmos.executeQuery(params);
  }

  // Document operations
  async createDocument(params: {
    connectionId: string;
    databaseId: string;
    containerId: string;
    document: CosmosDocument;
  }): Promise<CosmosDocument> {
    return this.api.cosmos.createDocument(params);
  }

  async updateDocument(params: {
    connectionId: string;
    databaseId: string;
    containerId: string;
    document: CosmosDocument;
    partitionKey: any;
  }): Promise<CosmosDocument> {
    return this.api.cosmos.updateDocument(params);
  }

  async deleteDocument(params: {
    connectionId: string;
    databaseId: string;
    containerId: string;
    documentId: string;
    partitionKey: any;
  }): Promise<void> {
    return this.api.cosmos.deleteDocument(params);
  }
}
```

### 2.3 Create Notification Service

Create `src/app/core/services/notification.service.ts`:

```typescript
import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private snackBar = inject(MatSnackBar);

  success(message: string, duration = 3000): void {
    this.snackBar.open(message, 'OK', {
      duration,
      panelClass: ['snackbar-success'],
      horizontalPosition: 'right',
      verticalPosition: 'bottom',
    });
  }

  error(message: string, action = 'Dismiss'): void {
    this.snackBar.open(message, action, {
      duration: 10000,
      panelClass: ['snackbar-error'],
      horizontalPosition: 'right',
      verticalPosition: 'bottom',
    });
  }

  info(message: string, duration = 4000): void {
    this.snackBar.open(message, undefined, {
      duration,
      panelClass: ['snackbar-info'],
      horizontalPosition: 'right',
      verticalPosition: 'bottom',
    });
  }

  warn(message: string, duration = 5000): void {
    this.snackBar.open(message, 'OK', {
      duration,
      panelClass: ['snackbar-warn'],
      horizontalPosition: 'right',
      verticalPosition: 'bottom',
    });
  }
}
```

Add snackbar styles to `src/styles.scss`:

```scss
.snackbar-success {
  --mdc-snackbar-container-color: #4caf50;
  --mdc-snackbar-supporting-text-color: white;
}

.snackbar-error {
  --mdc-snackbar-container-color: #f44336;
  --mdc-snackbar-supporting-text-color: white;
}

.snackbar-info {
  --mdc-snackbar-container-color: #2196f3;
  --mdc-snackbar-supporting-text-color: white;
}

.snackbar-warn {
  --mdc-snackbar-container-color: #ff9800;
  --mdc-snackbar-supporting-text-color: white;
}
```

### 2.4 Create Core Utilities

#### Path Utilities

Create `src/app/core/utils/path-utils.ts`:

```typescript
/**
 * Get value at a JSON path like "address.city" or "items[0].name"
 */
export function getValueAtPath(obj: any, path: string): any {
  if (!obj || !path) return undefined;

  const parts = path.split(/[.\[\]]/).filter(Boolean);
  let current = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[part];
  }

  return current;
}

/**
 * Set value at a JSON path, creating intermediate objects as needed
 */
export function setValueAtPath(obj: any, path: string, value: any): void {
  if (!obj || !path) return;

  const parts = path.split(/[.\[\]]/).filter(Boolean);
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const nextPart = parts[i + 1];

    if (current[part] === undefined || current[part] === null) {
      // Create intermediate object or array
      current[part] = isNaN(Number(nextPart)) ? {} : [];
    }
    current = current[part];
  }

  const lastPart = parts[parts.length - 1];
  current[lastPart] = value;
}

/**
 * Delete value at a JSON path
 */
export function deleteValueAtPath(obj: any, path: string): void {
  if (!obj || !path) return;

  const parts = path.split(/[.\[\]]/).filter(Boolean);
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] === undefined) return;
    current = current[part];
  }

  delete current[parts[parts.length - 1]];
}
```

#### Diff Tracker

Create `src/app/core/utils/diff-tracker.ts`:

```typescript
/**
 * Deep equality check for any values
 */
export function deepEquals(a: any, b: any): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (a === undefined || b === undefined) return a === b;
  if (typeof a !== typeof b) return false;

  if (typeof a === 'object') {
    if (Array.isArray(a) !== Array.isArray(b)) return false;

    if (Array.isArray(a)) {
      if (a.length !== b.length) return false;
      return a.every((item, index) => deepEquals(item, b[index]));
    }

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    return keysA.every(key => deepEquals(a[key], b[key]));
  }

  return false;
}

/**
 * Clone a document with proper handling
 */
export function cloneDocument<T>(doc: T): T {
  return structuredClone(doc);
}

/**
 * Get all paths that differ between two objects
 */
export function getDiffPaths(original: any, modified: any, prefix = ''): string[] {
  const paths: string[] = [];

  const allKeys = new Set([
    ...Object.keys(original || {}),
    ...Object.keys(modified || {}),
  ]);

  for (const key of allKeys) {
    const path = prefix ? `${prefix}.${key}` : key;
    const origValue = original?.[key];
    const modValue = modified?.[key];

    if (!deepEquals(origValue, modValue)) {
      if (
        typeof origValue === 'object' &&
        typeof modValue === 'object' &&
        origValue !== null &&
        modValue !== null &&
        !Array.isArray(origValue) &&
        !Array.isArray(modValue)
      ) {
        // Recurse into nested objects
        paths.push(...getDiffPaths(origValue, modValue, path));
      } else {
        paths.push(path);
      }
    }
  }

  return paths;
}
```

#### Column Detector

Create `src/app/core/utils/column-detector.ts`:

```typescript
import { ColumnDefinition, CosmosDocument } from '../models';

type ColumnType = ColumnDefinition['type'];

/**
 * Infer the type of a value
 */
export function inferType(value: any): ColumnType {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  return 'string';
}

/**
 * Detect columns from an array of documents
 */
export function detectColumns(documents: CosmosDocument[]): ColumnDefinition[] {
  const columnMap = new Map<string, ColumnDefinition>();

  for (const doc of documents) {
    extractPaths(doc, '', columnMap);
  }

  // Sort columns: id first, user columns, then system columns last
  return Array.from(columnMap.values()).sort((a, b) => {
    // id always first
    if (a.key === 'id') return -1;
    if (b.key === 'id') return 1;

    // System fields (starting with _) last
    const aIsSystem = a.key.startsWith('_');
    const bIsSystem = b.key.startsWith('_');
    if (aIsSystem && !bIsSystem) return 1;
    if (!aIsSystem && bIsSystem) return -1;

    // Otherwise alphabetical
    return a.key.localeCompare(b.key);
  });
}

function extractPaths(
  obj: any,
  prefix: string,
  map: Map<string, ColumnDefinition>,
  depth = 0
): void {
  if (depth > 3) return; // Limit nesting depth

  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const type = inferType(value);

    if (!map.has(path)) {
      map.set(path, {
        key: path,
        displayName: key,
        type,
        isNested: type === 'object' || type === 'array',
      });
    }

    // Recurse into objects (but not arrays)
    if (type === 'object' && value !== null) {
      extractPaths(value, path, map, depth + 1);
    }
  }
}

/**
 * Merge new columns into existing columns (for pagination)
 */
export function mergeColumns(
  existing: ColumnDefinition[],
  newColumns: ColumnDefinition[]
): ColumnDefinition[] {
  const merged = new Map<string, ColumnDefinition>();

  for (const col of existing) {
    merged.set(col.key, col);
  }

  for (const col of newColumns) {
    if (!merged.has(col.key)) {
      merged.set(col.key, col);
    }
  }

  return Array.from(merged.values()).sort((a, b) => {
    if (a.key === 'id') return -1;
    if (b.key === 'id') return 1;
    if (a.key.startsWith('_') && !b.key.startsWith('_')) return 1;
    if (!a.key.startsWith('_') && b.key.startsWith('_')) return -1;
    return a.key.localeCompare(b.key);
  });
}
```

#### JSON Flattener

Create `src/app/core/utils/json-flattener.ts`:

```typescript
import { CosmosDocument, FlatDocument, ColumnDefinition } from '../models';
import { getValueAtPath } from './path-utils';

/**
 * Flatten a document for table display based on column definitions
 */
export function flattenDocument(
  doc: CosmosDocument,
  columns: ColumnDefinition[]
): FlatDocument {
  const flat: FlatDocument = { id: doc.id };

  for (const column of columns) {
    flat[column.key] = getValueAtPath(doc, column.key);
  }

  return flat;
}

/**
 * Flatten multiple documents
 */
export function flattenDocuments(
  docs: CosmosDocument[],
  columns: ColumnDefinition[]
): FlatDocument[] {
  return docs.map(doc => flattenDocument(doc, columns));
}
```

#### Index Barrel

Create `src/app/core/utils/index.ts`:

```typescript
export * from './path-utils';
export * from './diff-tracker';
export * from './column-detector';
export * from './json-flattener';
```

### 2.5 Create Connection Guard

Create `src/app/core/guards/connection.guard.ts`:

```typescript
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ConnectionsStore } from '../../features/connections/store/connections.store';

export const connectionGuard: CanActivateFn = () => {
  const connectionsStore = inject(ConnectionsStore);
  const router = inject(Router);

  if (connectionsStore.activeConnection()) {
    return true;
  }

  return router.createUrlTree(['/connections']);
};
```

### 2.6 Create Shared Components

#### Loading Spinner

Create `src/app/shared/components/loading-spinner/loading-spinner.component.ts`:

```typescript
import { Component, Input } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-loading-spinner',
  standalone: true,
  imports: [MatProgressSpinnerModule],
  template: `
    <div class="loading-container">
      <mat-spinner [diameter]="diameter" />
      @if (message) {
        <p class="loading-message">{{ message }}</p>
      }
    </div>
  `,
  styles: [`
    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .loading-message {
      margin-top: 16px;
      color: #888;
    }
  `],
})
export class LoadingSpinnerComponent {
  @Input() diameter = 40;
  @Input() message?: string;
}
```

#### Confirm Dialog

Create `src/app/shared/components/confirm-dialog/confirm-dialog.component.ts`:

```typescript
import { Component, inject } from '@angular/core';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: 'primary' | 'accent' | 'warn';
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <p>{{ data.message }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close(false)">
        {{ data.cancelText || 'Cancel' }}
      </button>
      <button mat-raised-button
              [color]="data.confirmColor || 'primary'"
              (click)="dialogRef.close(true)">
        {{ data.confirmText || 'Confirm' }}
      </button>
    </mat-dialog-actions>
  `,
})
export class ConfirmDialogComponent {
  data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
  dialogRef = inject(MatDialogRef<ConfirmDialogComponent>);
}
```

#### Error Display

Create `src/app/shared/components/error-display/error-display.component.ts`:

```typescript
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-error-display',
  standalone: true,
  imports: [MatIconModule, MatButtonModule],
  template: `
    <div class="error-container">
      <mat-icon color="warn">error</mat-icon>
      <span class="error-message">{{ message }}</span>
      @if (dismissible) {
        <button mat-icon-button (click)="dismiss.emit()">
          <mat-icon>close</mat-icon>
        </button>
      }
    </div>
  `,
  styles: [`
    .error-container {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      background-color: rgba(244, 67, 54, 0.1);
      border: 1px solid rgba(244, 67, 54, 0.3);
      border-radius: 4px;
    }
    .error-message {
      flex: 1;
      color: #f44336;
    }
  `],
})
export class ErrorDisplayComponent {
  @Input({ required: true }) message!: string;
  @Input() dismissible = true;
  @Output() dismiss = new EventEmitter<void>();
}
```

### 2.7 Create Electron Main Process Services

#### Storage Service

Create `electron/services/storage.service.ts`:

```typescript
import Store from 'electron-store';

interface ConnectionData {
  id: string;
  name: string;
  endpoint: string;
  key: string;
  defaultDatabase?: string;
  createdAt: string;
  lastUsedAt?: string;
}

const store = new Store<{ connections: ConnectionData[] }>({
  name: 'cosmos-viewer',
  encryptionKey: 'cosmos-viewer-secure-key', // In production, use a better key
  schema: {
    connections: {
      type: 'array',
      default: [],
    },
  },
});

export function getConnections(): ConnectionData[] {
  return store.get('connections', []);
}

export function saveConnections(connections: ConnectionData[]): void {
  store.set('connections', connections);
}

export function getConnectionById(id: string): ConnectionData | undefined {
  return getConnections().find(c => c.id === id);
}
```

#### Cosmos Service

Create `electron/services/cosmos.service.ts`:

```typescript
import { CosmosClient, Container } from '@azure/cosmos';
import { getConnectionById } from './storage.service';

interface ConnectionConfig {
  endpoint: string;
  key: string;
}

class CosmosService {
  private clients = new Map<string, CosmosClient>();

  getClient(connectionId: string): CosmosClient {
    if (!this.clients.has(connectionId)) {
      const config = getConnectionById(connectionId);
      if (!config) {
        throw new Error(`Connection not found: ${connectionId}`);
      }
      const client = new CosmosClient({
        endpoint: config.endpoint,
        key: config.key,
      });
      this.clients.set(connectionId, client);
    }
    return this.clients.get(connectionId)!;
  }

  disposeClient(connectionId: string): void {
    const client = this.clients.get(connectionId);
    if (client) {
      client.dispose();
      this.clients.delete(connectionId);
    }
  }

  async testConnection(config: ConnectionConfig): Promise<{
    success: boolean;
    databaseCount?: number;
    error?: string;
  }> {
    try {
      const client = new CosmosClient({
        endpoint: config.endpoint,
        key: config.key,
      });

      const { resources } = await client.databases.readAll().fetchAll();
      client.dispose();

      return { success: true, databaseCount: resources.length };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async listDatabases(connectionId: string): Promise<{ id: string; name: string }[]> {
    const client = this.getClient(connectionId);
    const { resources } = await client.databases.readAll().fetchAll();
    return resources.map(db => ({ id: db.id, name: db.id }));
  }

  async listContainers(connectionId: string, databaseId: string): Promise<{
    id: string;
    name: string;
    partitionKeyPath: string;
  }[]> {
    const client = this.getClient(connectionId);
    const database = client.database(databaseId);
    const { resources } = await database.containers.readAll().fetchAll();

    return resources.map(container => ({
      id: container.id,
      name: container.id,
      partitionKeyPath: container.partitionKey?.paths?.[0] ?? '/id',
    }));
  }

  async executeQuery(params: {
    connectionId: string;
    databaseId: string;
    containerId: string;
    query: string;
    pageSize: number;
    continuationToken: string | null;
  }): Promise<{
    documents: any[];
    continuationToken: string | null;
    hasMoreResults: boolean;
    requestCharge: number;
  }> {
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

  async createDocument(params: {
    connectionId: string;
    databaseId: string;
    containerId: string;
    document: any;
  }): Promise<any> {
    const client = this.getClient(params.connectionId);
    const container = client
      .database(params.databaseId)
      .container(params.containerId);

    const { resource } = await container.items.create(params.document);
    return resource;
  }

  async updateDocument(params: {
    connectionId: string;
    databaseId: string;
    containerId: string;
    document: any;
    partitionKey: any;
  }): Promise<any> {
    const client = this.getClient(params.connectionId);
    const container = client
      .database(params.databaseId)
      .container(params.containerId);

    const { resource } = await container
      .item(params.document.id, params.partitionKey)
      .replace(params.document);

    return resource;
  }

  async deleteDocument(params: {
    connectionId: string;
    databaseId: string;
    containerId: string;
    documentId: string;
    partitionKey: any;
  }): Promise<void> {
    const client = this.getClient(params.connectionId);
    const container = client
      .database(params.databaseId)
      .container(params.containerId);

    await container.item(params.documentId, params.partitionKey).delete();
  }
}

export const cosmosService = new CosmosService();
```

#### IPC Handlers

Create `electron/services/ipc-handlers.ts`:

```typescript
import { ipcMain } from 'electron';
import { cosmosService } from './cosmos.service';
import { getConnections, saveConnections } from './storage.service';

export function registerCosmosHandlers(): void {
  // Storage handlers
  ipcMain.handle('storage:get-connections', async () => {
    return getConnections();
  });

  ipcMain.handle('storage:save-connections', async (_, connections) => {
    saveConnections(connections);
  });

  // Cosmos handlers
  ipcMain.handle('cosmos:test-connection', async (_, config) => {
    return cosmosService.testConnection(config);
  });

  ipcMain.handle('cosmos:list-databases', async (_, connectionId) => {
    return cosmosService.listDatabases(connectionId);
  });

  ipcMain.handle('cosmos:list-containers', async (_, connectionId, databaseId) => {
    return cosmosService.listContainers(connectionId, databaseId);
  });

  ipcMain.handle('cosmos:execute-query', async (_, params) => {
    return cosmosService.executeQuery(params);
  });

  ipcMain.handle('cosmos:create-document', async (_, params) => {
    return cosmosService.createDocument(params);
  });

  ipcMain.handle('cosmos:update-document', async (_, params) => {
    return cosmosService.updateDocument(params);
  });

  ipcMain.handle('cosmos:delete-document', async (_, params) => {
    return cosmosService.deleteDocument(params);
  });
}
```

## Verification

1. Build Electron:
   ```bash
   npm run electron:build
   ```

2. Check that all model files compile:
   ```bash
   npx tsc --noEmit
   ```

3. Verify utility functions work (create a simple test):
   ```typescript
   import { getValueAtPath, setValueAtPath } from './path-utils';

   const obj = { a: { b: { c: 1 } } };
   console.log(getValueAtPath(obj, 'a.b.c')); // 1

   setValueAtPath(obj, 'a.b.d', 2);
   console.log(obj.a.b.d); // 2
   ```

## Checklist

- [ ] All model interfaces created
- [ ] ElectronService with all IPC methods
- [ ] NotificationService with snackbar
- [ ] Path utilities (get/set/delete at path)
- [ ] Diff tracker (deep equals, clone, get diff paths)
- [ ] Column detector (detect columns, merge columns)
- [ ] JSON flattener
- [ ] Connection guard
- [ ] Shared components (loading, confirm, error)
- [ ] Electron storage service with encryption
- [ ] Electron cosmos service with all operations
- [ ] IPC handlers registered
- [ ] TypeScript compiles without errors

## Next Phase

Proceed to [Phase 3: Connections Feature](./phase-3-connections.md)
