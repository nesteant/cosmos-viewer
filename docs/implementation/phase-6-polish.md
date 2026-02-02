# Phase 6: Polish

## Overview

This final phase adds polish features including inline cell editing, import/export, keyboard shortcuts, and overall UX improvements.

## Completed Features

The following features have been implemented:
- ✅ **Document Editing** - Via dialog with full JSON support
- ✅ **Import/Export** - JSON and CSV support via ImportExportService
- ✅ **Multiple Query Tabs** - With persistence across sessions
- ✅ **Column Management** - Visibility, reorder, pin, container presets
- ✅ **Table Sorting** - Click-to-sort with asc/desc/none cycle
- ✅ **Table Filtering** - Global search + per-column filters
- ✅ **Query Analyzer** - Index metrics, RU cost, execution time
- ✅ **Dirty State Tracking** - Cell-level highlighting with revert

## Remaining Steps

### 6.3 Add Keyboard Shortcuts Dialog

Create `src/app/shared/components/shortcuts-dialog/shortcuts-dialog.component.ts` to show available keyboard shortcuts.

### 6.4 Add Unsaved Changes Guard

Create `src/app/core/guards/unsaved-changes.guard.ts` to warn users before leaving with dirty changes.

### 6.5 Add Loading Skeletons

Create `src/app/shared/components/skeleton/skeleton.component.ts` for shimmer loading effects.

---

## Reference Implementation (Already Complete)

### 6.1 Inline Cell Editing (✅ Implemented via Dialog)

The app uses `DocumentDialogComponent` and `FieldEditorDialogComponent` for editing:

```typescript
// Add to results-table.component.ts
@Component({
  // ... existing config
  template: `
    <!-- Cell template update -->
    <td mat-cell *matCellDef="let doc"
        [class.dirty]="isCellDirty()(doc.id, column.key)"
        [class.editing]="editingCell?.docId === doc.id && editingCell?.path === column.key">

      @if (editingCell?.docId === doc.id && editingCell?.path === column.key) {
        <!-- Edit mode -->
        <div class="cell-editor">
          @switch (column.type) {
            @case ('number') {
              <input type="number"
                     [ngModel]="editValue"
                     (ngModelChange)="editValue = $event"
                     (keyup.enter)="saveEdit()"
                     (keyup.escape)="cancelEdit()"
                     cdkFocusInitial />
            }
            @case ('boolean') {
              <select [ngModel]="editValue"
                      (ngModelChange)="editValue = $event"
                      (keyup.escape)="cancelEdit()">
                <option [value]="true">true</option>
                <option [value]="false">false</option>
              </select>
            }
            @default {
              <input type="text"
                     [ngModel]="editValue"
                     (ngModelChange)="editValue = $event"
                     (keyup.enter)="saveEdit()"
                     (keyup.escape)="cancelEdit()"
                     cdkFocusInitial />
            }
          }
          <button mat-icon-button (click)="saveEdit()">
            <mat-icon>check</mat-icon>
          </button>
          <button mat-icon-button (click)="cancelEdit()">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      } @else {
        <!-- Display mode -->
        <span class="cell-value"
              (dblclick)="startEdit(doc.id, column.key, doc[column.key], column.type)">
          {{ formatValue(doc[column.key]) }}
        </span>
        @if (isCellDirty()(doc.id, column.key)) {
          <button mat-icon-button class="revert-btn"
                  matTooltip="Revert change"
                  (click)="revertCell.emit({ documentId: doc.id, path: column.key })">
            <mat-icon>undo</mat-icon>
          </button>
        }
      }
    </td>
  `,
})
export class ResultsTableComponent {
  // ... existing code

  editingCell: { docId: string; path: string } | null = null;
  editValue: any = null;

  @Output() revertCell = new EventEmitter<{ documentId: string; path: string }>();

  startEdit(docId: string, path: string, value: any, type: string) {
    if (this.isPendingDelete()(docId)) return;

    this.editingCell = { docId, path };
    this.editValue = value;
  }

  saveEdit() {
    if (!this.editingCell) return;

    this.cellEdit.emit({
      documentId: this.editingCell.docId,
      path: this.editingCell.path,
      value: this.editValue,
    });

    this.cancelEdit();
  }

  cancelEdit() {
    this.editingCell = null;
    this.editValue = null;
  }
}
```

### 6.2 Import/Export Functionality (✅ Implemented via ImportExportService)

Reference implementation (already complete via `ImportExportService`):

