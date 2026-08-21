/**
 * Cosmos DB SQL API Provider
 * Implements DatabaseProvider interface for Azure Cosmos DB SQL API
 */

import { CosmosClient } from '@azure/cosmos';
import { DatabaseProvider, ProviderCapabilities } from '../base/provider.interface';
import {
  ProviderType,
  ProviderInfo,
  ConnectionConfig,
  TestConnectionResult,
  DatabaseNode,
  CollectionNode,
  QueryExecutionParams,
  QueryExecutionResult,
  QueryAnalysisParams,
  QueryAnalysisResult,
  DocumentCreateParams,
  DocumentUpdateParams,
  DocumentDeleteParams,
  DocumentResult,
  QueryLanguageConfig,
} from '../base/types';
import { ConnectionError, QueryExecutionError, DocumentOperationError } from '../base/errors';
import { getConnectionById } from '../../services/storage.service';
import {
  AuthState,
  getEntraCredential,
  explainAuthError,
  nextAuthState,
  describeAuthState,
} from '../../services/azure-auth.service';

// Cosmos SQL specific connection settings
interface CosmosSqlSettings {
  endpoint: string;
  key?: string;
}

/** key -> Entra ID -> Entra ID with the tenant the account named */
const MAX_AUTH_RETRIES = 2;

/** Accounts with keys start on key auth; without a key only Entra ID can work */
function initialAuthState(settings: CosmosSqlSettings): AuthState {
  return settings.key ? { mode: 'key' } : { mode: 'entra' };
}

function createCosmosClient(settings: CosmosSqlSettings, state: AuthState): CosmosClient {
  if (state.mode === 'entra') {
    return new CosmosClient({
      endpoint: settings.endpoint,
      aadCredentials: getEntraCredential(state.tenantId),
    });
  }
  return new CosmosClient({
    endpoint: settings.endpoint,
    key: settings.key,
  });
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

// CosmosSQL keywords for Monaco editor
const COSMOS_SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'BETWEEN',
  'LIKE', 'ORDER', 'BY', 'ASC', 'DESC', 'TOP', 'DISTINCT',
  'AS', 'JOIN', 'VALUE', 'OFFSET', 'LIMIT', 'EXISTS', 'GROUP', 'HAVING',
];

// CosmosSQL built-in functions
const COSMOS_SQL_FUNCTIONS = [
  // Array functions
  'ARRAY_CONCAT', 'ARRAY_CONTAINS', 'ARRAY_LENGTH', 'ARRAY_SLICE',
  'SetIntersect', 'SetUnion',
  // Math functions
  'ABS', 'ACOS', 'ASIN', 'ATAN', 'ATN2', 'CEILING', 'COS', 'COT',
  'DEGREES', 'EXP', 'FLOOR', 'LOG', 'LOG10', 'PI', 'POWER',
  'RADIANS', 'RAND', 'ROUND', 'SIGN', 'SIN', 'SQRT', 'SQUARE',
  'TAN', 'TRUNC',
  // String functions
  'CONCAT', 'CONTAINS', 'ENDSWITH', 'INDEX_OF', 'LEFT', 'LENGTH',
  'LOWER', 'LTRIM', 'REPLACE', 'REPLICATE', 'REVERSE', 'RIGHT',
  'RTRIM', 'STARTSWITH', 'StringToArray', 'SUBSTRING', 'ToString',
  'TRIM', 'UPPER', 'RegexMatch',
  // Type checking functions
  'IS_ARRAY', 'IS_BOOL', 'IS_DEFINED', 'IS_NULL', 'IS_NUMBER',
  'IS_OBJECT', 'IS_PRIMITIVE', 'IS_STRING',
  // Aggregate functions
  'AVG', 'COUNT', 'MAX', 'MIN', 'SUM',
  // Spatial functions
  'ST_DISTANCE', 'ST_WITHIN', 'ST_INTERSECTS', 'ST_ISVALID',
  'ST_ISVALIDDETAILED',
  // Date/time functions
  'GetCurrentDateTime', 'GetCurrentTimestamp', 'GetCurrentTicks',
  'DateTimeAdd', 'DateTimeDiff', 'DateTimeFromParts', 'DateTimePart',
  'DateTimeToTicks', 'DateTimeToTimestamp', 'TicksToDateTime',
  'TimestampToDateTime',
  // Other functions
  'COALESCE', 'IIF',
];

