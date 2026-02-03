import { Component, inject, OnInit, OnDestroy, signal, computed, effect } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AngularSplitModule, SplitGutterInteractionEvent } from 'angular-split';
import { ContainerInfo, TabState, ProviderType } from '@core/models';
import { LayoutPreferencesService, NotificationService, TabsPersistenceService, TablePreferencesService } from '@core/services';
import { CollapseButtonComponent } from '@shared/components';
import { ConnectionsStore } from '../connections/store';
import { ExplorerStore, QueryStore } from './store';
import { DatabaseTreeComponent } from './components/database-tree/database-tree.component';
import { QueryEditorComponent } from './components/query-editor/query-editor.component';
import { ResultsTableComponent } from './components/results-table/results-table.component';
import { TabBarComponent } from './components/tab-bar/tab-bar.component';

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
    TabBarComponent,
  ],
  template: `
    <div class="explorer-layout">
      <!-- Sidebar (collapsible to icon strip) -->
      <aside class="explorer-sidebar" [class.collapsed]="sidebarCollapsed()">
        @if (sidebarCollapsed()) {
          <!-- Collapsed: narrow icon strip -->
          <div class="sidebar-collapsed">
            <button
              mat-icon-button
              matTooltip="Expand Sidebar"
              (click)="toggleSidebar()"
              class="expand-btn"
            >
              <mat-icon>chevron_right</mat-icon>
            </button>
            <!-- Status icons area (for future use) -->
            <div class="status-icons">
              <mat-icon
                class="status-icon connected"
                matTooltip="Connected"
              >cloud_done</mat-icon>
            </div>
          </div>
        } @else {
          <!-- Expanded: full sidebar -->
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
            @if (connectionsStore.selectedConnection()?.providerType; as providerType) {
              <span class="provider-badge" [class]="'provider-' + providerType">
                {{ getProviderLabel(providerType) }}
              </span>
            }
            <span class="spacer"></span>
            <button
              mat-icon-button
              matTooltip="Collapse Sidebar"
              (click)="toggleSidebar()"
              class="collapse-btn"
            >
              <mat-icon>chevron_left</mat-icon>
            </button>
          </div>
          <app-database-tree
            (containerSelected)="onContainerSelected($event)"
          />
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
            <div class="no-selection">
              <mat-icon>touch_app</mat-icon>
              <h3>Select a Container</h3>
              <p>Choose a database and container from the tree to start querying</p>
            </div>
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

      /* Sidebar */
      .explorer-sidebar {
        height: 100%;
        display: flex;
        flex-direction: column;
        background: rgba(0, 0, 0, 0.15);
        overflow: hidden;
        transition: width 0.15s ease;
        width: var(--sidebar-width, 280px);
        min-width: var(--sidebar-width, 280px);
      }

      .explorer-sidebar.collapsed {
        width: 48px;
        min-width: 48px;
      }

      /* Collapsed sidebar strip */
      .sidebar-collapsed {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 4px 0;
        gap: 4px;
        height: 100%;
      }

      .sidebar-collapsed .expand-btn {
        margin-bottom: 4px;
      }

      .status-icons {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding-top: 8px;
        gap: 8px;
      }

      .status-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        opacity: 0.6;
      }

      .status-icon.connected {
        color: #4caf50;
        opacity: 1;
      }

      /* Expanded sidebar */
      .sidebar-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.12);
        flex-shrink: 0;
      }

      .connection-name {
        font-size: 14px;
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        min-width: 0;
      }

      .provider-badge {
        font-size: 10px;
        font-weight: 600;
        padding: 2px 6px;
        border-radius: 4px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        flex-shrink: 0;
        background: rgba(187, 134, 252, 0.2);
        color: #bb86fc;
      }

      .spacer {
        flex: 1;
      }

      .collapse-btn,
      .expand-btn {
        opacity: 0.7;
        transition: opacity 0.15s;
      }

      .collapse-btn:hover,
      .expand-btn:hover {
        opacity: 1;
      }

      /* Sidebar resizer */
      .sidebar-resizer {
        width: 4px;
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
  private tabsService = inject(TabsPersistenceService);
  private tablePrefsService = inject(TablePreferencesService);
  private notificationService = inject(NotificationService);

  // Layout state
  sidebarWidth = signal(280); // pixels
  queryPanelSize = signal(25);
  sidebarCollapsed = signal(false);
  queryPanelCollapsed = signal(false);

  // Store previous sizes for restore after collapse
  private lastSidebarWidth = 280;
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
    this.sidebarWidth.set(prefs.sidebarWidth ?? 280);
    this.queryPanelSize.set(prefs.queryPanelSize);
    this.sidebarCollapsed.set(prefs.sidebarCollapsed);
    this.queryPanelCollapsed.set(prefs.queryPanelCollapsed);

    // Store for restore
    if (!prefs.sidebarCollapsed) {
      this.lastSidebarWidth = prefs.sidebarWidth ?? 280;
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

  onContainerSelected(container: ContainerInfo) {
    // Open tab for container (or activate existing)
    const tabId = this.explorerStore.openTab(container);

    // Initialize query store for this tab
    this.queryStore.initializeTab(tabId, 'SELECT * FROM c');
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
      'cosmos-sql': 'Cosmos',
      'cosmos-mongo': 'Cosmos',
      'mongodb': 'Mongo',
      'jdbc': 'JDBC',
    };
    return labels[providerType] || providerType;
  }
}
