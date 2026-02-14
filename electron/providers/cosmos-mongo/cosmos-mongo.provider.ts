/**
 * Cosmos DB MongoDB API Provider
 * Implements DatabaseProvider interface for Azure Cosmos DB with MongoDB API
 *
 * Key differences from native MongoDB:
 * - Uses Cosmos DB connection string format
 * - Supports RU (Request Unit) consumption tracking via getLastRequestStatistics
 * - Partition key support (shard key)
 * - Some MongoDB features are limited or unsupported
 */

import { MongoClient, Db, Document, ObjectId, Filter } from 'mongodb';
import { EJSON } from 'bson';
import JSON5 from 'json5';

/**
 * Serialize MongoDB documents for IPC transfer.
 * Converts ObjectId, Binary, Date, etc. to Extended JSON format
 * that can survive Electron's structured clone algorithm.
 */
function serializeDocuments(docs: Document[]): Document[] {
  // EJSON.serialize converts MongoDB types to Extended JSON format
  // Then we parse it back to get plain objects that work with IPC
  return JSON.parse(EJSON.stringify(docs));
}
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

// Cosmos MongoDB specific connection settings
interface CosmosMongoSettings {
  connectionString: string;
}

// MongoDB query operators for Monaco editor
const MONGO_QUERY_OPERATORS = [
  // Comparison
  '$eq', '$gt', '$gte', '$in', '$lt', '$lte', '$ne', '$nin',
  // Logical
  '$and', '$not', '$nor', '$or',
  // Element
  '$exists', '$type',
  // Evaluation
  '$expr', '$jsonSchema', '$mod', '$regex', '$text', '$where',
  // Array
  '$all', '$elemMatch', '$size',
  // Projection
  '$slice', '$meta',
];

// MongoDB aggregation stages
const MONGO_AGGREGATION_STAGES = [
  '$match', '$group', '$sort', '$limit', '$skip', '$project',
  '$unwind', '$lookup', '$count', '$addFields', '$set',
  '$replaceRoot', '$facet', '$bucket', '$bucketAuto',
];

// MongoDB aggregation operators
const MONGO_AGGREGATION_OPERATORS = [
  // Arithmetic
  '$add', '$subtract', '$multiply', '$divide', '$mod', '$abs', '$ceil', '$floor', '$round',
  // Array
  '$arrayElemAt', '$concatArrays', '$filter', '$map', '$reduce', '$size', '$slice',
  // String
  '$concat', '$substr', '$toLower', '$toUpper', '$trim', '$split',
  // Date
  '$dateFromString', '$dateToString', '$dayOfMonth', '$dayOfWeek', '$year', '$month',
  // Conditional
  '$cond', '$ifNull', '$switch',
  // Type
  '$convert', '$toInt', '$toString', '$toObjectId',
  // Accumulator (in $group)
  '$sum', '$avg', '$min', '$max', '$first', '$last', '$push', '$addToSet',
];

const MONGO_SNIPPETS = [
  {
    label: 'find all',
    insertText: '{}',
    description: 'Find all documents',
  },
  {
    label: 'find by field',
    insertText: '{ "${1:field}": "${2:value}" }',
    description: 'Find documents by field value',
  },
  {
    label: 'find with comparison',
    insertText: '{ "${1:field}": { "$${2|gt,gte,lt,lte,eq,ne|}": ${3:value} } }',
    description: 'Find with comparison operator',
  },
  {
    label: 'find in array',
    insertText: '{ "${1:field}": { "$in": [${2:values}] } }',
    description: 'Find documents where field is in array',
  },
  {
    label: 'find with regex',
    insertText: '{ "${1:field}": { "$regex": "${2:pattern}", "$options": "i" } }',
    description: 'Find with regex pattern',
  },
  {
    label: 'find nested field',
    insertText: '{ "${1:parent}.${2:child}": "${3:value}" }',
    description: 'Find by nested field',
  },
  {
    label: 'aggregation pipeline',
    insertText: '[\n  { "$match": { ${1:filter} } },\n  { "$group": { "_id": "$${2:field}", "count": { "$sum": 1 } } }\n]',
    description: 'Basic aggregation pipeline',
  },
];

// Interface for request statistics from Cosmos DB
interface RequestStatistics {
  RequestCharge?: number;
  requestCharge?: number;
}

export class CosmosMongoProvider implements DatabaseProvider {
  readonly type: ProviderType = 'cosmos-mongo';
  readonly displayName = 'Cosmos DB (MongoDB)';
  readonly capabilities: ProviderCapabilities = {
    supportsQueryAnalysis: true,
    supportsPagination: true,
    supportsPartitionKey: true,
    supportsTransactions: false, // Limited in Cosmos MongoDB API
    queryLanguage: 'mongodb',
  };

