import {
  Component,
  input,
  output,
  computed,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import JSON5 from 'json5';

export type QueryType = 'find' | 'aggregate' | 'unknown';

export interface PipelineStage {
  index: number;
  type: string;
  content: any;
  summary: string;
}

export interface StageExecutionResult {
  stageIndex: number;
  documents: any[];
  count: number;
  executionTimeMs?: number;
}

@Component({
  selector: 'app-pipeline-visualizer',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatMenuModule,
  ],
  template: `
    <div class="pipeline-container">
      <!-- Query Type Badge -->
      <div class="query-type-badge" [class]="queryType()">
        <mat-icon>{{ queryType() === 'aggregate' ? 'account_tree' : 'search' }}</mat-icon>
        <span>{{ queryType() === 'aggregate' ? 'Aggregation Pipeline' : 'Find Query' }}</span>
      </div>

      @if (queryType() === 'aggregate' && stages().length > 0) {
        <!-- Aggregation Pipeline View -->
        <div class="stages-list">
          @for (stage of stages(); track stage.index) {
            <div class="stage-card" [class.executing]="executingStage() === stage.index">
              <div class="stage-header">
                <span class="stage-number">{{ stage.index + 1 }}</span>
                <span class="stage-type">{{ stage.type }}</span>
                <div class="stage-actions">
                  <button
                    mat-icon-button
                    matTooltip="Move up"
                    (click)="moveStage(stage.index, -1)"
                    [disabled]="stage.index === 0"
                    class="small-btn"
                  >
                    <mat-icon>arrow_upward</mat-icon>
                  </button>
                  <button
                    mat-icon-button
                    matTooltip="Move down"
                    (click)="moveStage(stage.index, 1)"
                    [disabled]="stage.index === stages().length - 1"
                    class="small-btn"
                  >
                    <mat-icon>arrow_downward</mat-icon>
                  </button>
                  <button
                    mat-icon-button
                    matTooltip="Run pipeline up to this stage"
                    (click)="runToStage(stage.index)"
                    class="small-btn run-btn"
                    [class.executing]="executingStage() === stage.index"
                  >
                    <mat-icon [class.hidden]="executingStage() === stage.index">play_arrow</mat-icon>
                    <mat-spinner [class.hidden]="executingStage() !== stage.index" diameter="16"></mat-spinner>
                  </button>
                  <button
                    mat-icon-button
                    matTooltip="Delete stage"
                    (click)="deleteStage(stage.index)"
                    class="small-btn delete-btn"
                  >
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>
              </div>
              <div class="stage-content">
                <code>{{ stage.summary }}</code>
              </div>
              @if (stageResults().get(stage.index); as result) {
                <div class="stage-result">
                  <mat-icon>arrow_forward</mat-icon>
                  <span class="result-count">{{ result.count }} document(s)</span>
                  @if (result.executionTimeMs) {
                    <span class="result-time">{{ result.executionTimeMs }}ms</span>
                  }
                </div>
              }
            </div>
            @if (stage.index < stages().length - 1) {
              <div class="stage-connector">
                <div class="connector-line"></div>
                <mat-icon>arrow_downward</mat-icon>
                <div class="connector-line"></div>
              </div>
            }
          }
        </div>

        <!-- Add Stage Button -->
        <button
          mat-stroked-button
          [matMenuTriggerFor]="addStageMenu"
          class="add-stage-btn"
        >
          <mat-icon>add</mat-icon>
          Add Stage
        </button>
        <mat-menu #addStageMenu="matMenu">
          @for (stageType of availableStageTypes; track stageType.type) {
            <button mat-menu-item (click)="addStage(stageType.type)">
              <mat-icon>{{ stageType.icon }}</mat-icon>
              {{ stageType.type }}
            </button>
          }
        </mat-menu>
      } @else if (queryType() === 'find') {
        <!-- Find Query View -->
        <div class="find-query-card">
          <div class="stage-header">
            <mat-icon>filter_list</mat-icon>
            <span class="stage-type">Filter</span>
          </div>
          <div class="stage-content">
            <code>{{ findQuerySummary() }}</code>
          </div>
        </div>
      } @else {
        <!-- Parse Error or Empty -->
        <div class="empty-state">
          <mat-icon>code</mat-icon>
          <span>Enter a query to visualize</span>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
      overflow: auto;
    }

    .pipeline-container {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .query-type-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 16px;
      font-size: 12px;
      font-weight: 500;
      width: fit-content;
    }

    .query-type-badge.aggregate {
      background: rgba(156, 39, 176, 0.15);
      color: #ce93d8;
    }

    .query-type-badge.find {
      background: rgba(33, 150, 243, 0.15);
      color: #64b5f6;
    }

    .query-type-badge.unknown {
      background: rgba(255, 255, 255, 0.1);
      color: rgba(255, 255, 255, 0.5);
    }

    .query-type-badge mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .stages-list {
      display: flex;
      flex-direction: column;
      align-items: stretch;
    }

    .stage-card,
    .find-query-card {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      overflow: hidden;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    .stage-card:hover {
      border-color: rgba(187, 134, 252, 0.3);
    }

    .stage-card.executing {
      border-color: #bb86fc;
      box-shadow: 0 0 12px rgba(187, 134, 252, 0.2);
    }

    .stage-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      background: rgba(255, 255, 255, 0.03);
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }

    .stage-number {
      width: 22px;
      height: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #bb86fc;
      color: #121212;
      border-radius: 50%;
      font-size: 11px;
      font-weight: 600;
    }

    .stage-type {
      font-size: 13px;
      font-weight: 600;
      color: #bb86fc;
      flex: 1;
    }

    .stage-actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .stage-actions button {
      width: 32px;
      height: 32px;
      line-height: 32px;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .stage-actions button.small-btn {
      width: 28px;
      height: 28px;
      line-height: 28px;
    }

    .stage-actions button mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      line-height: 18px;
    }

    .stage-actions button.small-btn mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      line-height: 16px;
    }

    .stage-actions button mat-spinner {
      margin: 0;
    }

    .stage-actions button.run-btn {
      display: inline-grid;
      place-items: center;
    }

    .stage-actions button.run-btn > * {
      grid-area: 1 / 1;
    }

    .stage-actions button.run-btn .hidden {
      visibility: hidden;
    }

    .stage-actions button.run-btn.executing {
      pointer-events: none;
      color: #bb86fc;
    }

    .stage-actions button.delete-btn:hover {
      color: #f44336;
    }

    .add-stage-btn {
      align-self: center;
      margin-top: 8px;
    }

    .add-stage-btn mat-icon {
      margin-right: 4px;
    }

    .stage-content {
      padding: 12px;
    }

    .stage-content code {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.8);
      white-space: pre-wrap;
      word-break: break-word;
    }

    .stage-result {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: rgba(76, 175, 80, 0.1);
      border-top: 1px solid rgba(76, 175, 80, 0.2);
      font-size: 12px;
      color: #81c784;
    }

    .stage-result mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    .result-time {
      margin-left: auto;
      color: rgba(255, 255, 255, 0.5);
    }

    .stage-connector {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 4px 0;
      color: rgba(255, 255, 255, 0.3);
    }

    .connector-line {
      width: 2px;
      height: 8px;
      background: rgba(255, 255, 255, 0.2);
    }

    .stage-connector mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 48px;
      color: rgba(255, 255, 255, 0.4);
    }

    .empty-state mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
    }

    .find-query-card .stage-header mat-icon {
      color: #64b5f6;
    }

    .find-query-card .stage-type {
      color: #64b5f6;
    }
  `],
})
export class PipelineVisualizerComponent {
  // Input query string
  query = input<string>('');