const COSMOS_SQL_SNIPPETS = [
  {
    label: 'SELECT * FROM c',
    insertText: 'SELECT * FROM c',
    description: 'Select all documents',
  },
  {
    label: 'SELECT TOP',
    insertText: 'SELECT TOP ${1:10} * FROM c',
    description: 'Select top N documents',
  },
  {
    label: 'WHERE ARRAY_CONTAINS',
    insertText: 'WHERE ARRAY_CONTAINS(c.${1:field}, ${2:value})',
    description: 'Filter by array containing value',
  },
  {
    label: 'ORDER BY',
    insertText: 'ORDER BY c.${1:field} ${2|ASC,DESC|}',
    description: 'Order results',
  },
];

export class CosmosSqlProvider implements DatabaseProvider {
  readonly type: ProviderType = 'cosmos-sql';
  readonly displayName = 'Cosmos DB (SQL)';
  readonly capabilities: ProviderCapabilities = {
    supportsQueryAnalysis: true,
    supportsPagination: true,
    supportsPartitionKey: true,
    supportsTransactions: false,
    queryLanguage: 'sql',
  };

  private clients = new Map<string, { client: CosmosClient; state: AuthState }>();

  getInfo(): ProviderInfo {
    return {
      type: this.type,
      displayName: this.displayName,
      description: 'Azure Cosmos DB with SQL API',
      icon: 'cloud',
      color: '#742774',
      enabled: true,
    };
  }

  /** Endpoint and key of a stored connection */
  private getSettings(connectionId: string): CosmosSqlSettings {
    const config = getConnectionById(connectionId);
    if (!config) {
      throw new ConnectionError(
        `Connection not found: ${connectionId}`,
        this.type,
        'CONNECTION_NOT_FOUND'
      );
    }
    return { endpoint: config.endpoint, key: config.key };
  }

  /**
   * Get or create a CosmosClient for a connection.
   * Cached clients are dropped by invalidateClients() when connections are saved.
   */
  private getEntry(connectionId: string): { client: CosmosClient; state: AuthState } {
    let entry = this.clients.get(connectionId);
    if (!entry) {
      const settings = this.getSettings(connectionId);
      const state = initialAuthState(settings);
      entry = { client: createCosmosClient(settings, state), state };
      this.clients.set(connectionId, entry);
    }
    return entry;
  }

  /** Replace a connection's client with one using different credentials */
  private switchAuth(connectionId: string, state: AuthState): { client: CosmosClient; state: AuthState } {
    this.clients.get(connectionId)?.client.dispose();
    const entry = { client: createCosmosClient(this.getSettings(connectionId), state), state };
    this.clients.set(connectionId, entry);
    return entry;
  }

  /**
   * Run an operation against the connection's client, retrying with different
   * credentials when the account rejects the ones in use. The resolved
   * credentials stay cached, so the retry happens once per connection.
   */
  private async withClient<T>(
    connectionId: string,
    run: (client: CosmosClient) => Promise<T>
  ): Promise<T> {
    let entry = this.getEntry(connectionId);

    for (let attempt = 0; ; attempt++) {
      try {
        return await run(entry.client);
      } catch (error: unknown) {
        const message = errorMessage(error, 'Request failed');
        const next = attempt < MAX_AUTH_RETRIES ? nextAuthState(message, entry.state) : null;
        if (!next) throw error;

        console.log(
          `[CosmosSQL] ${connectionId}: ${describeAuthState(entry.state)} rejected, retrying with ${describeAuthState(next)}`
        );
        entry = this.switchAuth(connectionId, next);
      }
    }
  }

  /** Auth currently in use for a connection, for error messages */
  private authStateOf(connectionId: string): AuthState {
    return this.clients.get(connectionId)?.state ?? { mode: 'key' };
  }

  /** Drop cached clients so edited connection strings take effect without a restart */
  invalidateClients(): void {
    for (const { client } of this.clients.values()) {
      client.dispose();
    }
    this.clients.clear();
  }

