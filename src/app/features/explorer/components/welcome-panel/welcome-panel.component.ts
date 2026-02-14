import { Component, inject, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ContainerInfo } from '@core/models';
import { ExplorerStore } from '../../store';

@Component({
  selector: 'app-welcome-panel',
  standalone: true,
  imports: [MatIconModule, MatButtonModule],
  template: `
    <div class="welcome-panel">
      <div class="welcome-content">
        <div class="welcome-header">
          <mat-icon class="welcome-icon">rocket_launch</mat-icon>
          <h2>Ready to explore</h2>
          <p>Select a container from the sidebar to start querying your data</p>
        </div>

        <div class="quick-access">
          <h3>Quick Access</h3>

          @if (explorerStore.databases().length === 0 || !hasExpandedContainers()) {
            <p class="hint">Expand a database in the sidebar to see containers here</p>
          } @else {
              <div class="databases-list">
                @for (db of explorerStore.databases(); track db.id) {
                  @if (explorerStore.expandedNodes().has(db.id) && getContainers(db.id).length > 0) {
                    <div class="database-section">
                      <div class="database-header">
                        <mat-icon>storage</mat-icon>
                        <span>{{ db.name }}</span>
                        <span class="container-count">{{ getContainers(db.id).length }}</span>
                      </div>
                      <div class="containers-grid">
                        @for (container of getContainers(db.id); track container.id) {
                          <button
                            class="container-tile"
                            (click)="onContainerClick(container)"
                          >
                            <mat-icon class="tile-icon">folder</mat-icon>
                            <span class="tile-name">{{ container.name }}</span>
                          </button>
                        }
                      </div>
                    </div>
                  }
                }
              </div>
          }
        </div>

        <div class="shortcuts">
          <h3>Keyboard Shortcuts</h3>
          <div class="shortcut-list">
            <div class="shortcut">
              <kbd>⌘</kbd> + <kbd>Enter</kbd>
              <span>Execute query</span>
            </div>
            <div class="shortcut">
              <kbd>⌘</kbd> + <kbd>S</kbd>
              <span>Save document</span>
            </div>
            <div class="shortcut">
              <kbd>Esc</kbd>
              <span>Cancel editing</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
      }

      .welcome-panel {
        height: 100%;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding: 32px;
        overflow-y: auto;
      }

      .welcome-content {
        max-width: 600px;
        width: 100%;
        display: flex;
        flex-direction: column;
        min-height: 0;
      }

      .welcome-header {
        text-align: center;
        margin-bottom: 40px;
      }

      .welcome-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        color: #bb86fc;
        margin-bottom: 16px;
      }

      h2 {
        margin: 0 0 8px;
        font-size: 24px;
        font-weight: 500;
        color: rgba(255, 255, 255, 0.9);
      }

      .welcome-header p {
        margin: 0;
        font-size: 14px;
        color: rgba(255, 255, 255, 0.5);
      }

      .quick-access {
        margin-bottom: 32px;
      }

      h3 {
        font-size: 12px;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: rgba(255, 255, 255, 0.5);
        margin: 0 0 12px;
      }

      .databases-list {
        max-height: 320px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding-right: 4px;

        &::-webkit-scrollbar {
          width: 6px;
        }

        &::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 3px;
        }
      }

      .database-section {
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 10px;
        overflow: hidden;
        flex-shrink: 0;
      }

      .database-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 14px;
        background: rgba(144, 202, 249, 0.08);
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        color: #90caf9;
        font-size: 13px;
        font-weight: 500;

        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
        }

        .container-count {
          margin-left: auto;
          font-size: 11px;
          padding: 2px 8px;
          background: rgba(144, 202, 249, 0.15);
          border-radius: 10px;
          color: rgba(144, 202, 249, 0.8);
        }
      }

      .containers-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        padding: 12px;
        max-height: 200px;
        overflow-y: auto;

        &::-webkit-scrollbar {
          width: 4px;
        }

        &::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 2px;
        }
      }

      .container-tile {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 12px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.15s ease;
        color: inherit;
        flex-shrink: 0;

        &:hover {
          background: rgba(103, 58, 183, 0.2);
          border-color: rgba(103, 58, 183, 0.4);
          transform: translateY(-1px);
        }
      }

      .tile-icon {
        color: #ce93d8;
        font-size: 16px;
        width: 16px;
        height: 16px;
      }

      .tile-name {
        font-size: 12px;
        font-weight: 500;
        color: rgba(255, 255, 255, 0.85);
        white-space: nowrap;
      }

      .hint {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.4);
        font-style: italic;
        margin: 12px 0 0;
      }

      .shortcuts {
        background: rgba(0, 0, 0, 0.2);
        border-radius: 8px;
        padding: 16px;
      }

      .shortcut-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .shortcut {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: rgba(255, 255, 255, 0.6);

        span {
          margin-left: auto;
          color: rgba(255, 255, 255, 0.4);
        }
      }

      kbd {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 24px;
        height: 22px;
        padding: 0 6px;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 4px;
        font-family: inherit;
        font-size: 11px;
        color: rgba(255, 255, 255, 0.7);
      }
    `,
  ],
})
export class WelcomePanelComponent {
  readonly explorerStore = inject(ExplorerStore);

  containerSelected = output<ContainerInfo>();

  getContainers(databaseId: string): ContainerInfo[] {
    return this.explorerStore.containers().get(databaseId) ?? [];
  }

  hasExpandedContainers(): boolean {
    for (const dbId of this.explorerStore.expandedNodes()) {
      const containers = this.getContainers(dbId);
      if (containers.length > 0) return true;
    }
    return false;
  }

  onContainerClick(container: ContainerInfo) {
    this.containerSelected.emit(container);
  }
}
