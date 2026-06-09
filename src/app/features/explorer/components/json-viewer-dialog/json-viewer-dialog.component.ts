import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MonacoEditorModule } from 'ngx-monaco-editor-v2';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CosmosDocument } from '@core/models';
import { containsBinaryUuids, convertUuidsDeep, toggleUuidRepresentation } from '@core/utils/json-flattener';

export interface JsonViewerDialogData {
  document: CosmosDocument;
  title?: string;
  readonly?: boolean;
  /**
   * Whether this document uses MongoDB Binary UUIDs. Enables the
   * "UUID ↔ Binary" toggle and Binary-preserving save. Should be false for
   * Cosmos NoSQL, where UUIDs are plain strings.
   */
  supportsBinaryUuid?: boolean;
}

@Component({
  selector: 'app-json-viewer-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MonacoEditorModule,
  ],
  template: `
    <h2 mat-dialog-title>
      {{ data.title ?? 'Document JSON' }}
      <span class="doc-id">{{ data.document.id }}</span>
    </h2>
    <mat-dialog-content>
      <ngx-monaco-editor
        class="json-editor"
        [options]="editorOptions"
        [(ngModel)]="jsonContent"
      ></ngx-monaco-editor>
    </mat-dialog-content>
    @if (data.supportsBinaryUuid && binaryDetected) {
      <div class="uuid-hint">
        <mat-icon>info</mat-icon>
        Binary UUID(s) detected — use "UUID ↔ Binary" to view them as readable UUID strings.
      </div>
    }
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCopy()">
        <mat-icon>content_copy</mat-icon>
        Copy
      </button>
      @if (!data.readonly) {
        @if (data.supportsBinaryUuid) {
          <button
            mat-button
            (click)="onToggleUuids()"
            matTooltip="Toggle between MongoDB Binary and readable UUID strings"
          >
            <mat-icon>swap_horiz</mat-icon>
            UUID ↔ Binary
          </button>
        }
        <button mat-button (click)="dialogRef.close()">Cancel</button>
        <button
          mat-flat-button
          color="primary"
          (click)="onSave()"
          [disabled]="!isValidJson"
        >
          Save Changes
        </button>
      } @else {
        <button mat-flat-button color="primary" (click)="dialogRef.close()">
          Close
        </button>
      }
    </mat-dialog-actions>
  `,
  styles: [
    `
      h2 {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .doc-id {
        font-size: 12px;
        font-weight: normal;
        color: rgba(255, 255, 255, 0.5);
        font-family: monospace;
      }

      mat-dialog-content {
        min-width: 600px;
        min-height: 400px;
        padding: 0 !important;
      }

      .json-editor {
        height: 400px;
      }

      mat-dialog-actions button mat-icon {
        margin-right: 4px;
      }

      .uuid-hint {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
        background: rgba(156, 39, 176, 0.15);
        color: #ce93d8;
        font-size: 12px;
      }

      .uuid-hint mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }
    `,
  ],
})
export class JsonViewerDialogComponent implements OnInit {
  readonly dialogRef = inject(MatDialogRef<JsonViewerDialogComponent>);
  readonly data = inject<JsonViewerDialogData>(MAT_DIALOG_DATA);

  jsonContent = '';
  isValidJson = true;
  binaryDetected = false;

  editorOptions = {
    theme: 'vs-dark',
    language: 'json',
    minimap: { enabled: false },
    automaticLayout: true,
    fontSize: 13,
    lineNumbers: 'on' as const,
    scrollBeyondLastLine: false,
    wordWrap: 'on' as const,
    readOnly: false,
    padding: { top: 8, bottom: 8 },
  };

  ngOnInit() {
    this.jsonContent = JSON.stringify(this.data.document, null, 2);
    this.editorOptions.readOnly = this.data.readonly ?? false;
    this.binaryDetected =
      !!this.data.supportsBinaryUuid && containsBinaryUuids(this.data.document);
  }

  onCopy() {
    navigator.clipboard.writeText(this.jsonContent);
  }

  /**
   * Toggle every UUID in the document between MongoDB Binary EJSON and a
   * readable UUID string, auto-detecting the current representation.
   */
  onToggleUuids() {
    try {
      const parsed = JSON.parse(this.jsonContent);
      const converted = toggleUuidRepresentation(parsed);
      this.jsonContent = JSON.stringify(converted, null, 2);
      this.binaryDetected = containsBinaryUuids(converted);
      this.isValidJson = true;
    } catch {
      // Leave content untouched if it is not currently valid JSON
      this.isValidJson = false;
    }
  }

  onSave() {
    try {
      const parsed = JSON.parse(this.jsonContent);
      // Preserve BSON shape for MongoDB: any plain UUID strings (e.g. left over
      // from the "UUID ↔ Binary" readable view) are written back as MongoDB
      // Binary, matching the single-field editor's convention. Already-Binary
      // values are left untouched. For Cosmos NoSQL, UUIDs stay plain strings.
      const result = this.data.supportsBinaryUuid
        ? convertUuidsDeep(parsed, 'wrap')
        : parsed;
      this.dialogRef.close(result);
    } catch {
      this.isValidJson = false;
    }
  }
}
