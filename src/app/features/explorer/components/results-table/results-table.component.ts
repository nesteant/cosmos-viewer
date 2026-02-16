import { Component, inject, input, computed, ElementRef, ViewChild, signal, HostListener, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ContainerInfo, CosmosDocument, ColumnLayout, SortDirection, createContainerKey } from '@core/models';
import { TablePreferencesService } from '@core/services';
import { detectApplicableTypes, getSpecialOptions, isValidGuid, isValidIsoDate, TypeOption, FieldType } from '@core/utils/json-flattener';
import { getValueAtPath, stringToPath } from '@core/utils/path-utils';
import { ConfirmDialogComponent, CellFormatterComponent } from '@shared/components';
import { ExplorerStore, QueryStore } from '../../store';
import { TableProviderStrategyFactory } from '../../strategies';
import { JsonViewerDialogComponent } from '../json-viewer-dialog/json-viewer-dialog.component';
import { DocumentDialogComponent } from '../document-dialog/document-dialog.component';
import { FieldEditorDialogComponent } from '../field-editor-dialog/field-editor-dialog.component';
import { ImportExportService } from '../import-export/import-export.service';

@Component({
  selector: 'app-results-table',
  standalone: true,
  imports: [
    FormsModule,
    DragDropModule,
    MatTableModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDividerModule,
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
              @if (queryStore.pendingDeleteCount() > 0) {
                {{ queryStore.getDirtyDocumentCount() }} change(s) ({{ queryStore.pendingDeleteCount() }} deletion(s))
              } @else {
                {{ queryStore.getDirtyDocumentCount() }} unsaved change(s)
              }
            </span>
            <button mat-flat-button class="save-all-btn" (click)="onSaveAll()">
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

          <div class="toolbar-separator"></div>

          <!-- Global Search -->
          <div class="global-search">
            <mat-icon>search</mat-icon>
            <input
              type="text"
              placeholder="Search..."
              [value]="globalSearchValue()"
              (input)="onGlobalSearchChange($any($event.target).value)"
            />
            @if (globalSearchValue()) {
              <button mat-icon-button (click)="onGlobalSearchChange('')" class="clear-btn">
                <mat-icon>close</mat-icon>
              </button>
            }
          </div>

          <!-- Column Filter Toggle -->
          <button
            mat-icon-button
            (click)="toggleColumnFilters()"
            [class.active]="showColumnFilters()"
            matTooltip="Toggle column filters"
          >
            <mat-icon>filter_list</mat-icon>
          </button>

          <!-- Column Picker -->
          <button mat-icon-button [matMenuTriggerFor]="columnMenu" matTooltip="Manage columns">
            <mat-icon>view_column</mat-icon>
          </button>
          <mat-menu #columnMenu="matMenu" class="column-picker-menu">
            <div class="column-picker-header" (click)="$event.stopPropagation()">
              <span>Columns</span>
              <div class="column-picker-actions">
                <mat-icon
                  class="action-icon"
                  (click)="showAllColumns()"
                  matTooltip="Show All"
                >visibility</mat-icon>
                <mat-icon
                  class="action-icon"
                  (click)="hideAllColumns()"
                  matTooltip="Hide All"
                >visibility_off</mat-icon>
                <span class="action-divider"></span>
                <mat-icon
                  class="action-icon"
                  (click)="saveAsContainerPreset()"
                  matTooltip="Save as Container Default"
                >save</mat-icon>
                <mat-icon
                  class="action-icon"
                  (click)="resetToContainerPreset()"
                  matTooltip="Reset to Container Default"
                >restore</mat-icon>
              </div>
            </div>
            <div
              class="column-picker-list"
              cdkDropList
              (cdkDropListDropped)="onColumnDrop($event)"
              (click)="$event.stopPropagation()"
            >
              @for (col of orderedColumnsForPicker(); track col.path) {
                <div class="column-picker-item" cdkDrag cdkDragLockAxis="y">
                  <span class="drag-handle">⋮⋮</span>
                  <mat-checkbox
                    [checked]="isColumnVisible(col.path)"
                    (change)="toggleColumnVisibility(col.path)"
                    [disabled]="col.path === 'id'"
                    (mousedown)="$event.stopPropagation()"
                  >
                    {{ col.label }}
                  </mat-checkbox>
                  <span class="picker-spacer"></span>
                  <mat-icon
                    class="pin-btn"
                    [class.pinned]="isColumnPinned(col.path)"
                    (click)="toggleColumnPin(col.path)"
                    (mousedown)="$event.stopPropagation()"
                    matTooltip="Pin column"
                  >push_pin</mat-icon>
                </div>
              }
            </div>
          </mat-menu>
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
        <div class="table-wrapper" tabindex="0" #tableWrapper (scroll)="closeContextMenu()" [class.selecting]="isDragging()">
          <table mat-table [dataSource]="processedDocuments()">
            <!-- Row number column -->
            <ng-container matColumnDef="_rowNum">
              <th mat-header-cell *matHeaderCellDef class="row-num-cell">#</th>
              <td
                mat-cell
                *matCellDef="let doc; let i = index"
                class="row-num-cell"
                [class.row-selected]="isRowSelected(getDocKey(doc))"
                (mousedown)="onRowNumberMouseDown(getDocKey(doc), $event)"
                (mouseenter)="onRowNumberMouseEnter(getDocKey(doc))"
              >
                {{ i + 1 }}
              </td>
            </ng-container>

            @for (column of visibleColumns(); track column) {
              <ng-container [matColumnDef]="column">
                <th
                  mat-header-cell
                  *matHeaderCellDef
                  [class.id-column]="isIdColumn(column)"
                  [class.partition-key-column]="isPartitionKeyField(column) && !isIdColumn(column)"
                  [class.system-column]="isSystemField(column)"
                  [class.pinned-column]="isColumnPinned(column)"
                  [class.sortable]="true"
                  [style.width.px]="columnWidths()[column]"
                  [style.min-width.px]="columnWidths()[column]"
                  [style.max-width.px]="columnWidths()[column]"
                  (click)="onHeaderClick(column, $event)"
                >
                  <div class="header-content">
                    <span class="header-label">
                      @if (isColumnPinned(column)) {
                        <mat-icon class="pin-indicator">push_pin</mat-icon>
                      }
                      @if (isIdColumn(column)) {
                        <mat-icon class="key-icon">key</mat-icon>
                      } @else if (isPartitionKeyField(column)) {
                        <mat-icon class="key-icon partition">dynamic_feed</mat-icon>
                      }
                      {{ getColumnLabel(column) }}
                    </span>
                    @if (getSortDirection(column)) {
                      <mat-icon class="sort-icon">
                        {{ getSortDirection(column) === 'asc' ? 'arrow_upward' : 'arrow_downward' }}
                      </mat-icon>
                    }
                    <div
                      class="resize-handle"
                      (mousedown)="startResize($event, column); $event.stopPropagation()"
                      (click)="$event.stopPropagation()"
                    ></div>
                  </div>
                  @if (showColumnFilters()) {
                    <div class="column-filter" (click)="$event.stopPropagation()">
                      <input
                        type="text"
                        placeholder="Filter..."
                        [value]="getColumnFilter(column)"
                        (input)="onColumnFilterChange(column, $any($event.target).value)"
                      />
                    </div>
                  }
                </th>
                <td
                  mat-cell
                  *matCellDef="let doc"
                  [class.dirty]="queryStore.isFieldDirty(doc, column)"
                  [class.editable]="!isSystemField(column)"
                  [class.cell-focused]="isCellFocused(getDocKey(doc), column)"
                  [class.cell-selected]="isCellInSelection(getDocKey(doc), column)"
                  [class.id-column]="isIdColumn(column)"
                  [class.partition-key-column]="isPartitionKeyField(column) && !isIdColumn(column)"
                  [class.system-column]="isSystemField(column)"
                  [style.width.px]="columnWidths()[column]"
                  [style.min-width.px]="columnWidths()[column]"
                  [style.max-width.px]="columnWidths()[column]"
                  (mousedown)="onCellMouseDown(getDocKey(doc), column, $event)"
                  (mouseenter)="onCellMouseEnter(getDocKey(doc), column)"
                  (dblclick)="startEditing(doc, column)"
                >
                  @if (editingCell?.docKey === getDocKey(doc) && editingCell?.path === column) {
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
                        @if (isValidIsoDateValue) {
                          <span class="date-badge" matTooltip="Valid ISO 8601 date" matTooltipPosition="above">D✓</span>
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
              [class.dirty-row]="queryStore.isDocumentDirty(row)"
              [class.pending-delete-row]="isMarkedForDeletion(row)"
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
            @if (hasSelection() && getSelectionCount() > 1) {
              <div class="context-menu-header">
                {{ getSelectionCount() }} rows selected
              </div>
              <button class="context-menu-item" (click)="onExportSelectionJson(); closeContextMenu()">
                <mat-icon>code</mat-icon>
                Export Selection as JSON
              </button>
              <button class="context-menu-item" (click)="onExportSelectionCsv(); closeContextMenu()">
                <mat-icon>table_chart</mat-icon>
                Export Selection as CSV
              </button>
              <div class="context-menu-divider"></div>
            }
            @if (isMarkedForDeletion(contextMenu()!.doc)) {
              <button class="context-menu-item restore" (click)="restoreFromDeletion(contextMenu()!.doc); closeContextMenu()">
                <mat-icon>restore</mat-icon>
                Restore (Cancel Delete)
              </button>
              <div class="context-menu-divider"></div>
            }
            @if (queryStore.isDocumentDirty(contextMenu()!.doc) && !isMarkedForDeletion(contextMenu()!.doc)) {
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
            @if (!isMarkedForDeletion(contextMenu()!.doc)) {
              <button class="context-menu-item" (click)="onViewJson(contextMenu()!.doc); closeContextMenu()">
                <mat-icon>code</mat-icon>
                View/Edit JSON
              </button>
              <button class="context-menu-item" (click)="onDuplicateDocument(contextMenu()!.doc); closeContextMenu()">
                <mat-icon>content_copy</mat-icon>
                Duplicate
              </button>
              <div class="context-menu-divider"></div>
              <button class="context-menu-item delete" (click)="onMarkForDeletion(contextMenu()!.doc); closeContextMenu()">
                <mat-icon>delete</mat-icon>
                Delete
              </button>
            }
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

      .save-all-btn {
        background: linear-gradient(135deg, #4caf50 0%, #388e3c 100%) !important;
        color: white !important;
      }

      .save-all-btn:hover {
        background: linear-gradient(135deg, #66bb6a 0%, #43a047 100%) !important;
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
        cursor: pointer;
      }

      td.row-num-cell:hover {
        background: rgba(66, 165, 245, 0.15);
        color: rgba(255, 255, 255, 0.7);
      }

      td.row-num-cell.row-selected {
        background: rgba(66, 165, 245, 0.3);
        color: white;
        font-weight: 600;
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

      td.mat-mdc-cell.cell-focused {
        outline: 2px solid #bb86fc;
        outline-offset: -2px;
        background: rgba(187, 134, 252, 0.15) !important;
      }

      td.mat-mdc-cell.cell-selected {
        background: rgba(66, 165, 245, 0.3) !important;
        position: relative;
      }

      td.mat-mdc-cell.cell-selected::after {
        content: '';
        position: absolute;
        inset: 0;
        border: 1px solid rgba(66, 165, 245, 0.6);
        pointer-events: none;
      }

      td.mat-mdc-cell.cell-selected.cell-focused {
        background: rgba(66, 165, 245, 0.35) !important;
        outline: 2px solid #bb86fc;
        outline-offset: -2px;
      }

      td.mat-mdc-cell.cell-selected.cell-focused::after {
        border: none;
      }

      .table-wrapper:focus {
        outline: none;
      }

      .table-wrapper.selecting {
        user-select: none;
        cursor: cell;
      }

      .table-wrapper.selecting td {
        cursor: cell;
      }

      tr.dirty-row {
        background: rgba(255, 183, 77, 0.05);
      }

      tr.pending-delete-row {
        background: rgba(244, 67, 54, 0.15) !important;
        opacity: 0.7;
      }

      tr.pending-delete-row td {
        color: rgba(255, 255, 255, 0.5) !important;
        text-decoration: line-through !important;
        background: rgba(244, 67, 54, 0.15) !important;
      }

      tr.pending-delete-row td .cell-value,
      tr.pending-delete-row td app-cell-formatter {
        text-decoration: line-through !important;
      }

      tr.pending-delete-row:hover {
        opacity: 0.9;
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

      .date-badge {
        font-size: 10px;
        font-weight: 600;
        color: #4fc3f7;
        background: rgba(3, 169, 244, 0.15);
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
        min-width: 200px;
        z-index: 1000;
      }

      .context-menu-header {
        padding: 8px 16px;
        font-size: 11px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.5);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        margin-bottom: 4px;
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

      .context-menu-item.restore {
        color: #4caf50;
      }

      .context-menu-item.restore mat-icon {
        color: #4caf50;
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

      /* Toolbar separator */
      .toolbar-separator {
        width: 1px;
        height: 24px;
        background: rgba(255, 255, 255, 0.15);
        margin: 0 8px;
      }

      /* Global search */
      .global-search {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 4px 8px;
        background: rgba(0, 0, 0, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 4px;
        min-width: 160px;
      }

      .global-search mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        color: rgba(255, 255, 255, 0.5);
      }

      .global-search input {
        flex: 1;
        background: none;
        border: none;
        color: white;
        font-size: 12px;
        outline: none;
        min-width: 80px;
      }

      .global-search input::placeholder {
        color: rgba(255, 255, 255, 0.4);
      }

      .global-search .clear-btn {
        width: 20px;
        height: 20px;
        line-height: 20px;
      }

      .global-search .clear-btn mat-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
      }

      button.active {
        color: #bb86fc;
      }

      /* Column picker menu */
      ::ng-deep .column-picker-menu {
        min-width: 220px;
        max-height: 400px;
        border-radius: 8px !important;
      }

      ::ng-deep .column-picker-menu .mat-mdc-menu-content {
        padding: 0 !important;
      }

      .column-picker-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 12px;
        background: rgba(187, 134, 252, 0.08);
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }

      .column-picker-header > span {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: rgba(255, 255, 255, 0.7);
      }

      .column-picker-actions {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .column-picker-actions .action-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        padding: 4px;
        border-radius: 4px;
        cursor: pointer;
        color: rgba(255, 255, 255, 0.5);
        transition: all 0.15s;
      }

      .column-picker-actions .action-icon:hover {
        color: #bb86fc;
        background: rgba(187, 134, 252, 0.15);
      }

      .action-divider {
        width: 1px;
        height: 16px;
        background: rgba(255, 255, 255, 0.15);
        margin: 0 4px;
      }

      .column-picker-list {
        max-height: 200px;
        overflow-y: auto;
        padding: 6px 0;
        user-select: none;
      }

      .column-picker-item {
        display: flex;
        align-items: center;
        padding: 5px 10px;
        gap: 6px;
        min-height: 30px;
        user-select: none;
        cursor: grab;
        transition: background 0.1s;
      }

      .column-picker-item:hover {
        background: rgba(255, 255, 255, 0.05);
      }

      .column-picker-item mat-checkbox {
        font-size: 12px;
      }

      ::ng-deep .column-picker-item .mdc-checkbox {
        width: 16px;
        height: 16px;
        padding: 0;
      }

      ::ng-deep .column-picker-item .mdc-checkbox__background {
        width: 14px;
        height: 14px;
        top: 1px;
        left: 1px;
      }

      ::ng-deep .column-picker-item .mdc-form-field {
        font-size: 12px;
      }

      ::ng-deep .column-picker-item .mdc-form-field > label {
        padding-left: 6px;
        color: rgba(255, 255, 255, 0.85);
      }

      .picker-spacer {
        flex: 1;
      }

      .column-picker-item .drag-handle {
        color: rgba(255, 255, 255, 0.25);
        font-size: 11px;
        letter-spacing: -3px;
        flex-shrink: 0;
      }

      .column-picker-item:hover .drag-handle {
        color: rgba(255, 255, 255, 0.5);
      }

      .column-picker-item .pin-btn {
        font-size: 14px;
        width: 14px;
        height: 14px;
        cursor: pointer;
        color: rgba(255, 255, 255, 0.25);
        flex-shrink: 0;
        transition: all 0.15s;
      }

      .column-picker-item:hover .pin-btn {
        color: rgba(255, 255, 255, 0.5);
      }

      .column-picker-item .pin-btn:hover {
        color: #bb86fc;
      }

      .column-picker-item .pin-btn.pinned {
        color: #bb86fc;
        transform: rotate(45deg);
      }

      /* Sorting */
      th.sortable {
        cursor: pointer;
      }

      th.sortable:hover {
        background: rgba(255, 255, 255, 0.05);
      }

      .sort-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
        margin-left: 4px;
        color: #bb86fc;
      }

      .pin-indicator {
        font-size: 12px;
        width: 12px;
        height: 12px;
        margin-right: 4px;
        color: #bb86fc;
        transform: rotate(45deg);
      }

      /* Pinned columns */
      th.pinned-column,
      td.pinned-column {
        position: sticky;
        left: 45px;
        z-index: 2;
        background: #252525;
        border-right: 2px solid rgba(187, 134, 252, 0.3);
      }

      th.pinned-column {
        z-index: 4;
      }

      /* Column filters */
      .column-filter {
        padding: 4px 8px 4px 4px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        margin-top: 4px;
      }

      .column-filter input {
        width: 100%;
        padding: 4px 6px;
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 4px;
        color: white;
        font-size: 11px;
        outline: none;
      }

      .column-filter input:focus {
        border-color: #bb86fc;
      }

      .column-filter input::placeholder {
        color: rgba(255, 255, 255, 0.4);
      }

      /* Search highlighting */
      ::ng-deep .highlight {
        background: rgba(255, 235, 59, 0.3);
        border-radius: 2px;
        padding: 0 2px;
      }

      /* Drag-drop column reordering */
      ::ng-deep .column-picker-item.cdk-drag-preview {
        display: flex;
        align-items: center;
        background: linear-gradient(135deg, #2d2d44 0%, #252538 100%);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(187, 134, 252, 0.2);
        border-radius: 6px;
        padding: 5px 10px;
        font-size: 12px;
        min-height: 30px;
        gap: 6px;
        user-select: none;
      }

      ::ng-deep .column-picker-item.cdk-drag-placeholder {
        background: rgba(187, 134, 252, 0.1);
        border: 1px dashed rgba(187, 134, 252, 0.3);
        border-radius: 4px;
      }

      ::ng-deep .cdk-drop-list-dragging .column-picker-item:not(.cdk-drag-placeholder) {
        transition: transform 200ms cubic-bezier(0, 0, 0.2, 1);
      }

      ::ng-deep .cdk-drag-animating {
        transition: transform 200ms cubic-bezier(0, 0, 0.2, 1);
      }
    `,
  ],
})
export class ResultsTableComponent {
  readonly queryStore = inject(QueryStore);
  private readonly explorerStore = inject(ExplorerStore);
  private readonly tablePrefs = inject(TablePreferencesService);
  private readonly strategyFactory = inject(TableProviderStrategyFactory);
  private dialog = inject(MatDialog);
  private importExportService = inject(ImportExportService);

  /** Current provider strategy for document handling */
  readonly strategy = this.strategyFactory.currentStrategy;

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('tableWrapper') tableWrapper!: ElementRef<HTMLDivElement>;

  container = input<ContainerInfo | null>(null);

  editingCell: { docKey: string; path: string } | null = null;
  editingValue = '';
  importType: 'json' | 'csv' = 'json';
  private isEditingCancelled = false;

  // Keyboard navigation - track by docKey (includes partition key) and column path
  focusedCell = signal<{ docKey: string; path: string } | null>(null);

  // Area selection for copy/paste
  selectionStart = signal<{ docKey: string; path: string } | null>(null);
  selectionEnd = signal<{ docKey: string; path: string } | null>(null);
  isDragging = signal(false);

  // Type selection for inline editing
  applicableTypes: TypeOption[] = [];
  specialOptions: TypeOption[] = getSpecialOptions();
  selectedType: FieldType = 'string';
  isValidGuidValue = false;
  isValidIsoDateValue = false;

  // Column resizing
  private columnWidthsMap = signal<Record<string, number>>({});
  private resizingColumn: string | null = null;
  private resizeStartX = 0;
  private resizeStartWidth = 0;
  private justFinishedResizing = false;
  private readonly DEFAULT_COLUMN_WIDTH = 150;
  private readonly MIN_COLUMN_WIDTH = 60;
  private readonly MAX_COLUMN_WIDTH = 600;

  // Column filters toggle
  showColumnFilters = signal(false);

  // Current tab and container key
  private currentTabId = computed(() => this.explorerStore.activeTabId());
  private containerKey = computed(() => {
    const cont = this.container();
    const connectionId = sessionStorage.getItem('activeConnectionId');
    if (!cont || !connectionId) return null;
    return createContainerKey(connectionId, cont.databaseId, cont.id);
  });

  // Column preferences for current tab
  private columnPrefs = computed(() => {
    const tabId = this.currentTabId();
    if (!tabId) return [];
    return this.tablePrefs.preferences().tabs[tabId]?.columns ?? [];
  });

  // Sort state for current tab
  private sortState = computed(() => {
    const tabId = this.currentTabId();
    if (!tabId) return { column: null, direction: null };
    return this.tablePrefs.getSortState(tabId);
  });

  // Filter state for current tab
  private filterState = computed(() => {
    const tabId = this.currentTabId();
    if (!tabId) return { globalSearch: '', columnFilters: {} };
    return this.tablePrefs.getFilterState(tabId);
  });

  // Global search value
  globalSearchValue = computed(() => this.filterState().globalSearch);

  // Ordered columns for picker (by saved order)
  orderedColumnsForPicker = computed(() => {
    const prefs = this.columnPrefs();
    const queryColumns = this.queryStore.columns();

    if (prefs.length === 0) {
      return queryColumns;
    }

    // Sort by saved order
    return [...queryColumns].sort((a, b) => {
      const prefA = prefs.find(p => p.path === a.path);
      const prefB = prefs.find(p => p.path === b.path);
      const orderA = prefA?.order ?? 1000;
      const orderB = prefB?.order ?? 1000;
      return orderA - orderB;
    });
  });

  // Visible columns (respecting visibility and order)
  visibleColumns = computed(() => {
    const prefs = this.columnPrefs();
    if (prefs.length === 0) {
      // Fall back to query store columns
      return this.queryStore.columns().map(c => c.path);
    }
    return prefs
      .filter(p => p.visible)
      .sort((a, b) => {
        // Pinned columns first
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return a.order - b.order;
      })
      .map(p => p.path);
  });

  // Processed documents (filtered and sorted)
  processedDocuments = computed(() => {
    let docs = [...this.queryStore.documents()];
    const filter = this.filterState();
    const sort = this.sortState();
    const visibleCols = this.visibleColumns();

    // Apply global search filter
    if (filter.globalSearch) {
      const search = filter.globalSearch.toLowerCase();
      docs = docs.filter(doc =>
        visibleCols.some(col => {
          const value = this.getCellValue(doc, col);
          return String(value ?? '').toLowerCase().includes(search);
        })
      );
    }

    // Apply column filters
    for (const [col, filterVal] of Object.entries(filter.columnFilters)) {
      if (filterVal) {
        const search = filterVal.toLowerCase();
        docs = docs.filter(doc => {
          const value = this.getCellValue(doc, col);
          return String(value ?? '').toLowerCase().includes(search);
        });
      }
    }

    // Apply sorting
    if (sort.column && sort.direction) {
      const sortCol = sort.column;
      const sortDir = sort.direction;
      docs.sort((a, b) => {
        const aVal = this.getCellValue(a, sortCol);
        const bVal = this.getCellValue(b, sortCol);

        // Handle nulls
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return sortDir === 'asc' ? 1 : -1;
        if (bVal == null) return sortDir === 'asc' ? -1 : 1;

        // Compare based on type
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
        }

        const aStr = String(aVal);
        const bStr = String(bVal);
        const cmp = aStr.localeCompare(bStr);
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return docs;
  });

  constructor() {
    // Initialize column preferences when columns change
    effect(() => {
      const tabId = this.currentTabId();
      const containerKey = this.containerKey();
      const columns = this.queryStore.columns();

      if (tabId && containerKey && columns.length > 0) {
        this.tablePrefs.initializeTabColumns(
          tabId,
          containerKey,
          columns.map(c => c.path)
        );
      }
    });
  }

  columnWidths = computed(() => {
    const widths: Record<string, number> = {};
    for (const col of this.visibleColumns()) {
      // Check live resize map first, then fall back to preferences
      const liveWidth = this.columnWidthsMap()[col];
      const pref = this.columnPrefs().find(p => p.path === col);
      widths[col] = liveWidth ?? pref?.width ?? this.DEFAULT_COLUMN_WIDTH;
    }
    return widths;
  });

  displayedColumns = computed(() => {
    return this.queryStore.columns().map((c) => c.path);
  });

  allColumns = computed(() => {
    return ['_rowNum', ...this.visibleColumns()];
  });

  // Extract partition key field names from path(s)
  // Supports hierarchical partition keys (comma-separated, e.g., "/tenant,/user")
  partitionKeyFields = computed(() => {
    const path = this.container()?.partitionKeyPath;
    if (!path) return [];
    return path.split(',').map(p => p.trim().replace(/^\//, ''));
  });

  // For backwards compatibility - returns first partition key field
  partitionKeyField = computed(() => {
    const fields = this.partitionKeyFields();
    return fields.length > 0 ? fields[0] : null;
  });

  // Check if a column is a partition key field
  isPartitionKeyField(column: string): boolean {
    return this.partitionKeyFields().includes(column);
  }

  // Context menu state
  contextMenu = signal<{ x: number; y: number; doc: CosmosDocument } | null>(null);

  getColumnLabel(path: string): string {
    const column = this.queryStore.columns().find((c) => c.path === path);
    return column?.label ?? path;
  }

  // Get document identifier (supports both 'id' for CosmosSQL and '_id' for MongoDB)
  getDocId(doc: CosmosDocument): string {
    return this.strategy().getDocumentId(doc);
  }

  // Get unique document key (includes partition key for uniqueness)
  getDocKey(doc: CosmosDocument): string {
    return this.queryStore.getDocumentKey(doc);
  }

  // Find document by its unique key
  findDocByKey(key: string): CosmosDocument | undefined {
    return this.processedDocuments().find(d => this.getDocKey(d) === key);
  }

  // Column visibility methods
  isColumnVisible(path: string): boolean {
    const pref = this.columnPrefs().find(p => p.path === path);
    return pref?.visible ?? true;
  }

  toggleColumnVisibility(path: string): void {
    const tabId = this.currentTabId();
    if (!tabId) return;
    const pref = this.columnPrefs().find(p => p.path === path);
    if (pref) {
      this.tablePrefs.updateTabColumn(tabId, path, { visible: !pref.visible });
    }
  }

  showAllColumns(): void {
    const tabId = this.currentTabId();
    if (!tabId) return;
    const columns = this.columnPrefs().map(c => ({ ...c, visible: true }));
    this.tablePrefs.updateTabColumns(tabId, columns);
  }

  hideAllColumns(): void {
    const tabId = this.currentTabId();
    if (!tabId) return;
    // Keep id visible
    const columns = this.columnPrefs().map(c => ({
      ...c,
      visible: c.path === 'id',
    }));
    this.tablePrefs.updateTabColumns(tabId, columns);
  }

  // Column pinning methods
  isColumnPinned(path: string): boolean {
    const pref = this.columnPrefs().find(p => p.path === path);
    return pref?.pinned ?? false;
  }

  toggleColumnPin(path: string): void {
    const tabId = this.currentTabId();
    if (!tabId) return;
    const pref = this.columnPrefs().find(p => p.path === path);
    if (pref) {
      this.tablePrefs.updateTabColumn(tabId, path, { pinned: !pref.pinned });
    }
  }

  // Drag-drop column reordering
  onColumnDrop(event: CdkDragDrop<unknown>): void {
    const tabId = this.currentTabId();
    if (!tabId || event.previousIndex === event.currentIndex) return;

    this.tablePrefs.reorderColumns(tabId, event.previousIndex, event.currentIndex);
  }

  // Sorting methods
  getSortDirection(column: string): SortDirection {
    const sort = this.sortState();
    return sort.column === column ? sort.direction : null;
  }

  onHeaderClick(column: string, event: MouseEvent): void {
    // Don't sort if resizing or just finished resizing
    if (this.resizingColumn || this.justFinishedResizing) return;

    const tabId = this.currentTabId();
    if (!tabId) return;

    const current = this.sortState();
    let newDirection: SortDirection;

    if (current.column !== column) {
      newDirection = 'asc';
    } else if (current.direction === 'asc') {
      newDirection = 'desc';
    } else {
      newDirection = null;
    }

    this.tablePrefs.updateSort(tabId, {
      column: newDirection ? column : null,
      direction: newDirection,
    });
  }

  // Filter methods
  toggleColumnFilters(): void {
    this.showColumnFilters.update(v => !v);
  }

  onGlobalSearchChange(value: string): void {
    const tabId = this.currentTabId();
    if (!tabId) return;
    this.tablePrefs.updateFilter(tabId, { globalSearch: value });
  }

  getColumnFilter(column: string): string {
    return this.filterState().columnFilters[column] ?? '';
  }

  onColumnFilterChange(column: string, value: string): void {
    const tabId = this.currentTabId();
    if (!tabId) return;
    const current = this.filterState().columnFilters;
    this.tablePrefs.updateFilter(tabId, {
      columnFilters: { ...current, [column]: value },
    });
  }

  // Preset methods
  saveAsContainerPreset(): void {
    const tabId = this.currentTabId();
    const containerKey = this.containerKey();
    if (tabId && containerKey) {
      this.tablePrefs.saveAsContainerPreset(tabId, containerKey);
    }
  }

  resetToContainerPreset(): void {
    const tabId = this.currentTabId();
    const containerKey = this.containerKey();
    if (tabId && containerKey) {
      this.tablePrefs.resetToContainerPreset(tabId, containerKey);
    }
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
    // Handle column resize end
    if (this.resizingColumn) {
      // Save the column width to preferences
      const tabId = this.currentTabId();
      const width = this.columnWidthsMap()[this.resizingColumn];
      if (tabId && width) {
        this.tablePrefs.updateTabColumn(tabId, this.resizingColumn, { width });
      }
      this.resizingColumn = null;
      // Prevent accidental sort trigger after resize
      this.justFinishedResizing = true;
      setTimeout(() => this.justFinishedResizing = false, 100);
    }

    // Handle cell selection drag end
    if (this.isDragging()) {
      this.isDragging.set(false);
      // If start and end are the same, clear selection (single cell click)
      const start = this.selectionStart();
      const end = this.selectionEnd();
      if (start && end && start.docKey === end.docKey && start.path === end.path) {
        this.selectionStart.set(null);
        this.selectionEnd.set(null);
      }
    }

    // Handle row selection drag end
    if (this.isRowDragging()) {
      this.isRowDragging.set(false);
      this.rowDragStartDocKey.set(null);
      // Focus table for keyboard events after row selection
      this.refocusTable();
    }
  }

  // Keyboard navigation
  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    // Skip if editing or if focus is in an input/textarea
    if (this.editingCell) return;
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

    const focused = this.focusedCell();
    const docs = this.processedDocuments();
    // Use visibleColumns which respects pinned column order
    const columns = this.visibleColumns();

    // Handle copy/paste
    if ((event.metaKey || event.ctrlKey) && event.key === 'c') {
      event.preventDefault();
      this.copySelection();
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key === 'v') {
      event.preventDefault();
      this.pasteToSelection();
      return;
    }

    // Handle Delete/Backspace key
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      this.handleDeleteKey();
      return;
    }

    const isNavKey = ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape', 'Tab'].includes(event.key);

    // Type to edit: if a cell is focused and user types a printable character, start editing
    if (focused && !isNavKey && !event.metaKey && !event.ctrlKey && !event.altKey && event.key.length === 1) {
      const doc = docs.find(d => this.getDocKey(d) === focused.docKey);
      if (doc && !this.isSystemField(focused.path)) {
        event.preventDefault();
        this.startEditingWithChar(doc, focused.path, event.key);
        return;
      }
    }

    if (!focused && !isNavKey) return;
    if (docs.length === 0 || columns.length === 0) return;

    // Get current position
    let rowIndex = focused ? docs.findIndex(d => this.getDocKey(d) === focused.docKey) : -1;
    let colIndex = focused ? columns.indexOf(focused.path) : -1;

    // Handle shift+arrow for area selection
    const isShift = event.shiftKey;

    // Save original focused cell for selection start (before we change it)
    const originalFocused = focused ? { ...focused } : null;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!focused) {
          this.focusedCell.set({ docKey: this.getDocKey(docs[0]), path: columns[0] });
          this.clearSelection();
        } else if (rowIndex < docs.length - 1) {
          const newCell = { docKey: this.getDocKey(docs[rowIndex + 1]), path: columns[colIndex] };
          if (isShift) {
            this.extendSelectionFrom(originalFocused!, newCell);
          } else {
            this.clearSelection();
          }
          this.focusedCell.set(newCell);
        }
        this.scrollToFocusedCell();
        break;

      case 'ArrowUp':
        event.preventDefault();
        if (focused && rowIndex > 0) {
          const newCell = { docKey: this.getDocKey(docs[rowIndex - 1]), path: columns[colIndex] };
          if (isShift) {
            this.extendSelectionFrom(originalFocused!, newCell);
          } else {
            this.clearSelection();
          }
          this.focusedCell.set(newCell);
          this.scrollToFocusedCell();
        }
        break;

      case 'ArrowRight':
      case 'Tab':
        event.preventDefault();
        if (!focused) {
          this.focusedCell.set({ docKey: this.getDocKey(docs[0]), path: columns[0] });
          this.clearSelection();
        } else if (colIndex < columns.length - 1) {
          const newCell = { docKey: this.getDocKey(docs[rowIndex]), path: columns[colIndex + 1] };
          if (isShift && event.key === 'ArrowRight') {
            this.extendSelectionFrom(originalFocused!, newCell);
          } else {
            this.clearSelection();
          }
          this.focusedCell.set(newCell);
        } else if (event.key === 'Tab' && rowIndex < docs.length - 1) {
          // Tab at end of row goes to first column of next row
          const newCell = { docKey: this.getDocKey(docs[rowIndex + 1]), path: columns[0] };
          this.focusedCell.set(newCell);
          this.clearSelection();
        }
        this.scrollToFocusedCell();
        break;

      case 'ArrowLeft':
        event.preventDefault();
        if (focused && colIndex > 0) {
          const newCell = { docKey: this.getDocKey(docs[rowIndex]), path: columns[colIndex - 1] };
          if (isShift) {
            this.extendSelectionFrom(originalFocused!, newCell);
          } else {
            this.clearSelection();
          }
          this.focusedCell.set(newCell);
          this.scrollToFocusedCell();
        }
        break;

      case 'Enter':
        event.preventDefault();
        if (focused) {
          const doc = docs.find(d => this.getDocKey(d) === focused.docKey);
          if (doc) {
            this.startEditing(doc, focused.path);
          }
        }
        break;

      case 'Escape':
        event.preventDefault();
        this.focusedCell.set(null);
        this.clearSelection();
        break;
    }
  }

  // Start editing with initial character
  private startEditingWithChar(doc: CosmosDocument, path: string, char: string) {
    if (this.isSystemField(path)) return;

    const value = getValueAtPath(doc, stringToPath(path));

    // For complex types, don't allow type-to-edit
    if (value !== null && typeof value === 'object') {
      return;
    }

    this.editingCell = { docKey: this.getDocKey(doc), path };
    this.editingValue = char;

    this.updateApplicableTypes(this.editingValue, false);

    // Try to preserve the original type if the typed character is compatible
    const originalType = this.getTypeFromValue(value);

    // If original was a number and user typed a digit or minus, keep number type
    if (originalType === 'number' && /^[\d\-.]$/.test(char)) {
      this.selectedType = 'number';
    }
    // If original was boolean and user typed 't' or 'f', keep boolean
    else if (originalType === 'boolean' && /^[tf]$/i.test(char)) {
      this.selectedType = 'boolean';
    }
    // Otherwise use the first applicable type based on the new input
    else {
      this.selectedType = this.applicableTypes[0]?.type ?? 'string';
    }

    requestAnimationFrame(() => {
      setTimeout(() => {
        const input = document.querySelector('.cell-input') as HTMLInputElement;
        if (input) {
          input.focus();
          // Place cursor at end
          input.setSelectionRange(input.value.length, input.value.length);
        }
      }, 0);
    });
  }

  // Selection methods
  private clearSelection() {
    this.selectionStart.set(null);
    this.selectionEnd.set(null);
  }

  private extendSelectionFrom(startCell: { docKey: string; path: string }, endCell: { docKey: string; path: string }) {
    if (!this.selectionStart()) {
      this.selectionStart.set(startCell);
    }
    this.selectionEnd.set(endCell);
  }

  getSelectedCells(): Array<{ docKey: string; path: string }> {
    const start = this.selectionStart();
    const end = this.selectionEnd();

    if (!start || !end) {
      const focused = this.focusedCell();
      return focused ? [focused] : [];
    }

    const docs = this.processedDocuments();
    const columns = this.visibleColumns();

    const startRowIdx = docs.findIndex(d => this.getDocKey(d) === start.docKey);
    const endRowIdx = docs.findIndex(d => this.getDocKey(d) === end.docKey);
    const startColIdx = columns.indexOf(start.path);
    const endColIdx = columns.indexOf(end.path);

    const minRow = Math.min(startRowIdx, endRowIdx);
    const maxRow = Math.max(startRowIdx, endRowIdx);
    const minCol = Math.min(startColIdx, endColIdx);
    const maxCol = Math.max(startColIdx, endColIdx);

    const cells: Array<{ docKey: string; path: string }> = [];
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        cells.push({ docKey: this.getDocKey(docs[r]), path: columns[c] });
      }
    }
    return cells;
  }

  isCellInSelection(docKey: string, path: string): boolean {
    const start = this.selectionStart();
    const end = this.selectionEnd();

    if (!start || !end) return false;

    const docs = this.processedDocuments();
    const columns = this.visibleColumns();

    const cellRowIdx = docs.findIndex(d => this.getDocKey(d) === docKey);
    const cellColIdx = columns.indexOf(path);

    const startRowIdx = docs.findIndex(d => this.getDocKey(d) === start.docKey);
    const endRowIdx = docs.findIndex(d => this.getDocKey(d) === end.docKey);
    const startColIdx = columns.indexOf(start.path);
    const endColIdx = columns.indexOf(end.path);

    const minRow = Math.min(startRowIdx, endRowIdx);
    const maxRow = Math.max(startRowIdx, endRowIdx);
    const minCol = Math.min(startColIdx, endColIdx);
    const maxCol = Math.max(startColIdx, endColIdx);

    return cellRowIdx >= minRow && cellRowIdx <= maxRow &&
           cellColIdx >= minCol && cellColIdx <= maxCol;
  }

  private async copySelection() {
    const cells = this.getSelectedCells();
    if (cells.length === 0) return;

    const docs = this.processedDocuments();
    const columns = this.visibleColumns();

    // Group by row for TSV format
    const start = this.selectionStart() || this.focusedCell();
    const end = this.selectionEnd() || this.focusedCell();

    if (!start || !end) return;

    const startRowIdx = docs.findIndex(d => this.getDocKey(d) === start.docKey);
    const endRowIdx = docs.findIndex(d => this.getDocKey(d) === end.docKey);
    const startColIdx = columns.indexOf(start.path);
    const endColIdx = columns.indexOf(end.path);

    const minRow = Math.min(startRowIdx, endRowIdx);
    const maxRow = Math.max(startRowIdx, endRowIdx);
    const minCol = Math.min(startColIdx, endColIdx);
    const maxCol = Math.max(startColIdx, endColIdx);

    const rows: string[] = [];
    for (let r = minRow; r <= maxRow; r++) {
      const rowValues: string[] = [];
      for (let c = minCol; c <= maxCol; c++) {
        const value = this.getCellValue(docs[r], columns[c]);
        rowValues.push(this.formatValueForCopy(value));
      }
      rows.push(rowValues.join('\t'));
    }

    const text = rows.join('\n');
    await navigator.clipboard.writeText(text);
  }

  /**
   * Format a value for clipboard copy.
   * Handles MongoDB Extended JSON types properly.
   */
  private formatValueForCopy(value: any): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);

    // Handle MongoDB Extended JSON types
    if (typeof value === 'object') {
      // ObjectId
      if (value.$oid) return value.$oid;
      // UUID
      if (value.$uuid) return value.$uuid;
      // Binary (including UUID)
      if (value.$binary) {
        const subType = value.$binary.subType;
        if (subType === '03' || subType === '04' || subType === 3 || subType === 4) {
          return this.binaryToUuid(value.$binary.base64);
        }
        return value.$binary.base64 || '';
      }
      // Date
      if (value.$date) {
        if (typeof value.$date === 'string') return value.$date;
        if (value.$date.$numberLong) {
          return new Date(parseInt(value.$date.$numberLong, 10)).toISOString();
        }
      }
      // NumberLong
      if (value.$numberLong) return value.$numberLong;
      // NumberDecimal
      if (value.$numberDecimal) return value.$numberDecimal;
      // Regex
      if (value.$regex) return `/${value.$regex}/${value.$options || ''}`;
      // Arrays and other objects - stringify
      return JSON.stringify(value);
    }

    return String(value);
  }

  /**
   * Convert base64 binary to UUID string.
   */
  private binaryToUuid(base64: string): string {
    try {
      const binaryStr = atob(base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      if (bytes.length !== 16) {
        return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
      }
      const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
    } catch {
      return base64;
    }
  }

  private async pasteToSelection() {
    const cells = this.getSelectedCells();
    if (cells.length === 0) return;

    try {
      const text = await navigator.clipboard.readText();
      const docs = this.processedDocuments();
      const trimmedText = text.trim();

      // Check if pasted content is a JSON object or array
      if (this.isJsonContent(trimmedText)) {
        // Paste JSON into single focused cell
        const focused = this.focusedCell();
        if (focused && !this.isSystemField(focused.path)) {
          const doc = this.findDocByKey(focused.docKey);
          if (doc) {
            try {
              const jsonValue = JSON.parse(trimmedText);
              this.queryStore.updateDocumentField(doc, focused.path, jsonValue);
            } catch {
              // If JSON parse fails, paste as string
              this.queryStore.updateDocumentField(doc, focused.path, trimmedText);
            }
          }
        }
        return;
      }

      // Smart line detection: parse as TSV only if lines look like tabular data
      const rows = this.parseClipboardAsRows(text);

      if (rows.length === 1 && rows[0].length === 1) {
        // Single value - apply to all selected cells
        const value = this.parseClipboardValue(rows[0][0]);
        for (const cell of cells) {
          if (!this.isSystemField(cell.path)) {
            const doc = this.findDocByKey(cell.docKey);
            if (doc) {
              this.queryStore.updateDocumentField(doc, cell.path, value);
            }
          }
        }
      } else {
        // Multi-cell paste - match dimensions
        const columns = this.visibleColumns();
        const start = this.selectionStart() || this.focusedCell();
        if (!start) return;

        const startRowIdx = docs.findIndex(d => this.getDocKey(d) === start.docKey);
        const startColIdx = columns.indexOf(start.path);

        for (let r = 0; r < rows.length && startRowIdx + r < docs.length; r++) {
          for (let c = 0; c < rows[r].length && startColIdx + c < columns.length; c++) {
            const doc = docs[startRowIdx + r];
            const path = columns[startColIdx + c];
            if (!this.isSystemField(path)) {
              const value = this.parseClipboardValue(rows[r][c]);
              this.queryStore.updateDocumentField(doc, path, value);
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to paste:', err);
    }
  }

  // Check if content looks like a JSON object or array
  private isJsonContent(text: string): boolean {
    const trimmed = text.trim();
    // Check if it starts/ends like JSON object or array
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        JSON.parse(trimmed);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  // Parse clipboard text into rows, being smart about line breaks in JSON
  private parseClipboardAsRows(text: string): string[][] {
    // Split by newlines but be careful about quoted content
    const lines: string[] = [];
    let currentLine = '';
    let inQuotes = false;
    let braceDepth = 0;
    let bracketDepth = 0;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const prevChar = i > 0 ? text[i - 1] : '';

      // Track quotes (but not escaped ones)
      if (char === '"' && prevChar !== '\\') {
        inQuotes = !inQuotes;
      }

      // Track braces and brackets when not in quotes
      if (!inQuotes) {
        if (char === '{') braceDepth++;
        if (char === '}') braceDepth--;
        if (char === '[') bracketDepth++;
        if (char === ']') bracketDepth--;
      }

      // Only split on newline if we're not inside JSON structure or quotes
      if (char === '\n' && !inQuotes && braceDepth === 0 && bracketDepth === 0) {
        lines.push(currentLine);
        currentLine = '';
      } else if (char !== '\r') {
        currentLine += char;
      }
    }

    // Don't forget the last line
    if (currentLine) {
      lines.push(currentLine);
    }

    // Split each line by tabs
    return lines.map(line => line.split('\t'));
  }

  // Parse clipboard value to appropriate type
  private parseClipboardValue(value: string): any {
    const trimmed = value.trim();

    // Try to parse as JSON first (for objects, arrays, booleans, numbers)
    if (this.isJsonContent(trimmed)) {
      try {
        return JSON.parse(trimmed);
      } catch {
        // Fall through to string
      }
    }

    // Check for number
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      return parseFloat(trimmed);
    }

    // Check for boolean
    if (trimmed.toLowerCase() === 'true') return true;
    if (trimmed.toLowerCase() === 'false') return false;

    // Check for null
    if (trimmed.toLowerCase() === 'null') return null;

    // Return as string
    return value;
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

  onCellMouseDown(docKey: string, path: string, event: MouseEvent) {
    // Ignore right-click
    if (event.button !== 0) return;

    const newCell = { docKey, path };

    if (event.shiftKey && this.focusedCell()) {
      // Shift+click extends selection from focused cell
      this.selectionStart.set(this.focusedCell());
      this.selectionEnd.set(newCell);
      this.focusedCell.set(newCell);
    } else {
      // Start potential drag selection
      this.isDragging.set(true);
      this.selectionStart.set(newCell);
      this.selectionEnd.set(newCell);
      this.focusedCell.set(newCell);
    }
  }

  onCellMouseEnter(docKey: string, path: string) {
    // Extend selection while dragging
    if (this.isDragging()) {
      const newCell = { docKey, path };
      this.selectionEnd.set(newCell);
      this.focusedCell.set(newCell);
    }
  }


  onCellClick(docKey: string, path: string, event: MouseEvent) {
    // Click is now handled by mousedown, but keep for double-click compatibility
  }

  // Track if we're dragging from row numbers
  isRowDragging = signal(false);
  rowDragStartDocKey = signal<string | null>(null);

  onRowNumberMouseDown(docKey: string, event: MouseEvent) {
    // Ignore right-click
    if (event.button !== 0) return;
    event.preventDefault();

    const columns = this.visibleColumns();
    if (columns.length === 0) return;

    const firstCol = columns[0];
    const lastCol = columns[columns.length - 1];
    const docs = this.processedDocuments();

    if (event.shiftKey && this.selectionStart()) {
      // Shift+click: extend selection to include all rows from start to clicked row
      const start = this.selectionStart()!;
      const startRowIdx = docs.findIndex(d => this.getDocKey(d) === start.docKey);
      const clickedRowIdx = docs.findIndex(d => this.getDocKey(d) === docKey);

      const minRowIdx = Math.min(startRowIdx, clickedRowIdx);
      const maxRowIdx = Math.max(startRowIdx, clickedRowIdx);

      // Keep the original start row, extend to clicked row
      this.selectionStart.set({ docKey: this.getDocKey(docs[minRowIdx]), path: firstCol });
      this.selectionEnd.set({ docKey: this.getDocKey(docs[maxRowIdx]), path: lastCol });
      this.focusedCell.set({ docKey, path: firstCol });
    } else {
      // Start row drag selection
      this.isRowDragging.set(true);
      this.rowDragStartDocKey.set(docKey);
      this.selectionStart.set({ docKey, path: firstCol });
      this.selectionEnd.set({ docKey, path: lastCol });
      this.focusedCell.set({ docKey, path: firstCol });
    }

    // Focus the table wrapper so keyboard events work
    this.refocusTable();
  }

  onRowNumberMouseEnter(docKey: string) {
    if (!this.isRowDragging()) return;

    const columns = this.visibleColumns();
    if (columns.length === 0) return;

    const firstCol = columns[0];
    const lastCol = columns[columns.length - 1];
    const docs = this.processedDocuments();

    const startDocKey = this.rowDragStartDocKey();
    if (!startDocKey) return;

    const startRowIdx = docs.findIndex(d => this.getDocKey(d) === startDocKey);
    const currentRowIdx = docs.findIndex(d => this.getDocKey(d) === docKey);

    const minRowIdx = Math.min(startRowIdx, currentRowIdx);
    const maxRowIdx = Math.max(startRowIdx, currentRowIdx);

    this.selectionStart.set({ docKey: this.getDocKey(docs[minRowIdx]), path: firstCol });
    this.selectionEnd.set({ docKey: this.getDocKey(docs[maxRowIdx]), path: lastCol });
    this.focusedCell.set({ docKey, path: firstCol });
  }

  isRowSelected(docKey: string): boolean {
    const start = this.selectionStart();
    const end = this.selectionEnd();
    if (!start || !end) return false;

    // Check if the entire row is selected
    const columns = this.visibleColumns();
    if (columns.length === 0) return false;

    const docs = this.processedDocuments();
    const startRowIdx = docs.findIndex(d => this.getDocKey(d) === start.docKey);
    const endRowIdx = docs.findIndex(d => this.getDocKey(d) === end.docKey);
    const rowIdx = docs.findIndex(d => this.getDocKey(d) === docKey);

    const minRow = Math.min(startRowIdx, endRowIdx);
    const maxRow = Math.max(startRowIdx, endRowIdx);

    // Row is selected if it's in the selection range
    return rowIdx >= minRow && rowIdx <= maxRow;
  }

  getSelectedDocuments(): CosmosDocument[] {
    const start = this.selectionStart();
    const end = this.selectionEnd();
    if (!start || !end) return [];

    const docs = this.processedDocuments();
    const startRowIdx = docs.findIndex(d => this.getDocKey(d) === start.docKey);
    const endRowIdx = docs.findIndex(d => this.getDocKey(d) === end.docKey);

    const minRow = Math.min(startRowIdx, endRowIdx);
    const maxRow = Math.max(startRowIdx, endRowIdx);

    return docs.slice(minRow, maxRow + 1);
  }

  hasSelection(): boolean {
    return this.selectionStart() !== null && this.selectionEnd() !== null;
  }

  getSelectionCount(): number {
    return this.getSelectedDocuments().length;
  }

  onExportSelectionJson() {
    const cont = this.container();
    if (!cont) return;

    const docs = this.getSelectedDocuments();
    if (docs.length === 0) return;

    const filename = `${cont.databaseId}_${cont.name}_selection`;
    this.importExportService.exportToJson(docs, filename);
  }

  onExportSelectionCsv() {
    const cont = this.container();
    if (!cont) return;

    const docs = this.getSelectedDocuments();
    if (docs.length === 0) return;

    const filename = `${cont.databaseId}_${cont.name}_selection`;
    this.importExportService.exportToCsv(docs, filename);
  }

  // Handle Delete key press
  private handleDeleteKey() {
    const start = this.selectionStart();
    const end = this.selectionEnd();
    const focused = this.focusedCell();
    const columns = this.visibleColumns();

    // Check if entire rows are selected (selection spans all columns)
    let isFullRowSelection = false;
    if (start && end && columns.length > 0) {
      const startColIdx = columns.indexOf(start.path);
      const endColIdx = columns.indexOf(end.path);
      const minCol = Math.min(startColIdx, endColIdx);
      const maxCol = Math.max(startColIdx, endColIdx);
      // Full row if selection spans from first to last column
      isFullRowSelection = minCol === 0 && maxCol === columns.length - 1;
    }

    if (isFullRowSelection) {
      // Mark selected rows for deletion
      const selectedDocs = this.getSelectedDocuments();
      if (selectedDocs.length > 0) {
        this.queryStore.markForDeletion(selectedDocs);
        // Clear selection after marking
        this.clearSelection();
        this.focusedCell.set(null);
      }
    } else {
      // Clear selected cells (set field to undefined)
      const cells = this.getSelectedCells();
      if (cells.length === 0 && focused) {
        // Single focused cell
        if (!this.isSystemField(focused.path)) {
          const doc = this.findDocByKey(focused.docKey);
          if (doc) {
            this.queryStore.updateDocumentField(doc, focused.path, undefined);
          }
        }
      } else {
        // Multiple cells selected
        for (const cell of cells) {
          if (!this.isSystemField(cell.path)) {
            const doc = this.findDocByKey(cell.docKey);
            if (doc) {
              this.queryStore.updateDocumentField(doc, cell.path, undefined);
            }
          }
        }
      }
    }
  }

  // Check if document is marked for deletion
  isMarkedForDeletion(doc: CosmosDocument): boolean {
    return this.queryStore.isMarkedForDeletion(doc);
  }

  // Restore a document from pending deletion
  restoreFromDeletion(doc: CosmosDocument) {
    this.queryStore.unmarkForDeletion([doc]);
  }

  // Mark a single document for deletion (from context menu)
  onMarkForDeletion(doc: CosmosDocument) {
    this.queryStore.markForDeletion([doc]);
  }

  isCellFocused(docKey: string, path: string): boolean {
    const focused = this.focusedCell();
    return focused?.docKey === docKey && focused?.path === path;
  }

  isSystemField(path: string): boolean {
    return this.strategy().isSystemField(path);
  }

  isIdColumn(column: string): boolean {
    return this.strategy().isIdColumn(column);
  }

  getCellValue(doc: CosmosDocument, path: string): any {
    return getValueAtPath(doc, stringToPath(path));
  }

  startEditing(doc: CosmosDocument, path: string) {
    if (this.isSystemField(path)) return;

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
    this.editingCell = { docKey: this.getDocKey(doc), path };
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
    this.isValidIsoDateValue = isValidIsoDate(value);

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
      if (this.editingCell?.docKey === this.getDocKey(doc) && this.editingCell?.path === column) {
        this.finishEditing(doc, column);
      }
    }, 150);
  }

  private openFieldEditor(doc: CosmosDocument, path: string, value: any, mode: 'json' | 'text') {
    const dialogRef = this.dialog.open(FieldEditorDialogComponent, {
      data: {
        fieldPath: path,
        value: value,
        documentId: this.getDocId(doc),
        mode,
      },
      width: '600px',
      panelClass: 'field-editor-dialog',
    });

    dialogRef.afterClosed().subscribe((updatedValue) => {
      if (updatedValue !== undefined) {
        this.queryStore.updateDocumentField(doc, path, updatedValue);
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
        this.queryStore.updateDocumentField(doc, path, undefined);
      } else {
        this.queryStore.updateDocumentField(doc, path, selectedOption.value);
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
      this.queryStore.saveDocument(cont, doc);
    }
  }

  onDiscardChanges(doc: CosmosDocument) {
    this.queryStore.discardChanges(doc);
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
      if (updatedDoc && this.getDocId(updatedDoc) === this.getDocId(doc)) {
        // Apply changes from JSON editor (skip system fields)
        Object.keys(updatedDoc).forEach((key) => {
          if (!this.isSystemField(key)) {
            this.queryStore.updateDocumentField(doc, key, updatedDoc[key]);
          }
        });
      }
    });
  }

  onDuplicateDocument(doc: CosmosDocument) {
    const cont = this.container();
    if (!cont) return;

    // Create copy using strategy (handles provider-specific ID generation)
    const copy = this.strategy().duplicateDocument(doc);

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
    const docId = this.getDocId(doc);
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete Document',
        message: `Are you sure you want to delete document "${docId}"? This action cannot be undone.`,
        confirmText: 'Delete',
        confirmColor: 'warn',
      },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        const cont = this.container();
        if (cont) {
          this.queryStore.deleteDocument(cont, doc);
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
