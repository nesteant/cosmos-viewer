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
import { ContainerInfo } from '@core/models';

export interface DocumentDialogData {
  container: ContainerInfo;
}

@Component({
  selector: 'app-document-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MonacoEditorModule,
  ],
  template: `
    <h2 mat-dialog-title>Create New Document</h2>
    <mat-dialog-content>
      <p class="hint">
        Partition key path: <code>{{ data.container.partitionKeyPath }}</code>
      </p>
      <ngx-monaco-editor
        class="json-editor"
        [options]="editorOptions"
        [(ngModel)]="jsonContent"
      ></ngx-monaco-editor>
      @if (error) {
        <p class="error">{{ error }}</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close()">Cancel</button>
      <button mat-flat-button color="primary" (click)="onCreate()">
        <mat-icon>add</mat-icon>
        Create
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      mat-dialog-content {
        min-width: 600px;
        min-height: 400px;
      }

      .hint {
        margin: 0 0 12px;
        font-size: 13px;
        color: rgba(255, 255, 255, 0.6);
      }

      .hint code {
        background: rgba(255, 255, 255, 0.1);
        padding: 2px 6px;
        border-radius: 4px;
        font-family: monospace;
      }

      .json-editor {
        height: 350px;
      }

      .error {
        margin: 12px 0 0;
        color: #f44336;
        font-size: 13px;
      }

      mat-dialog-actions button mat-icon {
        margin-right: 4px;
      }
    `,
  ],
})
export class DocumentDialogComponent implements OnInit {
  readonly dialogRef = inject(MatDialogRef<DocumentDialogComponent>);
  readonly data = inject<DocumentDialogData>(MAT_DIALOG_DATA);

  jsonContent = '';
  error = '';

  editorOptions = {
    theme: 'vs-dark',
    language: 'json',
    minimap: { enabled: false },
    automaticLayout: true,
    fontSize: 13,
    lineNumbers: 'on' as const,
    scrollBeyondLastLine: false,
    wordWrap: 'on' as const,
    padding: { top: 8, bottom: 8 },
  };

  ngOnInit() {
    // Generate template with partition key
    const pkPath = this.data.container.partitionKeyPath.replace(/^\//, '');
    const template: any = {
      id: this.generateId(),
    };

    // Add partition key field if not 'id'
    if (pkPath !== 'id') {
      template[pkPath] = '';
    }

    this.jsonContent = JSON.stringify(template, null, 2);
  }

  generateId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  onCreate() {
    this.error = '';
    try {
      const doc = JSON.parse(this.jsonContent);
      if (!doc.id) {
        this.error = 'Document must have an "id" field';
        return;
      }
      this.dialogRef.close(doc);
    } catch (e) {
      this.error = 'Invalid JSON format';
    }
  }
}
