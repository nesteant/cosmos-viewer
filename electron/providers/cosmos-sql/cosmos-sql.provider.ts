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

// Cosmos SQL specific connection settings
interface CosmosSqlSettings {
  endpoint: string;
  key: string;
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

  private clients = new Map<string, CosmosClient>();

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

  /**
   * Get or create a CosmosClient for a connection
   */
  private getClient(connectionId: string): CosmosClient {
    if (!this.clients.has(connectionId)) {
      const config = getConnectionById(connectionId);
      if (!config) {
        throw new ConnectionError(
          `Connection not found: ${connectionId}`,
          this.type,
          'CONNECTION_NOT_FOUND'
        );
      }
      const client = new CosmosClient({
        endpoint: config.endpoint,
        key: config.key,
      });
      this.clients.set(connectionId, client);
    }
    return this.clients.get(connectionId)!;
  }

  async connect(connectionId: string, config: ConnectionConfig): Promise<void> {
    const settings = config.settings as unknown as CosmosSqlSettings;
    try {
      const client = new CosmosClient({
        endpoint: settings.endpoint,
        key: settings.key,
      });
      // Verify connection by fetching databases
      await client.databases.readAll().fetchAll();
      this.clients.set(connectionId, client);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to connect';
      throw new ConnectionError(message, this.type, 'CONNECTION_FAILED', error instanceof Error ? error : undefined);
    }
  }

  async disconnect(connectionId: string): Promise<void> {
    const client = this.clients.get(connectionId);
    if (client) {
      client.dispose();
      this.clients.delete(connectionId);
    }
  }

  async testConnection(config: ConnectionConfig): Promise<TestConnectionResult> {
    const settings = config.settings as unknown as CosmosSqlSettings;
    try {
      const client = new CosmosClient({
        endpoint: settings.endpoint,
        key: settings.key,
      });

      const { resources } = await client.databases.readAll().fetchAll();
      client.dispose();

      return {
        success: true,
        message: `Connected successfully. Found ${resources.length} database(s).`,
        metadata: { databaseCount: resources.length },
      };
    } catch (error: unknown) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  async listDatabases(connectionId: string): Promise<DatabaseNode[]> {
    const client = this.getClient(connectionId);
    const { resources } = await client.databases.readAll().fetchAll();

    return resources.map((db) => ({
      id: db.id!,
      name: db.id!,
    }));
  }

  async listCollections(connectionId: string, databaseId: string): Promise<CollectionNode[]> {
    const client = this.getClient(connectionId);
    const database = client.database(databaseId);
    const { resources } = await database.containers.readAll().fetchAll();

    return resources.map((container) => ({
      id: container.id!,
      name: container.id!,
      databaseId,
      metadata: {
        partitionKeyPath: container.partitionKey?.paths?.[0] ?? '/id',
      },
    }));
  }

  async executeQuery(params: QueryExecutionParams): Promise<QueryExecutionResult> {
    try {
      const client = this.getClient(params.connectionId);
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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Query execution failed';
      throw new QueryExecutionError(message, this.type, params.query, 'QUERY_FAILED', error instanceof Error ? error : undefined);
    }
  }

  async createDocument(params: DocumentCreateParams): Promise<DocumentResult> {
    try {
      const client = this.getClient(params.connectionId);
      const container = client
        .database(params.databaseId)
        .container(params.collectionId);

      const { resource, requestCharge } = await container.items.create(params.document as Record<string, unknown>);

      return {
        document: resource,
        metadata: { requestCharge },
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create document';
      throw new DocumentOperationError(message, this.type, 'create', undefined, 'CREATE_FAILED', error instanceof Error ? error : undefined);
    }
  }

  async updateDocument(params: DocumentUpdateParams): Promise<DocumentResult> {
    try {
      const client = this.getClient(params.connectionId);
      const container = client
        .database(params.databaseId)
        .container(params.collectionId);

      const partitionKey = params.options?.['partitionKey'] as string | undefined;
      const { resource, requestCharge } = await container
        .item(params.documentId, partitionKey)
        .replace(params.document as Record<string, unknown>);

      return {
        document: resource,
        metadata: { requestCharge },
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update document';
      throw new DocumentOperationError(message, this.type, 'update', params.documentId, 'UPDATE_FAILED', error instanceof Error ? error : undefined);
    }
  }

  async deleteDocument(params: DocumentDeleteParams): Promise<void> {
    try {
      const client = this.getClient(params.connectionId);
      const container = client
        .database(params.databaseId)
        .container(params.collectionId);

      const partitionKey = params.options?.['partitionKey'] as string | undefined;
      await container.item(params.documentId, partitionKey).delete();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete document';
      throw new DocumentOperationError(message, this.type, 'delete', params.documentId, 'DELETE_FAILED', error instanceof Error ? error : undefined);
    }
  }

  async analyzeQuery(params: QueryAnalysisParams): Promise<QueryAnalysisResult> {
    const client = this.getClient(params.connectionId);
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