  private clients = new Map<string, MongoClient>();

  getInfo(): ProviderInfo {
    return {
      type: this.type,
      displayName: this.displayName,
      description: 'Azure Cosmos DB with MongoDB API',
      icon: 'cloud',
      color: '#4DB33D', // MongoDB green
      enabled: true,
    };
  }

  /**
   * Get or create a MongoClient for a connection
   */
  private async getClient(connectionId: string): Promise<MongoClient> {
    if (!this.clients.has(connectionId)) {
      const config = getConnectionById(connectionId);
      if (!config) {
        throw new ConnectionError(
          `Connection not found: ${connectionId}`,
          this.type,
          'CONNECTION_NOT_FOUND'
        );
      }

      // For Cosmos MongoDB, we use connectionString stored in endpoint field
      const connectionString = config.endpoint;
      const client = new MongoClient(connectionString, {
        retryWrites: false, // Cosmos DB doesn't support retryWrites
        maxIdleTimeMS: 120000,
      });

      await client.connect();
      this.clients.set(connectionId, client);
    }
    return this.clients.get(connectionId)!;
  }

  /**
   * Get RU consumption from the last operation
   */
  private async getRequestCharge(db: Db): Promise<number | undefined> {
    try {
      const stats = await db.command({ getLastRequestStatistics: 1 }) as RequestStatistics;
      return stats.RequestCharge ?? stats.requestCharge;
    } catch {
      // Command may not be available or may fail
      return undefined;
    }
  }

  async connect(connectionId: string, config: ConnectionConfig): Promise<void> {
    const settings = config.settings as unknown as CosmosMongoSettings;
    try {
      const client = new MongoClient(settings.connectionString, {
        retryWrites: false,
        maxIdleTimeMS: 120000,
      });

      await client.connect();
      // Verify connection by listing databases
      await client.db().admin().listDatabases();
      this.clients.set(connectionId, client);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to connect';
      throw new ConnectionError(message, this.type, 'CONNECTION_FAILED', error instanceof Error ? error : undefined);
    }
  }

  async disconnect(connectionId: string): Promise<void> {
    const client = this.clients.get(connectionId);
    if (client) {
      await client.close();
      this.clients.delete(connectionId);
    }
  }

