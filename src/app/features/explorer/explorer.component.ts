import { Component, inject, OnInit, OnDestroy, signal, computed, effect } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AngularSplitModule, SplitGutterInteractionEvent } from 'angular-split';
import { ContainerInfo, TabState, ProviderType, DatabaseConnection } from '@core/models';
import { LayoutPreferencesService, NotificationService, TabsPersistenceService, TablePreferencesService } from '@core/services';
import { getDefaultQueryForProvider } from '@core/utils/query-utils';
import { CollapseButtonComponent } from '@shared/components';
import { ConnectionsStore } from '../connections/store';
import { ExplorerStore, QueryStore } from './store';
import { ConnectionsBarComponent } from './components/connections-bar/connections-bar.component';
import { DatabaseTreeComponent } from './components/database-tree/database-tree.component';
import { QueryEditorComponent } from './components/query-editor/query-editor.component';
import { ResultsTableComponent } from './components/results-table/results-table.component';
import { TabBarComponent } from './components/tab-bar/tab-bar.component';
import { WelcomePanelComponent } from './components/welcome-panel/welcome-panel.component';

@Component({
  selector: 'app-explorer',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    AngularSplitModule,
    CollapseButtonComponent,
    ConnectionsBarComponent,
    DatabaseTreeComponent,
    QueryEditorComponent,
    ResultsTableComponent,
    TabBarComponent,
    WelcomePanelComponent,
  ],
  template: `
    <div class="explorer-layout">
      <!-- Connections Activity Bar (always visible) -->
      <app-connections-bar
        [connections]="connectionsStore.connections()"
        [selectedConnectionId]="connectionsStore.selectedConnection()?.id ?? null"
        (backClicked)="onBackToConnections()"
        (connectionSelected)="onConnectionSelected($event)"
        (settingsClicked)="onSettingsClicked()"
      />

      <!-- Database Tree Sidebar -->
      <aside class="explorer-sidebar" [class.collapsed]="sidebarCollapsed()">
        @if (!sidebarCollapsed()) {
          <div class="sidebar-header">
            <span class="connection-name">
              {{ connectionsStore.selectedConnection()?.name ?? 'Connection' }}
            </span>
            @if (connectionsStore.selectedConnection()?.providerType; as providerType) {
              <span class="provider-badge" [class]="'provider-' + providerType">
                {{ getProviderLabel(providerType) }}
              </span>
            }
            <span class="spacer"></span>
            <button
              mat-icon-button
              matTooltip="Collapse"
              (click)="toggleSidebar()"
              class="collapse-btn"
            >
              <mat-icon>chevron_left</mat-icon>
            </button>
          </div>
          <app-database-tree
            (containerSelected)="onContainerSelected($event)"
          />
        } @else {
          <button
            mat-icon-button
            matTooltip="Expand Sidebar"
            (click)="toggleSidebar()"
            class="expand-btn"
          >
            <mat-icon>chevron_right</mat-icon>
          </button>
        }
      </aside>

      <!-- Resizer -->
      @if (!sidebarCollapsed()) {
        <div
          class="sidebar-resizer"
          (mousedown)="onResizerMouseDown($event)"
        ></div>
      }

      <!-- Main area -->
      <div class="main-content">
          <!-- Tab bar (filtered to current connection) -->
          @if (explorerStore.hasConnectionTabs()) {
            <app-tab-bar
              [tabs]="explorerStore.connectionTabs()"
              [activeTabId]="explorerStore.activeTabId()"
              (tabSelected)="onTabSelected($event)"
              (tabClosed)="onTabClosed($event)"
            />
          }

          @if (explorerStore.selectedContainer(); as container) {
            <div class="split-wrapper">
              <as-split
                direction="vertical"
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
                    <app-query-editor
                      [container]="container"
                      [sidebarCollapsed]="sidebarCollapsed()"
                      (queryChange)="onQueryChange()"
                    />
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
                  <div class="results-wrapper">
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
                  </div>
                </as-split-area>
              </as-split>
            </div>
          } @else {
            <!-- Welcome panel when no container selected -->
            <app-welcome-panel
              (containerSelected)="onContainerSelected($event)"
            />
          }
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
        overflow: hidden;
      }

      .explorer-layout {
        display: flex;
        height: 100%;
        overflow: hidden;
      }

      /* Database Tree Sidebar */
      .explorer-sidebar {
        height: 100%;
        display: flex;
        flex-direction: column;
        background: rgba(0, 0, 0, 0.2);
        overflow: hidden;
        transition: width 0.15s ease;
        width: var(--sidebar-width, 220px);
        min-width: var(--sidebar-width, 220px);
        border-right: 1px solid rgba(255, 255, 255, 0.06);
      }

      .explorer-sidebar.collapsed {
        width: 32px;
        min-width: 32px;
        align-items: center;
        padding-top: 4px;
      }

      /* Expanded sidebar */
      .sidebar-header {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 8px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        flex-shrink: 0;
        min-height: 36px;
      }

      .connection-name {
        font-size: 12px;
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        min-width: 0;
        color: rgba(255, 255, 255, 0.9);
      }

      .provider-badge {
        font-size: 9px;
        font-weight: 600;
        padding: 2px 5px;
        border-radius: 3px;
        text-transform: uppercase;
        letter-spacing: 0.3px;
        flex-shrink: 0;
        background: rgba(187, 134, 252, 0.15);
        color: #bb86fc;
      }

      .spacer {
        flex: 1;
      }

      .collapse-btn,
      .expand-btn {
        opacity: 0.5;
        transition: opacity 0.15s;
        width: 24px;
        height: 24px;
        line-height: 24px;

        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
        }
      }

      .collapse-btn:hover,
      .expand-btn:hover {
        opacity: 1;
      }

      /* Sidebar resizer */
      .sidebar-resizer {
        width: 3px;
        cursor: col-resize;
        background: transparent;
        transition: background 0.15s;
        flex-shrink: 0;
      }

      .sidebar-resizer:hover {
        background: rgba(187, 134, 252, 0.3);
      }

      .sidebar-resizer:active {
        background: rgba(187, 134, 252, 0.5);
      }

      /* Main content */
      .main-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
        min-width: 0;
      }

      .split-wrapper {
        flex: 1;
        min-height: 0;
        overflow: hidden;
      }

      .split-wrapper as-split {
        height: 100%;
      }

      .query-panel {
        height: 100%;
        display: flex;
        flex-direction: column;
        position: relative;
        overflow: hidden;
      }

      .query-collapse-btn {
        position: absolute;
        bottom: 4px;
        right: 4px;
        z-index: 10;
      }

      .results-wrapper {
        height: 100%;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .results-panel {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
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
    `,
  ],
})
export class ExplorerComponent implements OnInit, OnDestroy {
  readonly connectionsStore = inject(ConnectionsStore);
  readonly explorerStore = inject(ExplorerStore);
  readonly queryStore = inject(QueryStore);
  private router = inject(Router);
  private layoutService = inject(LayoutPreferencesService);
  private tabsService = inject(TabsPersistenceService);
  private tablePrefsService = inject(TablePreferencesService);
  private notificationService = inject(NotificationService);

