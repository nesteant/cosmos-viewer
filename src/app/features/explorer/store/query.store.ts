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
import { DiffTracker, DocumentChange } from '@core/utils/diff-tracker';

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
      if (!tabId) return 'SELECT * FROM c';
      return store.tabStates()[tabId]?.query ?? 'SELECT * FROM c';
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

        updateTabState(tabId, {
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
            query,
            pageSize: 100,
          });

          const executionTime = Math.round(performance.now() - startTime);
          const columns = detectColumns(result.documents);

          result.documents.forEach((doc) => diffTracker.trackDocument(doc));

          updateTabState(tabId, {
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

          result.documents.forEach((doc) => diffTracker.trackDocument(doc));

          const allDocuments = [...(tabState.documents ?? []), ...result.documents];
          const columns = detectColumns(allDocuments);

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
          const message =
            error instanceof Error
              ? error.message
              : 'Failed to load more results';
          updateTabState(tabId, { isLoadingMore: false });
          notificationService.error(message);
        }
      },

      updateDocumentField(documentId: string, path: string, value: any) {
        const tabId = store.activeTabId();
        if (!tabId) return;

        const diffTracker = getDiffTracker(tabId);
        const tabState = store.tabStates()[tabId];

        diffTracker.updateField(documentId, path, value);

        const documents = (tabState?.documents ?? []).map((doc) => {
          if (doc.id === documentId) {
            return diffTracker.getModifiedDocument(documentId) ?? doc;
          }
          return doc;
        });

        updateTabState(tabId, { documents });
      },

      isFieldDirty(documentId: string, path: string): boolean {
        const tabId = store.activeTabId();
        if (!tabId) return false;
        return getDiffTracker(tabId).isFieldDirty(documentId, path);
      },

      isDocumentDirty(documentId: string): boolean {
        const tabId = store.activeTabId();
        if (!tabId) return false;
        return getDiffTracker(tabId).isDocumentDirty(documentId);
      },

      getDocumentChanges(documentId: string): DocumentChange[] {
        const tabId = store.activeTabId();
        if (!tabId) return [];
        return getDiffTracker(tabId).getDocumentChanges(documentId);
      },

      getDirtyDocumentCount(): number {
        const tabId = store.activeTabId();
        if (!tabId) return 0;
        return getDiffTracker(tabId).getDirtyCount();
      },

      getAllDirtyDocuments() {
        const tabId = store.activeTabId();
        if (!tabId) return [];
        return getDiffTracker(tabId).getAllDirtyDocuments();
      },

      discardChanges(documentId: string) {
        const tabId = store.activeTabId();
        if (!tabId) return;

        const diffTracker = getDiffTracker(tabId);
        const tabState = store.tabStates()[tabId];

        diffTracker.discardChanges(documentId);
        const original = diffTracker.getModifiedDocument(documentId);
        if (original) {
          const documents = (tabState?.documents ?? []).map((doc) => {
            if (doc.id === documentId) {
              return original;
            }
            return doc;
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
          return diffTracker.getModifiedDocument(doc.id) ?? doc;
        });
        updateTabState(tabId, { documents });
      },

      async saveDocument(container: ContainerInfo, documentId: string) {
        const tabId = store.activeTabId();
        if (!tabId) return;

        const connectionId = getActiveConnectionId();
        if (!connectionId) return;

        const diffTracker = getDiffTracker(tabId);
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

          const tabState = store.tabStates()[tabId];
          const documents = (tabState?.documents ?? []).map((doc) => {
            if (doc.id === documentId) {
              return updated;
            }
            return doc;
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
        const tabId = store.activeTabId();
        if (!tabId) return;

        const connectionId = getActiveConnectionId();
        if (!connectionId) return;

        const diffTracker = getDiffTracker(tabId);
        const tabState = store.tabStates()[tabId];
        const doc = tabState?.documents?.find((d) => d.id === documentId);
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

          const documents = (tabState?.documents ?? []).filter(
            (d) => d.id !== documentId
          );
          const columns = detectColumns(documents);

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
          const columns = detectColumns(documents);

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
