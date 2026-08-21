/**
 * Database Provider Interface
 * All database providers must implement this interface
 */

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
} from './types';

export interface ProviderCapabilities {
  supportsQueryAnalysis: boolean;
  supportsPagination: boolean;
  supportsPartitionKey: boolean;
  supportsTransactions: boolean;
  queryLanguage: 'sql' | 'mongodb' | 'custom';
}

export interface DatabaseProvider {
  // Provider metadata
  readonly type: ProviderType;
  readonly displayName: string;
  readonly capabilities: ProviderCapabilities;

  /**
   * Get provider info for UI display
   */
  getInfo(): ProviderInfo;

  /**
   * Connect to a database using the given configuration
   * @param connectionId Unique identifier for this connection
   * @param config Provider-specific connection configuration
   */
  connect(connectionId: string, config: ConnectionConfig): Promise<void>;

  /**
   * Disconnect and cleanup resources for a connection
   * @param connectionId The connection to disconnect
   */
  disconnect(connectionId: string): Promise<void>;

  /**
   * Test a connection without persisting it
   * @param config Connection configuration to test
   */
  testConnection(config: ConnectionConfig): Promise<TestConnectionResult>;

  /**
   * List all databases/schemas for a connection
   * @param connectionId The connection to query
   */
  listDatabases(connectionId: string): Promise<DatabaseNode[]>;

  /**
   * List all collections/tables in a database
   * @param connectionId The connection to query
   * @param databaseId The database to list collections from
   */
  listCollections(connectionId: string, databaseId: string): Promise<CollectionNode[]>;

  /**
   * Execute a query against a collection
   * @param params Query execution parameters
   */
  executeQuery(params: QueryExecutionParams): Promise<QueryExecutionResult>;

  /**
   * Create a new document/row
   * @param params Document creation parameters
   */
  createDocument(params: DocumentCreateParams): Promise<DocumentResult>;

  /**
   * Update an existing document/row
   * @param params Document update parameters
   */
  updateDocument(params: DocumentUpdateParams): Promise<DocumentResult>;

  /**
   * Create or replace a document/row (upsert)
   * @param params Document creation parameters
   */
  upsertDocument(params: DocumentCreateParams): Promise<DocumentResult>;

  /**
   * Delete a document/row
   * @param params Document deletion parameters
   */
  deleteDocument(params: DocumentDeleteParams): Promise<void>;

  /**
   * Analyze a query for optimization hints (optional)
   * Only available if capabilities.supportsQueryAnalysis is true
   * @param params Query analysis parameters
   */
  analyzeQuery?(params: QueryAnalysisParams): Promise<QueryAnalysisResult>;

  /**
   * Drop cached clients so they are rebuilt from current stored settings (optional).
   * Called when connections are saved - endpoint or credentials may have changed.
   */
  invalidateClients?(): void;

  /**
   * Get the query language configuration for Monaco editor
   */
  getQueryLanguage(): QueryLanguageConfig;
}
