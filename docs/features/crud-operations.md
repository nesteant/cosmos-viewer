# Feature: CRUD Operations

## Overview

This feature enables Create, Read, Update, and Delete operations on Cosmos DB documents with cell-level change tracking, visual dirty state indication, and batch commit/discard functionality.

## User Stories

1. **As a user**, I want to edit cell values inline so I can quickly update documents
2. **As a user**, I want to see which cells I've modified (dirty state)
3. **As a user**, I want to revert individual cell changes
4. **As a user**, I want to add new documents
5. **As a user**, I want to delete documents
6. **As a user**, I want to commit all my changes at once
7. **As a user**, I want to discard all changes without saving
8. **As a user**, I want to see save progress and errors

## UI Design

### Results Table with Editing

```
┌─────────────────────────────────────────────────────────────────────────┐
│ │ ☐ │ id       │ name     │ email          │ status   │ age  │ actions │
│ ├───┼──────────┼──────────┼────────────────┼──────────┼──────┼─────────│
│ │ ☐ │ user-001 │ Alice    │ alice@mail.com │ active   │ 28   │ [···]   │
│ │ ☐ │ user-002 │ Bob*     │ bob@mail.com   │ active   │ 32*  │ [···]   │  ← dirty cells
│ │ ☐ │ user-003 │ Carol    │ carol@mail.com │ inactive*│ 25   │ [···]   │
│ │ 🗑 │ user-004 │ ~~~~~~   │ ~~~~~~~~~~~~~~  │ ~~~~~~~~ │ ~~~~ │ [···]   │  ← pending delete
│ │ ➕ │ user-005*│ New User*│ new@mail.com*  │ active*  │ 30*  │ [···]   │  ← new document
│ └───┴──────────┴──────────┴────────────────┴──────────┴──────┴─────────┘

Legend:
  * = modified cell (yellow highlight)
  🗑 = pending deletion (strikethrough)
  ➕ = new document (green highlight)
```

### Inline Cell Editing

```
┌──────────────────┐
│ status           │
├──────────────────┤
│ ┌──────────────┐ │
│ │ inactive   ▼ │ │  ← dropdown for known values
│ └──────────────┘ │
│                  │
│ [Cancel] [Apply] │
└──────────────────┘

┌──────────────────┐
│ name             │
├──────────────────┤
│ ┌──────────────┐ │
│ │ Alice Smith  │ │  ← text input for strings
│ └──────────────┘ │
│                  │
│ [Cancel] [Apply] │
└──────────────────┘

┌──────────────────┐
│ age              │
├──────────────────┤
│ ┌──────────────┐ │
│ │ 28         ↕ │ │  ← number input
│ └──────────────┘ │
│                  │
│ [Cancel] [Apply] │
└──────────────────┘
```

### Full Document Editor Dialog

```
┌────────────────────────────────────────────────────────────────┐
│ Edit Document: user-002                                    [X] │
├────────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ {                                                          │ │
│ │   "id": "user-002",                                        │ │
│ │   "name": "Bob",                                           │ │
│ │   "email": "bob@mail.com",                                 │ │
│ │   "status": "active",                                      │ │
│ │   "age": 32,                                               │ │
│ │   "address": {                                             │ │
│ │     "city": "Los Angeles",                                 │ │
│ │     "zip": "90001"                                         │ │
│ │   }                                                        │ │
│ │ }                                                          │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                │
│ ⚠ JSON is valid                                               │
│                                                                │
│                              [Cancel]  [Save to Pending]       │
└────────────────────────────────────────────────────────────────┘
```

### Changes Toolbar

```
┌────────────────────────────────────────────────────────────────────────┐
│ ⚠ 3 changes: 2 modified, 1 deleted, 0 new    [Discard All] [Commit ▶] │
└────────────────────────────────────────────────────────────────────────┘

During save:
┌────────────────────────────────────────────────────────────────────────┐
│ Saving... 2/3 complete  [████████████░░░░░░░]                          │
└────────────────────────────────────────────────────────────────────────┘

With errors:
┌────────────────────────────────────────────────────────────────────────┐
│ ⚠ 1 error: user-004 - Conflict: Document was modified     [Retry] [X] │
└────────────────────────────────────────────────────────────────────────┘
```

### Row Actions Menu

