import { Component, inject, input, computed, ElementRef, ViewChild, signal, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ContainerInfo, CosmosDocument } from '@core/models';
import { parseEditedValue } from '@core/utils/json-flattener';
import { getValueAtPath, stringToPath, isSystemField } from '@core/utils/path-utils';
import { ConfirmDialogComponent, CellFormatterComponent } from '@shared/components';
import { QueryStore } from '../../store';
import { JsonViewerDialogComponent } from '../json-viewer-dialog/json-viewer-dialog.component';
import { DocumentDialogComponent } from '../document-dialog/document-dialog.component';
import { FieldEditorDialogComponent } from '../field-editor-dialog/field-editor-dialog.component';
import { ImportExportService } from '../import-export/import-export.service';

@Component({
  selector: 'app-results-table',
  standalone: true,
  imports: [
    FormsModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatDialogModule,
    CellFormatterComponent,
  ],
  template: `
    <div class="results-container">
      <div class="results-toolbar">
        <div class="toolbar-left">
          @if (queryStore.getDirtyDocumentCount() > 0) {
            <span class="dirty-indicator">
              {{ queryStore.getDirtyDocumentCount() }} unsaved change(s)
            </span>
            <button mat-stroked-button color="primary" (click)="onSaveAll()">
              <mat-icon>save</mat-icon>
              Save All
            </button>
            <button mat-stroked-button (click)="onDiscardAll()">
              <mat-icon>undo</mat-icon>
              Discard All
            </button>
          }
        </div>
        <div class="toolbar-right">
          <button
            mat-stroked-button
            (click)="onCreateDocument()"
            [disabled]="!container()"
            matTooltip="Create new document"
          >
            <mat-icon>add</mat-icon>
            New
          </button>

          <button mat-icon-button [matMenuTriggerFor]="importMenu" matTooltip="Import">
            <mat-icon>upload</mat-icon>
          </button>
          <mat-menu #importMenu="matMenu">
            <button mat-menu-item (click)="fileInput.click(); importType = 'json'">
              <mat-icon>code</mat-icon>
              Import JSON
            </button>
            <button mat-menu-item (click)="fileInput.click(); importType = 'csv'">
              <mat-icon>table_chart</mat-icon>
              Import CSV
            </button>
          </mat-menu>

          <button mat-icon-button [matMenuTriggerFor]="exportMenu" matTooltip="Export">
            <mat-icon>download</mat-icon>
          </button>
          <mat-menu #exportMenu="matMenu">
            <button mat-menu-item (click)="onExportJson()" [disabled]="!queryStore.hasDocuments()">
              <mat-icon>code</mat-icon>
              Export as JSON
            </button>
            <button mat-menu-item (click)="onExportCsv()" [disabled]="!queryStore.hasDocuments()">
              <mat-icon>table_chart</mat-icon>
              Export as CSV
            </button>
          </mat-menu>

          @if (queryStore.canLoadMore()) {
            <button
              mat-stroked-button
              (click)="onLoadMore()"
              [disabled]="queryStore.isLoadingMore()"
            >
              @if (queryStore.isLoadingMore()) {
                <mat-spinner diameter="18"></mat-spinner>
              } @else {
                <mat-icon>expand_more</mat-icon>
              }
              Load More
            </button>
          }
        </div>
      </div>

      <input
        #fileInput
        type="file"
        hidden
        [accept]="importType === 'json' ? '.json' : '.csv'"
        (change)="onFileSelected($event)"
      />

      @if (queryStore.hasDocuments()) {
        <div class="table-wrapper">
          <table mat-table [dataSource]="queryStore.documents()">
            @for (column of displayedColumns(); track column) {
              <ng-container [matColumnDef]="column">
                <th
                  mat-header-cell
                  *matHeaderCellDef
                  [style.width.px]="columnWidths()[column]"
                  [style.min-width.px]="columnWidths()[column]"
                  [style.max-width.px]="columnWidths()[column]"
                >
                  <div class="header-content">
                    <span class="header-label">{{ getColumnLabel(column) }}</span>
                    <div
                      class="resize-handle"
                      (mousedown)="startResize($event, column)"
                    ></div>
                  </div>
                </th>
                <td
                  mat-cell
                  *matCellDef="let doc"
                  [class.dirty]="queryStore.isFieldDirty(doc.id, column)"
                  [class.editable]="!isSystemField(column)"
                  [style.width.px]="columnWidths()[column]"
                  [style.min-width.px]="columnWidths()[column]"
                  [style.max-width.px]="columnWidths()[column]"
                  (dblclick)="startEditing(doc, column)"
                >
                  @if (editingCell?.docId === doc.id && editingCell?.path === column) {
                    <input
                      #editInput
                      class="cell-input"
                      [value]="editingValue"
                      (blur)="finishEditing(doc, column, $event)"
                      (keydown.enter)="finishEditing(doc, column, $event)"
                      (keydown.escape)="cancelEditing()"
                    />
                  } @else {
                    <span class="cell-value">
                      <app-cell-formatter
                        [value]="getCellValue(doc, column)"
                        [fieldPath]="column"
                      />
                    </span>
                  }
                </td>
              </ng-container>
            }

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let doc">
                <button
                  mat-icon-button
                  [matMenuTriggerFor]="rowMenu"
                  class="row-menu-trigger"
                >
                  <mat-icon>more_vert</mat-icon>
                </button>
                <mat-menu #rowMenu="matMenu">
                  @if (queryStore.isDocumentDirty(doc.id)) {
                    <button mat-menu-item (click)="onSaveDocument(doc)">
                      <mat-icon>save</mat-icon>
                      Save Changes
                    </button>
                    <button mat-menu-item (click)="onDiscardChanges(doc)">
                      <mat-icon>undo</mat-icon>
                      Discard Changes
                    </button>
                  }
                  <button mat-menu-item (click)="onViewJson(doc)">
                    <mat-icon>code</mat-icon>
                    View/Edit JSON
                  </button>
                  <button mat-menu-item (click)="onDuplicateDocument(doc)">
                    <mat-icon>content_copy</mat-icon>
                    Duplicate
                  </button>
                  <button
                    mat-menu-item
                    class="delete-item"
                    (click)="onDeleteDocument(doc)"
                  >
                    <mat-icon>delete</mat-icon>
                    Delete
                  </button>
                </mat-menu>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="allColumns(); sticky: true"></tr>
            <tr
              mat-row
              *matRowDef="let row; columns: allColumns()"
              [class.dirty-row]="queryStore.isDocumentDirty(row.id)"
            ></tr>
          </table>
        </div>
      } @else if (!queryStore.isExecuting()) {
        <div class="empty-state">
          <mat-icon>search_off</mat-icon>
          <span>No results. Execute a query to see documents.</span>
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        flex: 1 1 0;
        overflow: hidden;
      }

      .results-container {
        display: flex;
        flex-direction: column;
        flex: 1 1 0;
        overflow: hidden;
      }

      .results-toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 4px 8px;
        background: rgba(0, 0, 0, 0.2);
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        min-height: 36px;
        gap: 6px;
        flex-shrink: 0;
      }

      .toolbar-left,
      .toolbar-right {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .dirty-indicator {
        font-size: 13px;
        color: #ffb74d;
        padding: 4px 8px;
        background: rgba(255, 183, 77, 0.1);
        border-radius: 4px;
      }

      .toolbar-left button,
      .toolbar-right button {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .table-wrapper {
        flex: 1 1 0;
        overflow: auto;
      }

      table {
        width: max-content;
        min-width: 100%;
        table-layout: fixed;
      }

      th.mat-mdc-header-cell {
        background: #252525;
        font-size: 12px;
        font-weight: 600;
        color: #d9d9d9;
        padding: 0;
        white-space: nowrap;
        position: relative;
        overflow: hidden;
      }

      .header-content {
        display: flex;
        align-items: center;
        height: 100%;
        padding: 0 6px;
      }

      .header-label {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .resize-handle {
        position: absolute;
        right: 0;
        top: 4px;
        bottom: 4px;
        width: 3px;
        cursor: col-resize;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 2px;
        z-index: 1;
        transition: background 0.15s;
      }

      .resize-handle:hover {
        background: rgba(187, 134, 252, 0.7);
      }

      .resize-handle:active {
        background: #bb86fc;
      }

      td.mat-mdc-cell {
        padding: 0 6px;
        font-size: 12px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        position: relative;
      }

      td.mat-mdc-cell .cell-value {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      td.dirty {
        background: rgba(255, 183, 77, 0.15);
      }

      td.editable:hover {
        background: rgba(255, 255, 255, 0.08);
        cursor: cell;
      }

      tr.dirty-row {
        background: rgba(255, 183, 77, 0.05);
      }

      .cell-input {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        width: 100%;
        height: 100%;
        background: #1e1e2e;
        border: 2px solid #bb86fc;
        border-radius: 0;
        padding: 0 6px;
        color: white;
        font-size: 12px;
        outline: none;
        box-sizing: border-box;
      }

      .row-menu-trigger {
        opacity: 0;
        transition: opacity 0.2s;
      }

      tr:hover .row-menu-trigger {
        opacity: 1;
      }

      .delete-item {
        color: #f44336;
      }

      .delete-item mat-icon {
        color: #f44336;
      }

      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
        padding: 48px;
        color: rgba(255, 255, 255, 0.5);
      }

      .empty-state mat-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        opacity: 0.5;
      }
    `,
  ],
})
export class ResultsTableComponent {
  readonly queryStore = inject(QueryStore);
  private dialog = inject(MatDialog);
  private importExportService = inject(ImportExportService);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  container = input<ContainerInfo | null>(null);

