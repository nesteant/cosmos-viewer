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
  QueryResult,
  ColumnDefinition,
  ContainerInfo,
} from '@core/models';
import { ElectronService, NotificationService } from '@core/services';
import { detectColumns } from '@core/utils';
import { DiffTracker, DocumentChange } from '@core/utils/diff-tracker';

export interface QueryState {
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
}

const initialState: QueryState = {
  query: 'SELECT * FROM c',
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
};

export const QueryStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    documentCount: computed(() => store.documents().length),
    hasDocuments: computed(() => store.documents().length > 0),
    canLoadMore: computed(
      () => store.hasMoreResults() && !store.isLoadingMore()
    ),
  })),
  withMethods((store) => {
    const electronService = inject(ElectronService);
    const notificationService = inject(NotificationService);
    const diffTracker = new DiffTracker();

    const getActiveConnectionId = (): string | null => {
      return sessionStorage.getItem('activeConnectionId');
    };

    return {
      setQuery(query: string) {
        patchState(store, { query });
      },

      async executeQuery(container: ContainerInfo) {
        const connectionId = getActiveConnectionId();
        if (!connectionId) {
          patchState(store, { error: 'No active connection' });
          return;
        }

        patchState(store, {
          isExecuting: true,
          error: null,
          documents: [],
          columns: [],
          continuationToken: null,
          hasMoreResults: false,
          executionTime: null,
          requestCharge: null,
        });

        diffTracker.clear();
        const startTime = performance.now();

        try {
          const result = await electronService.executeQuery({
            connectionId,
            databaseId: container.databaseId,
            containerId: container.id,
            query: store.query(),
            pageSize: 100,
          });

          const executionTime = Math.round(performance.now() - startTime);
          const columns = detectColumns(result.documents);

          // Track all documents for dirty state
          result.documents.forEach((doc) => diffTracker.trackDocument(doc));

          patchState(store, {
            documents: result.documents,
            columns,
            continuationToken: result.continuationToken ?? null,
            hasMoreResults: result.hasMoreResults,
            totalCount: result.totalCount ?? null,
            isExecuting: false,
            executionTime,
            requestCharge: result.requestCharge ?? null,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Query execution failed';
          patchState(store, {
            error: message,
            isExecuting: false,
          });
          notificationService.error(message);
        }
      },

      async loadMoreResults(container: ContainerInfo) {
        const connectionId = getActiveConnectionId();
        const token = store.continuationToken();
        if (!connectionId || !token) return;

        patchState(store, { isLoadingMore: true });

        try {
          const result = await electronService.executeQuery({
            connectionId,
            databaseId: container.databaseId,
            containerId: container.id,
            query: store.query(),
            continuationToken: token,
            pageSize: 100,
          });

          // Track new documents
          result.documents.forEach((doc) => diffTracker.trackDocument(doc));

          const allDocuments = [...store.documents(), ...result.documents];
          const columns = detectColumns(allDocuments);

          patchState(store, {
            documents: allDocuments,
            columns,
            continuationToken: result.continuationToken ?? null,
            hasMoreResults: result.hasMoreResults,
            isLoadingMore: false,
            requestCharge:
              (store.requestCharge() ?? 0) + (result.requestCharge ?? 0),
          });
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : 'Failed to load more results';
          patchState(store, { isLoadingMore: false });
          notificationService.error(message);
        }
      },

      updateDocumentField(documentId: string, path: string, value: any) {
        diffTracker.updateField(documentId, path, value);

        // Update the document in state
        const documents = store.documents().map((doc) => {
          if (doc.id === documentId) {
            return diffTracker.getModifiedDocument(documentId) ?? doc;
          }
          return doc;
        });

        patchState(store, { documents });
      },

      isFieldDirty(documentId: string, path: string): boolean {
        return diffTracker.isFieldDirty(documentId, path);
      },

      isDocumentDirty(documentId: string): boolean {
        return diffTracker.isDocumentDirty(documentId);
      },

      getDocumentChanges(documentId: string): DocumentChange[] {
        return diffTracker.getDocumentChanges(documentId);
      },

      getDirtyDocumentCount(): number {
        return diffTracker.getDirtyCount();
      },

      getAllDirtyDocuments() {
        return diffTracker.getAllDirtyDocuments();
      },

      discardChanges(documentId: string) {
        diffTracker.discardChanges(documentId);
        const original = diffTracker.getModifiedDocument(documentId);
        if (original) {
          const documents = store.documents().map((doc) => {
            if (doc.id === documentId) {
              return original;
            }
            return doc;
          });
          patchState(store, { documents });
        }
      },

      discardAllChanges() {
        diffTracker.discardAllChanges();
        // Reload original documents
        const documents = store.documents().map((doc) => {
          return diffTracker.getModifiedDocument(doc.id) ?? doc;
        });
        patchState(store, { documents });
      },

      async saveDocument(container: ContainerInfo, documentId: string) {
        const connectionId = getActiveConnectionId();
        if (!connectionId) return;

        const modifiedDoc = diffTracker.getModifiedDocument(documentId);
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

          diffTracker.commitChanges(documentId, updated);

          const documents = store.documents().map((doc) => {
            if (doc.id === documentId) {
              return updated;
            }
            return doc;
          });

          patchState(store, { documents });
          notificationService.success('Document saved successfully');
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Failed to save document';
          notificationService.error(message);
          throw error;
        }
      },

      async saveAllChanges(container: ContainerInfo) {
        const dirtyDocs = diffTracker.getAllDirtyDocuments();
        let savedCount = 0;
        let errorCount = 0;

        for (const dirty of dirtyDocs) {
          try {
            await this.saveDocument(container, dirty.modified.id);
            savedCount++;
          } catch {
            errorCount++;
          }
        }

        if (errorCount === 0) {
          notificationService.success(`Saved ${savedCount} document(s)`);
        } else {
          notificationService.warn(
            `Saved ${savedCount}, failed ${errorCount} document(s)`
          );
        }
      },

      async deleteDocument(container: ContainerInfo, documentId: string) {
        const connectionId = getActiveConnectionId();
        if (!connectionId) return;

        const doc = store.documents().find((d) => d.id === documentId);
        if (!doc) return;

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

          diffTracker.untrackDocument(documentId);

          const documents = store.documents().filter((d) => d.id !== documentId);
          const columns = detectColumns(documents);

          patchState(store, { documents, columns });
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

      async createDocument(container: ContainerInfo, document: CosmosDocument) {
        const connectionId = getActiveConnectionId();
        if (!connectionId) return;

        try {
          const created = await electronService.createDocument({
            connectionId,
            databaseId: container.databaseId,
            containerId: container.id,
            document,
          });

          diffTracker.trackDocument(created);

          const documents = [created, ...store.documents()];
          const columns = detectColumns(documents);

          patchState(store, { documents, columns });
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
        diffTracker.clear();
        patchState(store, initialState);
      },
    };
  })
);

function getPartitionKeyValue(doc: CosmosDocument, partitionKeyPath: string): any {
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