```
┌─────────────────────┐
│ ✏️ Edit Full Doc     │
│ ↩️ Revert Changes    │
│ ─────────────────── │
│ 📋 Copy as JSON     │
│ 📋 Copy ID          │
│ ─────────────────── │
│ 🗑️ Delete           │
└─────────────────────┘
```

## Components

### ResultsTableComponent

```typescript
@Component({
  selector: 'app-results-table',
  standalone: true,
  imports: [
    MatTableModule,
    MatCheckboxModule,
    MatIconModule,
    MatMenuModule,
    EditableCellComponent,
  ],
  template: `
    <table mat-table [dataSource]="documents()">
      <!-- Checkbox Column -->
      <ng-container matColumnDef="select">
        <th mat-header-cell *matHeaderCellDef>
          <mat-checkbox (change)="toggleSelectAll()" />
        </th>
        <td mat-cell *matCellDef="let doc"
            [class.pending-delete]="isPendingDelete(doc.id)">
          <mat-checkbox
            [checked]="isSelected(doc.id)"
            (change)="toggleSelect(doc.id)"
          />
        </td>
      </ng-container>

      <!-- Dynamic Columns -->
      @for (column of columns(); track column.key) {
        <ng-container [matColumnDef]="column.key">
          <th mat-header-cell *matHeaderCellDef>
            {{ column.displayName }}
          </th>
          <td mat-cell *matCellDef="let doc"
              [class.dirty]="isCellDirty(doc.id, column.key)"
              [class.pending-delete]="isPendingDelete(doc.id)"
              [class.new-row]="isNewDocument(doc.id)">
            <app-editable-cell
              [value]="getValue(doc, column.key)"
              [type]="column.type"
              [isDirty]="isCellDirty(doc.id, column.key)"
              [isNested]="column.isNested"
              [disabled]="isPendingDelete(doc.id)"
              (valueChange)="onCellChange(doc.id, column.key, $event)"
              (revert)="onCellRevert(doc.id, column.key)"
            />
          </td>
        </ng-container>
      }

      <!-- Actions Column -->
      <ng-container matColumnDef="actions">
        <th mat-header-cell *matHeaderCellDef></th>
        <td mat-cell *matCellDef="let doc">
          <button mat-icon-button [matMenuTriggerFor]="rowMenu">
            <mat-icon>more_vert</mat-icon>
          </button>
          <mat-menu #rowMenu="matMenu">
            <button mat-menu-item (click)="editFullDoc.emit(doc.id)">
              <mat-icon>edit</mat-icon> Edit Full Doc
            </button>
            <button mat-menu-item
                    [disabled]="!hasChanges(doc.id)"
                    (click)="revertDoc.emit(doc.id)">
              <mat-icon>undo</mat-icon> Revert Changes
            </button>
            <mat-divider />
            <button mat-menu-item (click)="copyJson.emit(doc)">
              <mat-icon>content_copy</mat-icon> Copy as JSON
            </button>
            <mat-divider />
            <button mat-menu-item
                    class="delete-action"
                    (click)="deleteDoc.emit(doc.id)">
              <mat-icon>delete</mat-icon> Delete
            </button>
          </mat-menu>
        </td>
      </ng-container>

      <tr mat-header-row *matHeaderRowDef="displayedColumns()"></tr>
      <tr mat-row *matRowDef="let row; columns: displayedColumns()"></tr>
    </table>
  `,
  styles: [`
    .dirty {
      background-color: rgba(255, 193, 7, 0.15);
      border-left: 3px solid #ffc107;
    }
    .pending-delete {
      background-color: rgba(244, 67, 54, 0.1);
      text-decoration: line-through;
      opacity: 0.7;
    }
    .new-row {
      background-color: rgba(76, 175, 80, 0.1);
      border-left: 3px solid #4caf50;
    }
    .delete-action {
      color: #f44336;
    }
  `],
})
export class ResultsTableComponent {
  @Input({ required: true }) documents!: Signal<FlatDocument[]>;
  @Input({ required: true }) columns!: Signal<ColumnDefinition[]>;
  @Input({ required: true }) dirtyPaths!: Signal<Record<string, Set<string>>>;
  @Input() pendingDeletions: Signal<Set<string>> = signal(new Set());
  @Input() newDocumentIds: Signal<Set<string>> = signal(new Set());

  @Output() cellEdit = new EventEmitter<CellEditEvent>();
  @Output() cellRevert = new EventEmitter<CellRevertEvent>();
  @Output() rowDelete = new EventEmitter<string>();
  @Output() rowRevert = new EventEmitter<string>();
  @Output() editFullDoc = new EventEmitter<string>();
  @Output() copyJson = new EventEmitter<CosmosDocument>();

  displayedColumns = computed(() => [
    'select',
    ...this.columns().map(c => c.key),
    'actions',
  ]);

  isCellDirty(docId: string, path: string): boolean {
    return this.dirtyPaths()[docId]?.has(path) ?? false;
  }

  isPendingDelete(docId: string): boolean {
    return this.pendingDeletions().has(docId);
  }

  isNewDocument(docId: string): boolean {
    return this.newDocumentIds().has(docId);
  }

  getValue(doc: FlatDocument, path: string): any {
    return doc[path];
  }

  onCellChange(docId: string, path: string, value: any) {
    this.cellEdit.emit({ documentId: docId, path, value });
  }

  onCellRevert(docId: string, path: string) {
    this.cellRevert.emit({ documentId: docId, path });
  }
}
```