  editingCell: { docId: string; path: string } | null = null;
  editingValue = '';
  importType: 'json' | 'csv' = 'json';

  // Column resizing
  private columnWidthsMap = signal<Record<string, number>>({});
  private resizingColumn: string | null = null;
  private resizeStartX = 0;
  private resizeStartWidth = 0;
  private readonly DEFAULT_COLUMN_WIDTH = 150;
  private readonly MIN_COLUMN_WIDTH = 60;
  private readonly MAX_COLUMN_WIDTH = 600;

  columnWidths = computed(() => {
    const widths: Record<string, number> = {};
    for (const col of this.displayedColumns()) {
      widths[col] = this.columnWidthsMap()[col] ?? this.DEFAULT_COLUMN_WIDTH;
    }
    return widths;
  });

  displayedColumns = computed(() => {
    return this.queryStore.columns().map((c) => c.path);
  });

  allColumns = computed(() => {
    return [...this.displayedColumns(), 'actions'];
  });

  getColumnLabel(path: string): string {
    const column = this.queryStore.columns().find((c) => c.path === path);
    return column?.label ?? path;
  }

  // Column resize methods
  startResize(event: MouseEvent, column: string) {
    event.preventDefault();
    event.stopPropagation();
    this.resizingColumn = column;
    this.resizeStartX = event.clientX;
    this.resizeStartWidth = this.columnWidths()[column];
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    if (!this.resizingColumn) return;

    const delta = event.clientX - this.resizeStartX;
    const newWidth = Math.min(
      this.MAX_COLUMN_WIDTH,
      Math.max(this.MIN_COLUMN_WIDTH, this.resizeStartWidth + delta)
    );

    this.columnWidthsMap.update((widths) => ({
      ...widths,
      [this.resizingColumn!]: newWidth,
    }));
  }

