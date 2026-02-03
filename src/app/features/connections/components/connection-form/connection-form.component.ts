import { Component, inject, input, output, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DatabaseConnection, ProviderType } from '@core/models';
import { ConnectionsStore } from '../../store';

@Component({
  selector: 'app-connection-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()" class="connection-form">
      <h2 class="form-title">
        {{ editConnection() ? 'Edit Connection' : 'New Connection' }}
      </h2>

      <mat-form-field appearance="outline">
        <mat-label>Provider</mat-label>
        <mat-select formControlName="providerType">
          @for (provider of store.providers(); track provider.type) {
            <mat-option [value]="provider.type" [disabled]="!provider.enabled">
              {{ provider.displayName }}
              @if (!provider.enabled) {
                <span class="coming-soon">(Coming Soon)</span>
              }
            </mat-option>
          }
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Connection Name</mat-label>
        <input
          matInput
          formControlName="name"
          placeholder="My Cosmos DB"
          autocomplete="off"
        />
        <mat-error>Name is required</mat-error>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Endpoint URL</mat-label>
        <input
          matInput
          formControlName="endpoint"
          placeholder="https://your-account.documents.azure.com:443/"
          autocomplete="off"
        />
        <mat-error>Valid endpoint URL is required</mat-error>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Primary Key</mat-label>
        <input
          matInput
          [type]="showKey ? 'text' : 'password'"
          formControlName="key"
          placeholder="Your primary or secondary key"
          autocomplete="off"
        />
        <button
          mat-icon-button
          matSuffix
          type="button"
          (click)="showKey = !showKey"
        >
          <mat-icon>{{ showKey ? 'visibility_off' : 'visibility' }}</mat-icon>
        </button>
        <mat-error>Key is required</mat-error>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Default Database (Optional)</mat-label>
        <input
          matInput
          formControlName="defaultDatabase"
          placeholder="Leave empty to show all databases"
          autocomplete="off"
        />
      </mat-form-field>

      <div class="form-actions">
        <button
          mat-stroked-button
          type="button"
          (click)="onTestConnection()"
          [disabled]="!form.valid || store.isTesting()"
        >
          @if (store.isTesting()) {
            <mat-spinner diameter="20"></mat-spinner>
          } @else {
            <mat-icon>wifi_tethering</mat-icon>
          }
          Test Connection
        </button>

        <div class="spacer"></div>

        <button mat-button type="button" (click)="cancel.emit()">Cancel</button>

        <button
          mat-flat-button
          color="primary"
          type="submit"
          [disabled]="!form.valid || store.isLoading()"
        >
          @if (store.isLoading()) {
            <mat-spinner diameter="20"></mat-spinner>
          } @else {
            {{ editConnection() ? 'Update' : 'Save' }}
          }
        </button>
      </div>

      @if (store.testResult(); as result) {
        <div
          class="test-result"
          [class.success]="result.success"
          [class.error]="!result.success"
        >
          @if (result.success) {
            <mat-icon>check_circle</mat-icon>
            <span>{{ result.message }}</span>
          } @else {
            <mat-icon>error</mat-icon>
            <span>{{ result.message }}</span>
          }
        </div>
      }
    </form>
  `,
  styles: [
    `
      .connection-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 24px;
        max-width: 500px;
      }

      .form-title {
        margin: 0 0 8px 0;
        font-size: 20px;
        font-weight: 500;
      }

      mat-form-field {
        width: 100%;
      }

      .coming-soon {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.5);
        margin-left: 8px;
      }

      .form-actions {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-top: 8px;
      }

      .form-actions .spacer {
        flex: 1;
      }

      .form-actions button {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .form-actions mat-spinner {
        display: inline-block;
      }

      .test-result {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        border-radius: 8px;
        font-size: 14px;
      }

      .test-result.success {
        background: rgba(76, 175, 80, 0.15);
        color: #81c784;
      }

      .test-result.error {
        background: rgba(244, 67, 54, 0.15);
        color: #e57373;
      }

      .test-result mat-icon {
        flex-shrink: 0;
      }
    `,
  ],
})
export class ConnectionFormComponent implements OnInit {
  readonly store = inject(ConnectionsStore);
  private fb = inject(FormBuilder);

  editConnection = input<DatabaseConnection | null>(null);
  saved = output<DatabaseConnection>();
  cancel = output<void>();

  showKey = false;

  form = this.fb.group({
    providerType: ['cosmos-sql' as ProviderType, Validators.required],
    name: ['', Validators.required],
    endpoint: ['', [Validators.required, Validators.pattern(/^https?:\/\/.+/)]],
    key: ['', Validators.required],
    defaultDatabase: [''],
  });

  ngOnInit() {
    // Load providers if not already loaded
    if (this.store.providers().length === 0) {
      this.store.loadProviders();
    }

    const connection = this.editConnection();
    if (connection) {
      this.form.patchValue({
        providerType: connection.providerType,
        name: connection.name,
        endpoint: connection.endpoint,
        key: connection.key,
        defaultDatabase: connection.defaultDatabase ?? '',
      });
    }
    this.store.clearTestResult();
  }

  async onTestConnection() {
    if (!this.form.valid) return;

    const { providerType, endpoint, key } = this.form.value;
    await this.store.testConnection(providerType as ProviderType, {
      endpoint: endpoint!,
      key: key!,
    });
  }

  async onSubmit() {
    if (!this.form.valid) return;

    const { providerType, name, endpoint, key, defaultDatabase } = this.form.value;
    const connectionData = {
      providerType: providerType as ProviderType,
      name: name!,
      endpoint: endpoint!,
      key: key!,
      defaultDatabase: defaultDatabase || undefined,
    };

    try {
      const existing = this.editConnection();
      if (existing) {
        const updated: DatabaseConnection = {
          ...existing,
          ...connectionData,
        };
        await this.store.updateConnection(updated);
        this.saved.emit(updated);
      } else {
        const created = await this.store.saveConnection(connectionData);
        this.saved.emit(created);
      }
    } catch {
      // Error handled by store
    }
  }
}