  // Input to indicate if main query is executing
  isMainQueryExecuting = input<boolean>(false);

  // Available stage types for adding new stages
  readonly availableStageTypes = [
    { type: '$match', icon: 'filter_list' },
    { type: '$group', icon: 'group_work' },
    { type: '$project', icon: 'view_column' },
    { type: '$sort', icon: 'sort' },
    { type: '$limit', icon: 'vertical_align_bottom' },
    { type: '$skip', icon: 'vertical_align_top' },
    { type: '$unwind', icon: 'unfold_more' },
    { type: '$lookup', icon: 'link' },
    { type: '$addFields', icon: 'add_circle' },
    { type: '$count', icon: 'tag' },
  ];

  // Output event when user wants to run to a specific stage
  runToStageRequest = output<number>();

  // Output event when pipeline is modified (emits the new pipeline JSON string)
  pipelineChange = output<string>();

  // Execution state
  executingStage = signal<number | null>(null);
  stageResults = signal<Map<number, StageExecutionResult>>(new Map());

  // Computed query type
  queryType = computed((): QueryType => {
    const q = this.query().trim();
    if (!q) return 'unknown';
    if (q.startsWith('[')) return 'aggregate';
    if (q.startsWith('{')) return 'find';
    return 'unknown';
  });

  // Parsed pipeline stages
  stages = computed((): PipelineStage[] => {
    if (this.queryType() !== 'aggregate') return [];

    try {
      const parsed = JSON5.parse(this.query());
      if (!Array.isArray(parsed)) return [];

      return parsed.map((stage, index) => {
        const type = Object.keys(stage)[0] || 'unknown';
        const content = stage[type];
        return {
          index,
          type,
          content,
          summary: this.summarizeStage(type, content),
        };
      });
    } catch {
      return [];
    }
  });