  @HostListener('document:mouseup')
  onMouseUp() {
    this.resizingColumn = null;
  }

  isSystemField(path: string): boolean {
    return isSystemField(path);
  }

  getCellValue(doc: CosmosDocument, path: string): any {
    return getValueAtPath(doc, stringToPath(path));
  }

  startEditing(doc: CosmosDocument, path: string) {
    if (isSystemField(path)) return;

    const value = getValueAtPath(doc, stringToPath(path));

    // For complex types (objects/arrays), open Monaco editor dialog
    if (value !== null && typeof value === 'object') {
      this.openFieldEditor(doc, path, value, 'json');
      return;
    }

    // For long strings (>50 chars), open text editor dialog
    if (typeof value === 'string' && value.length > 50) {
      this.openFieldEditor(doc, path, value, 'text');
      return;
    }

    // For simple types, use inline editing
    this.editingCell = { docId: doc.id, path };
    this.editingValue =
      value === null ? 'null' : value === undefined ? '' : String(value);

    setTimeout(() => {
      const input = document.querySelector('.cell-input') as HTMLInputElement;
      input?.focus();
      input?.select();
    });
  }

  private openFieldEditor(doc: CosmosDocument, path: string, value: any, mode: 'json' | 'text') {
    const dialogRef = this.dialog.open(FieldEditorDialogComponent, {
      data: {
        fieldPath: path,
        value: value,
        documentId: doc.id,
        mode,
      },
      width: '600px',
      panelClass: 'field-editor-dialog',
    });

    dialogRef.afterClosed().subscribe((updatedValue) => {
      if (updatedValue !== undefined) {
        this.queryStore.updateDocumentField(doc.id, path, updatedValue);
      }
    });
  }

