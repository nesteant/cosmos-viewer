import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import {
  CosmosDocument,
  ColumnDefinition,
  ContainerInfo,
} from '@core/models';
import { ElectronService, NotificationService } from '@core/services';
import { detectColumns } from '@core/utils';
import { DiffTracker, DocumentChange, createDocumentKey, extractPartitionKeyValue } from '@core/utils/diff-tracker';

/**
 * Normalize raw query results into objects.
 *
 * Cosmos `SELECT VALUE …` queries (and Mongo aggregations like `{ $count: … }`)
 * return primitive scalars. Wrap them in `{ value: <primitive> }` so the rest
 * of the table pipeline (column detection, cell value lookup) treats them
 * uniformly. Object documents pass through unchanged.
 */
function normalizeQueryDocuments(docs: unknown[]): CosmosDocument[] {
  return docs.map((d) => {
    if (d !== null && typeof d === 'object' && !Array.isArray(d)) {
      return d as CosmosDocument;
    }
    return { value: d } as unknown as CosmosDocument;
  });
}

/**
 * Get document ID (supports both 'id' for CosmosSQL and '_id' for MongoDB with EJSON)
 */
function getDocId(doc: CosmosDocument): string {
  // CosmosSQL uses 'id'
  if (doc.id !== undefined) return doc.id;

  // MongoDB uses '_id' which can be a complex EJSON object
  const id = (doc as any)._id;
  if (id === null || id === undefined) return '';

  // Handle string/number directly
  if (typeof id === 'string') return id;
  if (typeof id === 'number') return String(id);

  // Handle Extended JSON object formats
  if (typeof id === 'object') {
    // ObjectId: { "$oid": "507f1f77bcf86cd799439011" }
    if (id.$oid) return id.$oid;

    // UUID: { "$uuid": "550e8400-e29b-41d4-a716-446655440000" }
    if (id.$uuid) return id.$uuid;

    // Binary (including UUID subtype): { "$binary": { "base64": "...", "subType": "04" } }
    if (id.$binary) {
      const subType = id.$binary.subType;
      // SubType 03 = UUID (old), 04 = UUID (new)
      if (subType === '03' || subType === '04' || subType === 3 || subType === 4) {
        return binaryToUuid(id.$binary.base64);
      }
      // For other binary types, use base64 as identifier
      return id.$binary.base64 || JSON.stringify(id);
    }

    // NumberLong: { "$numberLong": "12345" }
    if (id.$numberLong) return id.$numberLong;

    // Fallback: stringify the object
    return JSON.stringify(id);
  }

  return String(id);
}

/**
 * Convert base64 binary to UUID string
 */
function binaryToUuid(base64: string): string {
  try {
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    if (bytes.length !== 16) {
      return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    }

    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  } catch {
    return base64;
  }
}

/**
 * Parse Cosmos DB error and return user-friendly message
 */