```typescript
import { Component, inject } from '@angular/core';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatRadioModule } from '@angular/material/radio';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FormsModule } from '@angular/forms';
import { CosmosDocument } from '../../../../core/models';

interface ExportDialogData {
  documents: CosmosDocument[];
  containerName: string;
}

@Component({
  selector: 'app-export-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatRadioModule,
    MatCheckboxModule,
    FormsModule,
  ],
  template: `
    <h2 mat-dialog-title>Export Documents</h2>

    <mat-dialog-content>
      <p>{{ data.documents.length }} documents from {{ data.containerName }}</p>

      <div class="format-options">
        <label>Export Format:</label>
        <mat-radio-group [(ngModel)]="format">
          <mat-radio-button value="json">JSON</mat-radio-button>
          <mat-radio-button value="csv">CSV</mat-radio-button>
        </mat-radio-group>
      </div>

      <div class="options">
        <mat-checkbox [(ngModel)]="includeSystemFields">
          Include system fields (_rid, _self, _etag, _ts)
        </mat-checkbox>
        <mat-checkbox [(ngModel)]="prettyPrint" [disabled]="format !== 'json'">
          Pretty print JSON
        </mat-checkbox>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close()">Cancel</button>
      <button mat-raised-button color="primary" (click)="export()">
        Export
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .format-options {
      margin: 16px 0;
    }
    .format-options label {
      display: block;
      margin-bottom: 8px;
      color: #888;
    }
    mat-radio-button {
      margin-right: 16px;
    }
    .options {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 16px;
    }
  `],
})
export class ExportDialogComponent {
  dialogRef = inject(MatDialogRef<ExportDialogComponent>);
  data = inject<ExportDialogData>(MAT_DIALOG_DATA);

  format: 'json' | 'csv' = 'json';
  includeSystemFields = false;
  prettyPrint = true;

  export() {
    let documents = this.data.documents;

    // Remove system fields if requested
    if (!this.includeSystemFields) {
      documents = documents.map(doc => {
        const { _rid, _self, _etag, _attachments, _ts, ...rest } = doc;
        return rest;
      });
    }

    let content: string;
    let filename: string;
    let mimeType: string;

    if (this.format === 'json') {
      content = this.prettyPrint
        ? JSON.stringify(documents, null, 2)
        : JSON.stringify(documents);
      filename = `${this.data.containerName}-export.json`;
      mimeType = 'application/json';
    } else {
      content = this.convertToCSV(documents);
      filename = `${this.data.containerName}-export.csv`;
      mimeType = 'text/csv';
    }

    this.downloadFile(content, filename, mimeType);
    this.dialogRef.close();
  }

  private convertToCSV(documents: any[]): string {
    if (documents.length === 0) return '';

    // Get all unique keys
    const keys = new Set<string>();
    documents.forEach(doc => {
      Object.keys(doc).forEach(key => keys.add(key));
    });

    const headers = Array.from(keys);
    const rows = documents.map(doc =>
      headers.map(key => {
        const value = doc[key];
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value).includes(',') ? `"${value}"` : value;
      }).join(',')
    );

    return [headers.join(','), ...rows].join('\n');
  }

  private downloadFile(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
```

Create `src/app/features/query-editor/components/import-export/import-dialog.component.ts`:

```typescript
import { Component, inject } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-import-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>Import Documents</h2>

    <mat-dialog-content>
      <div class="drop-zone"
           [class.dragging]="isDragging"
           (dragover)="onDragOver($event)"
           (dragleave)="isDragging = false"
           (drop)="onDrop($event)"
           (click)="fileInput.click()">
        <mat-icon>upload_file</mat-icon>
        <p>Drop a JSON file here or click to browse</p>
        <input #fileInput type="file"
               accept=".json"
               hidden
               (change)="onFileSelect($event)" />
      </div>

      @if (error) {
        <div class="error">{{ error }}</div>
      }

      @if (documents.length > 0) {
        <div class="preview">
          <h4>Preview: {{ documents.length }} documents</h4>
          <pre>{{ previewText }}</pre>
        </div>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close()">Cancel</button>
      <button mat-raised-button color="primary"
              [disabled]="documents.length === 0"
              (click)="import()">
        Import {{ documents.length }} Documents
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .drop-zone {
      border: 2px dashed #555;
      border-radius: 8px;
      padding: 48px;
      text-align: center;
      cursor: pointer;
      transition: border-color 0.2s, background-color 0.2s;
    }
    .drop-zone:hover, .drop-zone.dragging {
      border-color: #2196f3;
      background-color: rgba(33, 150, 243, 0.1);
    }
    .drop-zone mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #888;
    }
    .error {
      margin-top: 16px;
      padding: 12px;
      background-color: rgba(244, 67, 54, 0.1);
      color: #f44336;
      border-radius: 4px;
    }
    .preview {
      margin-top: 16px;
      padding: 12px;
      background-color: #1e1e1e;
      border-radius: 4px;
      max-height: 200px;
      overflow: auto;
    }
    .preview pre {
      margin: 0;
      font-size: 12px;
      white-space: pre-wrap;
    }
  `],
})
export class ImportDialogComponent {
  dialogRef = inject(MatDialogRef<ImportDialogComponent>);

