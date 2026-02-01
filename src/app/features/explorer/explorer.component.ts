import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AngularSplitModule, SplitGutterInteractionEvent } from 'angular-split';
import { ContainerInfo } from '@core/models';
import { LayoutPreferencesService } from '@core/services';
import { CollapseButtonComponent } from '@shared/components';
import { ConnectionsStore } from '../connections/store';
import { ExplorerStore, QueryStore } from './store';
import { DatabaseTreeComponent } from './components/database-tree/database-tree.component';
import { QueryEditorComponent } from './components/query-editor/query-editor.component';
import { ResultsTableComponent } from './components/results-table/results-table.component';

@Component({
  selector: 'app-explorer',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    AngularSplitModule,
    CollapseButtonComponent,
    DatabaseTreeComponent,
    QueryEditorComponent,
    ResultsTableComponent,
  ],
  template: `
    <as-split
      direction="horizontal"
      class="explorer-layout"
      [gutterSize]="3"
      (dragEnd)="onHorizontalDragEnd($event)"
    >
      <!-- Sidebar -->
      <as-split-area
        [size]="sidebarSize()"
        [minSize]="sidebarCollapsed() ? 0 : 10"
        [maxSize]="40"
        [visible]="!sidebarCollapsed()"
      >
        <aside class="explorer-sidebar">
          <div class="sidebar-header">
            <button
              mat-icon-button
              matTooltip="Back to Connections"
              (click)="onBackToConnections()"
            >
              <mat-icon>arrow_back</mat-icon>
            </button>
            <span class="connection-name">
              {{ connectionsStore.selectedConnection()?.name ?? 'Connection' }}
            </span>
            <span class="spacer"></span>
            <app-collapse-button
              direction="horizontal"
              label="sidebar"
              [collapsed]="false"
              (toggle)="toggleSidebar()"
            />
          </div>
          <app-database-tree
            (containerSelected)="onContainerSelected($event)"
          />
        </aside>
      </as-split-area>

      <!-- Main area -->
      <as-split-area [size]="mainAreaSize()">
        <!-- Collapsed sidebar indicator -->
        @if (sidebarCollapsed()) {
          <div class="collapsed-sidebar-indicator">
            <app-collapse-button
              direction="horizontal"
              label="sidebar"
              [collapsed]="true"
              (toggle)="toggleSidebar()"
            />
          </div>
        }

        @if (explorerStore.selectedContainer(); as container) {
          <as-split
            direction="vertical"
            class="main-split"
            [gutterSize]="3"
            (dragEnd)="onVerticalDragEnd($event)"
          >
            <!-- Query panel -->
            <as-split-area
              [size]="queryPanelSize()"
              [minSize]="queryPanelCollapsed() ? 0 : 10"
              [maxSize]="60"
              [visible]="!queryPanelCollapsed()"
            >
              <div class="query-panel">
                <app-query-editor [container]="container" [sidebarCollapsed]="sidebarCollapsed()" />
                <app-collapse-button
                  class="query-collapse-btn"
                  direction="vertical"
                  label="query editor"
                  [collapsed]="false"
                  (toggle)="toggleQueryPanel()"
                />
              </div>
            </as-split-area>

            <!-- Results panel -->
            <as-split-area [size]="resultsPanelSize()">
              <!-- Collapsed query panel indicator -->
              @if (queryPanelCollapsed()) {
                <div class="collapsed-query-indicator">
                  <app-collapse-button
                    direction="vertical"
                    label="query editor"
                    [collapsed]="true"
                    (toggle)="toggleQueryPanel()"
                  />
                  <span class="collapsed-label">Query Editor</span>
                </div>
              }
              <div class="results-panel">
                <app-results-table [container]="container" />
              </div>
            </as-split-area>
          </as-split>
        } @else {
          <div class="no-selection">
            <mat-icon>touch_app</mat-icon>
            <h3>Select a Container</h3>
            <p>Choose a database and container from the tree to start querying</p>
          </div>
        }
      </as-split-area>
    </as-split>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
        overflow: hidden;
      }

      .explorer-layout {
        height: 100%;
      }

      .explorer-sidebar {
        height: 100%;
        display: flex;
        flex-direction: column;
        background: rgba(0, 0, 0, 0.1);
        overflow: hidden;
      }

      .sidebar-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.12);
      }

      .connection-name {
        font-size: 14px;
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .spacer {
        flex: 1;
      }

      .main-split {
        height: 100%;
      }

      .query-panel {
        height: 100%;
        display: flex;
        flex-direction: column;
        position: relative;
      }

      .query-collapse-btn {
        position: absolute;
        bottom: 4px;
        right: 4px;
        z-index: 10;
      }

      .results-panel {
        height: 100%;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .collapsed-sidebar-indicator {
        position: absolute;
        top: 38px;
        left: 4px;
        z-index: 100;
        background: rgba(0, 0, 0, 0.4);
        border-radius: 4px;
        padding: 2px;
      }

      .collapsed-query-indicator {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 4px 8px;
        background: rgba(0, 0, 0, 0.2);
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }

      .collapsed-label {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.5);
      }

      .no-selection {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: rgba(255, 255, 255, 0.5);
        text-align: center;
        padding: 32px;
      }

      .no-selection mat-icon {
        font-size: 72px;
        width: 72px;
        height: 72px;
        margin-bottom: 16px;
        opacity: 0.5;
      }

      .no-selection h3 {
        margin: 0;
        font-size: 20px;
        font-weight: 500;
        color: rgba(255, 255, 255, 0.7);
      }

      .no-selection p {
        margin: 8px 0 0;
        font-size: 14px;
      }
    `,
  ],
})
export class ExplorerComponent implements OnInit, OnDestroy {
  readonly connectionsStore = inject(ConnectionsStore);
  readonly explorerStore = inject(ExplorerStore);
  readonly queryStore = inject(QueryStore);
  private router = inject(Router);
  private layoutService = inject(LayoutPreferencesService);

