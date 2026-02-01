export interface CosmosConnection {
  id: string;
  name: string;
  endpoint: string;
  key: string;
  defaultDatabase?: string;
  createdAt: Date;
  lastUsedAt?: Date;
}

export interface ConnectionTestResult {
  connectionId: string;
  success: boolean;
  databaseCount?: number;
  error?: string;
}
