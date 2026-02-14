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

export interface ConnectionAppearance {
  /** 2-3 letter abbreviation shown on icon */
  prefix?: string;
  /** Material icon name (optional, uses prefix if not set) */
  icon?: string;
  /** Background color (hex or css color) */
  bgColor?: string;
  /** Icon/text color (hex or css color) */
  iconColor?: string;
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
  order?: number;
  /** Visual customization for sidebar */
  appearance?: ConnectionAppearance;
}

export interface ConnectionTestResult {
  success: boolean;
  message?: string;
  metadata?: Record<string, unknown>;
}
