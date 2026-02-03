import { Component, inject, input, output, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TextFieldModule } from '@angular/cdk/text-field';
import { DatabaseConnection, ProviderType } from '@core/models';
import { ConnectionsStore } from '../../store';

@Component({
  selector: 'app-connection-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    TextFieldModule,
    MatButtonModule,
    MatDividerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatTooltipModule,
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

      <!-- Connection String paste area -->
      <div class="connection-string-section">
        <mat-form-field appearance="outline" class="connection-string-field">
          <mat-label>Paste Connection String (Optional)</mat-label>
          <textarea
            matInput
            cdkTextareaAutosize
            cdkAutosizeMinRows="1"
            cdkAutosizeMaxRows="4"
            [(ngModel)]="connectionStringInput"
            [ngModelOptions]="{standalone: true}"
            [placeholder]="getConnectionStringPlaceholder()"
            autocomplete="off"
            (paste)="onConnectionStringPaste($event)"
            (input)="onConnectionStringInput()"
          ></textarea>
          <button
            mat-icon-button
            matSuffix
            type="button"
            matTooltip="Parse and fill fields"
            (click)="parseAndFillFields()"
            [disabled]="!connectionStringInput"
          >
            <mat-icon>auto_fix_high</mat-icon>
          </button>
        </mat-form-field>
        @if (parsedConnectionInfo()) {
          <div class="parsed-info success">
            <mat-icon>check_circle</mat-icon>
            <div class="parsed-details">
              <strong>{{ form.get('name')?.value || parsedConnectionInfo()?.account }}</strong>
              <span class="parsed-host">| {{ parsedConnectionInfo()?.host }}</span>
            </div>
          </div>
        }
        @if (parseError()) {
          <div class="parsed-info error">
            <mat-icon>error</mat-icon>
            <span>{{ parseError() }}</span>
          </div>
        }
      </div>

      <mat-divider></mat-divider>

      <mat-form-field appearance="outline">
        <mat-label>Display Name</mat-label>
        <input
          matInput
          formControlName="name"
          placeholder="My Cosmos DB"
          autocomplete="off"
        />
        <mat-error>Display name is required</mat-error>
      </mat-form-field>

      <!-- Cosmos SQL fields -->
      @if (selectedProviderType() === 'cosmos-sql') {
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
      }

      <!-- Cosmos MongoDB fields -->
      @if (selectedProviderType() === 'cosmos-mongo') {
        <mat-form-field appearance="outline">
          <mat-label>Connection String</mat-label>
          <input
            matInput
            [type]="showKey ? 'text' : 'password'"
            formControlName="endpoint"
            placeholder="mongodb://account:key@host:10255/?ssl=true"
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
          <mat-error>Connection string is required</mat-error>
        </mat-form-field>
      }

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
          [disabled]="!isFormValidForTest() || store.isTesting()"
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
          [disabled]="!isFormValidForTest() || store.isLoading()"
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
        gap: 12px;
        padding: 20px;
        max-width: 500px;
      }

      .form-title {
        margin: 0;
        font-size: 18px;
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
        margin-top: 4px;
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

      .connection-string-section {
        background: rgba(255, 255, 255, 0.03);
        border-radius: 8px;
        padding: 12px;
        padding-bottom: 4px;
      }

      .connection-string-field {
        margin-bottom: 0;
      }

      .connection-string-field textarea {
        font-family: 'JetBrains Mono', monospace;
        font-size: 11px;
        line-height: 1.4;
      }

      .parsed-info {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        padding: 6px 10px;
        border-radius: 6px;
        font-size: 11px;
        margin-top: 4px;
      }

      .parsed-info.success {
        background: rgba(76, 175, 80, 0.15);
        color: #81c784;
      }

      .parsed-info.error {
        background: rgba(244, 67, 54, 0.15);
        color: #e57373;
      }

      .parsed-info mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        flex-shrink: 0;
        margin-top: 1px;
      }

      .parsed-details {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        min-width: 0;
      }

      .parsed-label {
        margin-right: 2px;
      }

      .parsed-details strong {
        color: #a5d6a7;
        word-break: break-all;
      }

      .parsed-host {
        color: rgba(129, 199, 132, 0.7);
        word-break: break-all;
      }

      mat-divider {
        margin: 4px 0 8px;
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
  connectionStringInput = '';
  parsedConnectionInfo = signal<{ account: string; host: string } | null>(null);
  parseError = signal<string | null>(null);
  selectedProviderType = signal<ProviderType>('cosmos-sql');

  form = this.fb.group({
    providerType: ['cosmos-sql' as ProviderType, Validators.required],
    name: ['', Validators.required],
    endpoint: ['', Validators.required],
    key: [''], // Optional for MongoDB
    defaultDatabase: [''],
  });

  constructor() {
    // Subscribe to provider type changes
    this.form.get('providerType')?.valueChanges.subscribe((type) => {
      if (type) {
        this.selectedProviderType.set(type);
        this.updateValidators(type);
        this.store.clearTestResult();
        this.parsedConnectionInfo.set(null);
        this.parseError.set(null);
        this.connectionStringInput = '';
      }
    });
  }

  private updateValidators(providerType: ProviderType) {
    const endpointControl = this.form.get('endpoint');
    const keyControl = this.form.get('key');

    if (providerType === 'cosmos-sql') {
      endpointControl?.setValidators([Validators.required, Validators.pattern(/^https?:\/\/.+/)]);
      keyControl?.setValidators([Validators.required]);
    } else if (providerType === 'cosmos-mongo') {
      endpointControl?.setValidators([Validators.required, Validators.pattern(/^mongodb(\+srv)?:\/\/.+/)]);
      keyControl?.clearValidators();
      keyControl?.setValue(''); // Clear key for MongoDB
    }

    endpointControl?.updateValueAndValidity();
    keyControl?.updateValueAndValidity();
  }

  ngOnInit() {
    // Load providers if not already loaded
    if (this.store.providers().length === 0) {
      this.store.loadProviders();
    }

    const connection = this.editConnection();
    if (connection) {
      this.selectedProviderType.set(connection.providerType);
      this.form.patchValue({
        providerType: connection.providerType,
        name: connection.name,
        endpoint: connection.endpoint,
        key: connection.key ?? '',
        defaultDatabase: connection.defaultDatabase ?? '',
      });
      this.updateValidators(connection.providerType);
      // Show parsed info for existing MongoDB connections
      if (connection.providerType === 'cosmos-mongo' && connection.endpoint) {
        this.connectionStringInput = connection.endpoint;
        this.parseAndFillFields();
      }
    }

    this.store.clearTestResult();
  }

  isFormValidForTest(): boolean {
    const providerType = this.form.get('providerType')?.value;
    const name = this.form.get('name')?.value;
    const endpoint = this.form.get('endpoint')?.value;
    const key = this.form.get('key')?.value;

    if (!name || !endpoint) return false;

    if (providerType === 'cosmos-sql' && !key) return false;

    return true;
  }

  getConnectionStringPlaceholder(): string {
    const type = this.selectedProviderType();
    if (type === 'cosmos-mongo') {
      return 'mongodb://<account>:<key>@<account>.mongo.cosmos.azure.com:10255/?ssl=true&replicaSet=globaldb';
    }
    return 'AccountEndpoint=https://<account>.documents.azure.com:443/;AccountKey=<key>;';
  }

  onConnectionStringPaste(event: ClipboardEvent) {
    // Let the paste happen first, then parse
    setTimeout(() => {
      this.parseAndFillFields();
    }, 0);
  }

  onConnectionStringInput() {
    // Clear parsed info when user is typing
    if (!this.connectionStringInput) {
      this.parsedConnectionInfo.set(null);
      this.parseError.set(null);
    }
  }

  parseAndFillFields() {
    const input = this.connectionStringInput?.trim();
    if (!input) {
      this.parsedConnectionInfo.set(null);
      this.parseError.set(null);
      return;
    }

    const providerType = this.selectedProviderType();
    this.parseError.set(null);
    this.parsedConnectionInfo.set(null);

    try {
      if (providerType === 'cosmos-mongo') {
        this.parseMongoConnectionString(input);
      } else if (providerType === 'cosmos-sql') {
        this.parseCosmosSqlConnectionString(input);
      }
    } catch {
      this.parsedConnectionInfo.set(null);
      this.parseError.set('Failed to parse connection string');
    }
  }

  private parseMongoConnectionString(input: string) {
    // Check if it looks like a Cosmos SQL connection string
    if (input.includes('AccountEndpoint=') || input.includes('AccountKey=')) {
      this.parseError.set('This looks like a Cosmos SQL connection string. Please select "Cosmos DB (SQL)" provider or paste a MongoDB connection string.');
      return;
    }

    // Check if it starts with mongodb://
    if (!input.startsWith('mongodb://') && !input.startsWith('mongodb+srv://')) {
      this.parseError.set('MongoDB connection string should start with "mongodb://" or "mongodb+srv://"');
      return;
    }

    // Format: mongodb://account:key@account.mongo.cosmos.azure.com:10255/?...
    const match = input.match(/mongodb(?:\+srv)?:\/\/([^:]+):([^@]+)@([^/:]+)/);
    if (match) {
      const account = match[1];
      const host = match[3];

      this.parsedConnectionInfo.set({ account, host });

      // Fill the endpoint field with the full connection string
      this.form.patchValue({ endpoint: input });

      // Auto-fill name if empty
      const currentName = this.form.get('name')?.value;
      if (!currentName) {
        this.form.patchValue({ name: account });
      }
    } else {
      this.parseError.set('Could not parse MongoDB connection string. Expected format: mongodb://user:password@host:port/...');
    }
  }

  private parseCosmosSqlConnectionString(input: string) {
    // Check if it looks like a MongoDB connection string
    if (input.startsWith('mongodb://') || input.startsWith('mongodb+srv://')) {
      this.parseError.set('This looks like a MongoDB connection string. Please select "Cosmos DB (MongoDB)" provider or paste a Cosmos SQL connection string.');
      return;
    }

    // Format: AccountEndpoint=https://account.documents.azure.com:443/;AccountKey=key;
    const endpointMatch = input.match(/AccountEndpoint=([^;]+)/i);
    const keyMatch = input.match(/AccountKey=([^;]+)/i);

    if (endpointMatch && keyMatch) {
      const endpoint = endpointMatch[1];
      const key = keyMatch[1];

      // Extract account name from endpoint
      const accountMatch = endpoint.match(/https?:\/\/([^.]+)/);
      const account = accountMatch ? accountMatch[1] : 'unknown';
      const host = endpoint.replace(/^https?:\/\//, '').replace(/:\d+\/?$/, '');

      this.parsedConnectionInfo.set({ account, host });

      // Fill the form fields
      this.form.patchValue({ endpoint, key });

      // Auto-fill name if empty
      const currentName = this.form.get('name')?.value;
      if (!currentName) {
        this.form.patchValue({ name: account });
      }
    } else {
      this.parseError.set('Could not parse Cosmos SQL connection string. Expected format: AccountEndpoint=https://...;AccountKey=...;');
    }
  }

  async onTestConnection() {
    if (!this.isFormValidForTest()) return;

    const { providerType, endpoint, key } = this.form.value;

    if (providerType === 'cosmos-mongo') {
      // For MongoDB, pass connection string
      await this.store.testConnection(providerType as ProviderType, {
        connectionString: endpoint!,
      });
    } else {
      // For Cosmos SQL, pass endpoint and key
      await this.store.testConnection(providerType as ProviderType, {
        endpoint: endpoint!,
        key: key!,
      });
    }
  }

  async onSubmit() {
    if (!this.isFormValidForTest()) return;

    const { providerType, name, endpoint, key, defaultDatabase } = this.form.value;
    const connectionData = {
      providerType: providerType as ProviderType,
      name: name!,
      endpoint: endpoint!,
      key: providerType === 'cosmos-mongo' ? '' : key!,
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
