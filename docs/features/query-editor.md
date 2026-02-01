# Feature: Query Editor

## Overview

The Query Editor allows users to write and execute CosmosSQL queries against the selected container. Results are displayed in an interactive table with support for pagination using continuation tokens.

## User Stories

1. **As a user**, I want to write SQL queries to retrieve documents
2. **As a user**, I want to see query results in a table format
3. **As a user**, I want to paginate through large result sets
4. **As a user**, I want to see query execution metrics (RU, time)
5. **As a user**, I want to expand nested JSON objects in cells
6. **As a user**, I want to access my recent query history
7. **As a user**, I want to format/prettify my query

## UI Design

### Query Editor Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│ mydb > users                                              [Import] [Export]│
├──────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────────────────┐ │
│ │ 1  SELECT * FROM c                                                   │ │
│ │ 2  WHERE c.status = "active"                                         │ │
│ │ 3  ORDER BY c.createdAt DESC                                         │ │
│ │ 4                                                                    │ │
│ │ ~                                                                    │ │
│ └──────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│ [▶ Execute (F5)]  [Format]  [History ▾]              Query: 156 chars   │
├──────────────────────────────────────────────────────────────────────────┤
│ Results: 147 documents (page 1)                    2.34 RU  │  124 ms   │
├──────────────────────────────────────────────────────────────────────────┤
│ │ ☐ │ id       │ name     │ email          │ status │ address     │ ··· │
│ ├───┼──────────┼──────────┼────────────────┼────────┼─────────────┼─────│
│ │ ☐ │ user-001 │ Alice    │ alice@mail.com │ active │ {city: NY}  │     │
│ │ ☐ │ user-002 │ Bob      │ bob@mail.com   │ active │ {city: LA}  │     │
│ │ ☐ │ user-003 │ Carol    │ carol@mail.com │ active │ {city: CHI} │     │
│ │ ☐ │ user-004 │ David    │ david@mail.com │ active │ {city: SF}  │     │
│ │ ☐ │ user-005 │ Eve      │ eve@mail.com   │ active │ {city: BOS} │     │
│ │ · │ ·        │ ·        │ ·              │ ·      │ ·           │     │
│ │ · │ ·        │ ·        │ ·              │ ·      │ ·           │     │
│ └───┴──────────┴──────────┴────────────────┴────────┴─────────────┴─────┘
│                                                                          │
│                                          [Load More Results (47 more)]   │
├──────────────────────────────────────────────────────────────────────────┤
│ ⚠ 0 changes                                                              │
└──────────────────────────────────────────────────────────────────────────┘
```

### Nested Value Expansion

```
┌────────────────────────┐
│ address                │
├────────────────────────┤
│ {                      │
│   "city": "New York",  │
│   "zip": "10001",      │
│   "country": "USA"     │
│ }                      │
│                        │
│ [Copy] [Edit Full Doc] │
└────────────────────────┘
```

### Query History Dropdown

```
┌─────────────────────────────────────────────────────────────┐
│ Recent Queries                                              │
├─────────────────────────────────────────────────────────────┤
│ SELECT * FROM c WHERE c.status = "active"       2 min ago  │
│ SELECT c.id, c.name FROM c                      15 min ago │
│ SELECT * FROM c ORDER BY c.createdAt DESC       1 hour ago │
│ SELECT COUNT(1) FROM c                          Yesterday  │
└─────────────────────────────────────────────────────────────┘
```

## Components

### Smart Components (Containers)

#### QueryPageComponent
- **Location**: `features/query-editor/containers/query-page/`
- **Responsibilities**:
  - Inject `QueryStore`, `DocumentsStore`, `ExplorerStore`
  - Coordinate query execution
  - Handle CRUD operations
  - Manage import/export dialogs

```typescript
@Component({
  selector: 'app-query-page',
  standalone: true,
  imports: [
    QueryInputComponent,
    ResultsTableComponent,
    PaginationControlsComponent,
    ChangesToolbarComponent,
  ],
  templateUrl: './query-page.component.html',
})
export class QueryPageComponent implements OnInit {
  private queryStore = inject(QueryStore);
  private documentsStore = inject(DocumentsStore);
  private explorerStore = inject(ExplorerStore);

  // Query state
  query = this.queryStore.query;
  isExecuting = this.queryStore.isExecuting;
  queryHistory = this.queryStore.queryHistory;

  // Results state
  results = this.queryStore.flattenedResults;
  columns = this.queryStore.columns;
  hasMoreResults = this.queryStore.hasMoreResults;
  resultCount = computed(() => this.queryStore.results().length);
  executionTime = this.queryStore.executionTime;
  requestCharge = this.queryStore.requestCharge;

  // Document editing state
  dirtyPaths = this.documentsStore.dirtyPaths;
  hasDirtyChanges = this.documentsStore.hasDirtyChanges;
  changesSummary = this.documentsStore.changesSummary;
  isSaving = this.documentsStore.isSaving;

