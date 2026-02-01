import { Component, inject, output, OnInit, effect } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTreeModule, MatTreeNestedDataSource } from '@angular/material/tree';
import { NestedTreeControl } from '@angular/cdk/tree';
import { TreeNode, ContainerInfo } from '@core/models';
import { ExplorerStore } from '../../store';

@Component({
  selector: 'app-database-tree',
  standalone: true,
  imports: [
    MatTreeModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="tree-header">
      <span class="tree-title">Databases</span>
      <button
        mat-icon-button
        (click)="explorerStore.loadDatabases()"
        [disabled]="explorerStore.isLoadingDatabases()"
        matTooltip="Refresh"
      >
        <mat-icon>refresh</mat-icon>
      </button>
    </div>

    @if (explorerStore.isLoadingDatabases()) {
      <div class="loading">
        <mat-spinner diameter="24"></mat-spinner>
        <span>Loading databases...</span>
      </div>
    } @else if (explorerStore.databases().length === 0) {
      <div class="empty-state">
        <mat-icon>folder_off</mat-icon>
        <span>No databases found</span>
      </div>
    } @else {
      <div class="tree-container">
        @for (db of explorerStore.databases(); track db.id) {
          <div class="tree-node database">
            <button
              mat-icon-button
              (click)="onToggleNode(db)"
            >
              <mat-icon>
                {{ explorerStore.expandedNodes().has(db.id) ? 'expand_more' : 'chevron_right' }}
              </mat-icon>
            </button>
            <mat-icon class="node-icon database-icon">storage</mat-icon>
            <span class="node-name">{{ db.name }}</span>
          </div>

          @if (explorerStore.expandedNodes().has(db.id)) {
            @if (getContainers(db.id).length === 0 && explorerStore.isLoadingContainers()) {
              <div class="loading-containers">
                <mat-spinner diameter="16"></mat-spinner>
              </div>
            } @else {
              @for (container of getContainers(db.id); track container.id) {
                <div
                  class="tree-node container"
                  [class.selected]="explorerStore.selectedContainer()?.id === container.id"
                  (click)="onSelectContainer(container)"
                >
                  <span class="node-indent"></span>
                  <mat-icon class="node-icon container-icon">folder</mat-icon>
                  <span class="node-name clickable">{{ container.name }}</span>
                </div>
              }
            }
          }
        }
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        flex: 1 1 0;
        overflow: hidden;
      }

      .tree-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.12);
      }

      .tree-title {
        font-size: 12px;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: rgba(255, 255, 255, 0.7);
      }

      .loading,
      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        padding: 32px;
        color: rgba(255, 255, 255, 0.5);
        font-size: 13px;
      }

      .empty-state mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        opacity: 0.5;
      }

      .tree-container {
        flex: 1 1 0;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 4px 0;
      }

      .tree-node {
        display: flex;
        align-items: center;
        min-height: 36px;
        padding-right: 12px;
        border-radius: 4px;
        margin: 2px 8px;
        cursor: pointer;
      }

      .tree-node:hover {
        background: rgba(255, 255, 255, 0.05);
      }

      .tree-node.selected {
        background: rgba(103, 58, 183, 0.2);
      }

      .node-indent {
        width: 40px;
        flex-shrink: 0;
      }

      .node-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        margin-right: 8px;
        flex-shrink: 0;
      }

      .database-icon {
        color: #90caf9;
      }

      .container-icon {
        color: #ce93d8;
      }

      .node-name {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 13px;
      }

      .node-name.clickable:hover {
        color: #bb86fc;
      }

      .loading-containers {
        display: flex;
        justify-content: center;
        padding: 8px 0 8px 48px;
      }
    `,
  ],
})
export class DatabaseTreeComponent implements OnInit {
  readonly explorerStore = inject(ExplorerStore);

  containerSelected = output<ContainerInfo>();

  ngOnInit() {
    this.explorerStore.loadDatabases();
  }

  getContainers(databaseId: string): ContainerInfo[] {
    return this.explorerStore.containers().get(databaseId) ?? [];
  }

  onToggleNode(db: { id: string; name: string }) {
    this.explorerStore.toggleNode(db.id, true);
  }

  onSelectContainer(container: ContainerInfo) {
    this.explorerStore.selectContainer(container);
    this.containerSelected.emit(container);
  }
}
