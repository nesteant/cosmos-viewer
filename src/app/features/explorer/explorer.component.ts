import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ContainerInfo } from '@core/models';
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
    DatabaseTreeComponent,
    QueryEditorComponent,
    ResultsTableComponent,
  ],
  template: `
    <div class="explorer-layout">
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
        </div>
        <app-database-tree
          (containerSelected)="onContainerSelected($event)"
        />
      </aside>

      <main class="explorer-main">
        @if (explorerStore.selectedContainer(); as container) {
          <div class="query-panel">
            <app-query-editor [container]="container" />
          </div>
          <div class="results-panel">
            <app-results-table [container]="container" />
          </div>
        } @else {
          <div class="no-selection">
            <mat-icon>touch_app</mat-icon>
            <h3>Select a Container</h3>
            <p>Choose a database and container from the tree to start querying</p>
          </div>
        }
      </main>
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

      .explorer-sidebar {
        width: 260px;
        min-width: 260px;
        max-width: 260px;
        border-right: 1px solid rgba(255, 255, 255, 0.12);
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

      .explorer-main {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .query-panel {
        height: 160px;
        min-height: 100px;
        flex-shrink: 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.12);
      }

      .results-panel {
        flex: 1 1 0;
        overflow: hidden;
        display: flex;
        flex-direction: column;
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

  ngOnInit() {
    // Load connections if not already loaded
    if (!this.connectionsStore.hasConnections()) {
      this.connectionsStore.loadConnections();
    }
  }

  ngOnDestroy() {
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
}
