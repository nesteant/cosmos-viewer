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
import { MatTooltipModule } from '@angular/material/tooltip';
import { detectApplicableTypes, getSpecialOptions, isValidGuid, uuidToBinaryEjson, TypeOption, FieldType } from '@core/utils/json-flattener';

export interface FieldEditorDialogData {
  fieldPath: string;
  value: any;
  documentId: string;
  mode?: 'json' | 'text';
}

// Maximum content length before we show a warning or use simpler editor options
const LARGE_CONTENT_THRESHOLD = 50000; // 50KB
const VERY_LARGE_CONTENT_THRESHOLD = 200000; // 200KB

@Component({
  selector: 'app-field-editor-dialog',
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
      <mat-icon class="field-icon">{{ getIcon() }}</mat-icon>
      Edit Field
      <span class="field-path">{{ data.fieldPath }}</span>
    </h2>
    <mat-dialog-content>
      @if (isTextMode) {
        <div class="type-bar">
          <span class="type-label">Save as:</span>
          @for (opt of applicableTypes; track opt.type) {
            <button
              type="button"
              class="type-chip"
              [class.selected]="selectedType === opt.type"
              [style.background]="opt.color"
              [matTooltip]="opt.description"
              (click)="selectType(opt.type)"
            >
              {{ opt.label }}
            </button>
          }
          @if (isValidGuidValue) {
            <span class="guid-badge" matTooltip="Valid GUID format">G✓</span>
          }
          <span class="chip-divider"></span>
          @for (opt of specialOptions; track opt.type) {
            <button
              type="button"
              class="type-chip special"
              [class.selected]="selectedType === opt.type"
              [style.background]="opt.color"
              [matTooltip]="opt.description"
              (click)="selectType(opt.type)"
            >
              {{ opt.label }}
            </button>
          }
        </div>
      }
      @if (isLargeContent) {
        <div class="large-content-warning">
          <mat-icon>warning</mat-icon>
          <span>Large content ({{ contentSizeKb }}KB) - some editor features disabled for performance</span>
        </div>
      }
      <div class="editor-wrapper">
        <ngx-monaco-editor
          class="field-editor"
          [options]="editorOptions"
          [(ngModel)]="content"
          (ngModelChange)="onContentChange()"
        ></ngx-monaco-editor>
      </div>
    </mat-dialog-content>
    @if (uuidDetected()) {
      <div class="uuid-hint">
        <mat-icon>info</mat-icon>
        UUID detected - will be saved as MongoDB Binary format
      </div>
    }
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
      @if (!isTextMode) {
        <button mat-button (click)="onFormat()" [disabled]="!isValidJson()">
          <mat-icon>auto_fix_high</mat-icon>
          Format
        </button>
        <button
          mat-button
          (click)="onConvertUuids()"
          [disabled]="!isValidJson()"
          matTooltip="Toggle between UUID string and MongoDB Binary format"
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
        [disabled]="!isTextMode && !isValidJson()"
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
        display: flex;
        flex-direction: column;
      }

      .type-bar {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        background: rgba(0, 0, 0, 0.2);
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        flex-shrink: 0;
      }

      .type-label {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.6);
      }

      .type-chip {
        padding: 3px 10px;
        font-size: 11px;
        font-weight: 600;
        border-radius: 4px;
        border: 2px solid transparent;
        color: white;
        cursor: pointer;
        opacity: 0.5;
        transition: opacity 0.15s, border-color 0.15s;
      }

      .type-chip:hover {
        opacity: 0.8;
      }

      .type-chip.selected {
        opacity: 1;
        border-color: white;
      }

      .guid-badge {
        font-size: 11px;
        color: #9c27b0;
        font-weight: 600;
      }

      .chip-divider {
        width: 1px;
        height: 20px;
        background: rgba(255, 255, 255, 0.15);
        margin: 0 4px;
      }

      .type-chip.special {
        opacity: 0.5;
      }

      .type-chip.special:hover {
        opacity: 0.8;
      }

      .type-chip.special.selected {
        opacity: 1;
      }

      .editor-wrapper {
        flex: 1;
        position: relative;
        min-height: 0;
      }

      .field-editor {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
      }

      .large-content-warning {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
        background: rgba(255, 193, 7, 0.15);
        color: #ffc107;
        font-size: 11px;
        border-bottom: 1px solid rgba(255, 193, 7, 0.3);
        flex-shrink: 0;
      }

      .large-content-warning mat-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
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

      .uuid-hint {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
        background: rgba(156, 39, 176, 0.15);
        color: #ce93d8;
        font-size: 12px;
        border-top: 1px solid rgba(156, 39, 176, 0.3);
      }

      .uuid-hint mat-icon {
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

  content = '';
  isArray = false;
  isTextMode = false;
  isValidJson = signal(true);
  error = signal<string | null>(null);
  uuidDetected = signal(false);
  isLargeContent = false;
  isVeryLargeContent = false;
  contentSizeKb = 0;

  // Type selection for text mode
  applicableTypes: TypeOption[] = [];
  specialOptions: TypeOption[] = getSpecialOptions();
  selectedType: FieldType = 'string';
  isValidGuidValue = false;

  editorOptions: any = {
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
    this.isTextMode = this.data.mode === 'text';
    this.isArray = Array.isArray(this.data.value);

    if (this.isTextMode) {
      this.content = this.data.value ?? '';
      this.editorOptions = {
        ...this.editorOptions,
        language: 'plaintext',
        lineNumbers: 'off',
      };
      this.updateApplicableTypes(false);
    } else {
      this.content = JSON.stringify(this.data.value, null, 2);
    }

    // Check content size and adjust editor for large content
    this.contentSizeKb = Math.round(this.content.length / 1024);
    this.isLargeContent = this.content.length > LARGE_CONTENT_THRESHOLD;
    this.isVeryLargeContent = this.content.length > VERY_LARGE_CONTENT_THRESHOLD;

    if (this.isLargeContent) {
      // Disable expensive features for large content
      this.editorOptions = {
        ...this.editorOptions,
        wordWrap: 'off', // Disable word wrap for performance
        folding: false,
        renderLineHighlight: 'none',
        renderIndentGuides: false,
        occurrencesHighlight: false,
        selectionHighlight: false,
        matchBrackets: 'never',
        quickSuggestions: false,
        suggestOnTriggerCharacters: false,
        acceptSuggestionOnEnter: 'off',
        hover: { enabled: false },
        links: false,
        colorDecorators: false,
      };
    }
  }

  updateApplicableTypes(preserveSelection = true) {
    const previousType = this.selectedType;
    this.applicableTypes = detectApplicableTypes(this.content);
    this.isValidGuidValue = isValidGuid(this.content);

    // If user had a special type selected (delete/null) but now typed actual content,
    // automatically switch to the most appropriate value-based type
    const isSpecialType = previousType === 'delete' || previousType === 'null';
    const hasContent = this.content.length > 0;

    if (isSpecialType && hasContent) {
      this.selectedType = this.applicableTypes[0]?.type ?? 'string';
      return;
    }

    // Check if previous selection is still valid among value-based types
    const previousInApplicable = this.applicableTypes.some(opt => opt.type === previousType);

    if (preserveSelection && previousInApplicable) {
      this.selectedType = previousType;
    } else if (preserveSelection && (previousType === 'delete' || previousType === 'null')) {
      this.selectedType = previousType;
    } else {
      this.selectedType = this.applicableTypes[0]?.type ?? 'string';
    }
  }

  selectType(type: FieldType) {
    this.selectedType = type;
  }

  getIcon(): string {
    if (this.isTextMode) return 'text_fields';
    return this.isArray ? 'data_array' : 'data_object';
  }

  onContentChange() {
    if (this.isTextMode) {
      this.updateApplicableTypes(true);
    } else {
      this.validateJson();
    }
  }

  onCopy() {
    navigator.clipboard.writeText(this.content);
  }

  onFormat() {
    if (this.isTextMode) return;
    try {
      const parsed = JSON.parse(this.content);
      this.content = JSON.stringify(parsed, null, 2);
      this.isValidJson.set(true);
      this.error.set(null);
    } catch (e) {
      // Keep current content if invalid
    }
  }

  onConvertUuids() {
    if (this.isTextMode) return;

    const trimmed = this.content.trim();

    // Case 1: Plain UUID string - wrap to Binary
    if (isValidGuid(trimmed)) {
      const converted = uuidToBinaryEjson(trimmed);
      this.content = JSON.stringify(converted, null, 2);
      this.isValidJson.set(true);
      this.uuidDetected.set(false);
      this.error.set(null);
      return;
    }

    try {
      const parsed = JSON.parse(this.content);

      // Case 2: Single Binary UUID object - unwrap to plain UUID string
      if (this.isBinaryUuid(parsed)) {
        const uuid = this.binaryToUuid(parsed);
        this.content = uuid;
        this.isValidJson.set(true);
        this.uuidDetected.set(true);
        this.error.set(null);
        return;
      }

      // Case 3: Complex object - detect direction and convert
      const hasBinaryUuids = this.containsBinaryUuids(parsed);
      const hasPlainUuids = this.containsPlainUuids(parsed);

      let converted;
      if (hasBinaryUuids && !hasPlainUuids) {
        // Unwrap: Binary → Plain UUID strings
        converted = this.unwrapUuidsRecursively(parsed);
      } else {
        // Wrap: Plain UUID strings → Binary
        converted = this.wrapUuidsRecursively(parsed);
      }

      this.content = JSON.stringify(converted, null, 2);
      this.isValidJson.set(true);
      this.error.set(null);
    } catch (e) {
      // Keep current content if invalid
    }
  }

  /**
   * Check if value is a MongoDB Binary UUID
   */
  private isBinaryUuid(value: any): boolean {
    if (!value || typeof value !== 'object') return false;
    if ('$binary' in value) {
      const subType = value.$binary?.subType;
      return subType === '04' || subType === '03' || subType === 4 || subType === 3;
    }
    if ('$uuid' in value) return true;
    return false;
  }

  /**
   * Convert MongoDB Binary to UUID string
   */
  private binaryToUuid(value: any): string {
    if (value.$uuid) return value.$uuid;

    if (value.$binary?.base64) {
      try {
        const bytes = atob(value.$binary.base64);
        const hex = Array.from(bytes, (c: string) =>
          c.charCodeAt(0).toString(16).padStart(2, '0')
        ).join('');
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
      } catch {
        return JSON.stringify(value);
      }
    }
    return JSON.stringify(value);
  }

  /**
   * Check if object contains any Binary UUIDs
   */
  private containsBinaryUuids(value: any): boolean {
    if (value === null || value === undefined) return false;
    if (this.isBinaryUuid(value)) return true;
    if (Array.isArray(value)) return value.some(item => this.containsBinaryUuids(item));
    if (typeof value === 'object') {
      return Object.values(value).some(v => this.containsBinaryUuids(v));
    }
    return false;
  }

  /**
   * Check if object contains any plain UUID strings
   */
  private containsPlainUuids(value: any): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string' && isValidGuid(value)) return true;
    if (Array.isArray(value)) return value.some(item => this.containsPlainUuids(item));
    if (typeof value === 'object') {
      // Skip EJSON types
      if ('$binary' in value || '$oid' in value || '$date' in value) return false;
      return Object.values(value).some(v => this.containsPlainUuids(v));
    }
    return false;
  }

  /**
   * Recursively unwrap Binary UUIDs to plain UUID strings
   */
  private unwrapUuidsRecursively(value: any): any {
    if (value === null || value === undefined) return value;

    // Convert Binary UUID to string
    if (this.isBinaryUuid(value)) {
      return this.binaryToUuid(value);
    }

    if (Array.isArray(value)) {
      return value.map(item => this.unwrapUuidsRecursively(item));
    }

    if (typeof value === 'object') {
      const result: Record<string, any> = {};
      for (const [key, val] of Object.entries(value)) {
        result[key] = this.unwrapUuidsRecursively(val);
      }
      return result;
    }

    return value;
  }

  /**
   * Recursively wrap plain UUID strings to Binary format
   */
  private wrapUuidsRecursively(value: any): any {
    if (value === null || value === undefined) return value;

    // Convert UUID string to Binary
    if (typeof value === 'string' && isValidGuid(value)) {
      return uuidToBinaryEjson(value);
    }

    if (Array.isArray(value)) {
      return value.map(item => this.wrapUuidsRecursively(item));
    }

    if (typeof value === 'object') {
      // Skip EJSON types
      if ('$binary' in value || '$oid' in value || '$date' in value ||
          '$numberLong' in value || '$numberDecimal' in value || '$regex' in value || '$uuid' in value) {
        return value;
      }

      const result: Record<string, any> = {};
      for (const [key, val] of Object.entries(value)) {
        result[key] = this.wrapUuidsRecursively(val);
      }
      return result;
    }

    return value;
  }

  onSave() {
    if (this.isTextMode) {
      // Use the selected type option to get the converted value
      const allOptions = [...this.applicableTypes, ...this.specialOptions];
      const selectedOption = allOptions.find(
        (opt) => opt.type === this.selectedType
      );
      if (selectedOption) {
        this.dialogRef.close(selectedOption.value);
      } else {
        this.dialogRef.close(this.content);
      }
      return;
    }

    const trimmed = this.content.trim();

    // Check if it's a plain UUID string (not JSON) - convert to MongoDB Binary
    if (isValidGuid(trimmed)) {
      this.dialogRef.close(uuidToBinaryEjson(trimmed));
      return;
    }

    // Try to parse as JSON
    try {
      const parsed = JSON.parse(this.content);
      this.dialogRef.close(parsed);
    } catch {
      this.isValidJson.set(false);
      this.error.set('Invalid JSON');
    }
  }

  private validateJson() {
    const trimmed = this.content.trim();

    // A plain UUID is valid - will be converted to Binary on save
    if (isValidGuid(trimmed)) {
      this.isValidJson.set(true);
      this.error.set(null);
      this.uuidDetected.set(true);
      return;
    }

    this.uuidDetected.set(false);

    try {
      JSON.parse(this.content);
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