  isDragging = false;
  documents: any[] = [];
  error = '';

  get previewText(): string {
    if (this.documents.length === 0) return '';
    const preview = this.documents.slice(0, 2);
    return JSON.stringify(preview, null, 2);
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragging = true;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragging = false;

    const file = event.dataTransfer?.files[0];
    if (file) {
      this.processFile(file);
    }
  }

  onFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.processFile(file);
    }
  }

  async processFile(file: File) {
    this.error = '';
    this.documents = [];

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (Array.isArray(data)) {
        this.documents = data;
      } else if (typeof data === 'object') {
        this.documents = [data];
      } else {
        throw new Error('Invalid JSON format');
      }

      // Validate documents have id
      for (const doc of this.documents) {
        if (!doc.id) {
          doc.id = crypto.randomUUID();
        }
      }
    } catch (err: any) {
      this.error = `Failed to parse file: ${err.message}`;
    }
  }

  import() {
    this.dialogRef.close(this.documents);
  }
}
```

### 6.3 Add Keyboard Shortcuts Guide (⏳ Pending)

Create `src/app/shared/components/shortcuts-dialog/shortcuts-dialog.component.ts`:

```typescript
import { Component } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';

@Component({
  selector: 'app-shortcuts-dialog',
  standalone: true,
  imports: [MatDialogModule],
  template: `
    <h2 mat-dialog-title>Keyboard Shortcuts</h2>

    <mat-dialog-content>
      <div class="shortcut-group">
        <h3>Query Editor</h3>
        <div class="shortcut">
          <kbd>F5</kbd>
          <span>Execute query</span>
        </div>
        <div class="shortcut">
          <kbd>Ctrl</kbd> + <kbd>Enter</kbd>
          <span>Execute query</span>
        </div>
        <div class="shortcut">
          <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>F</kbd>
          <span>Format query</span>
        </div>
      </div>

      <div class="shortcut-group">
        <h3>Table</h3>
        <div class="shortcut">
          <kbd>Double-click</kbd>
          <span>Edit cell</span>
        </div>
        <div class="shortcut">
          <kbd>Enter</kbd>
          <span>Save cell edit</span>
        </div>
        <div class="shortcut">
          <kbd>Escape</kbd>
          <span>Cancel cell edit</span>
        </div>
      </div>

      <div class="shortcut-group">
        <h3>General</h3>
        <div class="shortcut">
          <kbd>Ctrl</kbd> + <kbd>S</kbd>
          <span>Commit changes</span>
        </div>
        <div class="shortcut">
          <kbd>Ctrl</kbd> + <kbd>?</kbd>
          <span>Show shortcuts</span>
        </div>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions>
      <button mat-button mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .shortcut-group {
      margin-bottom: 24px;
    }
    .shortcut-group h3 {
      margin-bottom: 12px;
      color: #888;
      font-size: 12px;
      text-transform: uppercase;
    }
    .shortcut {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid #3c3c3c;
    }
    kbd {
      background-color: #3c3c3c;
      border-radius: 4px;
      padding: 4px 8px;
      font-family: monospace;
      font-size: 12px;
    }
  `],
})
export class ShortcutsDialogComponent {}
```

### 6.4 Add Unsaved Changes Guard (⏳ Pending)

Create `src/app/core/guards/unsaved-changes.guard.ts`:

```typescript
import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { map } from 'rxjs';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { DocumentsStore } from '../../features/query-editor/store/documents.store';

export interface HasUnsavedChanges {
  hasUnsavedChanges: () => boolean;
}

export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) => {
  const documentsStore = inject(DocumentsStore);
  const dialog = inject(MatDialog);

  if (!documentsStore.hasDirtyChanges()) {
    return true;
  }

  const dialogRef = dialog.open(ConfirmDialogComponent, {
    data: {
      title: 'Unsaved Changes',
      message: 'You have unsaved changes. Are you sure you want to leave?',
      confirmText: 'Leave',
      cancelText: 'Stay',
      confirmColor: 'warn',
    },
  });

  return dialogRef.afterClosed().pipe(
    map(confirmed => confirmed === true)
  );
};
```

### 6.5 Add Loading Skeletons (⏳ Pending)

Create `src/app/shared/components/skeleton/skeleton.component.ts`:

```typescript
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-skeleton',
  standalone: true,
  template: `
    <div class="skeleton" [style.width]="width" [style.height]="height"></div>
  `,
  styles: [`
    .skeleton {
      background: linear-gradient(
        90deg,
        #2d2d2d 25%,
        #3c3c3c 50%,
        #2d2d2d 75%
      );
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 4px;
    }
    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `],
})
export class SkeletonComponent {
  @Input() width = '100%';
  @Input() height = '20px';
}
```

### 6.6 Final App Config Updates (✅ Complete)

Update `src/app/app.config.ts`:

```typescript
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideMonacoEditor } from 'ngx-monaco-editor-v2';
import { MAT_SNACK_BAR_DEFAULT_OPTIONS } from '@angular/material/snack-bar';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    provideAnimationsAsync(),
    provideMonacoEditor(),
    {
      provide: MAT_SNACK_BAR_DEFAULT_OPTIONS,
      useValue: {
        duration: 4000,
        horizontalPosition: 'right',
        verticalPosition: 'bottom',
      },
    },
  ],
};
```

### 6.7 Add Global Styles (✅ Complete)

Update `src/styles.scss` with final polish:

```scss
// ... existing styles

