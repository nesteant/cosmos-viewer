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
  DatabaseConnection,
} from '@core/models';
import { ElectronService, NotificationService } from '@core/services';
import { getDefaultQueryForProvider } from '@core/utils/query-utils';

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
  // Active connection (for reactive filtering)
  activeConnectionId: string | null;
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
  activeConnectionId: null,
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

    // Get tabs filtered by current active connection
    connectionTabs: computed(() => {
      const connectionId = store.activeConnectionId();
      if (!connectionId) return [];
      return store.tabs().filter((t) => t.connectionId === connectionId);
    }),

    // Check if there are tabs for the current connection
    hasConnectionTabs: computed(() => {
      const connectionId = store.activeConnectionId();
      if (!connectionId) return false;
      return store.tabs().some((t) => t.connectionId === connectionId);
    }),

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
      return store.activeConnectionId() ?? sessionStorage.getItem('activeConnectionId');
    };

    const generateTabId = (): string => {
      return `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    };

    return {
      setActiveConnection(connectionId: string | null) {
        patchState(store, { activeConnectionId: connectionId });
        if (connectionId) {
          sessionStorage.setItem('activeConnectionId', connectionId);
        } else {
          sessionStorage.removeItem('activeConnectionId');
        }
      },

      async loadDatabases() {
        const connectionId = getActiveConnectionId();
        if (!connectionId) {
          patchState(store, { error: 'No active connection' });
          return;
        }

        // Clear containers and expanded nodes when reloading databases
        patchState(store, {
          isLoadingDatabases: true,
          error: null,
          containers: new Map(),
          expandedNodes: new Set(),
        });
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
      openTab(container: ContainerInfo, query?: string, connections?: DatabaseConnection[]): string {
        const connectionId = sessionStorage.getItem('activeConnectionId') ?? '';

        // Determine default query based on provider type
        const connection = connections?.find(c => c.id === connectionId);
        const defaultQuery = query ?? getDefaultQueryForProvider(connection?.providerType ?? 'cosmos-sql');

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
          query: defaultQuery,
        };

        patchState(store, {
          tabs: [...store.tabs(), newTab],
          activeTabId: tabId,
        });

        return tabId;
      },

      closeTab(tabId: string) {
        const tabs = store.tabs();
        const closingTab = tabs.find((t) => t.id === tabId);
        if (!closingTab) return;

        const connectionId = closingTab.connectionId;
        const newTabs = tabs.filter((t) => t.id !== tabId);

        // Filter to only tabs for the same connection
        const connectionTabs = newTabs.filter((t) => t.connectionId === connectionId);
        const oldConnectionTabs = tabs.filter((t) => t.connectionId === connectionId);
        const tabIndexInConnection = oldConnectionTabs.findIndex((t) => t.id === tabId);

        // If closing active tab, activate adjacent tab from same connection
        let newActiveTabId = store.activeTabId();
        if (newActiveTabId === tabId) {
          if (connectionTabs.length === 0) {
            newActiveTabId = null;
          } else if (tabIndexInConnection >= connectionTabs.length) {
            newActiveTabId = connectionTabs[connectionTabs.length - 1].id;
          } else {
            newActiveTabId = connectionTabs[Math.max(0, tabIndexInConnection)].id;
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

      // Sync active tab to current connection (call after connection changes)
      syncActiveTabToConnection() {
        const connectionId = getActiveConnectionId();
        if (!connectionId) return;

        const currentActiveTab = store.tabs().find((t) => t.id === store.activeTabId());

        // If current active tab is for a different connection, switch to first tab of current connection
        if (!currentActiveTab || currentActiveTab.connectionId !== connectionId) {
          const connectionTab = store.tabs().find((t) => t.connectionId === connectionId);
          patchState(store, { activeTabId: connectionTab?.id ?? null });
        }
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

      // Reset only tree state, preserve tabs
      resetTreeState() {
        patchState(store, {
          databases: [],
          containers: new Map(),
          expandedNodes: new Set(),
          isLoadingDatabases: false,
          isLoadingContainers: false,
          error: null,
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
