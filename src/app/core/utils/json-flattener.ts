import { FlatDocument, CosmosDocument } from '../models';
import { pathToString, getAllPaths, getValueAtPath, stringToPath } from './path-utils';

/**
 * Flattens a nested Cosmos document into a flat key-value structure
 * for display in a table grid
 */
export function flattenDocument(doc: CosmosDocument): FlatDocument {
  const flat: FlatDocument = {
    _original: doc,
  };

  const paths = getAllPaths(doc);

  for (const { path, value } of paths) {
    if (path.length === 0) continue;

    const pathStr = pathToString(path);

    // Store primitive values directly
    if (
      value === null ||
      value === undefined ||
      typeof value !== 'object' ||
      (Array.isArray(value) && value.length === 0) ||
      (typeof value === 'object' && Object.keys(value).length === 0)
    ) {
      flat[pathStr] = value;
    }
  }

  return flat;
}

/**
 * Unflattens a flat document back to its nested structure
 */
export function unflattenDocument(flat: FlatDocument): CosmosDocument {
  const result: any = { ...flat['_original'] };

  // Apply any changes from flat structure back to nested
  for (const [key, value] of Object.entries(flat)) {
    if (key === '_original') continue;

    const path = stringToPath(key);
    setNestedValue(result, path, value);
  }

  return result;
}

/**
 * Helper to set nested value mutably (for unflatten)
 */
function setNestedValue(obj: any, path: (string | number)[], value: any): void {
  let current = obj;

  for (let i = 0; i < path.length - 1; i++) {
    const segment = path[i];
    const nextSegment = path[i + 1];

    if (current[segment] === undefined) {
      current[segment] = typeof nextSegment === 'number' ? [] : {};
    }

    current = current[segment];
  }

  if (path.length > 0) {
    current[path[path.length - 1]] = value;
  }
}

/**
 * Gets display value for a cell
 */
export function getDisplayValue(value: any): string {
  if (value === null) return 'null';
  if (value === undefined) return '';
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return value.length === 0 ? '[]' : `[${value.length} items]`;
    }
    const keys = Object.keys(value);
    return keys.length === 0 ? '{}' : `{${keys.length} fields}`;
  }
  return String(value);
}

/**
 * Parses an edited cell value back to its proper type
 */
export function parseEditedValue(value: string, originalValue: any): any {
  // Handle null
  if (value === 'null') return null;

  // Handle empty string
  if (value === '') return '';

  // Handle booleans
  if (value === 'true') return true;
  if (value === 'false') return false;

  // Try to preserve original type
  if (typeof originalValue === 'number') {
    const num = Number(value);
    if (!isNaN(num)) return num;
  }

  // Try JSON parse for arrays/objects
  if (value.startsWith('[') || value.startsWith('{')) {
    try {
      return JSON.parse(value);
    } catch {
      // Return as string if invalid JSON
    }
  }

  return value;
}

/**
 * Extracts the partition key value from a document
 */
export function extractPartitionKey(
  doc: CosmosDocument,
  partitionKeyPath: string
): any {
  // Remove leading slash if present
  const path = partitionKeyPath.startsWith('/')
    ? partitionKeyPath.slice(1)
    : partitionKeyPath;

  return getValueAtPath(doc, stringToPath(path));
}
