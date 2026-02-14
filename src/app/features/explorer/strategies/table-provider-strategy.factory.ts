import { Injectable, inject, computed } from '@angular/core';
import { TableProviderStrategy } from './table-provider.strategy';
import { CosmosSqlTableStrategy } from './cosmos-sql-table.strategy';
import { CosmosMongoTableStrategy } from './cosmos-mongo-table.strategy';
import { ConnectionsStore } from '../../connections/store/connections.store';

/**
 * Factory service for creating provider-specific table strategies.
 * Uses the current connection's provider type to return the appropriate strategy.
 */
@Injectable({ providedIn: 'root' })
export class TableProviderStrategyFactory {
  private readonly connectionsStore = inject(ConnectionsStore);

  private readonly cosmosSqlStrategy = new CosmosSqlTableStrategy();
  private readonly cosmosMongoStrategy = new CosmosMongoTableStrategy();

  /**
   * Get the strategy for the currently selected connection.
   * Falls back to checking sessionStorage and connections list if selectedConnection is null.
   * Returns Cosmos SQL strategy as default.
   */
  currentStrategy = computed((): TableProviderStrategy => {
    // Try selectedConnection first
    let connection = this.connectionsStore.selectedConnection();

    // If null, try to find connection by sessionStorage ID
    if (!connection) {
      const activeId = sessionStorage.getItem('activeConnectionId');
      if (activeId) {
        const connections = this.connectionsStore.connections();
        connection = connections.find(c => c.id === activeId) ?? null;
      }
    }

    const providerType = connection?.providerType ?? 'cosmos-sql';
    return this.getStrategyForProvider(providerType);
  });

  /**
   * Get strategy for a specific provider type.
   */
  getStrategyForProvider(providerType: string): TableProviderStrategy {
    switch (providerType) {
      case 'cosmos-mongo':
      case 'mongodb':
        return this.cosmosMongoStrategy;

      case 'cosmos-sql':
      default:
        return this.cosmosSqlStrategy;
    }
  }

  /**
   * Check if the current provider is MongoDB-based.
   */
  isMongoProvider = computed((): boolean => {
    let connection = this.connectionsStore.selectedConnection();

    if (!connection) {
      const activeId = sessionStorage.getItem('activeConnectionId');
      if (activeId) {
        const connections = this.connectionsStore.connections();
        connection = connections.find(c => c.id === activeId) ?? null;
      }
    }

    const providerType = connection?.providerType ?? 'cosmos-sql';
    return providerType === 'cosmos-mongo' || providerType === 'mongodb';
  });
}
