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
 * Type options for inline editing
 */
export type FieldType = 'string' | 'number' | 'boolean' | 'null' | 'delete';

export interface TypeOption {
  type: FieldType;
  label: string;
  color: string;
  value: any;
  description: string;
}

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Check if a string is a valid GUID format
 */
export function isValidGuid(value: string): boolean {
  return GUID_PATTERN.test(value);
}

/**
 * Get special options that are always available (null, delete)
 */
export function getSpecialOptions(): TypeOption[] {
  return [
    {
      type: 'null',
      label: 'N',
      color: '#78909c',
      value: null,
      description: 'Null',
    },
    {
      type: 'delete',
      label: '⌀',
      color: '#ff7043',
      value: undefined,
      description: 'Delete field',
    },
  ];
}

/**
 * Detect applicable types for an input string
 * Returns array of type options based on the value (does not include special options)
 * The most specific type is first (auto-selected)
 */
export function detectApplicableTypes(input: string): TypeOption[] {
  const types: TypeOption[] = [];

  // String is always an option
  const stringOption: TypeOption = {
    type: 'string',
    label: 'S',
    color: '#607d8b',
    value: input,
    description: 'String',
  };

  // Check for boolean
  if (input.toLowerCase() === 'true') {
    types.push({
      type: 'boolean',
      label: 'B',
      color: '#4caf50',
      value: true,
      description: 'Boolean true',
    });
    types.push(stringOption);
    return types;
  }
  if (input.toLowerCase() === 'false') {
    types.push({
      type: 'boolean',
      label: 'B',
      color: '#ef5350',
      value: false,
      description: 'Boolean false',
    });
    types.push(stringOption);
    return types;
  }

  // Check for number (integer or decimal)
  if (/^-?\d+(\.\d+)?$/.test(input)) {
    const num = Number(input);
    if (!isNaN(num) && isFinite(num)) {
      types.push({
        type: 'number',
        label: '#',
        color: '#42a5f5',
        value: num,
        description: 'Number',
      });
    }
  }

  // String is always an option
  types.push(stringOption);

  return types;
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
