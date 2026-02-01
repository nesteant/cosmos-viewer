# Phase 5: Query Editor

## Overview

This phase implements the query editor with Monaco Editor, results table, CRUD operations, and dirty state tracking.

## Steps

### 5.1 Create Query Store

Create `src/app/features/query-editor/store/query.store.ts`:

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
import { pipe, switchMap, tap, from, filter } from 'rxjs';
import { tapResponse } from '@ngrx/operators';
import {
  CosmosDocument,
  ColumnDefinition,
  QueryHistoryItem,
} from '../../../core/models';
import { ElectronService } from '../../../core/services/electron.service';
import { ConnectionsStore } from '../../connections/store/connections.store';
import { ExplorerStore } from '../../explorer/store/explorer.store';
import { NotificationService } from '../../../core/services/notification.service';
import { detectColumns, mergeColumns } from '../../../core/utils/column-detector';
import { flattenDocuments } from '../../../core/utils/json-flattener';

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

const initialState: QueryState = {
  query: 'SELECT * FROM c',
  results: [],
  columns: [],
  continuationToken: null,
  hasMoreResults: false,
  requestCharge: 0,
  isExecuting: false,
  executionTime: null,
  error: null,
  queryHistory: [],
};

export const QueryStore = signalStore(
  { providedIn: 'root' },

  withState(initialState),

  withComputed(({ results, columns }) => ({
    flattenedResults: computed(() => flattenDocuments(results(), columns())),
    columnKeys: computed(() => columns().map(c => c.key)),
    isEmpty: computed(() => results().length === 0),
    resultCount: computed(() => results().length),
  })),

  withMethods((store) => {
    const electronService = inject(ElectronService);
    const connectionsStore = inject(ConnectionsStore);
    const explorerStore = inject(ExplorerStore);
    const notificationService = inject(NotificationService);

    return {
      // Set query text
      setQuery: (query: string) => {
        patchState(store, { query });
      },

      // Execute query (initial)
      executeQuery: rxMethod<{ pageSize?: number }>(
        pipe(
          tap(() => patchState(store, {
            isExecuting: true,
            error: null,
            results: [],
            columns: [],
            continuationToken: null,
            hasMoreResults: false,
          })),
          switchMap(({ pageSize = 100 }) => {
            const connection = connectionsStore.activeConnection();
            const database = explorerStore.selectedDatabase();
            const container = explorerStore.selectedContainer();

            if (!connection || !database || !container) {
              throw new Error('No database/container selected');
            }

            const startTime = performance.now();

            return from(electronService.executeQuery({
              connectionId: connection.id,
              databaseId: database.id,
              containerId: container.id,
              query: store.query(),
              pageSize,
              continuationToken: null,
            })).pipe(
              tap((result) => {
                const executionTime = performance.now() - startTime;
                const columns = detectColumns(result.documents);

                patchState(store, {
                  results: result.documents,
                  columns,
                  continuationToken: result.continuationToken,
                  hasMoreResults: result.hasMoreResults,
                  requestCharge: result.requestCharge,
                  isExecuting: false,
                  executionTime,
                });

                // Add to history
                if (result.documents.length > 0) {
                  const historyItem: QueryHistoryItem = {
                    query: store.query(),
                    executedAt: new Date(),
                    databaseId: database.id,
                    containerId: container.id,
                  };
                  const history = [historyItem, ...store.queryHistory().slice(0, 49)];
                  patchState(store, { queryHistory: history });
                }
              })
            );
          }),
          tapResponse({
            next: () => {},
            error: (error: Error) => {
              patchState(store, {
                error: error.message,
                isExecuting: false,
              });
              notificationService.error(`Query failed: ${error.message}`);
            },
          })
        )
      ),

      // Load more results (pagination)
      loadMoreResults: rxMethod<{ pageSize?: number }>(
        pipe(
          filter(() => store.hasMoreResults() && !store.isExecuting()),
          tap(() => patchState(store, { isExecuting: true })),
          switchMap(({ pageSize = 100 }) => {
            const connection = connectionsStore.activeConnection();
            const database = explorerStore.selectedDatabase();
            const container = explorerStore.selectedContainer();

            return from(electronService.executeQuery({
              connectionId: connection!.id,
              databaseId: database!.id,
              containerId: container!.id,
              query: store.query(),
              pageSize,
              continuationToken: store.continuationToken(),
            }));
          }),
          tapResponse({
            next: (result) => {
              // Merge new columns
              const newColumns = detectColumns(result.documents);
              const merged = mergeColumns(store.columns(), newColumns);

              patchState(store, {
                results: [...store.results(), ...result.documents],
                columns: merged,
                continuationToken: result.continuationToken,
                hasMoreResults: result.hasMoreResults,
                requestCharge: store.requestCharge() + result.requestCharge,
                isExecuting: false,
              });
            },
            error: (error: Error) => {
              patchState(store, {
                error: error.message,
                isExecuting: false,
              });
              notificationService.error(`Failed to load more: ${error.message}`);
            },
          })
        )
      ),

      // Clear results
      clearResults: () => {
        patchState(store, {
          results: [],
          columns: [],
          continuationToken: null,
          hasMoreResults: false,
          error: null,
        });
      },

      // Clear error
      clearError: () => {
        patchState(store, { error: null });
      },

      // Reset (on container change)
      reset: () => {
        patchState(store, {
          ...initialState,
          queryHistory: store.queryHistory(), // Keep history
        });
      },
    };
  })
);
```

### 5.2 Create Documents Store

Create `src/app/features/query-editor/store/documents.store.ts`:

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
import { pipe, switchMap, tap, from, forkJoin, of, catchError, map } from 'rxjs';
import { tapResponse } from '@ngrx/operators';
import { CosmosDocument } from '../../../core/models';
import { ElectronService } from '../../../core/services/electron.service';
import { ConnectionsStore } from '../../connections/store/connections.store';
import { ExplorerStore } from '../../explorer/store/explorer.store';
import { NotificationService } from '../../../core/services/notification.service';
import { getValueAtPath, setValueAtPath } from '../../../core/utils/path-utils';
import { deepEquals, cloneDocument } from '../../../core/utils/diff-tracker';
import { QueryStore } from './query.store';

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

const initialState: DocumentsState = {
  originalDocuments: {},
  modifiedDocuments: {},
  dirtyPaths: {},
  pendingDeletions: new Set(),
  newDocuments: [],
  isSaving: false,
  saveProgress: null,
  saveErrors: [],
};

export const DocumentsStore = signalStore(
  { providedIn: 'root' },

  withState(initialState),

  withComputed(({ modifiedDocuments, pendingDeletions, newDocuments, dirtyPaths }) => ({
    hasDirtyChanges: computed(() => {
      return Object.keys(modifiedDocuments()).length > 0 ||
             pendingDeletions().size > 0 ||
             newDocuments().length > 0;
    }),

    pendingChangesCount: computed(() => {
      return Object.keys(modifiedDocuments()).length +
             pendingDeletions().size +
             newDocuments().length;
    }),

    changesSummary: computed(() => ({
      modified: Object.keys(modifiedDocuments()).length,
      deleted: pendingDeletions().size,
      created: newDocuments().length,
    })),

    isCellDirty: computed(() => (documentId: string, path: string): boolean => {
      return dirtyPaths()[documentId]?.has(path) ?? false;
    }),

    isDocumentDirty: computed(() => (documentId: string): boolean => {
      return (dirtyPaths()[documentId]?.size ?? 0) > 0;
    }),

    isPendingDelete: computed(() => (documentId: string): boolean => {
      return pendingDeletions().has(documentId);
    }),

    newDocumentIds: computed(() => {
      return new Set(newDocuments().map(d => d.id));
    }),
  })),

  withMethods((store) => {
    const electronService = inject(ElectronService);
    const connectionsStore = inject(ConnectionsStore);
    const explorerStore = inject(ExplorerStore);
    const notificationService = inject(NotificationService);
    const queryStore = inject(QueryStore);

    return {
      // Initialize tracking for query results
      trackDocuments: (documents: CosmosDocument[]) => {
        const originals: Record<string, CosmosDocument> = {};
        documents.forEach(doc => {
          originals[doc.id] = cloneDocument(doc);
        });
        patchState(store, {
          originalDocuments: { ...store.originalDocuments(), ...originals },
          // Don't clear modified - might have pending changes from previous pages
        });
      },

      // Update a cell value
      updateCell: (documentId: string, path: string, value: any) => {
        const original = store.originalDocuments()[documentId];
        if (!original) return;

        // Get or clone modified document
        let modified = store.modifiedDocuments()[documentId]
          ?? cloneDocument(original);

        // Set value at path
        setValueAtPath(modified, path, value);

        // Track dirty path
        const paths = new Set(store.dirtyPaths()[documentId] ?? []);
        const originalValue = getValueAtPath(original, path);

        if (deepEquals(originalValue, value)) {
          paths.delete(path);
        } else {
          paths.add(path);
        }

        // Update state
        const modifiedDocs = { ...store.modifiedDocuments() };
        const dirtyPathsMap = { ...store.dirtyPaths() };

        if (paths.size === 0) {
          delete modifiedDocs[documentId];
          delete dirtyPathsMap[documentId];
        } else {
          modifiedDocs[documentId] = modified;
          dirtyPathsMap[documentId] = paths;
        }

        patchState(store, {
          modifiedDocuments: modifiedDocs,
          dirtyPaths: dirtyPathsMap,
        });
      },

      // Revert a single cell
      revertCell: (documentId: string, path: string) => {
        const original = store.originalDocuments()[documentId];
        if (!original) return;
        const originalValue = getValueAtPath(original, path);
        store.updateCell(documentId, path, originalValue);
      },

      // Revert all changes for a document
      revertDocument: (documentId: string) => {
        const modifiedDocs = { ...store.modifiedDocuments() };
        const dirtyPathsMap = { ...store.dirtyPaths() };
        delete modifiedDocs[documentId];
        delete dirtyPathsMap[documentId];
        patchState(store, {
          modifiedDocuments: modifiedDocs,
          dirtyPaths: dirtyPathsMap,
        });
      },

      // Mark document for deletion
      markForDeletion: (documentId: string) => {
        const deletions = new Set(store.pendingDeletions());
        deletions.add(documentId);
        patchState(store, { pendingDeletions: deletions });
      },

      // Unmark document from deletion
      unmarkDeletion: (documentId: string) => {
        const deletions = new Set(store.pendingDeletions());
        deletions.delete(documentId);
        patchState(store, { pendingDeletions: deletions });
      },

      // Add new document
      addNewDocument: (document?: Partial<CosmosDocument>) => {
        const newDoc: CosmosDocument = {
          id: crypto.randomUUID(),
          ...document,
        };
        patchState(store, {
          newDocuments: [...store.newDocuments(), newDoc],
        });
        return newDoc;
      },

      // Update new document
      updateNewDocument: (documentId: string, updates: Partial<CosmosDocument>) => {
        const docs = store.newDocuments().map(d =>
          d.id === documentId ? { ...d, ...updates } : d
        );
        patchState(store, { newDocuments: docs });
      },

      // Remove new document
      removeNewDocument: (documentId: string) => {
        const docs = store.newDocuments().filter(d => d.id !== documentId);
        patchState(store, { newDocuments: docs });
      },

      // Commit all changes
      commitChanges: rxMethod<void>(
        pipe(
          tap(() => patchState(store, {
            isSaving: true,
            saveErrors: [],
            saveProgress: { completed: 0, total: store.pendingChangesCount() },
          })),
          switchMap(() => {
            const connection = connectionsStore.activeConnection()!;
            const database = explorerStore.selectedDatabase()!;
            const container = explorerStore.selectedContainer()!;

            const operations: any[] = [];
            let completed = 0;

            // Updates
            Object.entries(store.modifiedDocuments()).forEach(([id, doc]) => {
              operations.push(
                from(electronService.updateDocument({
                  connectionId: connection.id,
                  databaseId: database.id,
                  containerId: container.id,
                  document: doc,
                  partitionKey: getValueAtPath(doc, container.partitionKeyPath.replace('/', '')),
                })).pipe(
                  tap(() => {
                    completed++;
                    patchState(store, {
                      saveProgress: { completed, total: store.pendingChangesCount() }
                    });
                  }),
                  map(() => ({ type: 'update', id, success: true })),
                  catchError(err => of({ type: 'update', id, success: false, error: err.message }))
                )
              );
            });

            // Deletions
            store.pendingDeletions().forEach(id => {
              const doc = store.originalDocuments()[id];
              operations.push(
                from(electronService.deleteDocument({
                  connectionId: connection.id,
                  databaseId: database.id,
                  containerId: container.id,
                  documentId: id,
                  partitionKey: getValueAtPath(doc, container.partitionKeyPath.replace('/', '')),
                })).pipe(
                  tap(() => {
                    completed++;
                    patchState(store, {
                      saveProgress: { completed, total: store.pendingChangesCount() }
                    });
                  }),
                  map(() => ({ type: 'delete', id, success: true })),
                  catchError(err => of({ type: 'delete', id, success: false, error: err.message }))
                )
              );
            });

            // Creates
            store.newDocuments().forEach(doc => {
              operations.push(
                from(electronService.createDocument({
                  connectionId: connection.id,
                  databaseId: database.id,
                  containerId: container.id,
                  document: doc,
                })).pipe(
                  tap(() => {
                    completed++;
                    patchState(store, {
                      saveProgress: { completed, total: store.pendingChangesCount() }
                    });
                  }),
                  map(() => ({ type: 'create', id: doc.id, success: true })),
                  catchError(err => of({ type: 'create', id: doc.id, success: false, error: err.message }))
                )
              );
            });

            if (operations.length === 0) {
              return of([]);
            }

            return forkJoin(operations);
          }),
          tapResponse({
            next: (results: any[]) => {
              const errors = results.filter(r => !r.success);

              if (errors.length === 0) {
                patchState(store, {
                  originalDocuments: {},
                  modifiedDocuments: {},
                  dirtyPaths: {},
                  pendingDeletions: new Set(),
                  newDocuments: [],
                  isSaving: false,
                  saveProgress: null,
                });
                notificationService.success('Changes saved successfully');
                // Refresh query results
                queryStore.executeQuery({ pageSize: 100 });
              } else {
                patchState(store, {
                  isSaving: false,
                  saveProgress: null,
                  saveErrors: errors.map(e => ({ documentId: e.id, error: e.error })),
                });
                notificationService.error(`${errors.length} operation(s) failed`);
              }
            },
            error: (error: Error) => {
              patchState(store, {
                isSaving: false,
                saveProgress: null,
                saveErrors: [{ documentId: 'batch', error: error.message }],
              });
              notificationService.error(`Save failed: ${error.message}`);
            },
          })
        )
      ),

      // Discard all changes
      discardAllChanges: () => {
        patchState(store, {
          modifiedDocuments: {},
          dirtyPaths: {},
          pendingDeletions: new Set(),
          newDocuments: [],
          saveErrors: [],
        });
        notificationService.info('Changes discarded');
      },

      // Reset store
      reset: () => {
        patchState(store, initialState);
      },
    };
  })
);
```

