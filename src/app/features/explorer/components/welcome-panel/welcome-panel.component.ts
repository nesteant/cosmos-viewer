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

        @if (explorerStore.databases().length > 0) {
          <div class="quick-access">
            <h3>Quick Access</h3>
            <div class="containers-grid">
              @for (db of explorerStore.databases(); track db.id) {
                @if (explorerStore.expandedNodes().has(db.id)) {
                  @for (container of getContainers(db.id); track container.id) {
                    <button
                      class="container-card"
                      (click)="onContainerClick(container)"
                    >
                      <mat-icon class="card-icon">folder</mat-icon>
                      <div class="card-content">
                        <span class="card-name">{{ container.name }}</span>
                        <span class="card-db">{{ db.name }}</span>
                      </div>
                      <mat-icon class="card-arrow">arrow_forward</mat-icon>
                    </button>
                  }
                }
              }
            </div>

            @if (!hasExpandedContainers()) {
              <p class="hint">Expand a database in the sidebar to see containers here</p>
            }
          </div>
        }

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
        align-items: center;
        justify-content: center;
        padding: 32px;
        overflow-y: auto;
      }

      .welcome-content {
        max-width: 600px;
        width: 100%;
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

      .containers-grid {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .container-card {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.15s ease;
        text-align: left;
        color: inherit;

        &:hover {
          background: rgba(103, 58, 183, 0.15);
          border-color: rgba(103, 58, 183, 0.3);

          .card-arrow {
            opacity: 1;
            transform: translateX(4px);
          }
        }
      }

      .card-icon {
        color: #ce93d8;
        font-size: 20px;
        width: 20px;
        height: 20px;
      }

      .card-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }

      .card-name {
        font-size: 14px;
        font-weight: 500;
        color: rgba(255, 255, 255, 0.9);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .card-db {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.4);
      }

      .card-arrow {
        color: rgba(255, 255, 255, 0.3);
        opacity: 0;
        transition: all 0.15s ease;
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
