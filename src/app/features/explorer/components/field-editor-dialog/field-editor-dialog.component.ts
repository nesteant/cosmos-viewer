import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MonacoEditorModule } from 'ngx-monaco-editor-v2';

export interface FieldEditorDialogData {
  fieldPath: string;
  value: any;
  documentId: string;
}

@Component({
  selector: 'app-field-editor-dialog',
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
      <mat-icon class="field-icon">{{ isArray ? 'data_array' : 'data_object' }}</mat-icon>
      Edit Field
      <span class="field-path">{{ data.fieldPath }}</span>
    </h2>
    <mat-dialog-content>
      <div class="editor-wrapper">
        <ngx-monaco-editor
          class="field-editor"
          [options]="editorOptions"
          [(ngModel)]="jsonContent"
          (ngModelChange)="onContentChange()"
        ></ngx-monaco-editor>
      </div>
    </mat-dialog-content>
    @if (error()) {
      <div class="error-message">
        <mat-icon>error</mat-icon>
        {{ error() }}
      </div>
    }
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCopy()">
        <mat-icon>content_copy</mat-icon>
        Copy
      </button>
      <button mat-button (click)="onFormat()" [disabled]="!isValidJson()">
        <mat-icon>auto_fix_high</mat-icon>
        Format
      </button>
      <button mat-button (click)="dialogRef.close()">Cancel</button>
      <button
        mat-flat-button
        color="primary"
        (click)="onSave()"
        [disabled]="!isValidJson()"
      >
        Apply
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      h2 {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0;
      }

      .field-icon {
        color: #bb86fc;
        font-size: 20px;
        width: 20px;
        height: 20px;
      }

      .field-path {
        font-size: 13px;
        font-weight: normal;
        color: #bb86fc;
        font-family: monospace;
        background: rgba(187, 134, 252, 0.1);
        padding: 2px 8px;
        border-radius: 4px;
        margin-left: 4px;
      }

      mat-dialog-content {
        padding: 0 !important;
        overflow: hidden;
        height: 100%;
      }

      .editor-wrapper {
        height: 100%;
        position: relative;
      }

      .field-editor {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
      }

      .error-message {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        background: rgba(244, 67, 54, 0.15);
        color: #f44336;
        font-size: 12px;
        border-top: 1px solid rgba(244, 67, 54, 0.3);
      }

      .error-message mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }

      mat-dialog-actions {
        padding: 8px 16px;
      }

      mat-dialog-actions button mat-icon {
        margin-right: 4px;
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    `,
  ],
})
export class FieldEditorDialogComponent implements OnInit {
  readonly dialogRef = inject(MatDialogRef<FieldEditorDialogComponent>);
  readonly data = inject<FieldEditorDialogData>(MAT_DIALOG_DATA);

  jsonContent = '';
  isArray = false;
  isValidJson = signal(true);
  error = signal<string | null>(null);

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
    tabSize: 2,
  };

  ngOnInit() {
    this.isArray = Array.isArray(this.data.value);
    this.jsonContent = JSON.stringify(this.data.value, null, 2);
  }

  onContentChange() {
    this.validateJson();
  }

  onCopy() {
    navigator.clipboard.writeText(this.jsonContent);
  }

  onFormat() {
    try {
      const parsed = JSON.parse(this.jsonContent);
      this.jsonContent = JSON.stringify(parsed, null, 2);
      this.isValidJson.set(true);
      this.error.set(null);
    } catch (e) {
      // Keep current content if invalid
    }
  }

  onSave() {
    try {
      const parsed = JSON.parse(this.jsonContent);
      this.dialogRef.close(parsed);
    } catch {
      this.isValidJson.set(false);
      this.error.set('Invalid JSON');
    }
  }

  private validateJson() {
    try {
      JSON.parse(this.jsonContent);
      this.isValidJson.set(true);
      this.error.set(null);
    } catch (e) {
      this.isValidJson.set(false);
      if (e instanceof SyntaxError) {
        this.error.set(e.message);
      } else {
        this.error.set('Invalid JSON');
      }
    }
  }
}