  // Find query summary
  findQuerySummary = computed((): string => {
    if (this.queryType() !== 'find') return '';

    try {
      const parsed = JSON5.parse(this.query());
      if (Object.keys(parsed).length === 0) {
        return 'All documents (no filter)';
      }
      return this.summarizeFilter(parsed);
    } catch {
      return 'Invalid query';
    }
  });

  /**
   * Request to run pipeline up to a specific stage
   */
  runToStage(stageIndex: number): void {
    // Ignore if already executing
    if (this.executingStage() !== null || this.isMainQueryExecuting()) return;

    this.executingStage.set(stageIndex);
    this.runToStageRequest.emit(stageIndex);
  }

  /**
   * Set the result for a stage (called from parent)
   */
  setStageResult(stageIndex: number, result: StageExecutionResult): void {
    const results = new Map(this.stageResults());
    results.set(stageIndex, result);
    this.stageResults.set(results);
    this.executingStage.set(null);
  }

  /**
   * Clear all stage results
   */
  clearResults(): void {
    this.stageResults.set(new Map());
  }

  /**
   * Move a stage up or down
   */
  moveStage(index: number, direction: -1 | 1): void {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= this.stages().length) return;

    try {
      const pipeline = JSON5.parse(this.query());
      if (!Array.isArray(pipeline)) return;

      // Swap stages
      [pipeline[index], pipeline[newIndex]] = [pipeline[newIndex], pipeline[index]];

      // Emit the updated pipeline
      this.pipelineChange.emit(JSON.stringify(pipeline, null, 2));
      this.clearResults();
    } catch {
      // Invalid JSON, ignore
    }
  }

  /**
   * Delete a stage from the pipeline
   */
  deleteStage(index: number): void {
    try {
      const pipeline = JSON5.parse(this.query());
      if (!Array.isArray(pipeline)) return;

      // Remove the stage
      pipeline.splice(index, 1);

      // Emit the updated pipeline
      this.pipelineChange.emit(JSON.stringify(pipeline, null, 2));
      this.clearResults();
    } catch {
      // Invalid JSON, ignore
    }
  }

  /**
   * Add a new stage to the pipeline
   */
  addStage(stageType: string): void {
    try {
      let pipeline = JSON5.parse(this.query());
      if (!Array.isArray(pipeline)) {
        pipeline = [];
      }

      // Create a new stage with default content
      const newStage = this.createDefaultStage(stageType);
      pipeline.push(newStage);

      // Emit the updated pipeline
      this.pipelineChange.emit(JSON.stringify(pipeline, null, 2));
      this.clearResults();
    } catch {
      // If parsing fails, start with an empty pipeline
      const newStage = this.createDefaultStage(stageType);
      this.pipelineChange.emit(JSON.stringify([newStage], null, 2));
    }
  }

  /**
   * Create a default stage object for a given type
   */
  private createDefaultStage(stageType: string): Record<string, any> {
    switch (stageType) {
      case '$match':
        return { $match: {} };
      case '$group':
        return { $group: { _id: null } };
      case '$project':
        return { $project: { _id: 1 } };
      case '$sort':
        return { $sort: { _id: 1 } };
      case '$limit':
        return { $limit: 10 };
      case '$skip':
        return { $skip: 0 };
      case '$unwind':
        return { $unwind: '$field' };
      case '$lookup':
        return { $lookup: { from: 'collection', localField: 'field', foreignField: '_id', as: 'joined' } };
      case '$addFields':
        return { $addFields: {} };
      case '$count':
        return { $count: 'count' };
      default:
        return { [stageType]: {} };
    }
  }

  /**
   * Generate a summary for a pipeline stage
   */
  private summarizeStage(type: string, content: any): string {
    try {
      switch (type) {
        case '$match':
          return this.summarizeFilter(content);

        case '$group':
          const groupId = content['_id'];
          const idStr = groupId === null ? 'null (all docs)' :
                       typeof groupId === 'string' ? groupId :
                       JSON.stringify(groupId);
          const accumulators = Object.keys(content).filter(k => k !== '_id');
          return `_id: ${idStr}${accumulators.length ? ', ' + accumulators.join(', ') : ''}`;

        case '$project':
          const fields = Object.entries(content)
            .map(([k, v]) => v === 0 || v === false ? `-${k}` : k)
            .slice(0, 5);
          const more = Object.keys(content).length > 5 ? `, +${Object.keys(content).length - 5} more` : '';
          return fields.join(', ') + more;

        case '$sort':
          return Object.entries(content)
            .map(([k, v]) => `${k}: ${v === 1 ? 'asc' : 'desc'}`)
            .join(', ');

        case '$limit':
          return String(content);

        case '$skip':
          return String(content);

        case '$unwind':
          return typeof content === 'string' ? content : content.path || JSON.stringify(content);

        case '$lookup':
          return `${content.from} on ${content.localField} = ${content.foreignField}`;

        case '$count':
          return `as "${content}"`;

        case '$addFields':
        case '$set':
          const newFields = Object.keys(content).slice(0, 3);
          const moreFields = Object.keys(content).length > 3 ? `, +${Object.keys(content).length - 3} more` : '';
          return newFields.join(', ') + moreFields;

        default:
          const str = JSON.stringify(content);
          return str.length > 50 ? str.substring(0, 50) + '...' : str;
      }
    } catch {
      return JSON.stringify(content).substring(0, 50);
    }
  }

  /**
   * Summarize a filter/match object
   */
  private summarizeFilter(filter: any): string {
    if (!filter || Object.keys(filter).length === 0) {
      return 'All documents';
    }

    const conditions: string[] = [];

    for (const [key, value] of Object.entries(filter)) {
      if (key === '$and' || key === '$or' || key === '$nor') {
        conditions.push(`${key}: ${(value as any[]).length} conditions`);
      } else if (typeof value === 'object' && value !== null) {
        const ops = Object.keys(value);
        conditions.push(`${key} ${ops.join(', ')}`);
      } else {
        conditions.push(`${key}: ${JSON.stringify(value)}`);
      }
    }

    const result = conditions.slice(0, 3).join(', ');
    const more = conditions.length > 3 ? `, +${conditions.length - 3} more` : '';
    return result + more;
  }
}
