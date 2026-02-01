export interface CosmosDocument {
  id: string;
  [key: string]: any;
  // System properties (read-only, set by Cosmos DB)
  _rid?: string;
  _self?: string;
  _etag?: string;
  _attachments?: string;
  _ts?: number;
}

export interface FlatDocument {
  [path: string]: any;
  _original?: CosmosDocument;
}