  // Layout state
  sidebarSize = signal(20);
  queryPanelSize = signal(25);
  sidebarCollapsed = signal(false);
  queryPanelCollapsed = signal(false);

  // Store previous sizes for restore after collapse
  private lastSidebarSize = 20;
  private lastQueryPanelSize = 25;

  // Computed sizes
  mainAreaSize = computed(() => 100 - this.sidebarSize());
  resultsPanelSize = computed(() => 100 - this.queryPanelSize());

  async ngOnInit() {
    // Load connections if not already loaded
    if (!this.connectionsStore.hasConnections()) {
      this.connectionsStore.loadConnections();
    }

    // Load layout preferences
    const prefs = await this.layoutService.loadPreferences();
    this.sidebarSize.set(prefs.sidebarSize);
    this.queryPanelSize.set(prefs.queryPanelSize);
    this.sidebarCollapsed.set(prefs.sidebarCollapsed);
    this.queryPanelCollapsed.set(prefs.queryPanelCollapsed);

    // Store for restore
    if (!prefs.sidebarCollapsed) {
      this.lastSidebarSize = prefs.sidebarSize;
    }
    if (!prefs.queryPanelCollapsed) {
      this.lastQueryPanelSize = prefs.queryPanelSize;
    }
  }

  ngOnDestroy() {
    // Save layout before leaving
    this.layoutService.saveImmediately();

    // Reset stores when leaving explorer
    this.explorerStore.reset();
    this.queryStore.reset();
  }

  onBackToConnections() {
    this.explorerStore.clearSelection();
    sessionStorage.removeItem('activeConnectionId');
    this.router.navigate(['/connections']);
  }

  onContainerSelected(container: ContainerInfo) {
    // Auto-execute default query when container is selected
    this.queryStore.setQuery('SELECT * FROM c');
    this.queryStore.executeQuery(container);
  }

  onHorizontalDragEnd(event: SplitGutterInteractionEvent) {
    const sizes = event.sizes;
    if (sizes && sizes.length > 0) {
      const sidebarSize = typeof sizes[0] === 'number' ? sizes[0] : 20;
      this.sidebarSize.set(sidebarSize);
      this.lastSidebarSize = sidebarSize;
      this.layoutService.updatePreferences({ sidebarSize });
    }
  }

  onVerticalDragEnd(event: SplitGutterInteractionEvent) {
    const sizes = event.sizes;
    if (sizes && sizes.length > 0) {
      const queryPanelSize = typeof sizes[0] === 'number' ? sizes[0] : 25;
      this.queryPanelSize.set(queryPanelSize);
      this.lastQueryPanelSize = queryPanelSize;
      this.layoutService.updatePreferences({ queryPanelSize });
    }
  }

  toggleSidebar() {
    const collapsed = !this.sidebarCollapsed();
    this.sidebarCollapsed.set(collapsed);

    if (collapsed) {
      this.lastSidebarSize = this.sidebarSize();
      this.sidebarSize.set(0);
    } else {
      this.sidebarSize.set(this.lastSidebarSize || 20);
    }

    this.layoutService.updatePreferences({
      sidebarCollapsed: collapsed,
      sidebarSize: this.sidebarSize(),
    });
  }

  toggleQueryPanel() {
    const collapsed = !this.queryPanelCollapsed();
    this.queryPanelCollapsed.set(collapsed);

    if (collapsed) {
      this.lastQueryPanelSize = this.queryPanelSize();
      this.queryPanelSize.set(0);
    } else {
      this.queryPanelSize.set(this.lastQueryPanelSize || 25);
    }

    this.layoutService.updatePreferences({
      queryPanelCollapsed: collapsed,
      queryPanelSize: this.queryPanelSize(),
    });
  }
}
