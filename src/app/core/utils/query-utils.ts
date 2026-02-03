import { ProviderType } from '@core/models';

/**
 * Get the default query for a given provider type
 */
export function getDefaultQueryForProvider(providerType: ProviderType): string {
  return providerType === 'cosmos-mongo' || providerType === 'mongodb'
    ? '{}'
    : 'SELECT * FROM c';
}

/**
 * Check if a query is compatible with a provider type
 */
export function isQueryCompatibleWithProvider(query: string, providerType: ProviderType): boolean {
  const isMongo = providerType === 'cosmos-mongo' || providerType === 'mongodb';
  const trimmedQuery = query.trim();

  if (!trimmedQuery) return false;

  const looksLikeSQL = trimmedQuery.toUpperCase().includes('SELECT') ||
                       trimmedQuery.toUpperCase().includes('FROM');
  const looksLikeJSON = trimmedQuery.startsWith('{') || trimmedQuery.startsWith('[');

  if (isMongo) {
    return looksLikeJSON && !looksLikeSQL;
  } else {
    return looksLikeSQL || !looksLikeJSON;
  }
}
