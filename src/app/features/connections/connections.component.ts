import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { CosmosConnection } from '@core/models';
import { LoadingSpinnerComponent, ConfirmDialogComponent } from '@shared/components';
import { ConnectionsStore } from './store';
import { ConnectionFormComponent } from './components/connection-form/connection-form.component';
import { ConnectionListComponent } from './components/connection-list/connection-list.component';

@Component({
  selector: 'app-connections',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    LoadingSpinnerComponent,
    ConnectionFormComponent,
    ConnectionListComponent,
  ],
  template: `
    <div class="connections-container">
      <header class="connections-header">
        <div class="header-content">
          <h1>Cosmos DB Connections</h1>
          <p class="subtitle">
            Manage your Azure Cosmos DB connections
          </p>
        </div>
        <button
          mat-flat-button
          color="primary"
          (click)="showForm.set(true)"
          [disabled]="showForm()"
        >
          <mat-icon>add</mat-icon>
          New Connection
        </button>
      </header>

      <div class="connections-content">
        @if (store.isLoading() && !store.hasConnections()) {
          <app-loading-spinner message="Loading connections..." />
        } @else if (showForm()) {
          <div class="form-panel">
            <app-connection-form
              [editConnection]="editingConnection()"
              (saved)="onConnectionSaved($event)"
              (cancel)="closeForm()"
            />
          </div>
        } @else {
          <app-connection-list
            [connections]="store.sortedConnections()"
            (connect)="onConnect($event)"
            (edit)="onEdit($event)"
            (duplicate)="onDuplicate($event)"
            (delete)="onDelete($event)"
          />
        }
      </div>
    </div>
  `,
  styles: [
    `
      .connections-container {
        height: 100%;
        display: flex;
        flex-direction: column;
        padding: 24px 32px;
        max-width: 1400px;
        margin: 0 auto;
      }

      .connections-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 32px;
      }

      .header-content h1 {
        margin: 0;
        font-size: 28px;
        font-weight: 500;
      }

      .subtitle {
        margin: 8px 0 0;
        color: rgba(255, 255, 255, 0.6);
        font-size: 14px;
      }

      .connections-header button mat-icon {
        margin-right: 8px;
      }

      .connections-content {
        flex: 1;
        overflow: auto;
      }

      .form-panel {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 12px;
        max-width: 550px;
      }
    `,
  ],
})
export class ConnectionsComponent implements OnInit {
  readonly store = inject(ConnectionsStore);
  private router = inject(Router);
  private dialog = inject(MatDialog);

  showForm = signal(false);
  editingConnection = signal<CosmosConnection | null>(null);

  ngOnInit() {
    this.store.loadConnections();
  }

  onConnectionSaved(_connection: CosmosConnection) {
    this.closeForm();
  }

  closeForm() {
    this.showForm.set(false);
    this.editingConnection.set(null);
    this.store.clearTestResult();
  }

  async onConnect(connection: CosmosConnection) {
    const success = await this.store.connectAndNavigate(connection.id);
    if (success) {
      this.router.navigate(['/explorer']);
    }
  }

  onEdit(connection: CosmosConnection) {
    this.editingConnection.set(connection);
    this.showForm.set(true);
  }

  onDuplicate(connection: CosmosConnection) {
    this.editingConnection.set({
      ...connection,
      id: '', // Will be assigned a new ID on save
      name: `${connection.name} (Copy)`,
      createdAt: new Date(),
      lastUsedAt: undefined,
    });
    this.showForm.set(true);
  }

  onDelete(connection: CosmosConnection) {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete Connection',
        message: `Are you sure you want to delete "${connection.name}"? This action cannot be undone.`,
        confirmText: 'Delete',
        confirmColor: 'warn',
      },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.store.deleteConnection(connection.id);
      }
    });
  }
}
