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
          <div class="tree-node database" (click)="onToggleNode(db)">
            <mat-icon class="expand-icon">
              {{ explorerStore.expandedNodes().has(db.id) ? 'expand_more' : 'chevron_right' }}
            </mat-icon>
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
        padding: 4px 8px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        min-height: 32px;

        button {
          width: 28px;
          height: 28px;
          line-height: 28px;

          mat-icon {
            font-size: 18px;
            width: 18px;
            height: 18px;
          }
        }
      }

      .tree-title {
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: rgba(255, 255, 255, 0.5);
      }

      .loading,
      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 24px 12px;
        color: rgba(255, 255, 255, 0.4);
        font-size: 11px;
      }

      .empty-state mat-icon {
        font-size: 32px;
        width: 32px;
        height: 32px;
        opacity: 0.4;
      }

      .tree-container {
        flex: 1 1 0;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 2px 0;

        &::-webkit-scrollbar {
          width: 4px;
        }

        &::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 2px;
        }
      }

      .tree-node {
        display: flex;
        align-items: center;
        min-height: 26px;
        padding-right: 8px;
        border-radius: 3px;
        margin: 1px 4px;
        cursor: pointer;
      }

      .tree-node:hover {
        background: rgba(255, 255, 255, 0.05);
      }

      .tree-node.selected {
        background: rgba(103, 58, 183, 0.25);
      }

      .node-indent {
        width: 28px;
        flex-shrink: 0;
      }

      .expand-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        margin-left: 4px;
        margin-right: 2px;
        flex-shrink: 0;
        color: rgba(255, 255, 255, 0.4);
      }

      .node-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        margin-right: 6px;
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
        font-size: 11px;
        color: rgba(255, 255, 255, 0.85);
      }

      .node-name.clickable:hover {
        color: #bb86fc;
      }

      .loading-containers {
        display: flex;
        justify-content: center;
        padding: 4px 0 4px 32px;
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