  async connect(connectionId: string, config: ConnectionConfig): Promise<void> {
    const settings = config.settings as unknown as CosmosSqlSettings;
    this.clients.get(connectionId)?.client.dispose();
    this.clients.delete(connectionId);

    let state = initialAuthState(settings);
    for (let attempt = 0; ; attempt++) {
      const client = createCosmosClient(settings, state);
      try {
        // Verify connection by fetching databases
        await client.databases.readAll().fetchAll();
        this.clients.set(connectionId, { client, state });
        return;
      } catch (error: unknown) {
        client.dispose();
        const message = errorMessage(error, 'Failed to connect');
        const next = attempt < MAX_AUTH_RETRIES ? nextAuthState(message, state) : null;
        if (!next) {
          throw new ConnectionError(
            explainAuthError(message, state),
            this.type,
            'CONNECTION_FAILED',
            error instanceof Error ? error : undefined
          );
        }
        state = next;
      }
    }
  }

  async disconnect(connectionId: string): Promise<void> {
    const entry = this.clients.get(connectionId);
    if (entry) {
      entry.client.dispose();
      this.clients.delete(connectionId);
    }
  }

  async testConnection(config: ConnectionConfig): Promise<TestConnectionResult> {
    const settings = config.settings as unknown as CosmosSqlSettings;

    let state = initialAuthState(settings);
    for (let attempt = 0; ; attempt++) {
      const client = createCosmosClient(settings, state);
      try {
        const { resources } = await client.databases.readAll().fetchAll();
        return {
          success: true,
          message: `Connected via ${describeAuthState(state)}. Found ${resources.length} database(s).`,
          metadata: {
            databaseCount: resources.length,
            authMode: state.mode,
            tenantId: state.tenantId,
          },
        };
      } catch (error: unknown) {
        const message = errorMessage(error, 'Unknown error occurred');
        const next = attempt < MAX_AUTH_RETRIES ? nextAuthState(message, state) : null;
        if (!next) {
          return { success: false, message: explainAuthError(message, state) };
        }
        state = next;
      } finally {
        client.dispose();
      }
    }
  }

  async listDatabases(connectionId: string): Promise<DatabaseNode[]> {
    try {
      return await this.withClient(connectionId, async (client) => {
        const { resources } = await client.databases.readAll().fetchAll();

        return resources.map((db) => ({
          id: db.id!,
          name: db.id!,
        }));
      });
    } catch (error: unknown) {
      const message = explainAuthError(
        errorMessage(error, 'Failed to list databases'),
        this.authStateOf(connectionId)
      );
      throw new ConnectionError(message, this.type, 'LIST_DATABASES_FAILED', error instanceof Error ? error : undefined);
    }
  }

  async listCollections(connectionId: string, databaseId: string): Promise<CollectionNode[]> {
    return this.withClient(connectionId, async (client) => {
      const database = client.database(databaseId);
      const { resources } = await database.containers.readAll().fetchAll();

      return resources.map((container) => ({
        id: container.id!,
        name: container.id!,
        databaseId,
        metadata: {
          // Join all partition key paths with comma for hierarchical keys
          partitionKeyPath: container.partitionKey?.paths?.join(',') ?? '/id',
        },
      }));
    });
  }

  async executeQuery(params: QueryExecutionParams): Promise<QueryExecutionResult> {
    try {
      return await this.withClient(params.connectionId, async (client) => {
        const container = client
          .database(params.databaseId)
          .container(params.collectionId);

        const queryIterator = container.items.query(params.query, {
          maxItemCount: params.pageSize ?? 100,
          continuationToken: params.continuationToken ?? undefined,
        });

        const response = await queryIterator.fetchNext();

        return {
          documents: response.resources || [],
          continuationToken: response.continuationToken ?? null,
          hasMoreResults: response.hasMoreResults,
          metadata: {
            requestCharge: response.requestCharge,
          },
        };
      });
    } catch (error: unknown) {
      const message = explainAuthError(
        errorMessage(error, 'Query execution failed'),
        this.authStateOf(params.connectionId)
      );
      throw new QueryExecutionError(message, this.type, params.query, 'QUERY_FAILED', error instanceof Error ? error : undefined);
    }
  }

