import { Component, inject, input, output, OnInit, signal, computed, effect, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MonacoEditorModule } from 'ngx-monaco-editor-v2';
import JSON5 from 'json5';
import { ContainerInfo, ProviderType } from '@core/models';
import { NotificationService } from '@core/services';
import { registerCosmosSQL, updateSchemaFromDocuments } from '@core/utils/cosmossql-monaco';
import { registerMongoDB, updateMongoSchemaFromDocuments } from '@core/utils/mongodb-monaco';
import { getDefaultQueryForProvider, isQueryCompatibleWithProvider } from '@core/utils/query-utils';
import { ConnectionsStore } from '../../../connections/store';
import { ExplorerStore, QueryStore } from '../../store';
import { QueryAnalyzerDialogComponent } from '../query-analyzer/query-analyzer-dialog.component';

interface QueryTemplate {
  name: string;
  icon: string;
  query: string;
}

const SQL_TEMPLATES: QueryTemplate[] = [
  { name: 'Select All', icon: 'select_all', query: 'SELECT * FROM c' },
  { name: 'Select Top 10', icon: 'filter_1', query: 'SELECT TOP 10 * FROM c' },
  { name: 'Select Top 100', icon: 'filter_2', query: 'SELECT TOP 100 * FROM c' },
  { name: 'Count Documents', icon: 'tag', query: 'SELECT VALUE COUNT(1) FROM c' },
  { name: 'Select by ID', icon: 'key', query: "SELECT * FROM c WHERE c.id = 'your-id'" },
  { name: 'Array Contains', icon: 'data_array', query: "SELECT * FROM c WHERE ARRAY_CONTAINS(c.tags, 'value')" },
  { name: 'String Contains', icon: 'text_fields', query: "SELECT * FROM c WHERE CONTAINS(c.name, 'search')" },
  { name: 'Date Range', icon: 'date_range', query: "SELECT * FROM c WHERE c._ts >= 1700000000 AND c._ts <= 1800000000" },
  { name: 'Order By', icon: 'sort', query: 'SELECT * FROM c ORDER BY c._ts DESC' },
  { name: 'Distinct Values', icon: 'difference', query: 'SELECT DISTINCT VALUE c.type FROM c' },
];

const MONGO_TEMPLATES: QueryTemplate[] = [
  { name: 'Find All', icon: 'select_all', query: '{}' },
  { name: 'Find by ID', icon: 'key', query: '{ "_id": "your-id" }' },
  { name: 'Find by Field', icon: 'search', query: '{ "fieldName": "value" }' },
  { name: 'Find with Regex', icon: 'text_fields', query: '{ "name": { "$regex": "search", "$options": "i" } }' },
  { name: 'Find in Array', icon: 'data_array', query: '{ "tags": { "$in": ["tag1", "tag2"] } }' },
  { name: 'Find with AND', icon: 'join_inner', query: '{ "$and": [{ "field1": "value1" }, { "field2": "value2" }] }' },
  { name: 'Find with OR', icon: 'join_full', query: '{ "$or": [{ "field1": "value1" }, { "field2": "value2" }] }' },
  { name: 'Find Range', icon: 'date_range', query: '{ "field": { "$gte": 0, "$lte": 100 } }' },
  { name: 'Field Exists', icon: 'check_circle', query: '{ "fieldName": { "$exists": true } }' },
  { name: 'Nested Field', icon: 'account_tree', query: '{ "parent.child": "value" }' },
];

function getTemplatesForProvider(providerType: ProviderType): QueryTemplate[] {
  return providerType === 'cosmos-mongo' || providerType === 'mongodb'
    ? MONGO_TEMPLATES
    : SQL_TEMPLATES;
}

import { PipelineVisualizerComponent } from '../pipeline-visualizer/pipeline-visualizer.component';

