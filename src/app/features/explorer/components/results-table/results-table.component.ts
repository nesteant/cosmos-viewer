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
import { detectApplicableTypes, getSpecialOptions, isValidGuid, TypeOption, FieldType } from '@core/utils/json-flattener';
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
        <div class="table-wrapper" tabindex="0" #tableWrapper (scroll)="closeContextMenu()">
          <table mat-table [dataSource]="queryStore.documents()">
            <!-- Row number column -->
            <ng-container matColumnDef="_rowNum">
              <th mat-header-cell *matHeaderCellDef class="row-num-cell">#</th>
              <td mat-cell *matCellDef="let doc; let i = index" class="row-num-cell">
                {{ i + 1 }}
              </td>
            </ng-container>

            @for (column of displayedColumns(); track column) {
              <ng-container [matColumnDef]="column">
                <th
                  mat-header-cell
                  *matHeaderCellDef
                  [class.id-column]="column === 'id'"
                  [class.partition-key-column]="column === partitionKeyField() && column !== 'id'"
                  [class.system-column]="isSystemField(column)"
                  [style.width.px]="columnWidths()[column]"
                  [style.min-width.px]="columnWidths()[column]"
                  [style.max-width.px]="columnWidths()[column]"
                >
                  <div class="header-content">
                    <span class="header-label">
                      @if (column === 'id') {
                        <mat-icon class="key-icon">key</mat-icon>
                      } @else if (column === partitionKeyField()) {
                        <mat-icon class="key-icon partition">dynamic_feed</mat-icon>
                      }
                      {{ getColumnLabel(column) }}
                    </span>
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
                  [class.cell-focused]="isCellFocused(doc.id, column)"
                  [class.id-column]="column === 'id'"
                  [class.partition-key-column]="column === partitionKeyField() && column !== 'id'"
                  [class.system-column]="isSystemField(column)"
                  [style.width.px]="columnWidths()[column]"
                  [style.min-width.px]="columnWidths()[column]"
                  [style.max-width.px]="columnWidths()[column]"
                  (click)="onCellClick(doc.id, column, $event)"
                  (dblclick)="startEditing(doc, column)"
                >
                  @if (editingCell?.docId === doc.id && editingCell?.path === column) {
                    <div class="inline-editor" (mousedown)="$event.stopPropagation()">
                      <input
                        #editInput
                        class="cell-input"
                        [value]="editingValue"
                        (input)="onEditInput($event)"
                        (blur)="onInputBlur(doc, column)"
                        (keydown)="onEditKeydown($event, doc, column)"
                      />
                      <div class="type-chips">
                        @for (opt of applicableTypes; track opt.type) {
                          <button
                            type="button"
                            class="type-chip"
                            [class.selected]="selectedType === opt.type"
                            [style.background]="opt.color"
                            [matTooltip]="opt.description"
                            matTooltipPosition="above"
                            (mousedown)="selectType(opt.type, $event)"
                          >
                            {{ opt.label }}
                          </button>
                        }
                        @if (isValidGuidValue) {
                          <span class="guid-badge" matTooltip="Valid GUID format" matTooltipPosition="above">G✓</span>
                        }
                        <span class="chip-divider"></span>
                        @for (opt of specialOptions; track opt.type) {
                          <button
                            type="button"
                            class="type-chip special"
                            [class.selected]="selectedType === opt.type"
                            [style.background]="opt.color"
                            [matTooltip]="opt.description"
                            matTooltipPosition="above"
                            (mousedown)="selectType(opt.type, $event)"
                          >
                            {{ opt.label }}
                          </button>
                        }
                      </div>
                    </div>
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

            <tr mat-header-row *matHeaderRowDef="allColumns(); sticky: true"></tr>
            <tr
              mat-row
              *matRowDef="let row; columns: allColumns()"
              [class.dirty-row]="queryStore.isDocumentDirty(row.id)"
              (contextmenu)="onRowContextMenu($event, row)"
            ></tr>
          </table>
        </div>

        <!-- Context Menu -->
        @if (contextMenu()) {
          <div
            class="context-menu"
            [style.left.px]="contextMenu()!.x"
            [style.top.px]="contextMenu()!.y"
            (contextmenu)="$event.preventDefault()"
          >
            @if (queryStore.isDocumentDirty(contextMenu()!.doc.id)) {
              <button class="context-menu-item" (click)="onSaveDocument(contextMenu()!.doc); closeContextMenu()">
                <mat-icon>save</mat-icon>
                Save Changes
              </button>
              <button class="context-menu-item" (click)="onDiscardChanges(contextMenu()!.doc); closeContextMenu()">
                <mat-icon>undo</mat-icon>
                Discard Changes
              </button>
              <div class="context-menu-divider"></div>
            }
            <button class="context-menu-item" (click)="onViewJson(contextMenu()!.doc); closeContextMenu()">
              <mat-icon>code</mat-icon>
              View/Edit JSON
            </button>
            <button class="context-menu-item" (click)="onDuplicateDocument(contextMenu()!.doc); closeContextMenu()">
              <mat-icon>content_copy</mat-icon>
              Duplicate
            </button>
            <div class="context-menu-divider"></div>
            <button class="context-menu-item delete" (click)="onDeleteDocument(contextMenu()!.doc); closeContextMenu()">
              <mat-icon>delete</mat-icon>
              Delete
            </button>
          </div>
        }
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

      .row-num-cell {
        width: 45px !important;
        min-width: 45px !important;
        max-width: 45px !important;
        text-align: center;
        color: rgba(255, 255, 255, 0.4);
        font-size: 11px;
        background: rgba(0, 0, 0, 0.15);
        border-right: 1px solid rgba(255, 255, 255, 0.08);
        position: sticky;
        left: 0;
        z-index: 1;
      }

      th.row-num-cell {
        background: #1a1a1a;
        z-index: 3;
      }

      td.mat-mdc-cell:has(.inline-editor),
      td.mat-mdc-cell:has(.expanded-content) {
        overflow: visible;
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

      td.cell-focused {
        outline: 2px solid #bb86fc;
        outline-offset: -2px;
        background: rgba(187, 134, 252, 0.1);
      }

      .table-wrapper:focus {
        outline: none;
      }

      tr.dirty-row {
        background: rgba(255, 183, 77, 0.05);
      }

      /* Key column highlighting */
      .id-column {
        background: rgba(255, 193, 7, 0.08);
      }

      th.id-column {
        background: rgba(255, 193, 7, 0.15);
      }

      .partition-key-column {
        background: rgba(156, 39, 176, 0.08);
      }

      th.partition-key-column {
        background: rgba(156, 39, 176, 0.15);
      }

      .system-column {
        background: rgba(96, 125, 139, 0.08);
        color: rgba(255, 255, 255, 0.5);
      }

      th.system-column {
        background: rgba(96, 125, 139, 0.15);
      }

      .key-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
        vertical-align: middle;
        margin-right: 4px;
        color: #ffc107;
      }

      .key-icon.partition {
        color: #ce93d8;
      }

      .inline-editor {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 100;
      }

      .cell-input {
        width: 100%;
        height: 100%;
        background: #1a1a2e;
        border: 2px solid #bb86fc;
        padding: 0 6px;
        color: white;
        font-size: 12px;
        font-family: monospace;
        outline: none;
        box-sizing: border-box;
      }

      .type-chips {
        position: absolute;
        top: calc(100% + 4px);
        left: 0;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        background: linear-gradient(135deg, #1e1e2e 0%, #252536 100%);
        border-radius: 8px;
        box-shadow:
          0 4px 16px rgba(0, 0, 0, 0.5),
          0 0 0 1px rgba(255, 255, 255, 0.08),
          inset 0 1px 0 rgba(255, 255, 255, 0.05);
        z-index: 101;
      }

      .type-chip {
        padding: 4px 10px;
        font-size: 11px;
        font-weight: 600;
        border-radius: 6px;
        border: none;
        color: white;
        cursor: pointer;
        transition: filter 0.15s, box-shadow 0.15s;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      }

      .type-chip:hover {
        filter: brightness(1.15);
      }

      .type-chip.selected {
        box-shadow: 0 0 0 2px white, 0 2px 8px rgba(0, 0, 0, 0.3);
      }

      /* Type-specific colors */
      .type-chip[title="String"] {
        background: linear-gradient(135deg, #607d8b 0%, #455a64 100%);
      }

      .type-chip[title="Boolean true"] {
        background: linear-gradient(135deg, #4caf50 0%, #388e3c 100%);
      }

      .type-chip[title="Boolean false"] {
        background: linear-gradient(135deg, #ef5350 0%, #c62828 100%);
      }

      .type-chip[title="Number"] {
        background: linear-gradient(135deg, #42a5f5 0%, #1976d2 100%);
      }

      .type-chip[title="Null"] {
        background: linear-gradient(135deg, #78909c 0%, #546e7a 100%);
      }

      .type-chip[title="Delete field"] {
        background: linear-gradient(135deg, #ff7043 0%, #e64a19 100%);
      }

      .type-chip[title="Empty string"] {
        background: linear-gradient(135deg, #90a4ae 0%, #607d8b 100%);
      }

      .guid-badge {
        font-size: 10px;
        font-weight: 600;
        color: #ce93d8;
        background: rgba(156, 39, 176, 0.15);
        padding: 3px 8px;
        border-radius: 4px;
      }

      .chip-divider {
        width: 1px;
        height: 20px;
        background: rgba(255, 255, 255, 0.15);
        margin: 0 4px;
      }

      .type-chip.special {
        opacity: 0.7;
      }

      .type-chip.special:hover {
        opacity: 1;
      }

      .type-chip.special.selected {
        opacity: 1;
      }

      .context-menu {
        position: fixed;
        background: linear-gradient(135deg, #1e1e2e 0%, #252536 100%);
        border-radius: 8px;
        box-shadow:
          0 8px 32px rgba(0, 0, 0, 0.5),
          0 0 0 1px rgba(255, 255, 255, 0.1);
        padding: 4px 0;
        min-width: 180px;
        z-index: 1000;
      }

      .context-menu-item {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        padding: 10px 16px;
        background: none;
        border: none;
        color: rgba(255, 255, 255, 0.9);
        font-size: 13px;
        cursor: pointer;
        text-align: left;
        transition: background 0.15s;
      }

      .context-menu-item:hover {
        background: rgba(255, 255, 255, 0.1);
      }

      .context-menu-item mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: rgba(255, 255, 255, 0.7);
      }

      .context-menu-item.delete {
        color: #f44336;
      }

      .context-menu-item.delete mat-icon {
        color: #f44336;
      }

      .context-menu-divider {
        height: 1px;
        background: rgba(255, 255, 255, 0.1);
        margin: 4px 0;
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
  @ViewChild('tableWrapper') tableWrapper!: ElementRef<HTMLDivElement>;

  container = input<ContainerInfo | null>(null);

  editingCell: { docId: string; path: string } | null = null;
  editingValue = '';
  importType: 'json' | 'csv' = 'json';
  private isEditingCancelled = false;

  // Keyboard navigation - track by docId and column path for mat-table compatibility
  focusedCell = signal<{ docId: string; path: string } | null>(null);

  // Type selection for inline editing
  applicableTypes: TypeOption[] = [];
  specialOptions: TypeOption[] = getSpecialOptions();
  selectedType: FieldType = 'string';
  isValidGuidValue = false;

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
    return ['_rowNum', ...this.displayedColumns()];
  });

  // Extract partition key field name from path (e.g., "/userId" -> "userId")
  partitionKeyField = computed(() => {
    const path = this.container()?.partitionKeyPath;
    if (!path) return null;
    return path.replace(/^\//, '');
  });

  // Context menu state
  contextMenu = signal<{ x: number; y: number; doc: CosmosDocument } | null>(null);

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

  // Keyboard navigation
  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    // Skip if editing or if focus is in an input/textarea
    if (this.editingCell) return;
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

    const focused = this.focusedCell();
    const isNavKey = ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape'].includes(event.key);
    if (!focused && !isNavKey) return;

    const docs = this.queryStore.documents();
    const columns = this.displayedColumns();
    if (docs.length === 0 || columns.length === 0) return;

    // Get current position
    let rowIndex = focused ? docs.findIndex(d => d.id === focused.docId) : -1;
    let colIndex = focused ? columns.indexOf(focused.path) : -1;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!focused) {
          this.focusedCell.set({ docId: docs[0].id, path: columns[0] });
        } else if (rowIndex < docs.length - 1) {
          this.focusedCell.set({ docId: docs[rowIndex + 1].id, path: columns[colIndex] });
        }
        this.scrollToFocusedCell();
        break;

      case 'ArrowUp':
        event.preventDefault();
        if (focused && rowIndex > 0) {
          this.focusedCell.set({ docId: docs[rowIndex - 1].id, path: columns[colIndex] });
          this.scrollToFocusedCell();
        }
        break;

      case 'ArrowRight':
        event.preventDefault();
        if (!focused) {
          this.focusedCell.set({ docId: docs[0].id, path: columns[0] });
        } else if (colIndex < columns.length - 1) {
          this.focusedCell.set({ docId: docs[rowIndex].id, path: columns[colIndex + 1] });
        }
        this.scrollToFocusedCell();
        break;

      case 'ArrowLeft':
        event.preventDefault();
        if (focused && colIndex > 0) {
          this.focusedCell.set({ docId: docs[rowIndex].id, path: columns[colIndex - 1] });
          this.scrollToFocusedCell();
        }
        break;

      case 'Enter':
        event.preventDefault();
        if (focused) {
          const doc = docs.find(d => d.id === focused.docId);
          if (doc) {
            this.startEditing(doc, focused.path);
          }
        }
        break;

      case 'Escape':
        event.preventDefault();
        this.focusedCell.set(null);
        break;
    }
  }

  private scrollToFocusedCell() {
    setTimeout(() => {
      const focusedEl = document.querySelector('.cell-focused') as HTMLElement;
      const tableWrapper = document.querySelector('.table-wrapper') as HTMLElement;

      if (!focusedEl || !tableWrapper) return;

      const cellRect = focusedEl.getBoundingClientRect();
      const wrapperRect = tableWrapper.getBoundingClientRect();

      // Check horizontal scroll
      if (cellRect.right > wrapperRect.right) {
        // Cell is off to the right - scroll right
        tableWrapper.scrollLeft += (cellRect.right - wrapperRect.right) + 20;
      } else if (cellRect.left < wrapperRect.left) {
        // Cell is off to the left - scroll left
        tableWrapper.scrollLeft -= (wrapperRect.left - cellRect.left) + 20;
      }

      // Check vertical scroll
      if (cellRect.bottom > wrapperRect.bottom) {
        // Cell is below - scroll down
        tableWrapper.scrollTop += (cellRect.bottom - wrapperRect.bottom) + 20;
      } else if (cellRect.top < wrapperRect.top) {
        // Cell is above - scroll up
        tableWrapper.scrollTop -= (wrapperRect.top - cellRect.top) + 20;
      }
    });
  }

  onCellClick(docId: string, path: string, event: MouseEvent) {
    // Don't interfere with double-click for editing
    this.focusedCell.set({ docId, path });
  }

  isCellFocused(docId: string, path: string): boolean {
    const focused = this.focusedCell();
    return focused?.docId === docId && focused?.path === path;
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

    // Detect applicable types and set initial selection based on original value's type
    this.updateApplicableTypes(this.editingValue, false);
    this.selectedType = this.getTypeFromValue(value);

    // Use requestAnimationFrame to ensure DOM is updated, then focus
    requestAnimationFrame(() => {
      setTimeout(() => {
        const input = document.querySelector('.cell-input') as HTMLInputElement;
        if (input) {
          input.focus();
          input.select();
        }
      }, 0);
    });
  }

  onEditInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.editingValue = input.value;
    this.updateApplicableTypes(this.editingValue);
  }

  onEditKeydown(event: KeyboardEvent, doc: CosmosDocument, column: string) {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      this.finishEditing(doc, column);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.cancelEditing();
    }
  }

  updateApplicableTypes(value: string, preserveSelection = true) {
    const previousType = this.selectedType;
    this.applicableTypes = detectApplicableTypes(value);
    this.isValidGuidValue = isValidGuid(value);

    // If user had a special type selected (delete/null) but now typed actual content,
    // automatically switch to the most appropriate value-based type
    const isSpecialType = previousType === 'delete' || previousType === 'null';
    const hasContent = value.length > 0;

    if (isSpecialType && hasContent) {
      // Switch to value-based type
      this.selectedType = this.applicableTypes[0]?.type ?? 'string';
      return;
    }

    // Check if previous selection is still valid among value-based types
    const previousInApplicable = this.applicableTypes.some(opt => opt.type === previousType);

    if (preserveSelection && previousInApplicable) {
      // Keep user's selection if it's a valid value-based type
      this.selectedType = previousType;
    } else if (preserveSelection && (previousType === 'delete' || previousType === 'null')) {
      // Keep special type selection if no content
      this.selectedType = previousType;
    } else {
      // Default to first applicable type (most specific)
      this.selectedType = this.applicableTypes[0]?.type ?? 'string';
    }
  }

  selectType(type: FieldType, event: MouseEvent) {
    event.preventDefault(); // Prevent blur
    this.selectedType = type;
  }

  private getTypeFromValue(value: any): FieldType {
    if (value === null) return 'null';
    if (value === undefined) return 'delete';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return 'number';
    return 'string';
  }

  onInputBlur(doc: CosmosDocument, column: string) {
    // Small delay to allow chip clicks to register before blur
    setTimeout(() => {
      // Skip if editing was explicitly cancelled
      if (this.isEditingCancelled) {
        this.isEditingCancelled = false;
        return;
      }
      if (this.editingCell?.docId === doc.id && this.editingCell?.path === column) {
        this.finishEditing(doc, column);
      }
    }, 150);
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

  finishEditing(doc: CosmosDocument, path: string) {
    // Find the selected type option from both applicable and special options
    const allOptions = [...this.applicableTypes, ...this.specialOptions];
    const selectedOption = allOptions.find(
      (opt) => opt.type === this.selectedType
    );

    if (selectedOption) {
      if (selectedOption.type === 'delete') {
        // Delete field - set to undefined which should remove it
        this.queryStore.updateDocumentField(doc.id, path, undefined);
      } else {
        this.queryStore.updateDocumentField(doc.id, path, selectedOption.value);
      }
    }

    this.editingCell = null;
    this.applicableTypes = [];
    // Refocus table wrapper for keyboard navigation
    this.refocusTable();
  }

  cancelEditing() {
    this.isEditingCancelled = true;
    this.editingCell = null;
    this.applicableTypes = [];
    // Refocus table wrapper for keyboard navigation
    this.refocusTable();
  }

  private refocusTable() {
    setTimeout(() => {
      const wrapper = document.querySelector('.table-wrapper') as HTMLElement;
      wrapper?.focus();
    }, 10);
  }

  // Context menu handlers
  onRowContextMenu(event: MouseEvent, doc: CosmosDocument) {
    event.preventDefault();
    this.contextMenu.set({
      x: event.clientX,
      y: event.clientY,
      doc,
    });
  }

  closeContextMenu() {
    this.contextMenu.set(null);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.context-menu')) {
      this.closeContextMenu();
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeKey() {
    if (this.contextMenu()) {
      this.closeContextMenu();
    }
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