  // Layout state
  sidebarWidth = signal(220); // pixels
  queryPanelSize = signal(25);
  sidebarCollapsed = signal(false);
  queryPanelCollapsed = signal(false);

  // Store previous sizes for restore after collapse
  private lastSidebarWidth = 220;
  private lastQueryPanelSize = 25;

  // Resizing state
  private isResizing = false;

  // Computed sizes
  resultsPanelSize = computed(() => 100 - this.queryPanelSize());

  constructor() {
    // Effect to sync query store active tab with explorer store
    effect(() => {
      const activeTabId = this.explorerStore.activeTabId();
      this.queryStore.setActiveTab(activeTabId);
    });
  }

  async ngOnInit() {
    // Load connections if not already loaded
    if (!this.connectionsStore.hasConnections()) {
      this.connectionsStore.loadConnections();
    }

    // Load layout preferences
    const prefs = await this.layoutService.loadPreferences();
    this.sidebarWidth.set(prefs.sidebarWidth ?? 220);
    this.queryPanelSize.set(prefs.queryPanelSize);
    this.sidebarCollapsed.set(prefs.sidebarCollapsed);
    this.queryPanelCollapsed.set(prefs.queryPanelCollapsed);

    // Store for restore
    if (!prefs.sidebarCollapsed) {
      this.lastSidebarWidth = prefs.sidebarWidth ?? 220;
      // Set CSS variable for sidebar width
      document.documentElement.style.setProperty('--sidebar-width', `${this.sidebarWidth()}px`);
    }
    if (!prefs.queryPanelCollapsed) {
      this.lastQueryPanelSize = prefs.queryPanelSize;
    }

    // Load table preferences
    await this.tablePrefsService.loadPreferences();

    // Load tabs preferences
    const tabsPrefs = await this.tabsService.loadPreferences();
    if (tabsPrefs.tabs.length > 0) {
      this.explorerStore.setTabs(tabsPrefs.tabs, tabsPrefs.activeTabId);

      // Initialize query states for each tab
      for (const tab of tabsPrefs.tabs) {
        this.queryStore.initializeTab(tab.id, tab.query);
      }

      // Sync active tab to current connection (in case stored active tab is from different connection)
      this.explorerStore.syncActiveTabToConnection();

      // Set active tab in query store
      const activeTabId = this.explorerStore.activeTabId();
      if (activeTabId) {
        this.queryStore.setActiveTab(activeTabId);
      }
    }
  }