@Component({
  selector: 'app-query-editor',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MonacoEditorModule,
    PipelineVisualizerComponent,
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
            mat-icon-button
            [matMenuTriggerFor]="templatesMenu"
            matTooltip="Query Templates"
          >
            <mat-icon>library_books</mat-icon>
          </button>
          <mat-menu #templatesMenu="matMenu">
            @for (template of templates(); track template.name) {
              <button mat-menu-item (click)="applyTemplate(template)">
                <mat-icon>{{ template.icon }}</mat-icon>
                {{ template.name }}
              </button>
            }
          </mat-menu>

          <button
            mat-icon-button
            (click)="formatQuery()"
            matTooltip="Format Query"
            [disabled]="!query.trim()"
          >
            <mat-icon>auto_fix_high</mat-icon>
          </button>

          <button
            mat-icon-button
            (click)="analyzeQuery()"
            matTooltip="Analyze Query (Ctrl+Shift+A)"
            [disabled]="!query.trim() || !container()"
          >
            <mat-icon>analytics</mat-icon>
          </button>

          @if (isMongoDB()) {
            <button
              mat-icon-button
              (click)="toggleVisualMode()"
              [matTooltip]="visualMode() ? 'Switch to Text Editor' : 'Switch to Visual Pipeline'"
              [class.active]="visualMode()"
            >
              <mat-icon>{{ visualMode() ? 'code' : 'account_tree' }}</mat-icon>
            </button>
          }

          <button
            mat-icon-button
            (click)="clearQuery()"
            matTooltip="Clear"
            [disabled]="!query.trim()"
          >
            <mat-icon>clear</mat-icon>
          </button>

          <button
            mat-flat-button
            color="primary"
            class="execute-btn"
            (click)="onExecute()"
            [disabled]="!container() || isLoading() || !query.trim()"
            matTooltip="Execute (Ctrl+Enter)"
          >
            <span class="icon-container">
              <mat-icon [class.hidden]="isLoading()">play_arrow</mat-icon>
              <mat-spinner [class.hidden]="!isLoading()" diameter="18"></mat-spinner>
            </span>
            Execute
          </button>
        </div>
      </div>

      @if (visualMode() && isMongoDB()) {
        <app-pipeline-visualizer
          class="editor"
          [query]="query"
          [isMainQueryExecuting]="isLoading()"
          (runToStageRequest)="runPipelineToStage($event)"
          (pipelineChange)="onPipelineChange($event)"
          #pipelineVisualizer
        ></app-pipeline-visualizer>
      } @else {
        <ngx-monaco-editor
          class="editor"
          [options]="editorOptions"
          [(ngModel)]="query"
          (ngModelChange)="onQueryChange($event)"
          (onInit)="onEditorInit($event)"
        ></ngx-monaco-editor>
      }

      <div class="status-bar">
        @if (queryStore.executionTime() !== null) {
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
            {{ queryStore.documentCount() }} docs
          </span>
        }
        <span class="spacer"></span>
        <span class="hint">
          Ctrl+Enter: Execute | Ctrl+Shift+A: Analyze
        </span>
      </div>
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
        padding: 6px 12px;
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
        align-items: center;
        gap: 4px;
      }

      .toolbar-actions button.active {
        background: rgba(187, 134, 252, 0.2);
        color: #bb86fc;
      }

      .execute-btn {
        margin-left: 8px;
      }

      .execute-btn .icon-container {
        display: inline-grid;
        width: 18px;
        height: 18px;
        margin-right: 6px;
        vertical-align: middle;
      }

      .execute-btn .icon-container > * {
        grid-area: 1 / 1;
        width: 18px;
        height: 18px;
      }

      .execute-btn .icon-container mat-icon {
        font-size: 18px;
        line-height: 18px;
      }

      .execute-btn .hidden {
        visibility: hidden;
      }

      .editor {
        flex: 1;
        min-height: 0;
        overflow: hidden;
      }

      app-pipeline-visualizer.editor {
        overflow: auto;
      }

      .status-bar {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 4px 12px;
        padding-right: 48px; /* Space for collapse button */
        background: rgba(0, 0, 0, 0.3);
        font-size: 11px;
        color: rgba(255, 255, 255, 0.5);
        border-top: 1px solid rgba(255, 255, 255, 0.05);
      }

      .stat {
        display: flex;
        align-items: center;
        gap: 4px;
        color: rgba(255, 255, 255, 0.6);
      }

      .stat mat-icon {
        font-size: 13px;
        width: 13px;
        height: 13px;
      }

      .spacer {
        flex: 1;
      }

      .hint {
        font-size: 10px;
        color: rgba(255, 255, 255, 0.3);
      }
    `,
  ],
})
export class QueryEditorComponent implements OnInit {
  readonly queryStore = inject(QueryStore);
  private readonly connectionsStore = inject(ConnectionsStore);
  private readonly explorerStore = inject(ExplorerStore);
  private readonly notificationService = inject(NotificationService);
  private readonly dialog = inject(MatDialog);

  container = input<ContainerInfo | null>(null);
  sidebarCollapsed = input(false);
  execute = output<void>();
  queryChange = output<string>();

  query = '';  // Will be set based on provider type
  private editorInstance: any;
  private lastActiveTabId: string | null = null;
  private currentLanguage: string | null = null;
  private lastProviderType: ProviderType | null = null;

  // Provider type for the active connection
  activeProviderType = computed((): ProviderType => {
    const activeTab = this.explorerStore.activeTab();
    const connectionId = activeTab?.connectionId || sessionStorage.getItem('activeConnectionId');
    if (!connectionId) return 'cosmos-sql';

    const connection = this.connectionsStore.connections().find(c => c.id === connectionId);
    return connection?.providerType ?? 'cosmos-sql';
  });

  // Templates based on provider type
  templates = computed(() => getTemplatesForProvider(this.activeProviderType()));

  // Check if current provider is MongoDB
  isMongoDB = computed(() => {
    const pt = this.activeProviderType();
    return pt === 'cosmos-mongo' || pt === 'mongodb';
  });

  // Visual mode toggle for pipeline visualization
  visualMode = signal(false);

  // Loading state for reconnection
  private isReconnecting = signal(false);
  isLoading = computed(() => this.isReconnecting() || this.queryStore.isExecuting());

  // Reference to pipeline visualizer
  @ViewChild('pipelineVisualizer') pipelineVisualizer: PipelineVisualizerComponent | null = null;

  constructor() {
    // Sync query when active tab changes
    effect(() => {
      const activeTabId = this.explorerStore.activeTabId();
      if (activeTabId !== this.lastActiveTabId) {
        this.lastActiveTabId = activeTabId;
        // Load query for the new active tab, or use default if no tab
        const tabQuery = this.queryStore.query();
        const providerType = this.activeProviderType();
        if (!tabQuery || tabQuery.trim() === '') {
          // No query stored, use provider-appropriate default
          const defaultQuery = getDefaultQueryForProvider(providerType);
          this.query = defaultQuery;
        } else if (tabQuery !== this.query) {
          this.query = tabQuery;
        }
      }
    });

    // Update Monaco autocomplete when documents change
    effect(() => {
      const documents = this.queryStore.documents();
      const providerType = this.activeProviderType();
      if (providerType === 'cosmos-mongo' || providerType === 'mongodb') {
        updateMongoSchemaFromDocuments(documents);
      } else {
        updateSchemaFromDocuments(documents);
      }
    });

    // Switch Monaco language and reset query when provider type changes
    effect(() => {
      const providerType = this.activeProviderType();
      this.switchEditorLanguage(providerType);

      // Reset query to default when provider type changes
      if (this.lastProviderType !== null && this.lastProviderType !== providerType) {
        const defaultQuery = getDefaultQueryForProvider(providerType);
        this.query = defaultQuery;
        this.queryStore.setQuery(defaultQuery);
        this.queryChange.emit(defaultQuery);
      }
      this.lastProviderType = providerType;
    });
  }

  editorOptions = {
    theme: 'vs-dark',
    language: 'sql', // Start with sql, switch to cosmossql in onEditorInit
    minimap: { enabled: false },
    automaticLayout: true,
    fontSize: 14,
    lineNumbers: 'on' as const,
    scrollBeyondLastLine: false,
    wordWrap: 'on' as const,
    padding: { top: 8, bottom: 8 },
    renderLineHighlight: 'all' as const,
    bracketPairColorization: { enabled: true },
    matchBrackets: 'always' as const,
    suggestOnTriggerCharacters: true,
    quickSuggestions: true,
    tabSize: 2,
  };

  ngOnInit() {
    const storedQuery = this.queryStore.query();
    const providerType = this.activeProviderType();
    const defaultQuery = getDefaultQueryForProvider(providerType);

    // Use default if no stored query or if stored query is incompatible with provider
    if (!storedQuery || storedQuery.trim() === '' || !isQueryCompatibleWithProvider(storedQuery, providerType)) {
      this.query = defaultQuery;
      this.queryStore.setQuery(defaultQuery);
    } else {
      this.query = storedQuery;
    }

    this.lastProviderType = providerType;
  }

  onEditorInit(editor: any) {
    this.editorInstance = editor;
    const monaco = (window as any).monaco;

    // Register both languages if not already registered
    if (monaco) {
      const languages = monaco.languages.getLanguages();
      if (!languages.some((lang: any) => lang.id === 'cosmossql')) {
        registerCosmosSQL(monaco);
      }
      if (!languages.some((lang: any) => lang.id === 'mongodb')) {
        registerMongoDB(monaco);
      }
    }

    // Set the language based on current provider type
    const providerType = this.activeProviderType();
    this.switchEditorLanguage(providerType);

    // Add Ctrl+Enter / Cmd+Enter keybinding
    editor.addCommand(
      // Monaco.KeyMod.CtrlCmd | Monaco.KeyCode.Enter
      2048 | 3, // CtrlCmd = 2048, Enter = 3
      () => this.onExecute()
    );

    // Add Ctrl+Shift+F for format
    editor.addCommand(
      2048 | 1024 | 36, // CtrlCmd + Shift + KeyF
      () => this.formatQuery()
    );

    // Add Ctrl+Shift+A for analyze
    editor.addCommand(
      2048 | 1024 | 31, // CtrlCmd + Shift + KeyA
      () => this.analyzeQuery()
    );

    // Override toggle line comment to move cursor to next line after
    editor.addAction({
      id: 'comment-line-and-move',
      label: 'Toggle Line Comment and Move Down',
      keybindings: [
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash,
      ],
      run: (ed: any) => {
        const action = ed.getAction('editor.action.commentLine');
        if (action) {
          action.run().then(() => {
            const position = ed.getPosition();
            if (position) {
              const lineCount = ed.getModel()?.getLineCount() || 0;
              if (position.lineNumber < lineCount) {
                ed.setPosition({
                  lineNumber: position.lineNumber + 1,
                  column: position.column
                });
              }
            }
          });
        }
      }
    });
  }

  async onExecute() {
    const cont = this.container();
    if (!cont || !this.query.trim() || this.isLoading()) return;

    // Check if we need to reconnect
    const currentConnectionId = sessionStorage.getItem('activeConnectionId');
    const activeTab = this.explorerStore.activeTab();
    const tabConnectionId = activeTab?.connectionId;

    try {
      // Case 1: No active connection at all
      if (!currentConnectionId) {
        if (tabConnectionId) {
          // Try to reconnect using tab's stored connection
          const connection = this.connectionsStore.connections().find(c => c.id === tabConnectionId);
          if (connection) {
            this.isReconnecting.set(true);
            this.notificationService.info(`Reconnecting to: ${connection.name}`);
            await this.connectionsStore.connectAndNavigate(tabConnectionId);
            await this.explorerStore.loadDatabases();
          } else {
            this.notificationService.error('Connection no longer exists. Please go back and select a connection.');
            return;
          }
        } else {
          this.notificationService.error('No active connection. Please go back and select a connection.');
          return;
        }
      }
      // Case 2: Active connection differs from tab's connection
      else if (tabConnectionId && tabConnectionId !== currentConnectionId) {
        const connection = this.connectionsStore.connections().find(c => c.id === tabConnectionId);
        if (connection) {
          this.isReconnecting.set(true);
          this.notificationService.info(`Switching to: ${connection.name}`);
          await this.connectionsStore.connectAndNavigate(tabConnectionId);
          await this.explorerStore.loadDatabases();
        } else {
          this.notificationService.error('Connection no longer exists. Please close this tab and reconnect.');
          return;
        }
      }
    } finally {
      this.isReconnecting.set(false);
    }

    this.queryStore.executeQuery(cont);
    this.execute.emit();
  }

  applyTemplate(template: QueryTemplate) {
    this.query = template.query;
    this.queryStore.setQuery(template.query);
    this.queryChange.emit(template.query);
    // Focus the editor
    this.editorInstance?.focus();
  }

  formatQuery() {
    if (!this.query.trim()) return;
    const providerType = this.activeProviderType();
    if (providerType === 'cosmos-mongo' || providerType === 'mongodb') {
      this.query = this.formatJSON(this.query);
    } else {
      this.query = this.formatSQL(this.query);
    }
    this.queryStore.setQuery(this.query);
    this.queryChange.emit(this.query);
  }

  analyzeQuery() {
    const cont = this.container();
    if (!cont || !this.query.trim()) return;

    const activeTab = this.explorerStore.activeTab();
    const connectionId = activeTab?.connectionId || sessionStorage.getItem('activeConnectionId');

    if (!connectionId) {
      this.notificationService.error('No active connection. Please reconnect.');
      return;
    }

    this.dialog.open(QueryAnalyzerDialogComponent, {
      width: '700px',
      maxHeight: '80vh',
      data: {
        query: this.query,
        connectionId,
        container: cont,
        providerType: this.activeProviderType(),
      },
    });
  }

  clearQuery() {
    this.query = '';
    this.queryStore.setQuery('');
    this.queryChange.emit('');
    this.editorInstance?.focus();
  }

  toggleVisualMode() {
    this.visualMode.update(v => !v);
  }

  /**
   * Run the aggregation pipeline up to a specific stage
   */
  async runPipelineToStage(stageIndex: number) {
    const cont = this.container();
    if (!cont || !this.query.trim()) return;

    try {
      // Parse the full pipeline
      const fullPipeline = JSON5.parse(this.query);
      if (!Array.isArray(fullPipeline)) return;

      // Create a partial pipeline up to and including the requested stage
      const partialPipeline = fullPipeline.slice(0, stageIndex + 1);

      // Execute the partial pipeline
      const activeTab = this.explorerStore.activeTab();
      const connectionId = activeTab?.connectionId || sessionStorage.getItem('activeConnectionId');
      if (!connectionId) return;

      const startTime = performance.now();
      const result = await this.queryStore.executePartialPipeline(
        cont,
        connectionId,
        JSON.stringify(partialPipeline)
      );
      const executionTime = Math.round(performance.now() - startTime);

      // Update the visualizer with results
      if (this.pipelineVisualizer) {
        this.pipelineVisualizer.setStageResult(stageIndex, {
          stageIndex,
          documents: result.documents,
          count: result.documents.length,
          executionTimeMs: executionTime,
        });
      }
    } catch (err: any) {
      this.notificationService.error(`Failed to execute pipeline: ${err.message}`);
      if (this.pipelineVisualizer) {
        this.pipelineVisualizer.executingStage.set(null);
      }
    }
  }

  onQueryChange(query: string) {
    this.queryStore.setQuery(query);
    this.queryChange.emit(query);
    // Clear stage results when query changes
    if (this.pipelineVisualizer) {
      this.pipelineVisualizer.clearResults();
    }
  }

  /**
   * Handle pipeline changes from the visual editor
   */
  onPipelineChange(newPipeline: string) {
    this.query = newPipeline;
    this.queryStore.setQuery(newPipeline);
    this.queryChange.emit(newPipeline);
  }

  private switchEditorLanguage(providerType: ProviderType): void {
    if (!this.editorInstance) return;

    const monaco = (window as any).monaco;
    if (!monaco) return;

    const model = this.editorInstance.getModel();
    if (!model) return;

    const languageId = providerType === 'cosmos-mongo' || providerType === 'mongodb'
      ? 'mongodb'
      : 'cosmossql';

    if (this.currentLanguage !== languageId) {
      this.currentLanguage = languageId;
      monaco.editor.setModelLanguage(model, languageId);
    }
  }

  private formatJSON(json: string): string {
    try {
      // Use JSON5 to parse relaxed JSON (unquoted keys, trailing commas, etc.)
      const parsed = JSON5.parse(json);
      // Output as standard JSON with proper formatting
      return JSON.stringify(parsed, null, 2);
    } catch {
      // If invalid JSON, return as-is
      return json;
    }
  }

  private formatSQL(sql: string): string {
    const keywords = [
      'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'ORDER BY', 'GROUP BY',
      'HAVING', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN',
      'OFFSET', 'LIMIT', 'TOP', 'DISTINCT', 'VALUE', 'AS',
      'NOT', 'IN', 'BETWEEN', 'LIKE', 'EXISTS',
    ];
    const majorKeywords = ['SELECT', 'FROM', 'WHERE', 'ORDER BY', 'GROUP BY', 'HAVING', 'OFFSET', 'LIMIT'];

    // Split into segments: comments vs code blocks
    const lines = sql.split('\n');
    const segments: { type: 'comment' | 'code'; content: string }[] = [];
    let currentCode: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('--')) {
        // Flush any accumulated code
        if (currentCode.length > 0) {
          segments.push({ type: 'code', content: currentCode.join(' ') });
          currentCode = [];
        }
        // Add comment segment (preserve original indentation)
        segments.push({ type: 'comment', content: line });
      } else {
        currentCode.push(line);
      }
    }
    // Flush remaining code
    if (currentCode.length > 0) {
      segments.push({ type: 'code', content: currentCode.join(' ') });
    }

    // Format each segment
    const formattedSegments = segments.map((segment, index) => {
      if (segment.type === 'comment') {
        // Preserve comment with consistent indentation (4 spaces for commented-out conditions)
        const trimmed = segment.content.trim();
        // If comment looks like a commented-out AND/OR condition, indent it
        if (/^--\s*(AND|OR)\b/i.test(trimmed)) {
          return '  ' + trimmed;
        }
        return trimmed;
      }

      // Format code
      let code = segment.content.trim();
      if (!code) return '';

      // Check if this code block starts with AND/OR (continuation after comment)
      const startsWithCondition = /^(AND|OR)\b/i.test(code);

      // Normalize whitespace
      code = code.replace(/\s+/g, ' ');

      // Add newlines before major keywords
      for (const kw of majorKeywords) {
        const regex = new RegExp(`\\b(${kw})\\b`, 'gi');
        code = code.replace(regex, '\n$1');
      }

      // Add newlines before AND/OR (with indentation)
      code = code.replace(/\b(AND|OR)\b/gi, '\n  $1');

      // Trim and fix indentation
      code = code.trim();
      code = code.replace(/\n +/g, '\n  ');
      code = code.replace(/^\n/, '');

      // Uppercase keywords
      for (const kw of keywords) {
        const regex = new RegExp(`\\b${kw}\\b`, 'gi');
        code = code.replace(regex, kw);
      }

      // Cosmos DB: Boolean and null literals must be lowercase
      code = code.replace(/\b[Tt][Rr][Uu][Ee]\b/g, 'true');
      code = code.replace(/\b[Ff][Aa][Ll][Ss][Ee]\b/g, 'false');
      code = code.replace(/\b[Nn][Uu][Ll][Ll]\b(?=\s|$|,|\))/g, 'null');

      // If this block started with AND/OR but got moved to new line, ensure indent
      if (startsWithCondition && index > 0) {
        // The formatting already added newline+indent, but since this is a separate
        // segment, we need to make sure the first AND/OR is indented
        if (code.startsWith('AND') || code.startsWith('OR')) {
          code = '  ' + code;
        }
      }

      return code;
    });

    return formattedSegments.filter(s => s.length > 0).join('\n');
  }
}
