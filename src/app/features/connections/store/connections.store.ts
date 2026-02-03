import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { DatabaseConnection, ConnectionTestResult, ProviderType, ProviderInfo } from '@core/models';
import { ElectronService, NotificationService } from '@core/services';
import { v4 as uuidv4 } from 'uuid';

export interface ConnectionsState {
  connections: DatabaseConnection[];
  providers: ProviderInfo[];
  selectedConnectionId: string | null;
  isLoading: boolean;
  isTesting: boolean;
  testResult: ConnectionTestResult | null;
  error: string | null;
}

const initialState: ConnectionsState = {
  connections: [],
  providers: [],
  selectedConnectionId: null,
  isLoading: false,
  isTesting: false,
  testResult: null,
  error: null,
};

export const ConnectionsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    selectedConnection: computed(() => {
      const id = store.selectedConnectionId();
      return store.connections().find((c) => c.id === id) ?? null;
    }),
    connectionCount: computed(() => store.connections().length),
    hasConnections: computed(() => store.connections().length > 0),
    sortedConnections: computed(() => {
      return [...store.connections()].sort((a, b) => {
        const aTime = a.lastUsedAt?.getTime() ?? a.createdAt.getTime();
        const bTime = b.lastUsedAt?.getTime() ?? b.createdAt.getTime();
        return bTime - aTime;
      });
    }),
    enabledProviders: computed(() => store.providers().filter(p => p.enabled)),
  })),
  withMethods((store) => {
    const electronService = inject(ElectronService);
    const notificationService = inject(NotificationService);

    return {
      async loadProviders() {
        try {
          const providers = await electronService.listProviders();
          patchState(store, { providers });
        } catch (error) {
          console.error('Failed to load providers:', error);
        }
      },

      async loadConnections() {
        patchState(store, { isLoading: true, error: null });
        try {
          const connections = await electronService.getConnections();
          patchState(store, { connections, isLoading: false });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Failed to load connections';
          patchState(store, { error: message, isLoading: false });
          notificationService.error(message);
        }
      },

      async testConnection(
        providerType: ProviderType,
        config: { endpoint?: string; key?: string; connectionString?: string }
      ) {
        patchState(store, { isTesting: true, testResult: null, error: null });
        try {
          const result = await electronService.testConnection(providerType, config);
          patchState(store, { testResult: result, isTesting: false });
          if (result.success) {
            notificationService.success(result.message ?? 'Connection successful!');
          } else {
            notificationService.error(result.message ?? 'Connection failed');
          }
          return result;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Connection test failed';
          patchState(store, {
            testResult: { success: false, message },
            isTesting: false,
          });
          notificationService.error(message);
          return { success: false, message };
        }
      },

      async saveConnection(
        connectionData: Omit<DatabaseConnection, 'id' | 'createdAt'>
      ) {
        patchState(store, { isLoading: true, error: null });
        try {
          const newConnection: DatabaseConnection = {
            ...connectionData,
            id: uuidv4(),
            createdAt: new Date(),
          };
          const updatedConnections = [...store.connections(), newConnection];
          await electronService.saveConnections(updatedConnections);
          patchState(store, {
            connections: updatedConnections,
            isLoading: false,
          });
          notificationService.success('Connection saved successfully');
          return newConnection;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Failed to save connection';
          patchState(store, { error: message, isLoading: false });
          notificationService.error(message);
          throw error;
        }
      },

      async updateConnection(connection: DatabaseConnection) {
        patchState(store, { isLoading: true, error: null });
        try {
          const updatedConnections = store
            .connections()
            .map((c) => (c.id === connection.id ? connection : c));
          await electronService.saveConnections(updatedConnections);
          patchState(store, {
            connections: updatedConnections,
            isLoading: false,
          });
          notificationService.success('Connection updated successfully');
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : 'Failed to update connection';
          patchState(store, { error: message, isLoading: false });
          notificationService.error(message);
          throw error;
        }
      },

      async deleteConnection(id: string) {
        patchState(store, { isLoading: true, error: null });
        try {
          const updatedConnections = store
            .connections()
            .filter((c) => c.id !== id);
          await electronService.saveConnections(updatedConnections);
          patchState(store, {
            connections: updatedConnections,
            selectedConnectionId:
              store.selectedConnectionId() === id
                ? null
                : store.selectedConnectionId(),
            isLoading: false,
          });
          notificationService.success('Connection deleted');
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : 'Failed to delete connection';
          patchState(store, { error: message, isLoading: false });
          notificationService.error(message);
          throw error;
        }
      },

      selectConnection(id: string | null) {
        patchState(store, { selectedConnectionId: id });
        if (id) {
          sessionStorage.setItem('activeConnectionId', id);
        } else {
          sessionStorage.removeItem('activeConnectionId');
        }
      },

      async connectAndNavigate(id: string) {
        const connection = store.connections().find((c) => c.id === id);
        if (!connection) return;

        const updatedConnection: DatabaseConnection = {
          ...connection,
          lastUsedAt: new Date(),
        };

        const updatedConnections = store
          .connections()
          .map((c) => (c.id === id ? updatedConnection : c));

        try {
          await electronService.saveConnections(updatedConnections);
          patchState(store, {
            connections: updatedConnections,
            selectedConnectionId: id,
          });
          sessionStorage.setItem('activeConnectionId', id);
          return true;
        } catch {
          return false;
        }
      },

      clearTestResult() {
        patchState(store, { testResult: null });
      },

      clearError() {
        patchState(store, { error: null });
      },
    };
  })
);