  async testConnection(config: ConnectionConfig): Promise<TestConnectionResult> {
    const settings = config.settings as unknown as CosmosMongoSettings;
    let client: MongoClient | null = null;

    try {
      client = new MongoClient(settings.connectionString, {
        retryWrites: false,
        maxIdleTimeMS: 120000,
        serverSelectionTimeoutMS: 10000, // 10 second timeout for testing
      });

      await client.connect();
      const result = await client.db().admin().listDatabases();
      const dbCount = result.databases.length;

      return {
        success: true,
        message: `Connected successfully. Found ${dbCount} database(s).`,
        metadata: { databaseCount: dbCount },
      };
    } catch (error: unknown) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    } finally {
      if (client) {
        await client.close();
      }
    }
  }

  async listDatabases(connectionId: string): Promise<DatabaseNode[]> {
    const client = await this.getClient(connectionId);
    const result = await client.db().admin().listDatabases();

    return result.databases
      .filter(db => !['admin', 'local', 'config'].includes(db.name)) // Filter system DBs
      .map((db) => ({
        id: db.name,
        name: db.name,
        metadata: {
          sizeOnDisk: db.sizeOnDisk,
          empty: db.empty,
        },
      }));
  }

  async listCollections(connectionId: string, databaseId: string): Promise<CollectionNode[]> {
    const client = await this.getClient(connectionId);
    const db = client.db(databaseId);
    const collections = await db.listCollections().toArray();

    // Get partition key info for each collection if available
    const collectionsWithMetadata = await Promise.all(
      collections.map(async (col) => {
        let partitionKeyPath = '/_id'; // Default for Cosmos MongoDB

        try {
          // Try to get collection info including shard key
          const collStats = await db.command({ collStats: col.name });
          if (collStats.shardKey) {
            const shardKeyField = Object.keys(collStats.shardKey)[0];
            partitionKeyPath = `/${shardKeyField}`;
          }
        } catch {
          // If collStats fails, use default
        }

        return {
          id: col.name,
          name: col.name,
          databaseId,
          metadata: {
            partitionKeyPath,
            type: col.type,
          },
        };
      })
    );

    return collectionsWithMetadata;
  }

  async executeQuery(params: QueryExecutionParams): Promise<QueryExecutionResult> {
    try {
      const client = await this.getClient(params.connectionId);
      const db = client.db(params.databaseId);
      const collection = db.collection(params.collectionId);

      // Parse the query - it could be a find filter or aggregation pipeline
      // Using JSON5 to support relaxed syntax (unquoted keys, trailing commas, etc.)
      let query: Document | Document[];
      try {
        query = JSON5.parse(params.query);
      } catch (parseError) {
        const errorMsg = parseError instanceof Error ? parseError.message : 'Unknown parse error';
        throw new QueryExecutionError(
          `Invalid query syntax: ${errorMsg}. Please provide a valid MongoDB query object or aggregation pipeline.`,
          this.type,
          params.query,
          'INVALID_QUERY'
        );
      }

      const pageSize = params.pageSize ?? 100;
      let documents: Document[];
      let hasMoreResults = false;

      // Check if it's an aggregation pipeline (array) or find query (object)
      if (Array.isArray(query)) {
        // Aggregation pipeline
        const pipeline = [...query];

        // Add pagination to pipeline
        const skip = params.continuationToken ? parseInt(params.continuationToken, 10) : 0;
        pipeline.push({ $skip: skip });
        pipeline.push({ $limit: pageSize + 1 }); // +1 to check if more results exist

        const cursor = collection.aggregate(pipeline);
        documents = await cursor.toArray();

        if (documents.length > pageSize) {
          hasMoreResults = true;
          documents = documents.slice(0, pageSize);
        }

        // Get RU charge
        const requestCharge = await this.getRequestCharge(db);

        return {
          // Serialize documents for IPC (converts ObjectId, Binary, etc. to Extended JSON)
          documents: serializeDocuments(documents),
          continuationToken: hasMoreResults ? String(skip + pageSize) : null,
          hasMoreResults,
          metadata: {
            requestCharge,
            queryType: 'aggregation',
          },
        };
      } else {
        // Find query
        const skip = params.continuationToken ? parseInt(params.continuationToken, 10) : 0;

        const cursor = collection
          .find(query)
          .skip(skip)
          .limit(pageSize + 1);

        documents = await cursor.toArray();

        if (documents.length > pageSize) {
          hasMoreResults = true;
          documents = documents.slice(0, pageSize);
        }

        // Get RU charge
        const requestCharge = await this.getRequestCharge(db);

        return {
          // Serialize documents for IPC (converts ObjectId, Binary, etc. to Extended JSON)
          documents: serializeDocuments(documents),
          continuationToken: hasMoreResults ? String(skip + pageSize) : null,
          hasMoreResults,
          metadata: {
            requestCharge,
            queryType: 'find',
          },
        };
      }
    } catch (error: unknown) {
      if (error instanceof QueryExecutionError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Query execution failed';
      throw new QueryExecutionError(message, this.type, params.query, 'QUERY_FAILED', error instanceof Error ? error : undefined);
    }
  }

  async createDocument(params: DocumentCreateParams): Promise<DocumentResult> {
    try {
      const client = await this.getClient(params.connectionId);
      const db = client.db(params.databaseId);
      const collection = db.collection(params.collectionId);

      // Deserialize EJSON to native MongoDB types
      const doc = EJSON.deserialize(params.document as Document) as Document;
      const result = await collection.insertOne(doc);

      // Get the inserted document
      const insertedDoc = await collection.findOne({ _id: result.insertedId });

      // Get RU charge
      const requestCharge = await this.getRequestCharge(db);

      return {
        // Serialize document for IPC
        document: insertedDoc ? serializeDocuments([insertedDoc])[0] : null,
        metadata: { requestCharge, insertedId: result.insertedId.toString() },
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create document';
      throw new DocumentOperationError(message, this.type, 'create', undefined, 'CREATE_FAILED', error instanceof Error ? error : undefined);
    }
  }

  async updateDocument(params: DocumentUpdateParams): Promise<DocumentResult> {
    try {
      const client = await this.getClient(params.connectionId);
      const db = client.db(params.databaseId);
      const collection = db.collection(params.collectionId);

      // Build filter for document lookup
      let filter: Filter<Document>;
      try {
        if (ObjectId.isValid(params.documentId)) {
          filter = { _id: new ObjectId(params.documentId) };
        } else {
          filter = { _id: params.documentId as unknown } as Filter<Document>;
        }
      } catch {
        filter = { _id: params.documentId as unknown } as Filter<Document>;
      }

      // Deserialize EJSON to native MongoDB types
      // This converts { $date: "..." } back to Date, { $oid: "..." } to ObjectId, etc.
      const doc = EJSON.deserialize(params.document as Document) as Document;

      // Remove _id from the document to avoid immutable field error
      const { _id, ...updateDoc } = doc;

      const result = await collection.replaceOne(filter, updateDoc);

      if (result.matchedCount === 0) {
        throw new DocumentOperationError(
          `Document not found: ${params.documentId}`,
          this.type,
          'update',
          params.documentId,
          'NOT_FOUND'
        );
      }

      // Get the updated document
      const updatedDoc = await collection.findOne(filter);

      // Get RU charge
      const requestCharge = await this.getRequestCharge(db);

      return {
        // Serialize document for IPC
        document: updatedDoc ? serializeDocuments([updatedDoc])[0] : null,
        metadata: { requestCharge, modifiedCount: result.modifiedCount },
      };
    } catch (error: unknown) {
      if (error instanceof DocumentOperationError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Failed to update document';
      throw new DocumentOperationError(message, this.type, 'update', params.documentId, 'UPDATE_FAILED', error instanceof Error ? error : undefined);
    }
  }

  async deleteDocument(params: DocumentDeleteParams): Promise<void> {
    try {
      const client = await this.getClient(params.connectionId);
      const db = client.db(params.databaseId);
      const collection = db.collection(params.collectionId);

      // Build filter for document lookup
      let filter: Filter<Document>;
      try {
        if (ObjectId.isValid(params.documentId)) {
          filter = { _id: new ObjectId(params.documentId) };
        } else {
          filter = { _id: params.documentId as unknown } as Filter<Document>;
        }
      } catch {
        filter = { _id: params.documentId as unknown } as Filter<Document>;
      }

      const result = await collection.deleteOne(filter);

      if (result.deletedCount === 0) {
        throw new DocumentOperationError(
          `Document not found: ${params.documentId}`,
          this.type,
          'delete',
          params.documentId,
          'NOT_FOUND'
        );
      }
    } catch (error: unknown) {
      if (error instanceof DocumentOperationError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Failed to delete document';
      throw new DocumentOperationError(message, this.type, 'delete', params.documentId, 'DELETE_FAILED', error instanceof Error ? error : undefined);
    }
  }

  async analyzeQuery(params: QueryAnalysisParams): Promise<QueryAnalysisResult> {
    try {
      const client = await this.getClient(params.connectionId);
      const db = client.db(params.databaseId);
      const collection = db.collection(params.collectionId);

      let query: Document | Document[];
      try {
        query = JSON5.parse(params.query);
      } catch (parseError) {
        const errorMsg = parseError instanceof Error ? parseError.message : 'Unknown parse error';
        return {
          indexMetrics: JSON.stringify({ error: `Invalid query syntax: ${errorMsg}` }),
          executionTimeMs: 0,
        };
      }

      const startTime = performance.now();

      // Use explain to get query plan
      let explainResult: Document;

      if (Array.isArray(query)) {
        // Aggregation pipeline
        explainResult = await collection.aggregate(query).explain('executionStats');
      } else {
        // Find query
        explainResult = await collection.find(query).explain('executionStats');
      }

      const executionTimeMs = Math.round(performance.now() - startTime);

      // Get RU charge
      const requestCharge = await this.getRequestCharge(db);

      // Extract relevant metrics
      const metrics = {
        queryPlanner: explainResult.queryPlanner,
        executionStats: explainResult.executionStats,
        serverInfo: explainResult.serverInfo,
      };

      return {
        indexMetrics: JSON.stringify(metrics, null, 2),
        executionTimeMs,
        metadata: {
          requestCharge,
          indexesUsed: explainResult.queryPlanner?.winningPlan?.inputStage?.indexName,
        },
      };
    } catch (error: unknown) {
      return {
        indexMetrics: JSON.stringify({ error: error instanceof Error ? error.message : 'Analysis failed' }),
        executionTimeMs: 0,
      };
    }
  }

  getQueryLanguage(): QueryLanguageConfig {
    return {
      languageId: 'json', // MongoDB queries are JSON
      fileExtension: '.json',
      keywords: [...MONGO_QUERY_OPERATORS, ...MONGO_AGGREGATION_STAGES],
      functions: MONGO_AGGREGATION_OPERATORS,
      snippets: MONGO_SNIPPETS,
    };
  }
}

// Export singleton instance
export const cosmosMongoProvider = new CosmosMongoProvider();
