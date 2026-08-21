/**
 * Provider Manager
 * Handles registration, lookup, and lifecycle of database providers
 */

import { DatabaseProvider, ProviderCapabilities } from './base/provider.interface';
import { ProviderType, ProviderInfo } from './base/types';
import { ProviderNotFoundError, ConnectionNotFoundError } from './base/errors';
import { getConnectionById } from '../services/storage.service';

class ProviderManagerClass {
  private providers: Map<ProviderType, DatabaseProvider> = new Map();
  private connectionProviders: Map<string, ProviderType> = new Map();

  /**
   * Register a provider
   */
  register(provider: DatabaseProvider): void {
    this.providers.set(provider.type, provider);
    console.log(`[ProviderManager] Registered provider: ${provider.displayName}`);
  }

  /**
   * Get a provider by type
   */
  get(type: ProviderType): DatabaseProvider {
    const provider = this.providers.get(type);
    if (!provider) {
      throw new ProviderNotFoundError(type);
    }
    return provider;
  }

  /**
   * Get provider for a connection ID
   * Looks up the connection's provider type from storage
   */
  getForConnection(connectionId: string): DatabaseProvider {
    // Check cache first
    const cachedType = this.connectionProviders.get(connectionId);
    if (cachedType) {
      return this.get(cachedType);
    }

    // Look up from storage
    const connection = getConnectionById(connectionId);
    if (!connection) {
      throw new ConnectionNotFoundError(connectionId);
    }

    const providerType = (connection.providerType || 'cosmos-sql') as ProviderType;
    this.connectionProviders.set(connectionId, providerType);
    return this.get(providerType);
  }

  /**
   * Drop every provider's cached clients - call after connections are saved,
   * since endpoints or credentials may have changed
   */
  invalidateClients(): void {
    for (const provider of this.providers.values()) {
      provider.invalidateClients?.();
    }
  }

  /**
   * Clear cached provider type for a connection
   */
  clearConnectionCache(connectionId: string): void {
    this.connectionProviders.delete(connectionId);
  }

  /**
   * List all registered providers
   */
  listProviders(): ProviderInfo[] {
    return Array.from(this.providers.values()).map(p => p.getInfo());
  }

  /**
   * Get all available provider types
   */
  getAvailableTypes(): ProviderType[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Check if a provider type is registered
   */
  hasProvider(type: ProviderType): boolean {
    return this.providers.has(type);
  }

  /**
   * Get capabilities for a provider type
   */
  getCapabilities(type: ProviderType): ProviderCapabilities {
    return this.get(type).capabilities;
  }
}

// Singleton instance
export const providerManager = new ProviderManagerClass();