// Table styles
.mat-mdc-table {
  background-color: transparent !important;
}

.mat-mdc-row:hover {
  background-color: rgba(255, 255, 255, 0.04) !important;
}

// Form field styles
.mat-mdc-form-field {
  width: 100%;
}

// Dialog styles
.mat-mdc-dialog-container {
  --mdc-dialog-container-color: #2d2d2d;
}

// Button focus styles
.mat-mdc-button:focus,
.mat-mdc-raised-button:focus {
  outline: 2px solid #2196f3;
  outline-offset: 2px;
}

// Tooltip styles
.mat-mdc-tooltip {
  font-size: 12px;
}

// Selection styles
::selection {
  background-color: #264f78;
  color: white;
}

// Focus visible for accessibility
:focus-visible {
  outline: 2px solid #2196f3;
  outline-offset: 2px;
}

// Animations
.fade-in {
  animation: fadeIn 0.2s ease-in;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

// Responsive adjustments
@media (max-width: 1200px) {
  .sidebar {
    width: 240px !important;
  }
}
```

## Verification

Full end-to-end testing:

1. **Connection Management**
   - [x] Add new connection
   - [x] Test connection
   - [x] Edit connection
   - [x] Delete connection
   - [x] Connect and navigate to explorer

2. **Database Explorer**
   - [x] Databases load
   - [x] Expand to load containers
   - [x] Select container
   - [x] Refresh button works
   - [x] Disconnect returns to connections

3. **Query Editor**
   - [x] Monaco Editor loads
   - [x] F5 executes query
   - [x] Results display in table
   - [x] Load More works
   - [x] Query history shows
   - [x] Multiple tabs with persistence

4. **CRUD Operations**
   - [x] Double-click opens edit dialog
   - [x] Dirty cells highlighted
   - [x] Revert cell works
   - [x] Delete marks row
   - [x] Undo delete works
   - [x] Commit saves all changes
   - [x] Discard clears changes

5. **Import/Export**
   - [x] Export to JSON works
   - [x] Export to CSV works
   - [x] Import from JSON works
   - [x] Import from CSV works

6. **Column Management**
   - [x] Column picker with visibility toggle
   - [x] Column reordering via drag-drop
   - [x] Column pinning (freeze left)
   - [x] Save as Container Default
   - [x] Reset to Container Default

7. **Table Sorting & Filtering**
   - [x] Click header to sort (asc/desc/none)
   - [x] Global search across visible columns
   - [x] Per-column filter inputs
   - [x] Search highlighting

8. **Query Analyzer**
   - [x] Index metrics display
   - [x] RU cost display
   - [x] Execution time display

9. **Polish**
   - [x] Loading spinners display
   - [x] Error messages helpful
   - [x] Confirmation dialogs work
   - [ ] Keyboard shortcuts dialog
   - [ ] Unsaved changes guard

## Checklist

- [x] Document editing via dialog
- [x] Import/Export (JSON & CSV)
- [x] Column management (visibility, order, pin)
- [x] Table sorting
- [x] Table filtering (global + per-column)
- [x] Query analyzer
- [x] Multiple tabs with persistence
- [x] Error handling polished
- [ ] Keyboard shortcuts dialog
- [ ] Unsaved changes guard
- [ ] Loading skeletons

## Congratulations!

You have completed the Cosmos DB NoSQL Viewer implementation. The application is now ready for:

1. **Testing** with real Cosmos DB accounts
2. **Packaging** for distribution (`npm run package`)
3. **Further enhancements** as needed

### Remaining Tasks

- [ ] Keyboard shortcuts dialog (show available shortcuts)
- [ ] Unsaved changes guard (warn before leaving with dirty changes)
- [ ] Loading skeletons (shimmer effect while loading)

### Future Enhancements to Consider

- Query syntax highlighting for CosmosSQL
- Autocomplete based on container schema
- Container management (create/delete containers)
- Index management
- Stored procedures/triggers/UDFs support
- Dark/light theme toggle
- Bulk operations (multi-select delete/update)
