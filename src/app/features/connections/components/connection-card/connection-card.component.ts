import { Component, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DatabaseConnection, ProviderType } from '@core/models';

@Component({
  selector: 'app-connection-card',
  standalone: true,
  imports: [
    DatePipe,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
  ],
  template: `
    <mat-card class="connection-card" (click)="connect.emit(connection())">
      <mat-card-header>
        <div
          mat-card-avatar
          class="connection-avatar"
          [style.background]="getConnectionBgColor()"
          [style.color]="getConnectionIconColor()"
        >
          {{ getDisplayPrefix() }}
        </div>
        <mat-card-title>{{ connection().name }}</mat-card-title>
        <mat-card-subtitle>
          {{ getEndpointHost(connection().endpoint) }}
        </mat-card-subtitle>
        <button
          mat-icon-button
          [matMenuTriggerFor]="menu"
          (click)="$event.stopPropagation()"
          class="menu-trigger"
        >
          <mat-icon>more_vert</mat-icon>
        </button>
      </mat-card-header>

      <mat-card-content>
        <div class="connection-info">
          <div class="info-item">
            <mat-icon>dns</mat-icon>
            <span class="provider-badge">
              {{ getProviderLabel(connection().providerType) }}
            </span>
          </div>
          @if (connection().defaultDatabase) {
            <div class="info-item">
              <mat-icon>folder</mat-icon>
              <span>{{ connection().defaultDatabase }}</span>
            </div>
          }
          <div class="info-item">
            <mat-icon>schedule</mat-icon>
            <span>
              @if (connection().lastUsedAt) {
                Last used {{ connection().lastUsedAt | date: 'dd.MM.yyyy HH:mm' }}
              } @else {
                Created {{ connection().createdAt | date: 'dd.MM.yyyy HH:mm' }}
              }
            </span>
          </div>
        </div>
      </mat-card-content>

      <mat-card-actions align="end">
        <button
          mat-button
          color="primary"
          (click)="connect.emit(connection()); $event.stopPropagation()"
        >
          <mat-icon>login</mat-icon>
          Connect
        </button>
      </mat-card-actions>
    </mat-card>

    <mat-menu #menu="matMenu">
      <button mat-menu-item (click)="edit.emit(connection())">
        <mat-icon>edit</mat-icon>
        <span>Edit</span>
      </button>
      <button mat-menu-item (click)="duplicate.emit(connection())">
        <mat-icon>content_copy</mat-icon>
        <span>Duplicate</span>
      </button>
      <button mat-menu-item class="delete-item" (click)="delete.emit(connection())">
        <mat-icon>delete</mat-icon>
        <span>Delete</span>
      </button>
    </mat-menu>
  `,
  styles: [
    `
      .connection-card {
        cursor: pointer;
        transition: border-color 0.15s, background-color 0.15s;
        border: 1px solid transparent;
      }

      .connection-card:hover {
        border-color: rgba(187, 134, 252, 0.4);
        background-color: rgba(255, 255, 255, 0.03);
      }

      mat-card-header {
        position: relative;
      }

      .provider-badge {
        font-size: 12px;
        color: #bb86fc;
      }

      .connection-avatar {
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        width: 40px;
        height: 40px;
        font-size: 14px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: -0.5px;
      }

      .menu-trigger {
        position: absolute;
        right: 8px;
        top: 8px;
      }

      mat-card-title {
        font-size: 16px;
        font-weight: 500;
        padding-right: 40px;
      }

      mat-card-subtitle {
        font-size: 13px;
        opacity: 0.7;
      }

      mat-card-content {
        padding-top: 8px;
      }

      .connection-info {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .info-item {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: rgba(255, 255, 255, 0.7);
      }

      .info-item mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        opacity: 0.7;
      }

      mat-card-actions {
        padding: 8px 16px 16px;
      }

      mat-card-actions button {
        color: #bb86fc;
      }

      mat-card-actions button mat-icon {
        margin-right: 4px;
      }

      .delete-item {
        color: #f44336;
      }

      .delete-item mat-icon {
        color: #f44336;
      }
    `,
  ],
})
export class ConnectionCardComponent {
  connection = input.required<DatabaseConnection>();

  connect = output<DatabaseConnection>();
  edit = output<DatabaseConnection>();
  duplicate = output<DatabaseConnection>();
  delete = output<DatabaseConnection>();

  private providerLabels: Record<ProviderType, string> = {
    'cosmos-sql': 'Cosmos SQL',
    'cosmos-mongo': 'Cosmos Mongo',
    'mongodb': 'MongoDB',
    'jdbc': 'JDBC',
  };

  getEndpointHost(endpoint: string): string {
    try {
      const url = new URL(endpoint);
      return url.hostname;
    } catch {
      return endpoint;
    }
  }

  getProviderLabel(providerType: ProviderType): string {
    return this.providerLabels[providerType] ?? providerType;
  }

  getDisplayPrefix(): string {
    const conn = this.connection();
    if (conn.appearance?.prefix) {
      return conn.appearance.prefix;
    }
    // Generate prefix from name
    const name = conn.name.trim();
    if (name.length <= 3) return name.toUpperCase();

    const words = name.split(/[\s-_]+/).filter(w => w.length > 0);
    if (words.length >= 2) {
      return words.slice(0, 3).map(w => w[0]).join('').toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  getConnectionBgColor(): string {
    const conn = this.connection();
    if (conn.appearance?.bgColor) return conn.appearance.bgColor;

    // Default colors based on provider type
    switch (conn.providerType) {
      case 'cosmos-sql':
        return '#339af0'; // Ocean
      case 'cosmos-mongo':
        return '#51cf66'; // Emerald
      case 'mongodb':
        return '#20c997'; // Teal
      default:
        return '#845ef7'; // Violet
    }
  }

  getConnectionIconColor(): string {
    const conn = this.connection();
    if (conn.appearance?.iconColor) return conn.appearance.iconColor;

    return '#ffffff';
  }
}