  async createDocument(params: DocumentCreateParams): Promise<DocumentResult> {
    try {
      return await this.withClient(params.connectionId, async (client) => {
        const container = client
          .database(params.databaseId)
          .container(params.collectionId);

        const { resource, requestCharge } = await container.items.create(params.document as Record<string, unknown>);

        return {
          document: resource,
          metadata: { requestCharge },
        };
      });
    } catch (error: unknown) {
      const message = errorMessage(error, 'Failed to create document');
      throw new DocumentOperationError(message, this.type, 'create', undefined, 'CREATE_FAILED', error instanceof Error ? error : undefined);
    }
  }

  async upsertDocument(params: DocumentCreateParams): Promise<DocumentResult> {
    try {
      return await this.withClient(params.connectionId, async (client) => {
        const container = client
          .database(params.databaseId)
          .container(params.collectionId);

        const { resource, requestCharge } = await container.items.upsert(params.document as Record<string, unknown>);

        return {
          document: resource,
          metadata: { requestCharge },
        };
      });
    } catch (error: unknown) {
      const message = errorMessage(error, 'Failed to upsert document');
      throw new DocumentOperationError(message, this.type, 'create', undefined, 'CREATE_FAILED', error instanceof Error ? error : undefined);
    }
  }

  async updateDocument(params: DocumentUpdateParams): Promise<DocumentResult> {
    try {
      return await this.withClient(params.connectionId, async (client) => {
        const container = client
          .database(params.databaseId)
          .container(params.collectionId);

        // Handle hierarchical partition keys (array) or single partition key
        const partitionKeyParam = params.options?.['partitionKey'];
        const partitionKey = Array.isArray(partitionKeyParam) ? partitionKeyParam : partitionKeyParam as string | undefined;
        const { resource, requestCharge } = await container
          .item(params.documentId, partitionKey)
          .replace(params.document as Record<string, unknown>);

        return {
          document: resource,
          metadata: { requestCharge },
        };
      });
    } catch (error: unknown) {
      const message = errorMessage(error, 'Failed to update document');
      throw new DocumentOperationError(message, this.type, 'update', params.documentId, 'UPDATE_FAILED', error instanceof Error ? error : undefined);
    }
  }

  async deleteDocument(params: DocumentDeleteParams): Promise<void> {
    try {
      await this.withClient(params.connectionId, async (client) => {
        const container = client
          .database(params.databaseId)
          .container(params.collectionId);

        // Handle hierarchical partition keys (array) or single partition key
        const partitionKeyParam = params.options?.['partitionKey'];
        const partitionKey = Array.isArray(partitionKeyParam) ? partitionKeyParam : partitionKeyParam as string | undefined;
        await container.item(params.documentId, partitionKey).delete();
      });
    } catch (error: unknown) {
      const message = errorMessage(error, 'Failed to delete document');
      throw new DocumentOperationError(message, this.type, 'delete', params.documentId, 'DELETE_FAILED', error instanceof Error ? error : undefined);
    }
  }

  async analyzeQuery(params: QueryAnalysisParams): Promise<QueryAnalysisResult> {
    return this.withClient(params.connectionId, async (client) => {
      const container = client
        .database(params.databaseId)
        .container(params.collectionId);

      const startTime = performance.now();

      const queryIterator = container.items.query(params.query, {
        populateIndexMetrics: true,
        maxItemCount: 1,
      });

      const response = await queryIterator.fetchNext();
      const executionTimeMs = Math.round(performance.now() - startTime);

      return {
        indexMetrics: (response as unknown as { indexMetrics?: string }).indexMetrics || '{}',
        executionTimeMs,
        metadata: {
          requestCharge: response.requestCharge,
          retrievedDocumentCount: response.resources?.length || 0,
        },
      };
    });
  }

  getQueryLanguage(): QueryLanguageConfig {
    return {
      languageId: 'cosmossql',
      fileExtension: '.sql',
      keywords: COSMOS_SQL_KEYWORDS,
      functions: COSMOS_SQL_FUNCTIONS,
      snippets: COSMOS_SQL_SNIPPETS,
    };
  }
}

// Export singleton instance
export const cosmosSqlProvider = new CosmosSqlProvider();
