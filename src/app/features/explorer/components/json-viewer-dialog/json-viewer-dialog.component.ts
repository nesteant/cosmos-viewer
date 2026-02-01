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
import { CosmosDocument } from '@core/models';

export interface JsonViewerDialogData {
  document: CosmosDocument;
  title?: string;
  readonly?: boolean;
}

@Component({
  selector: 'app-json-viewer-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
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
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCopy()">
        <mat-icon>content_copy</mat-icon>
        Copy
      </button>
      @if (!data.readonly) {
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
    `,
  ],
})
export class JsonViewerDialogComponent implements OnInit {
  readonly dialogRef = inject(MatDialogRef<JsonViewerDialogComponent>);
  readonly data = inject<JsonViewerDialogData>(MAT_DIALOG_DATA);

  jsonContent = '';
  isValidJson = true;

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
  }

  onCopy() {
    navigator.clipboard.writeText(this.jsonContent);
  }

  onSave() {
    try {
      const parsed = JSON.parse(this.jsonContent);
      this.dialogRef.close(parsed);
    } catch {
      this.isValidJson = false;
    }
  }
}