  // Container info
  selectedContainer = this.explorerStore.selectedContainer;
  selectedDatabase = this.explorerStore.selectedDatabase;

  ngOnInit() {
    // Auto-execute default query on load
    this.queryStore.executeQuery({ pageSize: 100 });
  }

  onQueryChange(query: string) {
    this.queryStore.setQuery(query);
  }

  onExecute() {
    this.queryStore.executeQuery({ pageSize: 100 });
  }

  onLoadMore() {
    this.queryStore.loadMoreResults({ pageSize: 100 });
  }

  onCellEdit(event: CellEditEvent) {
    this.documentsStore.updateCell(event.documentId, event.path, event.value);
  }

  onCommitChanges() {
    this.documentsStore.commitChanges();
  }

  onDiscardChanges() {
    this.documentsStore.discardAllChanges();
  }
}
```

### Presentational Components

#### QueryInputComponent
- **Location**: `features/query-editor/components/query-input/`
- **Inputs**: `query`, `isExecuting`, `history`
- **Outputs**: `queryChange`, `execute`, `format`, `historySelect`
- Uses Monaco Editor for query input

```typescript
@Component({
  selector: 'app-query-input',
  standalone: true,
  imports: [FormsModule, MonacoEditorModule, MatButtonModule, MatMenuModule],
  template: `
    <div class="query-editor-container">
      <ngx-monaco-editor
        [options]="editorOptions"
        [(ngModel)]="queryValue"
        (ngModelChange)="onQueryChange($event)"
        (onInit)="onEditorInit($event)"
      />
    </div>
    <div class="query-toolbar">
      <button mat-raised-button color="primary"
              [disabled]="isExecuting()"
              (click)="execute.emit()">
        <mat-icon>play_arrow</mat-icon>
        Execute (F5)
      </button>
      <button mat-button (click)="formatQuery()">
        Format
      </button>
      <button mat-button [matMenuTriggerFor]="historyMenu">
        History
        <mat-icon>arrow_drop_down</mat-icon>
      </button>
      <mat-menu #historyMenu="matMenu">
        @for (item of history(); track item.executedAt) {
          <button mat-menu-item (click)="historySelect.emit(item.query)">
            <span class="query-preview">{{ item.query | truncate:50 }}</span>
            <span class="query-time">{{ item.executedAt | date:'short' }}</span>
          </button>
        }
      </mat-menu>
    </div>
  `,
})
export class QueryInputComponent {
  @Input({ required: true }) query!: Signal<string>;
  @Input({ required: true }) isExecuting!: Signal<boolean>;
  @Input() history: Signal<QueryHistoryItem[]> = signal([]);

  @Output() queryChange = new EventEmitter<string>();
  @Output() execute = new EventEmitter<void>();
  @Output() format = new EventEmitter<void>();
  @Output() historySelect = new EventEmitter<string>();