function parseCosmosError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  // Check for NotFound errors
  if (message.includes('"code":"NotFound"') || message.includes('Owner resource does not exist')) {
    return 'Container or database no longer exists. Please refresh the database tree and try again.';
  }

  // Check for Unauthorized errors
  if (message.includes('"code":"Unauthorized"') || message.includes('401')) {
    return 'Authentication failed. Please check your connection credentials.';
  }

  // Check for Forbidden errors
  if (message.includes('"code":"Forbidden"') || message.includes('403')) {
    return 'Access denied. You may not have permission to access this resource.';
  }

  // Check for syntax errors
  if (message.includes('Syntax error')) {
    const syntaxMatch = message.match(/Syntax error[^"]+/);
    return syntaxMatch ? syntaxMatch[0] : 'Query syntax error. Please check your query.';
  }

  // Check for timeout
  if (message.includes('timeout') || message.includes('RequestTimeout')) {
    return 'Request timed out. Try reducing the query scope or check your connection.';
  }

  // Check for connection errors
  if (message.includes('ECONNREFUSED') || message.includes('ENOTFOUND')) {
    return 'Connection failed. Please check your network and connection settings.';
  }

  // Return truncated message if too long
  if (message.length > 200) {
    return message.substring(0, 200) + '...';
  }

  return message || 'Query execution failed';
}

export interface TabQueryState {
  query: string;
  documents: CosmosDocument[];
  columns: ColumnDefinition[];
  continuationToken: string | null;
  hasMoreResults: boolean;
  totalCount: number | null;
  isExecuting: boolean;
  isLoadingMore: boolean;
  error: string | null;
  executionTime: number | null;
  requestCharge: number | null;
  pendingDeletes: Set<string>; // Composite keys (id::partitionKeyValue) marked for deletion
  partitionKeyPath: string | null; // Partition key path for this container
}

export interface QueryState {
  tabStates: Record<string, TabQueryState>;
  activeTabId: string | null;
}

const createInitialTabState = (query = 'SELECT * FROM c'): TabQueryState => ({
  query,
  documents: [],
  columns: [],
  continuationToken: null,
  hasMoreResults: false,
  totalCount: null,
  isExecuting: false,
  isLoadingMore: false,
  error: null,
  executionTime: null,
  requestCharge: null,
  pendingDeletes: new Set(),
  partitionKeyPath: null,
});

const initialState: QueryState = {
  tabStates: {},
  activeTabId: null,
};

export const QueryStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    // Get the active tab's state
    activeTabState: computed(() => {
      const tabId = store.activeTabId();
      if (!tabId) return null;
      return store.tabStates()[tabId] ?? null;
    }),

    // Convenience accessors for active tab
    query: computed(() => {
      const tabId = store.activeTabId();
      if (!tabId) return '';
      return store.tabStates()[tabId]?.query ?? '';
    }),
    documents: computed(() => {
      const tabId = store.activeTabId();
      if (!tabId) return [];
      return store.tabStates()[tabId]?.documents ?? [];
    }),
    columns: computed(() => {
      const tabId = store.activeTabId();
      if (!tabId) return [];
      return store.tabStates()[tabId]?.columns ?? [];
    }),
    isExecuting: computed(() => {
      const tabId = store.activeTabId();
      if (!tabId) return false;
      return store.tabStates()[tabId]?.isExecuting ?? false;
    }),
    isLoadingMore: computed(() => {
      const tabId = store.activeTabId();
      if (!tabId) return false;
      return store.tabStates()[tabId]?.isLoadingMore ?? false;
    }),
    hasMoreResults: computed(() => {
      const tabId = store.activeTabId();
      if (!tabId) return false;
      return store.tabStates()[tabId]?.hasMoreResults ?? false;
    }),
    continuationToken: computed(() => {
      const tabId = store.activeTabId();
      if (!tabId) return null;
      return store.tabStates()[tabId]?.continuationToken ?? null;
    }),
    error: computed(() => {
      const tabId = store.activeTabId();
      if (!tabId) return null;
      return store.tabStates()[tabId]?.error ?? null;
    }),
    executionTime: computed(() => {
      const tabId = store.activeTabId();
      if (!tabId) return null;
      return store.tabStates()[tabId]?.executionTime ?? null;
    }),
    requestCharge: computed(() => {
      const tabId = store.activeTabId();
      if (!tabId) return null;
      return store.tabStates()[tabId]?.requestCharge ?? null;
    }),
    documentCount: computed(() => {
      const tabId = store.activeTabId();
      if (!tabId) return 0;
      return store.tabStates()[tabId]?.documents?.length ?? 0;
    }),
    hasDocuments: computed(() => {
      const tabId = store.activeTabId();
      if (!tabId) return false;
      return (store.tabStates()[tabId]?.documents?.length ?? 0) > 0;
    }),
    canLoadMore: computed(() => {
      const tabId = store.activeTabId();
      if (!tabId) return false;
      const state = store.tabStates()[tabId];
      return state?.hasMoreResults && !state?.isLoadingMore;
    }),
    pendingDeletes: computed(() => {
      const tabId = store.activeTabId();
      if (!tabId) return new Set<string>();
      return store.tabStates()[tabId]?.pendingDeletes ?? new Set<string>();
    }),
    pendingDeleteCount: computed(() => {
      const tabId = store.activeTabId();
      if (!tabId) return 0;
      return store.tabStates()[tabId]?.pendingDeletes?.size ?? 0;
    }),
  })),
  withMethods((store) => {
    const electronService = inject(ElectronService);
    const notificationService = inject(NotificationService);

    // Map of DiffTrackers per tab
    const diffTrackers = new Map<string, DiffTracker>();

    const getDiffTracker = (tabId: string): DiffTracker => {
      if (!diffTrackers.has(tabId)) {
        diffTrackers.set(tabId, new DiffTracker());
      }
      return diffTrackers.get(tabId)!;
    };

    const getActiveConnectionId = (): string | null => {
      return sessionStorage.getItem('activeConnectionId');
    };

    const updateTabState = (
      tabId: string,
      updates: Partial<TabQueryState>
    ) => {
      const current = store.tabStates()[tabId] ?? createInitialTabState();
      patchState(store, {
        tabStates: {
          ...store.tabStates(),
          [tabId]: { ...current, ...updates },
        },
      });
    };

    return {
      // Tab management
      initializeTab(tabId: string, query = 'SELECT * FROM c') {
        if (!store.tabStates()[tabId]) {
          patchState(store, {
            tabStates: {
              ...store.tabStates(),
              [tabId]: createInitialTabState(query),
            },
          });
        }
      },

      setActiveTab(tabId: string | null) {
        patchState(store, { activeTabId: tabId });
      },

      removeTab(tabId: string) {
        const { [tabId]: _, ...remaining } = store.tabStates();
        diffTrackers.delete(tabId);
        patchState(store, { tabStates: remaining });
      },

      getTabQuery(tabId: string): string {
        return store.tabStates()[tabId]?.query ?? 'SELECT * FROM c';
      },

      setQuery(query: string) {
        const tabId = store.activeTabId();
        if (!tabId) return;
        updateTabState(tabId, { query });
      },

      setTabQuery(tabId: string, query: string) {
        updateTabState(tabId, { query });
      },

      async executeQuery(container: ContainerInfo) {
        const tabId = store.activeTabId();
        if (!tabId) return;
        await this.executeTabQuery(tabId, container);
      },

      async executeTabQuery(tabId: string, container: ContainerInfo) {
        const connectionId = getActiveConnectionId();
        if (!connectionId) {
          updateTabState(tabId, { error: 'No active connection' });
          return;
        }

        const diffTracker = getDiffTracker(tabId);
        const tabState = store.tabStates()[tabId];
        const query = tabState?.query ?? 'SELECT * FROM c';

        // Store partition key path and set it on the tracker
        // partitionKeyPath can be comma-separated for composite keys (e.g., "/tenant,/user")
        const partitionKeyPath = container.partitionKeyPath;
        const partitionKeyPaths = partitionKeyPath
          ? partitionKeyPath.split(',').map(p => p.trim())
          : [];
        diffTracker.setPartitionKeyPath(partitionKeyPaths.length > 0 ? partitionKeyPaths : null);

        updateTabState(tabId, {
          isExecuting: true,
          error: null,
          documents: [],
          columns: [],
          continuationToken: null,
          hasMoreResults: false,
          executionTime: null,
          requestCharge: null,
          pendingDeletes: new Set(), // Clear pending deletes on new query
          partitionKeyPath,
        });

        diffTracker.clear();
        const startTime = performance.now();

        try {
          const result = await electronService.executeQuery({
            connectionId,
            databaseId: container.databaseId,
            containerId: container.id,
            query,
            pageSize: 100,
          });

          const executionTime = Math.round(performance.now() - startTime);
          const documents = normalizeQueryDocuments(result.documents);
          const columns = detectColumns(documents, partitionKeyPath);

          documents.forEach((doc) => diffTracker.trackDocument(doc));

          updateTabState(tabId, {
            documents,
            columns,
            continuationToken: result.continuationToken ?? null,
            hasMoreResults: result.hasMoreResults,
            totalCount: result.totalCount ?? null,
            isExecuting: false,
            executionTime,
            requestCharge: result.requestCharge ?? null,
          });
        } catch (error) {
          const message = parseCosmosError(error);
          updateTabState(tabId, {
            error: message,
            isExecuting: false,
          });
          notificationService.error(message);
        }
      },

      async loadMoreResults(container: ContainerInfo) {
        const tabId = store.activeTabId();
        if (!tabId) return;

        const connectionId = getActiveConnectionId();
        const tabState = store.tabStates()[tabId];
        const token = tabState?.continuationToken;
        if (!connectionId || !token) return;

        const diffTracker = getDiffTracker(tabId);

        updateTabState(tabId, { isLoadingMore: true });

        try {
          const result = await electronService.executeQuery({
            connectionId,
            databaseId: container.databaseId,
            containerId: container.id,
            query: tabState.query,
            continuationToken: token,
            pageSize: 100,
          });

          const newDocuments = normalizeQueryDocuments(result.documents);
          newDocuments.forEach((doc) => diffTracker.trackDocument(doc));

          const allDocuments = [...(tabState.documents ?? []), ...newDocuments];
          const columns = detectColumns(allDocuments, container.partitionKeyPath);

          updateTabState(tabId, {
            documents: allDocuments,
            columns,
            continuationToken: result.continuationToken ?? null,
            hasMoreResults: result.hasMoreResults,
            isLoadingMore: false,
            requestCharge:
              (tabState.requestCharge ?? 0) + (result.requestCharge ?? 0),
          });
        } catch (error) {
          const message = parseCosmosError(error);
          updateTabState(tabId, { isLoadingMore: false });
          notificationService.error(message);
        }
      },

      /**
       * Execute a partial aggregation pipeline (for stage-by-stage preview)
       */
      async executePartialPipeline(
        container: ContainerInfo,
        connectionId: string,
        partialPipelineJson: string
      ): Promise<{ documents: CosmosDocument[] }> {
        const result = await electronService.executeQuery({
          connectionId,
          databaseId: container.databaseId,
          containerId: container.id,
          query: partialPipelineJson,
          pageSize: 10, // Limit preview to 10 docs
        });

        return { documents: normalizeQueryDocuments(result.documents) };
      },

      updateDocumentField(doc: CosmosDocument, path: string, value: any) {
        const tabId = store.activeTabId();
        if (!tabId) return;

        const diffTracker = getDiffTracker(tabId);
        const tabState = store.tabStates()[tabId];
        const documentKey = diffTracker.getDocumentKey(doc);

        diffTracker.updateField(doc, path, value);

        const documents = (tabState?.documents ?? []).map((d) => {
          if (diffTracker.getDocumentKey(d) === documentKey) {
            return diffTracker.getModifiedDocument(d) ?? d;
          }
          return d;
        });

        updateTabState(tabId, { documents });
      },

      isFieldDirty(doc: CosmosDocument, path: string): boolean {
        const tabId = store.activeTabId();
        if (!tabId) return false;
        return getDiffTracker(tabId).isFieldDirty(doc, path);
      },

      isDocumentDirty(doc: CosmosDocument): boolean {
        const tabId = store.activeTabId();
        if (!tabId) return false;
        return getDiffTracker(tabId).isDocumentDirty(doc);
      },

      getDocumentChanges(doc: CosmosDocument): DocumentChange[] {
        const tabId = store.activeTabId();
        if (!tabId) return [];
        return getDiffTracker(tabId).getDocumentChanges(doc);
      },

      getDirtyDocumentCount(): number {
        const tabId = store.activeTabId();
        if (!tabId) return 0;
        const dirtyCount = getDiffTracker(tabId).getDirtyCount();
        const deleteCount = store.tabStates()[tabId]?.pendingDeletes?.size ?? 0;
        return dirtyCount + deleteCount;
      },

      getAllDirtyDocuments() {
        const tabId = store.activeTabId();
        if (!tabId) return [];
        return getDiffTracker(tabId).getAllDirtyDocuments();
      },

      getDocumentKey(doc: CosmosDocument): string {
        const tabId = store.activeTabId();
        if (!tabId) return getDocId(doc);
        return getDiffTracker(tabId).getDocumentKey(doc);
      },

      discardChanges(doc: CosmosDocument) {
        const tabId = store.activeTabId();
        if (!tabId) return;

        const diffTracker = getDiffTracker(tabId);
        const tabState = store.tabStates()[tabId];
        const documentKey = diffTracker.getDocumentKey(doc);

        diffTracker.discardChanges(doc);
        const original = diffTracker.getModifiedDocument(doc);
        if (original) {
          const documents = (tabState?.documents ?? []).map((d) => {
            if (diffTracker.getDocumentKey(d) === documentKey) {
              return original;
            }
            return d;
          });
          updateTabState(tabId, { documents });
        }
      },

      discardAllChanges() {
        const tabId = store.activeTabId();
        if (!tabId) return;

        const diffTracker = getDiffTracker(tabId);
        const tabState = store.tabStates()[tabId];

        diffTracker.discardAllChanges();
        const documents = (tabState?.documents ?? []).map((doc) => {
          return diffTracker.getModifiedDocument(doc) ?? doc;
        });
        // Also clear pending deletes
        updateTabState(tabId, { documents, pendingDeletes: new Set() });
      },

      // Mark documents for deletion (soft delete) using composite keys
      markForDeletion(documents: CosmosDocument[]) {
        const tabId = store.activeTabId();
        if (!tabId) return;

        const tabState = store.tabStates()[tabId];
        const partitionKeyPath = tabState?.partitionKeyPath ?? null;
        const currentDeletes = new Set(tabState?.pendingDeletes ?? []);

        documents.forEach(doc => {
          const pkValue = extractPartitionKeyValue(doc, partitionKeyPath ?? undefined);
          const key = createDocumentKey(getDocId(doc), pkValue);
          currentDeletes.add(key);
        });

        updateTabState(tabId, { pendingDeletes: currentDeletes });
      },

      // Unmark documents for deletion
      unmarkForDeletion(documents: CosmosDocument[]) {
        const tabId = store.activeTabId();
        if (!tabId) return;

        const tabState = store.tabStates()[tabId];
        const partitionKeyPath = tabState?.partitionKeyPath ?? null;
        const currentDeletes = new Set(tabState?.pendingDeletes ?? []);

        documents.forEach(doc => {
          const pkValue = extractPartitionKeyValue(doc, partitionKeyPath ?? undefined);
          const key = createDocumentKey(getDocId(doc), pkValue);
          currentDeletes.delete(key);
        });

        updateTabState(tabId, { pendingDeletes: currentDeletes });
      },

      // Check if a document is marked for deletion
      isMarkedForDeletion(doc: CosmosDocument): boolean {
        const tabId = store.activeTabId();
        if (!tabId) return false;

        const tabState = store.tabStates()[tabId];
        const partitionKeyPath = tabState?.partitionKeyPath ?? null;
        const pkValue = extractPartitionKeyValue(doc, partitionKeyPath ?? undefined);
        const key = createDocumentKey(getDocId(doc), pkValue);

        return tabState?.pendingDeletes?.has(key) ?? false;
      },

      // Get all document keys marked for deletion
      getDocumentsMarkedForDeletion(): string[] {
        const tabId = store.activeTabId();
        if (!tabId) return [];
        return Array.from(store.tabStates()[tabId]?.pendingDeletes ?? []);
      },

      async saveDocument(container: ContainerInfo, doc: CosmosDocument) {
        const tabId = store.activeTabId();
        if (!tabId) return;

        const connectionId = getActiveConnectionId();
        if (!connectionId) return;

        const diffTracker = getDiffTracker(tabId);
        const documentKey = diffTracker.getDocumentKey(doc);
        const modifiedDoc = diffTracker.getModifiedDocument(doc);
        if (!modifiedDoc) return;

        try {
          const partitionKey = getPartitionKeyValue(
            modifiedDoc,
            container.partitionKeyPath
          );

          const updated = await electronService.updateDocument({
            connectionId,
            databaseId: container.databaseId,
            containerId: container.id,
            document: modifiedDoc,
            partitionKey,
          });

          diffTracker.commitChanges(doc, updated);

          const tabState = store.tabStates()[tabId];
          const documents = (tabState?.documents ?? []).map((d) => {
            if (diffTracker.getDocumentKey(d) === documentKey) {
              return updated;
            }
            return d;
          });

          updateTabState(tabId, { documents });
          notificationService.success('Document saved successfully');
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Failed to save document';
          notificationService.error(message);
          throw error;
        }
      },

      async saveAllChanges(container: ContainerInfo) {
        const tabId = store.activeTabId();
        if (!tabId) return;

        const diffTracker = getDiffTracker(tabId);
        const tabState = store.tabStates()[tabId];
        const dirtyDocs = diffTracker.getAllDirtyDocuments();
        const pendingDeleteKeys = new Set(tabState?.pendingDeletes ?? []);
        const partitionKeyPath = tabState?.partitionKeyPath ?? null;
        const documents = tabState?.documents ?? [];

        let savedCount = 0;
        let deletedCount = 0;
        let errorCount = 0;

        // Save modified documents (skip those marked for deletion)
        for (const dirty of dirtyDocs) {
          const pkValue = extractPartitionKeyValue(dirty.modified, partitionKeyPath ?? undefined);
          const key = createDocumentKey(getDocId(dirty.modified), pkValue);
          if (pendingDeleteKeys.has(key)) continue;
          try {
            await this.saveDocument(container, dirty.modified);
            savedCount++;
          } catch {
            errorCount++;
          }
        }

        // Delete documents marked for deletion
        // Find actual documents from the keys
        for (const doc of documents) {
          const pkValue = extractPartitionKeyValue(doc, partitionKeyPath ?? undefined);
          const key = createDocumentKey(getDocId(doc), pkValue);
          if (pendingDeleteKeys.has(key)) {
            try {
              await this.deleteDocument(container, doc);
              deletedCount++;
            } catch {
              errorCount++;
            }
          }
        }

        // Clear pending deletes after processing
        updateTabState(tabId, { pendingDeletes: new Set() });

        // Show appropriate notification
        const actions: string[] = [];
        if (savedCount > 0) actions.push(`saved ${savedCount}`);
        if (deletedCount > 0) actions.push(`deleted ${deletedCount}`);

        if (errorCount === 0 && actions.length > 0) {
          notificationService.success(`Successfully ${actions.join(', ')} document(s)`);
        } else if (errorCount > 0) {
          notificationService.warn(
            `${actions.join(', ')}, failed ${errorCount} document(s)`
          );
        }
      },

      async deleteDocument(container: ContainerInfo, doc: CosmosDocument) {
        const tabId = store.activeTabId();
        if (!tabId) return;

        const connectionId = getActiveConnectionId();
        if (!connectionId) return;

        const diffTracker = getDiffTracker(tabId);
        const tabState = store.tabStates()[tabId];
        const documentKey = diffTracker.getDocumentKey(doc);
        const documentId = getDocId(doc);

        try {
          const partitionKey = getPartitionKeyValue(
            doc,
            container.partitionKeyPath
          );

          await electronService.deleteDocument({
            connectionId,
            databaseId: container.databaseId,
            containerId: container.id,
            documentId,
            partitionKey,
          });

          diffTracker.untrackDocument(doc);

          const documents = (tabState?.documents ?? []).filter(
            (d) => diffTracker.getDocumentKey(d) !== documentKey
          );
          const columns = detectColumns(documents, container.partitionKeyPath);

          updateTabState(tabId, { documents, columns });
          notificationService.success('Document deleted');
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : 'Failed to delete document';
          notificationService.error(message);
          throw error;
        }
      },

      async upsertDocument(container: ContainerInfo, document: CosmosDocument) {
        const tabId = store.activeTabId();
        if (!tabId) return;

        const connectionId = getActiveConnectionId();
        if (!connectionId) return;

        const diffTracker = getDiffTracker(tabId);
        const tabState = store.tabStates()[tabId];

        try {
          const upserted = await electronService.upsertDocument({
            connectionId,
            databaseId: container.databaseId,
            containerId: container.id,
            document,
          });

          diffTracker.trackDocument(upserted);

          const docId = getDocId(upserted);
          const existing = (tabState?.documents ?? []).filter(d => getDocId(d) !== docId);
          const documents = [upserted, ...existing];
          const columns = detectColumns(documents, container.partitionKeyPath);

          updateTabState(tabId, { documents, columns });
          return upserted;
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : 'Failed to upsert document';
          notificationService.error(message);
          throw error;
        }
      },

      async createDocument(container: ContainerInfo, document: CosmosDocument) {
        const tabId = store.activeTabId();
        if (!tabId) return;

        const connectionId = getActiveConnectionId();
        if (!connectionId) return;

        const diffTracker = getDiffTracker(tabId);
        const tabState = store.tabStates()[tabId];

        try {
          const created = await electronService.createDocument({
            connectionId,
            databaseId: container.databaseId,
            containerId: container.id,
            document,
          });

          diffTracker.trackDocument(created);

          const documents = [created, ...(tabState?.documents ?? [])];
          const columns = detectColumns(documents, container.partitionKeyPath);

          updateTabState(tabId, { documents, columns });
          notificationService.success('Document created');
          return created;
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : 'Failed to create document';
          notificationService.error(message);
          throw error;
        }
      },

      reset() {
        diffTrackers.clear();
        patchState(store, initialState);
      },
    };
  })
);

/**
 * Extract partition key value(s) from a document.
 * For hierarchical partition keys (comma-separated paths), returns an array of values.
 * For single partition keys, returns the single value.
 */
function getPartitionKeyValue(doc: CosmosDocument, partitionKeyPath: string): any {
  // Check if this is a hierarchical partition key (comma-separated)
  const paths = partitionKeyPath.split(',').map(p => p.trim());

  if (paths.length > 1) {
    // Hierarchical partition key - return array of values
    return paths.map(pathStr => {
      const path = pathStr.startsWith('/') ? pathStr.slice(1) : pathStr;
      const segments = path.split('/');
      let value: any = doc;
      for (const segment of segments) {
        if (value === null || value === undefined) return undefined;
        value = value[segment];
      }
      return value;
    });
  }

  // Single partition key
  const path = partitionKeyPath.startsWith('/')
    ? partitionKeyPath.slice(1)
    : partitionKeyPath;
  const segments = path.split('/');

  let value: any = doc;
  for (const segment of segments) {
    if (value === null || value === undefined) return undefined;
    value = value[segment];
  }

  return value;
}