### EditableCellComponent

```typescript
@Component({
  selector: 'app-editable-cell',
  standalone: true,
  imports: [
    FormsModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    JsonViewerComponent,
  ],
  template: `
    @if (isEditing) {
      <div class="cell-editor">
        @switch (type) {
          @case ('string') {
            <input matInput [(ngModel)]="editValue" (keyup.enter)="save()" />
          }
          @case ('number') {
            <input matInput type="number" [(ngModel)]="editValue" />
          }
          @case ('boolean') {
            <mat-select [(ngModel)]="editValue">
              <mat-option [value]="true">true</mat-option>
              <mat-option [value]="false">false</mat-option>
            </mat-select>
          }
          @case ('object') {
            <app-json-viewer [value]="editValue" [editable]="true"
                             (valueChange)="editValue = $event" />
          }
          @default {
            <input matInput [(ngModel)]="editValue" />
          }
        }
        <div class="cell-actions">
          <button mat-icon-button (click)="cancel()">
            <mat-icon>close</mat-icon>
          </button>
          <button mat-icon-button color="primary" (click)="save()">
            <mat-icon>check</mat-icon>
          </button>
        </div>
      </div>
    } @else {
      <div class="cell-display"
           [class.disabled]="disabled"
           (dblclick)="startEdit()">
        @if (isNested) {
          <span class="nested-indicator" (click)="showNested()">
            {{ displayValue }}
            <mat-icon>unfold_more</mat-icon>
          </span>
        } @else {
          <span>{{ displayValue }}</span>
        }

        @if (isDirty && !disabled) {
          <button mat-icon-button class="revert-btn" (click)="revert.emit()">
            <mat-icon>undo</mat-icon>
          </button>
        }
      </div>
    }
  `,
  styles: [`
    .cell-display {
      display: flex;
      align-items: center;
      gap: 4px;
      cursor: pointer;
    }
    .cell-display:hover .revert-btn {
      opacity: 1;
    }
    .revert-btn {
      opacity: 0;
      transition: opacity 0.2s;
    }
    .nested-indicator {
      display: flex;
      align-items: center;
      color: #666;
    }
    .cell-editor {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .disabled {
      pointer-events: none;
      opacity: 0.5;
    }
  `],
})
export class EditableCellComponent {
  @Input({ required: true }) value: any;
  @Input() type: string = 'string';
  @Input() isDirty = false;
  @Input() isNested = false;
  @Input() disabled = false;

  @Output() valueChange = new EventEmitter<any>();
  @Output() revert = new EventEmitter<void>();

  isEditing = false;
  editValue: any;

  get displayValue(): string {
    if (this.value === null) return 'null';
    if (this.value === undefined) return '';
    if (typeof this.value === 'object') {
      return JSON.stringify(this.value).substring(0, 30) + '...';
    }
    return String(this.value);
  }

  startEdit() {
    if (this.disabled) return;
    this.editValue = structuredClone(this.value);
    this.isEditing = true;
  }

  save() {
    this.valueChange.emit(this.editValue);
    this.isEditing = false;
  }

  cancel() {
    this.isEditing = false;
  }

  showNested() {
    // Open dialog with full JSON editor
  }
}
```

### ChangesToolbarComponent

```typescript
@Component({
  selector: 'app-changes-toolbar',
  standalone: true,
  imports: [MatButtonModule, MatProgressBarModule, MatIconModule],
  template: `
    @if (hasDirtyChanges()) {
      <div class="changes-toolbar">
        @if (isSaving()) {
          <div class="save-progress">
            <span>Saving... {{ saveProgress()?.completed }}/{{ saveProgress()?.total }}</span>
            <mat-progress-bar mode="determinate"
              [value]="(saveProgress()?.completed ?? 0) / (saveProgress()?.total ?? 1) * 100" />
          </div>
        } @else if (saveErrors().length > 0) {
          <div class="save-errors">
            <mat-icon color="warn">error</mat-icon>
            <span>{{ saveErrors().length }} error(s)</span>
            <button mat-button (click)="showErrors.emit()">View Details</button>
            <button mat-button (click)="commit.emit()">Retry</button>
          </div>
        } @else {
          <div class="changes-summary">
            <mat-icon>warning</mat-icon>
            <span>
              {{ changesSummary().modified }} modified,
              {{ changesSummary().deleted }} deleted,
              {{ changesSummary().created }} new
            </span>
          </div>
          <div class="changes-actions">
            <button mat-button (click)="discard.emit()">
              Discard All
            </button>
            <button mat-raised-button color="primary" (click)="commit.emit()">
              Commit Changes
            </button>
          </div>
        }
      </div>
    }
  `,
})
export class ChangesToolbarComponent {
  @Input({ required: true }) hasDirtyChanges!: Signal<boolean>;
  @Input({ required: true }) changesSummary!: Signal<ChangesSummary>;
  @Input({ required: true }) isSaving!: Signal<boolean>;
  @Input() saveProgress: Signal<SaveProgress | null> = signal(null);
  @Input() saveErrors: Signal<SaveError[]> = signal([]);

  @Output() commit = new EventEmitter<void>();
  @Output() discard = new EventEmitter<void>();
  @Output() showErrors = new EventEmitter<void>();
}
```

## Store: DocumentsStore

See [ADR-005: Dirty State Tracking](../adr/005-dirty-state-tracking.md) for full implementation details.

### Key Methods

| Method | Purpose |
|--------|---------|
| `trackDocuments(docs)` | Initialize tracking for query results |
| `updateCell(docId, path, value)` | Update cell and track dirty state |
| `revertCell(docId, path)` | Revert cell to original value |
| `revertDocument(docId)` | Revert all changes for a document |
| `markForDeletion(docId)` | Mark document for deletion |
| `unmarkDeletion(docId)` | Remove deletion mark |
| `addNewDocument(doc)` | Add new document to pending creates |
| `removeNewDocument(index)` | Remove pending new document |
| `commitChanges()` | Batch commit all pending changes |
| `discardAllChanges()` | Discard all pending changes |

### Batch Commit Flow

```
commitChanges()
    │
    ├─► For each modified document:
    │     electronService.updateDocument(doc)
    │     └─► Updates doc in Cosmos DB
    │
    ├─► For each pending deletion:
    │     electronService.deleteDocument(id, partitionKey)
    │     └─► Deletes doc from Cosmos DB
    │
    └─► For each new document:
          electronService.createDocument(doc)
          └─► Creates doc in Cosmos DB
    │
    ▼
On All Success:
    - Clear modifiedDocuments
    - Clear dirtyPaths
    - Clear pendingDeletions
    - Clear newDocuments
    - Re-execute query to refresh

On Partial Failure:
    - Track errors per document
    - Keep failed operations in pending state
    - Show error UI for retry
```

## Error Handling

| Error | Handling |
|-------|----------|
| 409 Conflict | Show "Document was modified externally" - offer refresh or force save |
| 404 Not Found | Show "Document no longer exists" - remove from table |
| 401 Unauthorized | Session expired - redirect to reconnect |
| 429 Too Many Requests | Show throttling message - retry with backoff |
| Network Error | Show connection error - offer retry |

## Testing Checklist

- [ ] Double-click cell enters edit mode
- [ ] Escape cancels edit
- [ ] Enter saves edit
- [ ] Edited cells show yellow highlight
- [ ] Revert button appears on dirty cells
- [ ] Revert restores original value
- [ ] Delete marks row with strikethrough
- [ ] Undo delete removes strikethrough
- [ ] Add New creates green highlighted row
- [ ] Changes toolbar shows correct counts
- [ ] Commit saves all changes to Cosmos DB
- [ ] Discard clears all pending changes
- [ ] Progress bar shows during save
- [ ] Errors display with retry option
- [ ] Table refreshes after successful commit
