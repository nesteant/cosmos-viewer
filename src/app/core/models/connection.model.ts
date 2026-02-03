export type ProviderType = 'cosmos-sql' | 'cosmos-mongo' | 'mongodb' | 'jdbc';

export interface ProviderInfo {
  type: ProviderType;
  displayName: string;
  description: string;
  icon: string;
  color: string;
  enabled: boolean;
}

export interface ProviderCapabilities {
  supportsQueryAnalysis: boolean;
  supportsPagination: boolean;
  supportsPartitionKey: boolean;
  supportsTransactions: boolean;
  queryLanguage: 'sql' | 'mongodb' | 'custom';
}

export interface DatabaseConnection {
  id: string;
  name: string;
  providerType: ProviderType;
  endpoint: string;
  key: string;
  defaultDatabase?: string;
  createdAt: Date;
  lastUsedAt?: Date;
}

export interface ConnectionTestResult {
  success: boolean;
  message?: string;
  metadata?: Record<string, unknown>;
}
