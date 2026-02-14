import { Component, input, output, computed } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';
import { DatabaseConnection } from '@core/models';

@Component({
  selector: 'app-connections-bar',
  standalone: true,
  imports: [MatIconModule, MatTooltipModule, MatButtonModule],
  template: `
    <div class="connections-bar">
      <button
        mat-icon-button
        class="back-btn"
        matTooltip="Back to Connections"
        (click)="backClicked.emit()"
      >
        <mat-icon>arrow_back</mat-icon>
      </button>

      <div class="connections-list">
        @for (conn of sortedConnections(); track conn.id) {
          <button
            class="connection-item"
            [class.active]="conn.id === selectedConnectionId()"
            [matTooltip]="conn.name"
            matTooltipPosition="right"
            [style.background]="getConnectionBgColor(conn)"
            [style.color]="getConnectionIconColor(conn)"
            (click)="connectionSelected.emit(conn)"
          >
            <span class="connection-prefix">{{ getDisplayPrefix(conn) }}</span>
          </button>
        }
      </div>

      <div class="spacer"></div>

      <button
        mat-icon-button
        class="settings-btn"
        matTooltip="Settings"
        (click)="settingsClicked.emit()"
      >
        <mat-icon>settings</mat-icon>
      </button>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
      }

      .connections-bar {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 48px;
        height: 100%;
        background: rgba(0, 0, 0, 0.4);
        border-right: 1px solid rgba(255, 255, 255, 0.08);
        padding: 4px 0;
      }

      .back-btn {
        margin-bottom: 8px;
        opacity: 0.7;
        transition: opacity 0.15s;

        &:hover {
          opacity: 1;
        }
      }

      .connections-list {
        display: flex;
        flex-direction: column;
        gap: 4px;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 4px;

        &::-webkit-scrollbar {
          width: 3px;
        }

        &::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 2px;
        }
      }

      .connection-item {
        width: 36px;
        height: 36px;
        border: none;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.08);
        color: rgba(255, 255, 255, 0.85);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s ease;
        position: relative;
        font-weight: 600;

        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
        }

        .connection-prefix {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: -0.5px;
          text-transform: uppercase;
        }

        &:hover {
          transform: scale(1.05);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }

        &.active {
          box-shadow: 0 0 0 2px #bb86fc;

          &::before {
            content: '';
            position: absolute;
            left: -4px;
            top: 50%;
            transform: translateY(-50%);
            width: 3px;
            height: 20px;
            background: #bb86fc;
            border-radius: 0 2px 2px 0;
          }
        }
      }

      .spacer {
        flex: 1;
      }

      .settings-btn {
        opacity: 0.5;
        transition: opacity 0.15s;

        &:hover {
          opacity: 1;
        }
      }
    `,
  ],
})
export class ConnectionsBarComponent {
  connections = input.required<DatabaseConnection[]>();
  selectedConnectionId = input<string | null>(null);

  backClicked = output<void>();
  connectionSelected = output<DatabaseConnection>();
  settingsClicked = output<void>();

  // Sort connections by order property
  sortedConnections = computed(() => {
    return [...this.connections()].sort((a, b) => {
      const orderA = a.order ?? 999;
      const orderB = b.order ?? 999;
      return orderA - orderB;
    });
  });

  getDisplayPrefix(conn: DatabaseConnection): string {
    // Use custom prefix if set
    if (conn.appearance?.prefix) {
      return conn.appearance.prefix;
    }
    return this.getDefaultPrefix(conn);
  }

  getDefaultPrefix(conn: DatabaseConnection): string {
    // Generate 2-3 letter prefix from name
    const name = conn.name.trim();
    if (name.length <= 3) return name.toUpperCase();

    // Try to use initials of words
    const words = name.split(/[\s-_]+/).filter(w => w.length > 0);
    if (words.length >= 2) {
      return words.slice(0, 3).map(w => w[0]).join('').toUpperCase();
    }

    // Use first 2-3 chars
    return name.substring(0, 2).toUpperCase();
  }

  getConnectionBgColor(conn: DatabaseConnection): string {
    if (conn.appearance?.bgColor) return conn.appearance.bgColor;

    // Default colors based on provider type
    switch (conn.providerType) {
      case 'cosmos-sql':
        return 'rgba(0, 120, 212, 0.25)';
      case 'cosmos-mongo':
        return 'rgba(76, 175, 80, 0.25)';
      case 'mongodb':
        return 'rgba(0, 237, 100, 0.2)';
      default:
        return 'rgba(255, 255, 255, 0.08)';
    }
  }

  getConnectionIconColor(conn: DatabaseConnection): string {
    if (conn.appearance?.iconColor) return conn.appearance.iconColor;

    // Default icon colors based on provider type
    switch (conn.providerType) {
      case 'cosmos-sql':
        return '#60a5fa';
      case 'cosmos-mongo':
        return '#86efac';
      case 'mongodb':
        return '#4ade80';
      default:
        return 'rgba(255, 255, 255, 0.85)';
    }
  }
}
