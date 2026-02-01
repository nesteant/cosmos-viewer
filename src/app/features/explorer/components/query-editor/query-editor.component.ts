import { Component, inject, input, output, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MonacoEditorModule } from 'ngx-monaco-editor-v2';
import { ContainerInfo } from '@core/models';
import { QueryStore } from '../../store';

@Component({
  selector: 'app-query-editor',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MonacoEditorModule,
  ],
  template: `
    <div class="query-editor">
      <div class="editor-toolbar" [class.sidebar-collapsed]="sidebarCollapsed()">
        <span class="container-info">
          <mat-icon>folder</mat-icon>
          {{ container()?.name ?? 'No container selected' }}
        </span>
        <div class="toolbar-actions">
          <button
            mat-flat-button
            color="primary"
            (click)="onExecute()"
            [disabled]="!container() || queryStore.isExecuting()"
          >
            @if (queryStore.isExecuting()) {
              <mat-spinner diameter="18"></mat-spinner>
            } @else {
              <mat-icon>play_arrow</mat-icon>
            }
            Execute
          </button>
        </div>
      </div>

      <ngx-monaco-editor
        class="editor"
        [options]="editorOptions"
        [(ngModel)]="query"
        (ngModelChange)="queryStore.setQuery($event)"
      ></ngx-monaco-editor>

      @if (queryStore.executionTime() !== null) {
        <div class="execution-stats">
          <span class="stat">
            <mat-icon>schedule</mat-icon>
            {{ queryStore.executionTime() }}ms
          </span>
          @if (queryStore.requestCharge()) {
            <span class="stat">
              <mat-icon>bolt</mat-icon>
              {{ queryStore.requestCharge()?.toFixed(2) }} RU
            </span>
          }
          <span class="stat">
            <mat-icon>table_rows</mat-icon>
            {{ queryStore.documentCount() }} documents
          </span>
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
      }

      .query-editor {
        display: flex;
        flex-direction: column;
        height: 100%;
        border-bottom: 1px solid rgba(255, 255, 255, 0.12);
      }

      .editor-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        background: rgba(0, 0, 0, 0.2);
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);

        &.sidebar-collapsed {
          padding-left: 44px;
        }
      }

      .container-info {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: rgba(255, 255, 255, 0.7);
      }

      .container-info mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: #ce93d8;
      }

      .toolbar-actions {
        display: flex;
        gap: 8px;
      }

      .toolbar-actions button {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .toolbar-actions mat-spinner {
        display: inline-block;
      }

      .editor {
        flex: 1;
        min-height: 120px;
      }

      .execution-stats {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 6px 12px;
        background: rgba(0, 0, 0, 0.2);
        font-size: 12px;
        color: rgba(255, 255, 255, 0.6);
      }

      .stat {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .stat mat-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
      }
    `,
  ],
})
export class QueryEditorComponent implements OnInit {
  readonly queryStore = inject(QueryStore);

  container = input<ContainerInfo | null>(null);
  sidebarCollapsed = input(false);
  execute = output<void>();

  query = 'SELECT * FROM c';

  editorOptions = {
    theme: 'vs-dark',
    language: 'sql',
    minimap: { enabled: false },
    automaticLayout: true,
    fontSize: 14,
    lineNumbers: 'on' as const,
    scrollBeyondLastLine: false,
    wordWrap: 'on' as const,
    padding: { top: 8, bottom: 8 },
  };

  ngOnInit() {
    this.query = this.queryStore.query();
  }

  onExecute() {
    const cont = this.container();
    if (cont) {
      this.queryStore.executeQuery(cont);
      this.execute.emit();
    }
  }
}