  ngOnDestroy() {
    // Save layout, tabs, and table preferences before leaving
    this.layoutService.saveImmediately();
    this.tabsService.saveImmediately();
    this.tablePrefsService.saveImmediately();

    // Reset stores when leaving explorer
    this.explorerStore.reset();
    this.queryStore.reset();
  }

  onBackToConnections() {
    this.explorerStore.clearSelection();
    sessionStorage.removeItem('activeConnectionId');
    this.router.navigate(['/connections']);
  }

  onConnectionSelected(connection: DatabaseConnection) {
    // Switch to different connection
    if (connection.id !== this.connectionsStore.selectedConnection()?.id) {
      // Save current state
      this.layoutService.saveImmediately();
      this.tabsService.saveImmediately();
      this.tablePrefsService.saveImmediately();

      // Select new connection
      this.connectionsStore.selectConnection(connection.id);
      sessionStorage.setItem('activeConnectionId', connection.id);

      // Reset explorer state for new connection
      this.explorerStore.reset();
      this.queryStore.reset();

      // Load databases for new connection
      this.explorerStore.loadDatabases();

      // Sync tabs to new connection
      this.explorerStore.syncActiveTabToConnection();
    }
  }

  onSettingsClicked() {
    // TODO: Open settings dialog
    this.notificationService.info('Settings coming soon');
  }

  onContainerSelected(container: ContainerInfo) {
    // Get default query based on provider type
    const providerType = this.connectionsStore.selectedConnection()?.providerType ?? 'cosmos-sql';
    const defaultQuery = getDefaultQueryForProvider(providerType);

    // Open tab for container (or activate existing)
    const tabId = this.explorerStore.openTab(container, undefined, this.connectionsStore.connections());

    // Initialize query store for this tab
    this.queryStore.initializeTab(tabId, defaultQuery);
    this.queryStore.setActiveTab(tabId);

    // Auto-execute query
    this.queryStore.executeQuery(container);

    // Save tabs
    this.saveTabsState();
  }

  onTabSelected(tab: TabState) {
    // Save current tab's query before switching
    this.saveTabsState();

    // Activate the tab (tabs are already filtered to current connection)
    this.explorerStore.activateTab(tab.id);
    this.queryStore.setActiveTab(tab.id);
  }

  onTabClosed(tab: TabState) {
    this.explorerStore.closeTab(tab.id);
    this.queryStore.removeTab(tab.id);
    this.tablePrefsService.clearTabState(tab.id);
    this.saveTabsState();
  }

  onQueryChange() {
    this.saveTabsState();
  }

  private saveTabsState() {
    const tabs = this.explorerStore.tabs();
    const activeTabId = this.explorerStore.activeTabId();

    // Update tab queries from query store
    const updatedTabs = tabs.map((tab) => ({
      ...tab,
      query: this.queryStore.getTabQuery(tab.id),
    }));

    this.tabsService.updatePreferences({
      tabs: updatedTabs,
      activeTabId,
    });
  }

  onResizerMouseDown(event: MouseEvent) {
    event.preventDefault();
    this.isResizing = true;

    const startX = event.clientX;
    const startWidth = this.sidebarWidth();

    const onMouseMove = (e: MouseEvent) => {
      if (!this.isResizing) return;

      const deltaX = e.clientX - startX;
      const newWidth = Math.max(180, Math.min(500, startWidth + deltaX));
      this.sidebarWidth.set(newWidth);

      // Update CSS variable
      document.documentElement.style.setProperty('--sidebar-width', `${newWidth}px`);
    };

    const onMouseUp = () => {
      if (this.isResizing) {
        this.isResizing = false;
        this.lastSidebarWidth = this.sidebarWidth();
        this.layoutService.updatePreferences({ sidebarWidth: this.sidebarWidth() });
      }
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
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

    if (!collapsed) {
      // Restore CSS variable when expanding
      document.documentElement.style.setProperty('--sidebar-width', `${this.lastSidebarWidth}px`);
    }

    this.layoutService.updatePreferences({
      sidebarCollapsed: collapsed,
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

  getProviderLabel(providerType: ProviderType): string {
    const labels: Record<ProviderType, string> = {
      'cosmos-sql': 'Cosmos SQL',
      'cosmos-mongo': 'Cosmos Mongo',
      'mongodb': 'MongoDB',
      'jdbc': 'JDBC',
    };
    return labels[providerType] || providerType;
  }
}
