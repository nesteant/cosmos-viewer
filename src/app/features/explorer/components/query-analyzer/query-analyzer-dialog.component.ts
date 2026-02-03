import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  ContainerInfo,
  QueryAnalysis,
  IndexMetrics,
  OptimizationHint,
  HintSeverity,
  ProviderType,
} from '@core/models';
import { ElectronService } from '@core/services';
import { QueryParserService } from '../../services/query-parser.service';
import { MongoQueryParserService } from '../../services/mongo-query-parser.service';

interface QueryAnalyzerDialogData {
  query: string;
  container: ContainerInfo;
  connectionId: string;
  providerType: ProviderType;
}

interface MongoExplainData {
  queryPlanner?: {
    winningPlan?: {
      stage?: string;
      inputStage?: {
        stage?: string;
        indexName?: string;
        keyPattern?: Record<string, number>;
        indexBounds?: Record<string, string[]>;
      };
    };
    rejectedPlans?: any[];
  };
  executionStats?: {
    executionSuccess?: boolean;
    nReturned?: number;
    executionTimeMillis?: number;
    totalKeysExamined?: number;
    totalDocsExamined?: number;
  };
  serverInfo?: {
    host?: string;
    port?: number;
    version?: string;
  };
}

@Component({
  selector: 'app-query-analyzer-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>analytics</mat-icon>
      Query Analyzer
    </h2>

    <mat-dialog-content>
      @if (isLoading()) {
        <div class="loading-state">
          <mat-spinner diameter="40"></mat-spinner>
          <span>Analyzing query...</span>
        </div>
      } @else if (error()) {
        <div class="error-state">
          <mat-icon>error</mat-icon>
          <span>{{ error() }}</span>
          <button mat-stroked-button (click)="analyze()">Retry</button>
        </div>
      } @else if (analysis()) {
        <mat-tab-group>
          <!-- Explanation Tab -->
          <mat-tab label="Explanation">
            <div class="tab-content">
              <div class="explanation-summary">
                {{ analysis()!.explanation.summary }}
              </div>
              @if (analysis()!.explanation.clauses.length > 0) {
                <div class="clause-list">
                  @for (clause of analysis()!.explanation.clauses; track clause.type) {
                    <div class="clause-item">
                      <span class="clause-type">{{ clause.type.replace('_', ' ') }}</span>
                      <span class="clause-desc">{{ clause.description }}</span>
                    </div>
                  }
                </div>
              }
            </div>
          </mat-tab>

          <!-- Optimization Hints Tab -->
          <mat-tab>
            <ng-template mat-tab-label>
              Hints
              @if (hintCount() > 0) {
                <span class="badge" [class.warning]="hasWarnings()">{{ hintCount() }}</span>
              }
            </ng-template>
            <div class="tab-content">
              @if (analysis()!.optimizationHints.length === 0) {
                <div class="empty-message success">
                  <mat-icon>check_circle</mat-icon>
                  <span>No optimization issues detected</span>
                </div>
              } @else {
                @for (hint of analysis()!.optimizationHints; track hint.title) {
                  <div class="hint-card" [class]="hint.severity">
                    <mat-icon>{{ getHintIcon(hint.severity) }}</mat-icon>
                    <div class="hint-content">
                      <div class="hint-title">{{ hint.title }}</div>
                      <div class="hint-description">{{ hint.description }}</div>
                      @if (hint.suggestion) {
                        <div class="hint-suggestion">
                          <strong>Suggestion:</strong> {{ hint.suggestion }}
                        </div>
                      }
                    </div>
                  </div>
                }
              }
            </div>
          </mat-tab>

          <!-- Index Metrics Tab -->
          <mat-tab label="Index Metrics">
            <div class="tab-content">
              @if (isMongoDB()) {
                <!-- MongoDB Explain Output -->
                @if (mongoExplain()) {
                  <!-- Query Plan -->
                  <div class="index-section">
                    <h4>
                      <mat-icon class="success">account_tree</mat-icon>
                      Query Plan
                    </h4>
                    <div class="mongo-plan">
                      @if (mongoExplain()!.queryPlanner?.winningPlan) {
                        <div class="plan-item">
                          <span class="plan-label">Stage:</span>
                          <code class="plan-value" [class.warning]="mongoExplain()!.queryPlanner!.winningPlan!.stage === 'COLLSCAN'">
                            {{ mongoExplain()!.queryPlanner!.winningPlan!.stage || 'N/A' }}
                          </code>
                        </div>
                        @if (mongoExplain()!.queryPlanner!.winningPlan!.inputStage) {
                          <div class="plan-item">
                            <span class="plan-label">Input Stage:</span>
                            <code class="plan-value">{{ mongoExplain()!.queryPlanner!.winningPlan!.inputStage!.stage }}</code>
                          </div>
                          @if (mongoExplain()!.queryPlanner!.winningPlan!.inputStage!.indexName) {
                            <div class="plan-item">
                              <span class="plan-label">Index Used:</span>
                              <code class="plan-value success">{{ mongoExplain()!.queryPlanner!.winningPlan!.inputStage!.indexName }}</code>
                            </div>
                          }
                        }
                      }
                    </div>
                  </div>

                  <!-- Execution Stats -->
                  @if (mongoExplain()!.executionStats) {
                    <div class="index-section">
                      <h4>
                        <mat-icon class="info">speed</mat-icon>
                        Execution Statistics
                      </h4>
                      <div class="mongo-stats">
                        <div class="stat-item">
                          <span class="stat-label">Documents Returned:</span>
                          <span class="stat-value">{{ mongoExplain()!.executionStats!.nReturned ?? 'N/A' }}</span>
                        </div>
                        <div class="stat-item">
                          <span class="stat-label">Documents Examined:</span>
                          <span class="stat-value" [class.warning]="(mongoExplain()!.executionStats!.totalDocsExamined ?? 0) > (mongoExplain()!.executionStats!.nReturned ?? 0) * 10">
                            {{ mongoExplain()!.executionStats!.totalDocsExamined ?? 'N/A' }}
                          </span>
                        </div>
                        <div class="stat-item">
                          <span class="stat-label">Keys Examined:</span>
                          <span class="stat-value">{{ mongoExplain()!.executionStats!.totalKeysExamined ?? 'N/A' }}</span>
                        </div>
                        <div class="stat-item">
                          <span class="stat-label">Execution Time:</span>
                          <span class="stat-value">{{ mongoExplain()!.executionStats!.executionTimeMillis ?? 'N/A' }} ms</span>
                        </div>
                      </div>
                    </div>
                  }
                } @else {
                  <div class="empty-message">
                    <mat-icon>info</mat-icon>
                    <span>No execution plan available for this query</span>
                  </div>
                }
              } @else {
                <!-- Cosmos SQL Index Metrics -->
                @if (analysis()!.indexMetrics) {
                  <!-- Utilized Indexes -->
                  <div class="index-section">
                    <h4>
                      <mat-icon class="success">check_circle</mat-icon>
                      Utilized Indexes
                    </h4>
                    @if (analysis()!.indexMetrics!.utilizedSingleIndexes.length > 0) {
                      @for (idx of analysis()!.indexMetrics!.utilizedSingleIndexes; track idx.indexSpec) {
                        <div class="index-item utilized">
                          <code>{{ idx.indexSpec }}</code>
                          <span class="impact high">{{ idx.indexImpactScore }}</span>
                        </div>
                      }
                    } @else {
                      <div class="empty-hint">No single indexes utilized</div>
                    }
                    @for (idx of analysis()!.indexMetrics!.utilizedCompositeIndexes; track idx.indexSpecs.join()) {
                      <div class="index-item utilized composite">
                        <code>{{ idx.indexSpecs.join(' + ') }}</code>
                        <span class="impact high">Composite</span>
                      </div>
                    }
                  </div>

                  <!-- Recommended Indexes -->
                  <div class="index-section">
                    <h4>
                      <mat-icon class="warning">lightbulb</mat-icon>
                      Recommended Indexes
                    </h4>
                    @if (analysis()!.indexMetrics!.potentialSingleIndexes.length === 0 &&
                         analysis()!.indexMetrics!.potentialCompositeIndexes.length === 0) {
                      <div class="empty-hint success">No additional indexes recommended</div>
                    }
                    @for (idx of analysis()!.indexMetrics!.potentialSingleIndexes; track idx.indexSpec) {
                      <div class="index-item potential">
                        <code>{{ idx.indexSpec }}</code>
                        <span class="impact" [class.high]="idx.indexImpactScore === 'High'">
                          {{ idx.indexImpactScore }} impact
                        </span>
                      </div>
                    }
                    @for (idx of analysis()!.indexMetrics!.potentialCompositeIndexes; track idx.indexSpecs.join()) {
                      <div class="index-item potential composite">
                        <code>{{ idx.indexSpecs.join(' + ') }}</code>
                        <span class="impact" [class.high]="idx.indexImpactScore === 'High'">
                          {{ idx.indexImpactScore }} impact
                        </span>
                      </div>
                    }
                  </div>
                } @else {
                  <div class="empty-message">
                    <mat-icon>info</mat-icon>
                    <span>Index metrics not available for this query</span>
                  </div>
                }
              }
            </div>
          </mat-tab>
        </mat-tab-group>

        <!-- Stats footer -->
        <div class="stats-bar">
          @if (serverError()) {
            <span class="stat error" [matTooltip]="serverError()!">
              <mat-icon>error_outline</mat-icon>
              Server analysis failed (hover for details)
            </span>
          } @else {
            <span class="stat">
              <mat-icon>bolt</mat-icon>
              {{ formatRU(analysis()!.executionStats?.requestCharge) }} RU
            </span>
            <span class="stat">
              <mat-icon>schedule</mat-icon>
              {{ formatMs(analysis()!.executionStats?.executionTimeMs) }}
            </span>
          }
        </div>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="analyze()" [disabled]="isLoading()">
        <mat-icon>refresh</mat-icon>
        Re-analyze
      </button>
      <button mat-flat-button color="primary" mat-dialog-close>
        Close
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      h2[mat-dialog-title] {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0;
        padding: 12px 24px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        font-size: 18px;
        line-height: 1.2;
      }

      h2[mat-dialog-title] mat-icon {
        color: #bb86fc;
        font-size: 20px;
        width: 20px;
        height: 20px;
      }

      mat-dialog-content {
        padding: 0 !important;
        min-height: 300px;
        max-height: 60vh;
      }

      .loading-state,
      .error-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
        padding: 48px;
        color: rgba(255, 255, 255, 0.7);
      }

      .error-state mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: #f44336;
      }

      .tab-content {
        padding: 16px;
      }

      .explanation-summary {
        font-size: 15px;
        line-height: 1.6;
        color: rgba(255, 255, 255, 0.9);
        padding: 12px 16px;
        background: rgba(187, 134, 252, 0.1);
        border-radius: 8px;
        border-left: 3px solid #bb86fc;
        margin-bottom: 16px;
      }

      .clause-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .clause-item {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 8px 12px;
        background: rgba(255, 255, 255, 0.03);
        border-radius: 4px;
      }

      .clause-type {
        font-size: 11px;
        font-weight: 600;
        color: #bb86fc;
        background: rgba(187, 134, 252, 0.15);
        padding: 2px 8px;
        border-radius: 4px;
        min-width: 70px;
        text-align: center;
      }

      .clause-desc {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.8);
      }

      .badge {
        background: rgba(255, 255, 255, 0.2);
        color: white;
        font-size: 11px;
        font-weight: 600;
        padding: 2px 6px;
        border-radius: 10px;
        margin-left: 8px;
      }

      .badge.warning {
        background: #ff9800;
      }

      .hint-card {
        display: flex;
        gap: 12px;
        padding: 12px;
        border-radius: 8px;
        margin-bottom: 8px;
      }

      .hint-card.info {
        background: rgba(33, 150, 243, 0.1);
        border-left: 3px solid #2196f3;
      }

      .hint-card.info mat-icon {
        color: #2196f3;
      }

      .hint-card.warning {
        background: rgba(255, 152, 0, 0.1);
        border-left: 3px solid #ff9800;
      }

      .hint-card.warning mat-icon {
        color: #ff9800;
      }

      .hint-card.error {
        background: rgba(244, 67, 54, 0.1);
        border-left: 3px solid #f44336;
      }

      .hint-card.error mat-icon {
        color: #f44336;
      }

      .hint-content {
        flex: 1;
      }

      .hint-title {
        font-weight: 500;
        font-size: 14px;
        margin-bottom: 4px;
      }

      .hint-description {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.7);
        margin-bottom: 8px;
      }

      .hint-suggestion {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.6);
        background: rgba(0, 0, 0, 0.2);
        padding: 8px;
        border-radius: 4px;
      }

      .index-section {
        margin-bottom: 20px;
      }

      .index-section h4 {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0 0 12px 0;
        font-size: 14px;
        font-weight: 500;
      }

      .index-section h4 mat-icon.success {
        color: #4caf50;
      }

      .index-section h4 mat-icon.warning {
        color: #ff9800;
      }

      .index-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        background: rgba(255, 255, 255, 0.03);
        border-radius: 4px;
        margin-bottom: 6px;
      }

      .index-item code {
        font-size: 12px;
        color: #4fc3f7;
      }

      .index-item.utilized {
        border-left: 3px solid #4caf50;
      }

      .index-item.potential {
        border-left: 3px solid #ff9800;
      }

      .index-item .impact {
        font-size: 11px;
        padding: 2px 8px;
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.1);
      }

      .index-item .impact.high {
        background: rgba(76, 175, 80, 0.2);
        color: #4caf50;
      }

      .empty-message,
      .empty-hint {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px;
        color: rgba(255, 255, 255, 0.5);
        font-size: 13px;
      }

      .empty-message.success,
      .empty-hint.success {
        color: #4caf50;
      }

      .stats-bar {
        display: flex;
        gap: 16px;
        padding: 12px 16px;
        background: rgba(0, 0, 0, 0.2);
        border-top: 1px solid rgba(255, 255, 255, 0.08);
      }

      .stat {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.6);
      }

      .stat mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }

      .stat.error {
        color: #ff9800;
      }

      .stat.error mat-icon {
        color: #ff9800;
      }

      mat-dialog-actions {
        padding: 12px 16px;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
      }

      /* MongoDB-specific styles */
      .mongo-plan,
      .mongo-stats {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .plan-item,
      .stat-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 12px;
        background: rgba(255, 255, 255, 0.03);
        border-radius: 4px;
      }

      .plan-label,
      .stat-label {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.6);
        min-width: 140px;
      }

      .plan-value,
      .stat-value {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.9);
      }

      .plan-value.warning,
      .stat-value.warning {
        color: #ff9800;
      }

      .plan-value.success {
        color: #4caf50;
      }

      .index-section h4 mat-icon.info {
        color: #2196f3;
      }
    `,
  ],
})
export class QueryAnalyzerDialogComponent implements OnInit {
  readonly dialogRef = inject(MatDialogRef<QueryAnalyzerDialogComponent>);
  readonly data = inject<QueryAnalyzerDialogData>(MAT_DIALOG_DATA);
  private electronService = inject(ElectronService);
  private queryParser = inject(QueryParserService);
  private mongoQueryParser = inject(MongoQueryParserService);

  analysis = signal<QueryAnalysis | null>(null);
  isLoading = signal(true);
  error = signal<string | null>(null);
  serverError = signal<string | null>(null);

  // MongoDB-specific explain data
  mongoExplain = signal<MongoExplainData | null>(null);

  // Check if this is a MongoDB provider
  isMongoDB = computed(() =>
    this.data.providerType === 'cosmos-mongo' || this.data.providerType === 'mongodb'
  );

  hintCount = computed(() => this.analysis()?.optimizationHints.length ?? 0);
  hasWarnings = computed(() =>
    this.analysis()?.optimizationHints.some(
      (h) => h.severity === 'warning' || h.severity === 'error'
    ) ?? false
  );

  ngOnInit() {
    this.analyze();
  }

  async analyze() {
    this.isLoading.set(true);
    this.error.set(null);
    this.serverError.set(null);
    this.mongoExplain.set(null);

    try {
      const isMongo = this.isMongoDB();

      // Step 1: Parse query for explanation (client-side)
      const explanation = isMongo
        ? this.mongoQueryParser.parseQuery(this.data.query)
        : this.queryParser.parseQuery(this.data.query);

      // Step 2: Get optimization hints (client-side)
      const hints: OptimizationHint[] = isMongo
        ? this.mongoQueryParser.analyzeForHints(this.data.query)
        : this.queryParser.analyzeForHints(
            this.data.query,
            this.data.container.partitionKeyPath
          );

      // Step 3: Get analysis from server
      let indexMetrics: IndexMetrics | null = null;
      let executionStats = null;

      try {
        const result = await this.electronService.analyzeQuery({
          connectionId: this.data.connectionId,
          databaseId: this.data.container.databaseId,
          containerId: this.data.container.id,
          query: this.data.query,
        });

        if (isMongo) {
          // Parse MongoDB explain output
          if (result.indexMetrics && result.indexMetrics !== '{}') {
            try {
              const parsed = JSON.parse(result.indexMetrics);
              this.mongoExplain.set(parsed);

              // Generate hints from MongoDB explain data
              this.generateMongoHints(parsed, hints);
            } catch {
              // Ignore JSON parse errors
            }
          }

          executionStats = {
            requestCharge: result.requestCharge,
            executionTimeMs: result.executionTimeMs,
            retrievedDocumentCount: result.retrievedDocumentCount,
          };
        } else {
          // Parse Cosmos SQL index metrics
          if (result.indexMetrics && result.indexMetrics !== '{}') {
            try {
              const parsed = JSON.parse(result.indexMetrics);
              indexMetrics = {
                utilizedSingleIndexes: parsed.UtilizedSingleIndexes || [],
                potentialSingleIndexes: parsed.PotentialSingleIndexes || [],
                utilizedCompositeIndexes: parsed.UtilizedCompositeIndexes || [],
                potentialCompositeIndexes: parsed.PotentialCompositeIndexes || [],
              };

              // Add hints from server-side index recommendations
              for (const idx of indexMetrics.potentialSingleIndexes) {
                if (idx.indexImpactScore === 'High') {
                  hints.push({
                    severity: 'warning',
                    category: 'index',
                    title: `Missing index: ${idx.indexSpec}`,
                    description: `Creating an index on ${idx.indexSpec} could significantly improve query performance.`,
                    suggestion: `Add a range index on path ${idx.indexSpec} in your indexing policy.`,
                  });
                }
              }
            } catch {
              // Ignore JSON parse errors for index metrics
            }
          }

          executionStats = {
            requestCharge: result.requestCharge,
            executionTimeMs: result.executionTimeMs,
            retrievedDocumentCount: result.retrievedDocumentCount,
          };
        }
      } catch (err: any) {
        // Server-side analysis failed, but we still have client-side analysis
        console.warn('Server-side analysis failed:', err);
        this.serverError.set(err.message || 'Failed to get server metrics');
      }

      this.analysis.set({
        explanation,
        optimizationHints: hints,
        indexMetrics,
        executionStats,
        analyzedQuery: this.data.query,
        timestamp: new Date(),
      });
    } catch (err: any) {
      this.error.set(err.message || 'Failed to analyze query');
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Generate optimization hints from MongoDB explain output
   */
  private generateMongoHints(explain: MongoExplainData, hints: OptimizationHint[]): void {
    const stats = explain.executionStats;
    const planner = explain.queryPlanner;

    // Check for collection scan (no index used)
    const stage = planner?.winningPlan?.stage || planner?.winningPlan?.inputStage?.stage;
    if (stage === 'COLLSCAN') {
      hints.push({
        severity: 'warning',
        category: 'index',
        title: 'Collection scan detected',
        description: 'Query is scanning the entire collection without using an index.',
        suggestion: 'Consider creating an index on the fields used in your query filter.',
      });
    }

    // Check for high docs examined vs returned ratio
    if (stats && stats.nReturned !== undefined && stats.totalDocsExamined !== undefined) {
      const ratio = stats.totalDocsExamined / Math.max(stats.nReturned, 1);
      if (ratio > 10 && stats.totalDocsExamined > 100) {
        hints.push({
          severity: 'info',
          category: 'index',
          title: 'High document examination ratio',
          description: `Examined ${stats.totalDocsExamined} documents to return ${stats.nReturned}. Ratio: ${ratio.toFixed(1)}x`,
          suggestion: 'An index covering your query filter could reduce the number of documents examined.',
        });
      }
    }

    // Check if index was used
    const indexName = planner?.winningPlan?.inputStage?.indexName;
    if (indexName) {
      hints.push({
        severity: 'info',
        category: 'index',
        title: `Using index: ${indexName}`,
        description: 'Query is utilizing an index for efficient execution.',
      });
    }
  }

  getHintIcon(severity: HintSeverity): string {
    switch (severity) {
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      case 'info':
      default:
        return 'info';
    }
  }

  formatRU(value: number | undefined | null): string {
    if (value === undefined || value === null) return '--';
    return value.toFixed(2);
  }

  formatMs(value: number | undefined | null): string {
    if (value === undefined || value === null) return '-- ms';
    return `${value} ms`;
  }
}
