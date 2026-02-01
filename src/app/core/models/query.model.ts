import { CosmosDocument } from './document.model';

export interface QueryParams {
  connectionId: string;
  databaseId: string;
  containerId: string;
  query: string;
  pageSize?: number;
  continuationToken?: string | null;
}

export interface QueryResult {
  documents: CosmosDocument[];
  continuationToken?: string | null;
  hasMoreResults: boolean;
  requestCharge?: number;
  totalCount?: number;
}

export interface QueryHistoryItem {
  query: string;
  executedAt: Date;
  databaseId: string;
  containerId: string;
}

export interface ColumnDefinition {
  path: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'mixed';
  isSystem: boolean;
  width?: number;
}