  finishEditing(doc: CosmosDocument, path: string, event: Event) {
    const input = event.target as HTMLInputElement;
    const newValueStr = input.value;

    const originalValue = getValueAtPath(doc, stringToPath(path));
    const newValue = parseEditedValue(newValueStr, originalValue);

    this.queryStore.updateDocumentField(doc.id, path, newValue);
    this.editingCell = null;
  }

  cancelEditing() {
    this.editingCell = null;
  }

  onSaveDocument(doc: CosmosDocument) {
    const cont = this.container();
    if (cont) {
      this.queryStore.saveDocument(cont, doc.id);
    }
  }

  onDiscardChanges(doc: CosmosDocument) {
    this.queryStore.discardChanges(doc.id);
  }

  onSaveAll() {
    const cont = this.container();
    if (cont) {
      this.queryStore.saveAllChanges(cont);
    }
  }

  onDiscardAll() {
    this.queryStore.discardAllChanges();
  }

  onLoadMore() {
    const cont = this.container();
    if (cont) {
      this.queryStore.loadMoreResults(cont);
    }
  }

  onViewJson(doc: CosmosDocument) {
    const dialogRef = this.dialog.open(JsonViewerDialogComponent, {
      data: { document: doc },
      width: '700px',
    });

    dialogRef.afterClosed().subscribe((updatedDoc) => {
      if (updatedDoc && updatedDoc.id === doc.id) {
        // Apply changes from JSON editor
        Object.keys(updatedDoc).forEach((key) => {
          if (!key.startsWith('_') && key !== 'id') {
            this.queryStore.updateDocumentField(doc.id, key, updatedDoc[key]);
          }
        });
      }
    });
  }

  onDuplicateDocument(doc: CosmosDocument) {
    const cont = this.container();
    if (!cont) return;

    // Create copy without system fields
    const copy: any = {};
    Object.keys(doc).forEach((key) => {
      if (!key.startsWith('_')) {
        copy[key] = doc[key];
      }
    });
    copy.id = this.generateId();

    const dialogRef = this.dialog.open(JsonViewerDialogComponent, {
      data: {
        document: copy,
        title: 'Duplicate Document',
      },
      width: '700px',
    });

    dialogRef.afterClosed().subscribe((newDoc) => {
      if (newDoc) {
        this.queryStore.createDocument(cont, newDoc);
      }
    });
  }

  onCreateDocument() {
    const cont = this.container();
    if (!cont) return;

    const dialogRef = this.dialog.open(DocumentDialogComponent, {
      data: { container: cont },
      width: '700px',
    });

    dialogRef.afterClosed().subscribe((newDoc) => {
      if (newDoc) {
        this.queryStore.createDocument(cont, newDoc);
      }
    });
  }

  onDeleteDocument(doc: CosmosDocument) {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete Document',
        message: `Are you sure you want to delete document "${doc.id}"? This action cannot be undone.`,
        confirmText: 'Delete',
        confirmColor: 'warn',
      },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        const cont = this.container();
        if (cont) {
          this.queryStore.deleteDocument(cont, doc.id);
        }
      }
    });
  }

  onExportJson() {
    const cont = this.container();
    if (!cont) return;

    const docs = this.queryStore.documents();
    const filename = `${cont.databaseId}_${cont.name}_export`;
    this.importExportService.exportToJson(docs, filename);
  }

  onExportCsv() {
    const cont = this.container();
    if (!cont) return;

    const docs = this.queryStore.documents();
    const filename = `${cont.databaseId}_${cont.name}_export`;
    this.importExportService.exportToCsv(docs, filename);
  }

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const cont = this.container();
    if (!cont) return;

    try {
      let documents: CosmosDocument[];

      if (this.importType === 'json') {
        documents = await this.importExportService.importFromJson(file);
      } else {
        documents = await this.importExportService.importFromCsv(file, cont);
      }

      // Confirm import
      const dialogRef = this.dialog.open(ConfirmDialogComponent, {
        data: {
          title: 'Import Documents',
          message: `Import ${documents.length} document(s) into ${cont.name}?`,
          confirmText: 'Import',
        },
      });

      dialogRef.afterClosed().subscribe(async (confirmed) => {
        if (confirmed) {
          for (const doc of documents) {
            try {
              await this.queryStore.createDocument(cont, doc);
            } catch {
              // Individual errors handled by store
            }
          }
        }
      });
    } catch {
      // Error handled by service
    }

    // Reset file input
    input.value = '';
  }

  private generateId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
