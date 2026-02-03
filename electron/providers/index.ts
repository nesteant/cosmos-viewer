/**
 * Providers module entry point
 * Exports provider manager and registers all available providers
 */

export * from './base';
export * from './provider-manager';
export { cosmosSqlProvider } from './cosmos-sql';

import { providerManager } from './provider-manager';
import { cosmosSqlProvider } from './cosmos-sql';

/**
 * Initialize and register all providers
 * Call this during application startup
 */
export function initializeProviders(): void {
  // Register Cosmos SQL provider
  providerManager.register(cosmosSqlProvider);

  // Future providers will be registered here:
  // providerManager.register(cosmosMongoProvider);
  // providerManager.register(mongoDbProvider);
  // providerManager.register(jdbcProvider);

  console.log('[Providers] Initialized with providers:', providerManager.getAvailableTypes());
}