### 5.3 Create Query Input Component

Create `src/app/features/query-editor/components/query-input/query-input.component.ts`:

```typescript
import { Component, Input, Output, EventEmitter, Signal, signal, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MonacoEditorModule } from 'ngx-monaco-editor-v2';
import { QueryHistoryItem } from '../../../../core/models';

@Component({
  selector: 'app-query-input',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    MonacoEditorModule,
  ],
  template: `
    <div class="query-editor-wrapper">
      <ngx-monaco-editor
        class="editor"
        [options]="editorOptions"
        [(ngModel)]="queryValue"
        (ngModelChange)="onQueryChange($event)"
        (onInit)="onEditorInit($event)"
      />
    </div>

    <div class="query-toolbar">
      <button mat-raised-button color="primary"
              [disabled]="isExecuting()"
              matTooltip="Execute Query (F5)"
              (click)="execute.emit()">
        <mat-icon>play_arrow</mat-icon>
        Execute
      </button>

      <button mat-button
              matTooltip="Format Query (Ctrl+Shift+F)"
              (click)="formatQuery()">
        <mat-icon>auto_fix_high</mat-icon>
        Format
      </button>

      <button mat-button [matMenuTriggerFor]="historyMenu">
        <mat-icon>history</mat-icon>
        History
      </button>
      <mat-menu #historyMenu="matMenu" class="history-menu">
        @if (history().length === 0) {
          <div class="no-history">No query history</div>
        } @else {
          @for (item of history().slice(0, 10); track item.executedAt) {
            <button mat-menu-item (click)="selectHistory(item.query)">
              <span class="history-query">{{ truncateQuery(item.query) }}</span>
              <span class="history-time">{{ formatTime(item.executedAt) }}</span>
            </button>
          }
        }
      </mat-menu>

      <span class="spacer"></span>
      <span class="query-length">{{ queryValue.length }} chars</span>
    </div>
  `,
  styles: [`
    .query-editor-wrapper {
      height: 150px;
      border: 1px solid #3c3c3c;
      border-radius: 4px;
      overflow: hidden;
    }
    .editor {
      height: 100%;
    }
    .query-toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 12px;
    }
    .spacer {
      flex: 1;
    }
    .query-length {
      color: #888;
      font-size: 12px;
    }
    .history-query {
      font-family: monospace;
      font-size: 12px;
      max-width: 300px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .history-time {
      color: #888;
      font-size: 11px;
      margin-left: 8px;
    }
    .no-history {
      padding: 16px;
      color: #888;
      text-align: center;
    }
  `],
})
export class QueryInputComponent {
  @Input({ required: true }) query!: Signal<string>;
  @Input() isExecuting: Signal<boolean> = signal(false);
  @Input() history: Signal<QueryHistoryItem[]> = signal([]);

  @Output() queryChange = new EventEmitter<string>();
  @Output() execute = new EventEmitter<void>();

  queryValue = '';
  private editor: any;

  editorOptions = {
    theme: 'vs-dark',
    language: 'sql',
    minimap: { enabled: false },
    lineNumbers: 'on',
    scrollBeyondLastLine: false,
    automaticLayout: true,
    fontSize: 14,
    tabSize: 2,
    wordWrap: 'on',
    padding: { top: 8 },
  };

  constructor() {
    effect(() => {
      const q = this.query();
      if (q !== this.queryValue) {
        this.queryValue = q;
      }
    });
  }

  onEditorInit(editor: any) {
    this.editor = editor;

    // F5 to execute
    editor.addAction({
      id: 'execute-query',
      label: 'Execute Query',
      keybindings: [monaco.KeyCode.F5],
      run: () => this.execute.emit(),
    });

    // Ctrl+Enter to execute
    editor.addAction({
      id: 'execute-query-ctrl-enter',
      label: 'Execute Query',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => this.execute.emit(),
    });

    // Ctrl+Shift+F to format
    editor.addAction({
      id: 'format-query',
      label: 'Format Query',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF],
      run: () => this.formatQuery(),
    });
  }

  onQueryChange(query: string) {
    this.queryChange.emit(query);
  }

  formatQuery() {
    // Simple SQL formatting
    const keywords = [
      'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'ORDER BY',
      'GROUP BY', 'HAVING', 'JOIN', 'LEFT', 'RIGHT', 'INNER',
      'TOP', 'DISTINCT', 'AS', 'ON', 'IN', 'NOT', 'BETWEEN',
      'LIKE', 'IS', 'NULL', 'ASC', 'DESC', 'OFFSET', 'LIMIT',
    ];

    let formatted = this.queryValue.trim();

    // Add newlines before major keywords
    keywords.forEach(keyword => {
      const regex = new RegExp(`\\s+${keyword}\\b`, 'gi');
      formatted = formatted.replace(regex, `\n${keyword}`);
    });

    // Clean up extra whitespace
    formatted = formatted.replace(/\n\s*\n/g, '\n').trim();

    this.queryValue = formatted;
    this.queryChange.emit(formatted);
  }

  selectHistory(query: string) {
    this.queryValue = query;
    this.queryChange.emit(query);
  }

  truncateQuery(query: string): string {
    const cleaned = query.replace(/\s+/g, ' ').trim();
    return cleaned.length > 50 ? cleaned.substring(0, 50) + '...' : cleaned;
  }

  formatTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    return new Date(date).toLocaleDateString();
  }
}
```

### 5.4 Create Results Table Component

This is a larger component - see `docs/features/crud-operations.md` for the full implementation. Here's a summary version:

Create `src/app/features/query-editor/components/results-table/results-table.component.ts`:

```typescript
import { Component, Input, Output, EventEmitter, Signal, signal, computed } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FlatDocument, ColumnDefinition } from '../../../../core/models';

@Component({
  selector: 'app-results-table',
  standalone: true,
  imports: [
    MatTableModule,
    MatCheckboxModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatTooltipModule,
  ],
  template: `
    <div class="table-container">
      <table mat-table [dataSource]="documents()">
        @for (column of columns(); track column.key) {
          <ng-container [matColumnDef]="column.key">
            <th mat-header-cell *matHeaderCellDef>{{ column.displayName }}</th>
            <td mat-cell *matCellDef="let doc"
                [class.dirty]="isCellDirty()(doc.id, column.key)"
                [class.pending-delete]="isPendingDelete()(doc.id)"
                (dblclick)="onCellEdit(doc.id, column.key, doc[column.key])">
              <span class="cell-value">{{ formatValue(doc[column.key]) }}</span>
            </td>
          </ng-container>
        }

        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef></th>
          <td mat-cell *matCellDef="let doc">
            <button mat-icon-button [matMenuTriggerFor]="rowMenu">
              <mat-icon>more_vert</mat-icon>
            </button>
            <mat-menu #rowMenu="matMenu">
              <button mat-menu-item (click)="editDoc.emit(doc.id)">
                <mat-icon>edit</mat-icon> Edit Document
              </button>
              @if (isPendingDelete()(doc.id)) {
                <button mat-menu-item (click)="undoDelete.emit(doc.id)">
                  <mat-icon>undo</mat-icon> Undo Delete
                </button>
              } @else {
                <button mat-menu-item class="delete-action" (click)="deleteDoc.emit(doc.id)">
                  <mat-icon>delete</mat-icon> Delete
                </button>
              }
            </mat-menu>
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="displayedColumns()"></tr>
        <tr mat-row *matRowDef="let row; columns: displayedColumns()"
            [class.pending-delete]="isPendingDelete()(row.id)"></tr>
      </table>
    </div>
  `,
  styles: [`
    .table-container {
      overflow: auto;
      max-height: calc(100vh - 400px);
    }
    table {
      width: 100%;
    }
    .cell-value {
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      display: block;
    }
    .dirty {
      background-color: rgba(255, 193, 7, 0.15) !important;
      border-left: 3px solid #ffc107;
    }
    .pending-delete {
      background-color: rgba(244, 67, 54, 0.1) !important;
      text-decoration: line-through;
      opacity: 0.6;
    }
    .delete-action {
      color: #f44336;
    }
    th, td {
      padding: 8px 12px !important;
    }
  `],
})
export class ResultsTableComponent {
  @Input({ required: true }) documents!: Signal<FlatDocument[]>;
  @Input({ required: true }) columns!: Signal<ColumnDefinition[]>;
  @Input() isCellDirty: Signal<(docId: string, path: string) => boolean> = signal(() => false);
  @Input() isPendingDelete: Signal<(docId: string) => boolean> = signal(() => false);

  @Output() cellEdit = new EventEmitter<{ documentId: string; path: string; value: any }>();
  @Output() editDoc = new EventEmitter<string>();
  @Output() deleteDoc = new EventEmitter<string>();
  @Output() undoDelete = new EventEmitter<string>();

  displayedColumns = computed(() => [
    ...this.columns().map(c => c.key),
    'actions',
  ]);

  onCellEdit(docId: string, path: string, value: any) {
    this.cellEdit.emit({ documentId: docId, path, value });
  }

  formatValue(value: any): string {
    if (value === null) return 'null';
    if (value === undefined) return '';
    if (typeof value === 'object') {
      return JSON.stringify(value).substring(0, 50) + '...';
    }
    return String(value);
  }
}
```

### 5.5 Create Changes Toolbar and Pagination Components

Create the remaining components following patterns from `docs/features/crud-operations.md` and `docs/features/query-editor.md`.

### 5.6 Create Query Page Container

Create `src/app/features/query-editor/containers/query-page/query-page.component.ts`:

```typescript
import { Component, inject, OnInit, OnDestroy, effect } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { QueryInputComponent } from '../../components/query-input/query-input.component';
import { ResultsTableComponent } from '../../components/results-table/results-table.component';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { ErrorDisplayComponent } from '../../../../shared/components/error-display/error-display.component';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { QueryStore } from '../../store/query.store';
import { DocumentsStore } from '../../store/documents.store';
import { ExplorerStore } from '../../../explorer/store/explorer.store';

@Component({
  selector: 'app-query-page',
  standalone: true,
  imports: [
    QueryInputComponent,
    ResultsTableComponent,
    LoadingSpinnerComponent,
    ErrorDisplayComponent,
  ],
  template: `
    <div class="query-page">
      <!-- Query Input -->
      <section class="query-section">
        <app-query-input
          [query]="queryStore.query"
          [isExecuting]="queryStore.isExecuting"
          [history]="queryStore.queryHistory"
          (queryChange)="queryStore.setQuery($event)"
          (execute)="onExecute()"
        />
      </section>

      <!-- Results Section -->
      <section class="results-section">
        @if (queryStore.isExecuting() && queryStore.isEmpty()) {
          <app-loading-spinner message="Executing query..." />
        } @else if (queryStore.error()) {
          <app-error-display
            [message]="queryStore.error()!"
            (dismiss)="queryStore.clearError()"
          />
        } @else if (queryStore.isEmpty()) {
          <div class="empty-state">
            <p>No results. Execute a query to see documents.</p>
          </div>
        } @else {
          <div class="results-header">
            <span>{{ queryStore.resultCount() }} documents</span>
            <span class="separator">|</span>
            <span>{{ queryStore.requestCharge() | number:'1.2-2' }} RU</span>
            @if (queryStore.executionTime()) {
              <span class="separator">|</span>
              <span>{{ queryStore.executionTime() | number:'1.0-0' }} ms</span>
            }
          </div>

          <app-results-table
            [documents]="queryStore.flattenedResults"
            [columns]="queryStore.columns"
            [isCellDirty]="documentsStore.isCellDirty"
            [isPendingDelete]="documentsStore.isPendingDelete"
            (cellEdit)="onCellEdit($event)"
            (deleteDoc)="onDeleteDoc($event)"
            (undoDelete)="onUndoDelete($event)"
          />

          @if (queryStore.hasMoreResults()) {
            <div class="load-more">
              <button mat-stroked-button
                      [disabled]="queryStore.isExecuting()"
                      (click)="onLoadMore()">
                Load More Results
              </button>
            </div>
          }
        }
      </section>

      <!-- Changes Toolbar -->
      @if (documentsStore.hasDirtyChanges()) {
        <div class="changes-toolbar">
          <span class="changes-summary">
            {{ documentsStore.changesSummary().modified }} modified,
            {{ documentsStore.changesSummary().deleted }} deleted,
            {{ documentsStore.changesSummary().created }} new
          </span>
          <button mat-button (click)="onDiscardChanges()">Discard All</button>
          <button mat-raised-button color="primary"
                  [disabled]="documentsStore.isSaving()"
                  (click)="onCommitChanges()">
            Commit Changes
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .query-page {
      display: flex;
      flex-direction: column;
      height: 100%;
      padding: 16px;
    }
    .query-section {
      margin-bottom: 16px;
    }
    .results-section {
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .results-header {
      padding: 8px 0;
      color: #888;
      font-size: 13px;
    }
    .separator {
      margin: 0 8px;
    }
    .empty-state {
      text-align: center;
      padding: 48px;
      color: #888;
    }
    .load-more {
      padding: 16px;
      text-align: center;
    }
    .changes-toolbar {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background-color: #2d2d2d;
      border-top: 1px solid #3c3c3c;
      margin-top: auto;
    }
    .changes-summary {
      flex: 1;
      color: #ffc107;
    }
  `],
})
export class QueryPageComponent implements OnInit, OnDestroy {
  queryStore = inject(QueryStore);
  documentsStore = inject(DocumentsStore);
  private explorerStore = inject(ExplorerStore);
  private dialog = inject(MatDialog);

  constructor() {
    // Track documents when results change
    effect(() => {
      const results = this.queryStore.results();
      if (results.length > 0) {
        this.documentsStore.trackDocuments(results);
      }
    });
  }

  ngOnInit() {
    // Auto-execute query on load
    this.onExecute();
  }

  ngOnDestroy() {
    // Warn about unsaved changes
    if (this.documentsStore.hasDirtyChanges()) {
      // In a real app, use a guard to prevent navigation
      console.warn('Unsaved changes will be lost');
    }
  }

  onExecute() {
    this.queryStore.executeQuery({ pageSize: 100 });
  }

  onLoadMore() {
    this.queryStore.loadMoreResults({ pageSize: 100 });
  }

  onCellEdit(event: { documentId: string; path: string; value: any }) {
    // For now, just log - full inline editing in Phase 6
    console.log('Cell edit:', event);
  }

  onDeleteDoc(documentId: string) {
    this.documentsStore.markForDeletion(documentId);
  }

  onUndoDelete(documentId: string) {
    this.documentsStore.unmarkDeletion(documentId);
  }

  onCommitChanges() {
    this.documentsStore.commitChanges();
  }

  onDiscardChanges() {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Discard Changes',
        message: 'Are you sure you want to discard all pending changes?',
        confirmText: 'Discard',
        confirmColor: 'warn',
      },
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.documentsStore.discardAllChanges();
      }
    });
  }
}
```

## Verification

1. Run the app and connect to a Cosmos DB
2. Select a container
3. Verify:
   - Query editor appears with Monaco
   - Default query executes
   - Results display in table
   - Load More works for pagination
   - Delete marks rows with strikethrough
   - Changes toolbar appears
   - Commit saves changes
   - Discard clears changes

## Checklist

- [ ] QueryStore with execute and pagination
- [ ] DocumentsStore with dirty tracking
- [ ] QueryInputComponent with Monaco Editor
- [ ] ResultsTableComponent with dirty highlighting
- [ ] QueryPageComponent orchestrating
- [ ] F5 shortcut executes query
- [ ] Query history works
- [ ] Pagination with continuation token
- [ ] Delete marks documents
- [ ] Commit saves changes
- [ ] Discard clears changes

## Next Phase

Proceed to [Phase 6: Polish](./phase-6-polish.md)
