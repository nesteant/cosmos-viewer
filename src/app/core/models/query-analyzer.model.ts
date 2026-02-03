export interface QueryAnalysis {
  explanation: QueryExplanation;
  optimizationHints: OptimizationHint[];
  indexMetrics: IndexMetrics | null;
  executionStats: ExecutionStats | null;
  analyzedQuery: string;
  timestamp: Date;
}

export interface QueryExplanation {
  summary: string;
  clauses: ClauseExplanation[];
}

// SQL clause types
export type SqlClauseType = 'SELECT' | 'FROM' | 'WHERE' | 'ORDER_BY' | 'TOP' | 'OFFSET' | 'GROUP_BY' | 'JOIN';

// MongoDB clause types
export type MongoClauseType = 'FIELD' | 'FILTER' | 'ERROR' | '$and' | '$or' | '$nor' | '$match' | '$group' |
  '$project' | '$sort' | '$limit' | '$skip' | '$unwind' | '$lookup' | '$count' | '$addFields' | '$set';

export interface ClauseExplanation {
  type: SqlClauseType | MongoClauseType | string;
  description: string;
  fields?: string[];
}

export type HintSeverity = 'info' | 'warning' | 'error';
export type HintCategory = 'index' | 'filter' | 'projection' | 'pagination' | 'function' | 'partition';

export interface OptimizationHint {
  severity: HintSeverity;
  category: HintCategory;
  title: string;
  description: string;
  suggestion?: string;
  affectedFields?: string[];
}

export interface IndexMetrics {
  utilizedSingleIndexes: IndexInfo[];
  potentialSingleIndexes: IndexInfo[];
  utilizedCompositeIndexes: CompositeIndexInfo[];
  potentialCompositeIndexes: CompositeIndexInfo[];
}

export interface IndexInfo {
  indexSpec: string;
  filterExpression?: string;
  filterPreciseSet?: boolean;
  indexPreciseSet?: boolean;
  indexImpactScore: 'High' | 'Low';
}

export interface CompositeIndexInfo {
  indexSpecs: string[];
  indexImpactScore: 'High' | 'Low';
}

export interface ExecutionStats {
  requestCharge: number;
  executionTimeMs: number;
  retrievedDocumentCount?: number;
}

export interface AnalyzeQueryParams {
  connectionId: string;
  databaseId: string;
  containerId: string;
  query: string;
}

export interface AnalyzeQueryResult {
  indexMetrics: string;
  requestCharge: number;
  executionTimeMs: number;
  retrievedDocumentCount: number;
}
