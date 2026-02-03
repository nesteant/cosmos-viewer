/**
 * Shared types for all database providers
 */

// Provider type identifier
export type ProviderType = 'cosmos-sql' | 'cosmos-mongo' | 'mongodb' | 'jdbc';

// Provider metadata for UI
export interface ProviderInfo {
  type: ProviderType;
  displayName: string;
  description: string;
  icon: string;
  color: string;
  enabled: boolean;
}

// Connection configuration
export interface ConnectionConfig {
  type: ProviderType;
  settings: Record<string, unknown>;
}

export interface TestConnectionResult {
  success: boolean;
  message?: string;
  metadata?: Record<string, unknown>;
}

// Schema nodes (generic for any DB)
export interface DatabaseNode {
  id: string;
  name: string;
  metadata?: Record<string, unknown>;
}

export interface CollectionNode {
  id: string;
  name: string;
  databaseId: string;
  metadata?: Record<string, unknown>;
}

// Query execution
export interface QueryExecutionParams {
  connectionId: string;
  databaseId: string;
  collectionId: string;
  query: string;
  pageSize?: number;
  continuationToken?: string | null;
  parameters?: Record<string, unknown>;
}

export interface QueryExecutionResult {
  documents: unknown[];
  continuationToken?: string | null;
  hasMoreResults: boolean;
  metadata?: Record<string, unknown>;
}

// Query analysis (optional capability)
export interface QueryAnalysisParams {
  connectionId: string;
  databaseId: string;
  collectionId: string;
  query: string;
}

export interface QueryAnalysisResult {
  indexMetrics?: string;
  executionTimeMs?: number;
  metadata?: Record<string, unknown>;
}

// Document operations
export interface DocumentCreateParams {
  connectionId: string;
  databaseId: string;
  collectionId: string;
  document: unknown;
  options?: Record<string, unknown>;
}

export interface DocumentUpdateParams {
  connectionId: string;
  databaseId: string;
  collectionId: string;
  documentId: string;
  document: unknown;
  options?: Record<string, unknown>;
}

export interface DocumentDeleteParams {
  connectionId: string;
  databaseId: string;
  collectionId: string;
  documentId: string;
  options?: Record<string, unknown>;
}

export interface DocumentResult {
  document: unknown;
  metadata?: Record<string, unknown>;
}

// Query language configuration (for Monaco editor)
export interface QueryLanguageConfig {
  languageId: string;
  fileExtension: string;
  keywords: string[];
  functions: string[];
  snippets: QuerySnippet[];
}

export interface QuerySnippet {
  label: string;
  insertText: string;
  description: string;
}
