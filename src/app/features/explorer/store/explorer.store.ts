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
  TabState,
} from '@core/models';
import { ElectronService, NotificationService } from '@core/services';

export interface ExplorerState {
  databases: DatabaseInfo[];
  containers: Map<string, ContainerInfo[]>;
  expandedNodes: Set<string>;
  isLoadingDatabases: boolean;
  isLoadingContainers: boolean;
  error: string | null;
  // Tab state
  tabs: TabState[];
  activeTabId: string | null;
}

const initialState: ExplorerState = {
  databases: [],
  containers: new Map(),
  expandedNodes: new Set(),
  isLoadingDatabases: false,
  isLoadingContainers: false,
  error: null,
  tabs: [],
  activeTabId: null,
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

    // Get active tab
    activeTab: computed(() => {
      const tabId = store.activeTabId();
      if (!tabId) return null;
      return store.tabs().find((t) => t.id === tabId) ?? null;
    }),

    // Get selected container from active tab
    selectedContainer: computed((): ContainerInfo | null => {
      const tabId = store.activeTabId();
      if (!tabId) return null;
      const tab = store.tabs().find((t) => t.id === tabId);
      if (!tab) return null;

      // First try to find in containers map for full info
      const containers = store.containers().get(tab.databaseId);
      const found = containers?.find((c) => c.id === tab.containerId);
      if (found) return found;

      // Fallback: create ContainerInfo from tab state
      return {
        id: tab.containerId,
        name: tab.containerName,
        databaseId: tab.databaseId,
        partitionKeyPath: tab.partitionKeyPath || '/id',
      };
    }),

    hasSelection: computed(() => store.activeTabId() !== null),
    hasTabs: computed(() => store.tabs().length > 0),

    isLoading: computed(
      () => store.isLoadingDatabases() || store.isLoadingContainers()
    ),

    // Check if a container has an open tab
    getTabForContainer: computed(() => {
      const tabs = store.tabs();
      return (containerId: string) =>
        tabs.find((t) => t.containerId === containerId);
    }),
  })),
  withMethods((store) => {
    const electronService = inject(ElectronService);
    const notificationService = inject(NotificationService);

    const getActiveConnectionId = (): string | null => {
      return sessionStorage.getItem('activeConnectionId');
    };

    const generateTabId = (): string => {
      return `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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

      // Tab management methods
      openTab(container: ContainerInfo, query = 'SELECT * FROM c'): string {
        const connectionId = sessionStorage.getItem('activeConnectionId') ?? '';

        // Check if tab already exists for this container on this connection
        const existingTab = store
          .tabs()
          .find((t) => t.containerId === container.id && t.connectionId === connectionId);
        if (existingTab) {
          // Activate existing tab
          patchState(store, { activeTabId: existingTab.id });
          return existingTab.id;
        }

        // Create new tab
        const tabId = generateTabId();
        const newTab: TabState = {
          id: tabId,
          connectionId,
          containerId: container.id,
          containerName: container.name,
          databaseId: container.databaseId,
          partitionKeyPath: container.partitionKeyPath,
          query,
        };

        patchState(store, {
          tabs: [...store.tabs(), newTab],
          activeTabId: tabId,
        });

        return tabId;
      },

      closeTab(tabId: string) {
        const tabs = store.tabs();
        const tabIndex = tabs.findIndex((t) => t.id === tabId);
        if (tabIndex === -1) return;

        const newTabs = tabs.filter((t) => t.id !== tabId);

        // If closing active tab, activate adjacent tab
        let newActiveTabId = store.activeTabId();
        if (newActiveTabId === tabId) {
          if (newTabs.length === 0) {
            newActiveTabId = null;
          } else if (tabIndex >= newTabs.length) {
            newActiveTabId = newTabs[newTabs.length - 1].id;
          } else {
            newActiveTabId = newTabs[tabIndex].id;
          }
        }

        patchState(store, {
          tabs: newTabs,
          activeTabId: newActiveTabId,
        });
      },

      activateTab(tabId: string) {
        const tab = store.tabs().find((t) => t.id === tabId);
        if (tab) {
          patchState(store, { activeTabId: tabId });
        }
      },

      updateTabQuery(tabId: string, query: string) {
        const tabs = store.tabs().map((t) =>
          t.id === tabId ? { ...t, query } : t
        );
        patchState(store, { tabs });
      },

      // Load tabs from persistence
      setTabs(tabs: TabState[], activeTabId: string | null) {
        patchState(store, { tabs, activeTabId });
      },

      // For backwards compatibility
      selectContainer(container: ContainerInfo) {
        this.openTab(container);
      },

      clearSelection() {
        patchState(store, {
          activeTabId: null,
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