  queryValue = '';

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
  };

  private editor: any;

  constructor() {
    effect(() => {
      this.queryValue = this.query();
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

    // Ctrl+Shift+F to format
    editor.addAction({
      id: 'format-query',
      label: 'Format Query',
      keybindings: [
        monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF
      ],
      run: () => this.formatQuery(),
    });
  }

  onQueryChange(query: string) {
    this.queryChange.emit(query);
  }

  formatQuery() {
    // Basic SQL formatting
    const formatted = this.queryValue
      .replace(/\s+/g, ' ')
      .replace(/(SELECT|FROM|WHERE|AND|OR|ORDER BY|GROUP BY|HAVING|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AS)/gi,
        '\n$1')
      .trim();
    this.queryValue = formatted;
    this.queryChange.emit(formatted);
  }
}
```

#### ResultsTableComponent
- **Location**: `features/query-editor/components/results-table/`
- **Inputs**: `documents`, `columns`, `dirtyPaths`
- **Outputs**: `cellEdit`, `rowDelete`, `rowSelect`

See [CRUD Operations](./crud-operations.md) for detailed implementation.

#### PaginationControlsComponent
- **Location**: `features/query-editor/components/pagination-controls/`
- **Inputs**: `hasMore`, `isLoading`, `currentCount`, `requestCharge`, `executionTime`
- **Outputs**: `loadMore`

```typescript
@Component({
  selector: 'app-pagination-controls',
  standalone: true,
  imports: [MatButtonModule, MatProgressSpinnerModule],
  template: `
    <div class="pagination-bar">
      <div class="stats">
        <span class="result-count">{{ currentCount() }} documents</span>
        <span class="separator">|</span>
        <span class="ru">{{ requestCharge() | number:'1.2-2' }} RU</span>
        <span class="separator">|</span>
        <span class="time">{{ executionTime() | number:'1.0-0' }} ms</span>
      </div>

      @if (hasMore()) {
        <button mat-stroked-button
                [disabled]="isLoading()"
                (click)="loadMore.emit()">
          @if (isLoading()) {
            <mat-spinner diameter="20" />
          } @else {
            Load More Results
          }
        </button>
      }
    </div>
  `,
})
export class PaginationControlsComponent {
  @Input({ required: true }) hasMore!: Signal<boolean>;
  @Input({ required: true }) isLoading!: Signal<boolean>;
  @Input({ required: true }) currentCount!: Signal<number>;
  @Input() requestCharge: Signal<number> = signal(0);
  @Input() executionTime: Signal<number | null> = signal(null);

  @Output() loadMore = new EventEmitter<void>();
}
```

## Store

### QueryStore State

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

interface ColumnDefinition {
  key: string;              // JSON path (e.g., "address.city")
  displayName: string;      // Human readable
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null';
  isNested: boolean;
  width?: number;
}

interface QueryHistoryItem {
  query: string;
  executedAt: Date;
  databaseId: string;
  containerId: string;
}
```

### Computed Signals

```typescript
// Flatten documents for table display
flattenedResults: computed(() => {
  return results().map(doc => flattenDocument(doc, columns()));
})

// Column keys for table headers
columnKeys: computed(() => columns().map(c => c.key))

// Check if results are empty
isEmpty: computed(() => results().length === 0)
```

### Methods

| Method | Purpose |
|--------|---------|
| `setQuery(query)` | Update query text |
| `executeQuery({ pageSize })` | Execute query (resets results) |
| `loadMoreResults({ pageSize })` | Load next page using continuation token |
| `addToHistory(query)` | Save query to history |
| `clearResults()` | Clear current results |

## Column Detection

The `column-detector.ts` utility automatically detects columns from documents:

```typescript
export function detectColumns(documents: CosmosDocument[]): ColumnDefinition[] {
  const columnMap = new Map<string, ColumnDefinition>();

  for (const doc of documents) {
    extractPaths(doc, '', columnMap);
  }

  // Sort: id first, then system fields last
  return Array.from(columnMap.values()).sort((a, b) => {
    if (a.key === 'id') return -1;
    if (b.key === 'id') return 1;
    if (a.key.startsWith('_') && !b.key.startsWith('_')) return 1;
    if (!a.key.startsWith('_') && b.key.startsWith('_')) return -1;
    return a.key.localeCompare(b.key);
  });
}

function extractPaths(
  obj: any,
  prefix: string,
  map: Map<string, ColumnDefinition>
) {
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

    // Recurse into objects (but not too deep)
    if (type === 'object' && prefix.split('.').length < 3) {
      extractPaths(value, path, map);
    }
  }
}
```

## Pagination

Cosmos DB uses continuation tokens for pagination:

```typescript
executeQuery: rxMethod<{ pageSize: number }>(
  pipe(
    switchMap(({ pageSize }) => {
      return from(electronService.executeQuery({
        connectionId: connection.id,
        databaseId: database.id,
        containerId: container.id,
        query: store.query(),
        pageSize,
        continuationToken: null,  // First page
      }));
    }),
    tapResponse({
      next: (result) => {
        // Initialize document tracking
        documentsStore.trackDocuments(result.documents);

        patchState(store, {
          results: result.documents,
          columns: detectColumns(result.documents),
          continuationToken: result.continuationToken,
          hasMoreResults: result.hasMoreResults,
          requestCharge: result.requestCharge,
        });
      },
      error: (err) => { /* handle */ },
    })
  )
)

loadMoreResults: rxMethod<{ pageSize: number }>(
  pipe(
    filter(() => store.hasMoreResults() && !store.isExecuting()),
    switchMap(({ pageSize }) => {
      return from(electronService.executeQuery({
        // ... same params
        continuationToken: store.continuationToken(),  // Use token
      }));
    }),
    tapResponse({
      next: (result) => {
        // Track new documents
        documentsStore.trackDocuments(result.documents);

        // Merge columns
        const newColumns = detectColumns(result.documents);
        const merged = mergeColumns(store.columns(), newColumns);

        patchState(store, {
          results: [...store.results(), ...result.documents],
          columns: merged,
          continuationToken: result.continuationToken,
          hasMoreResults: result.hasMoreResults,
          requestCharge: store.requestCharge() + result.requestCharge,
        });
      },
      error: (err) => { /* handle */ },
    })
  )
)
```

## Testing Checklist

- [ ] Query executes on page load
- [ ] Results display in table
- [ ] Columns detected from documents
- [ ] Nested objects show expand icon
- [ ] Load More fetches next page
- [ ] Continuation token handled correctly
- [ ] RU and timing metrics displayed
- [ ] Query history saves and restores
- [ ] History dropdown shows recent queries
- [ ] F5 keyboard shortcut works
- [ ] Format button prettifies SQL
- [ ] Error messages display for bad queries
