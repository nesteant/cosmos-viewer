import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import {
  DatabaseInfo,
  ContainerInfo,
  TreeNode,
} from '@core/models';
import { ElectronService, NotificationService } from '@core/services';

export interface ExplorerState {
  databases: DatabaseInfo[];
  containers: Map<string, ContainerInfo[]>;
  expandedNodes: Set<string>;
  selectedDatabase: string | null;
  selectedContainer: ContainerInfo | null;
  isLoadingDatabases: boolean;
  isLoadingContainers: boolean;
  error: string | null;
}

const initialState: ExplorerState = {
  databases: [],
  containers: new Map(),
  expandedNodes: new Set(),
  selectedDatabase: null,
  selectedContainer: null,
  isLoadingDatabases: false,
  isLoadingContainers: false,
  error: null,
};

export const ExplorerStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    treeNodes: computed((): TreeNode[] => {
      return store.databases().map((db) => {
        const dbContainers = store.containers().get(db.id) ?? [];
        const isExpanded = store.expandedNodes().has(db.id);

        return {
          id: db.id,
          name: db.name,
          type: 'database' as const,
          children: isExpanded
            ? dbContainers.map((c) => ({
                id: c.id,
                name: c.name,
                type: 'container' as const,
                partitionKeyPath: c.partitionKeyPath,
                databaseId: db.id,
              }))
            : undefined,
        };
      });
    }),
    hasSelection: computed(() => store.selectedContainer() !== null),
    isLoading: computed(
      () => store.isLoadingDatabases() || store.isLoadingContainers()
    ),
  })),
  withMethods((store) => {
    const electronService = inject(ElectronService);
    const notificationService = inject(NotificationService);

    const getActiveConnectionId = (): string | null => {
      return sessionStorage.getItem('activeConnectionId');
    };

    return {
      async loadDatabases() {
        const connectionId = getActiveConnectionId();
        if (!connectionId) {
          patchState(store, { error: 'No active connection' });
          return;
        }

        patchState(store, { isLoadingDatabases: true, error: null });
        try {
          const databases = await electronService.listDatabases(connectionId);
          patchState(store, {
            databases,
            isLoadingDatabases: false,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Failed to load databases';
          patchState(store, { error: message, isLoadingDatabases: false });
          notificationService.error(message);
        }
      },

      async loadContainers(databaseId: string) {
        const connectionId = getActiveConnectionId();
        if (!connectionId) return;

        patchState(store, { isLoadingContainers: true });
        try {
          const containers = await electronService.listContainers(
            connectionId,
            databaseId
          );
          const updatedContainers = new Map(store.containers());
          updatedContainers.set(databaseId, containers);
          patchState(store, {
            containers: updatedContainers,
            isLoadingContainers: false,
          });
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : 'Failed to load containers';
          patchState(store, { isLoadingContainers: false });
          notificationService.error(message);
        }
      },

      async toggleNode(nodeId: string, isDatabase: boolean) {
        const expanded = new Set(store.expandedNodes());

        if (expanded.has(nodeId)) {
          expanded.delete(nodeId);
        } else {
          expanded.add(nodeId);
          // Load containers if expanding a database
          if (isDatabase && !store.containers().has(nodeId)) {
            const connectionId = getActiveConnectionId();
            if (connectionId) {
              patchState(store, { isLoadingContainers: true });
              try {
                const containers = await electronService.listContainers(
                  connectionId,
                  nodeId
                );
                const updatedContainers = new Map(store.containers());
                updatedContainers.set(nodeId, containers);
                patchState(store, {
                  containers: updatedContainers,
                  isLoadingContainers: false,
                });
              } catch (error) {
                patchState(store, { isLoadingContainers: false });
                const message =
                  error instanceof Error
                    ? error.message
                    : 'Failed to load containers';
                notificationService.error(message);
              }
            }
          }
        }

        patchState(store, { expandedNodes: expanded });
      },

      selectContainer(container: ContainerInfo) {
        patchState(store, {
          selectedDatabase: container.databaseId,
          selectedContainer: container,
        });
      },

      clearSelection() {
        patchState(store, {
          selectedDatabase: null,
          selectedContainer: null,
        });
      },

      reset() {
        patchState(store, {
          ...initialState,
          containers: new Map(),
          expandedNodes: new Set(),
        });
      },
    };
  })
);
