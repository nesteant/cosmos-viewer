import { FlatDocument, CosmosDocument } from '../models';
import { getValueAtPath, stringToPath } from './path-utils';

/**
 * Flattens a Cosmos document for table display.
 * Only top-level fields become columns - nested objects/arrays stay as complex values.
 */
export function flattenDocument(doc: CosmosDocument): FlatDocument {
  const flat: FlatDocument = {
    _original: doc,
  };

  // Only flatten top-level keys
  for (const key of Object.keys(doc)) {
    flat[key] = doc[key];
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
      if (value.length === 0) return '[]';
      // Show preview for small primitive arrays
      if (value.length <= 3 && value.every(v => typeof v !== 'object')) {
        return `[${value.join(', ')}]`;
      }
      return `[${value.length} items]`;
    }
    const keys = Object.keys(value);
    if (keys.length === 0) return '{}';
    // Show preview for simple objects with few keys
    if (keys.length <= 2) {
      const preview = keys.map(k => {
        const v = value[k];
        if (v === null) return `${k}: null`;
        if (typeof v === 'object') return `${k}: {...}`;
        const str = String(v);
        return `${k}: ${str.length > 15 ? str.slice(0, 15) + '...' : str}`;
      }).join(', ');
      return `{${preview}}`;
    }
    return `{${keys.length} fields}`;
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
export type FieldType = 'string' | 'number' | 'boolean' | 'null' | 'delete' | 'binaryUuid' | 'mongoDate';

export interface TypeOption {
  type: FieldType;
  label: string;
  color: string;
  value: any;
  description: string;
}

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Convert UUID string to MongoDB Binary EJSON format
 */
export function uuidToBinaryEjson(uuid: string): any {
  try {
    // Remove dashes and convert to bytes
    const hex = uuid.replace(/-/g, '');
    const bytes = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
      bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    // Convert to base64
    const base64 = btoa(String.fromCharCode(...bytes));
    return {
      $binary: {
        base64,
        subType: '04' // UUID subtype
      }
    };
  } catch {
    return uuid;
  }
}

/**
 * Returns true when the value is a MongoDB Binary/UUID EJSON object
 * (subtype 03 or 04), or a { $uuid } shorthand.
 */
export function isBinaryUuid(value: any): boolean {
  if (!value || typeof value !== 'object') return false;
  if ('$uuid' in value) return true;
  if ('$binary' in value) {
    const subType = value.$binary?.subType;
    return subType === '04' || subType === '03' || subType === 4 || subType === 3;
  }
  return false;
}

/**
 * Convert a MongoDB Binary/UUID EJSON object to a plain UUID string.
 * Returns the original JSON string form if it cannot be decoded.
 */
export function binaryUuidToString(value: any): string {
  if (value?.$uuid) return value.$uuid;
  if (value?.$binary?.base64) {
    try {
      const bytes = atob(value.$binary.base64);
      const hex = Array.from(bytes, (c: string) =>
        c.charCodeAt(0).toString(16).padStart(2, '0')
      ).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
    } catch {
      return JSON.stringify(value);
    }
  }
  return JSON.stringify(value);
}

/** Recursively checks whether a value tree contains any Binary/UUID EJSON. */
export function containsBinaryUuids(value: any): boolean {
  if (value === null || value === undefined) return false;
  if (isBinaryUuid(value)) return true;
  if (Array.isArray(value)) return value.some(containsBinaryUuids);
  if (typeof value === 'object') return Object.values(value).some(containsBinaryUuids);
  return false;
}

/** Recursively checks whether a value tree contains any plain UUID strings. */
export function containsPlainUuids(value: any): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return isValidGuid(value);
  if (Array.isArray(value)) return value.some(containsPlainUuids);
  if (typeof value === 'object') {
    // Don't descend into EJSON wrappers
    if ('$binary' in value || '$oid' in value || '$date' in value || '$uuid' in value) return false;
    return Object.values(value).some(containsPlainUuids);
  }
  return false;
}

/**
 * Recursively converts UUIDs in a parsed value tree between plain string form
 * and MongoDB Binary EJSON form. Pass 'wrap' to turn UUID strings into Binary,
 * 'unwrap' to turn Binary back into UUID strings.
 */
export function convertUuidsDeep(value: any, direction: 'wrap' | 'unwrap'): any {
  if (value === null || value === undefined) return value;

  if (direction === 'unwrap' && isBinaryUuid(value)) {
    return binaryUuidToString(value);
  }
  if (direction === 'wrap' && typeof value === 'string' && isValidGuid(value)) {
    return uuidToBinaryEjson(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => convertUuidsDeep(item, direction));
  }

  if (typeof value === 'object') {
    // Leave other EJSON wrappers untouched
    if (direction === 'wrap' && (
      '$binary' in value || '$oid' in value || '$date' in value ||
      '$numberLong' in value || '$numberDecimal' in value || '$regex' in value || '$uuid' in value
    )) {
      return value;
    }
    const result: Record<string, any> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = convertUuidsDeep(val, direction);
    }
    return result;
  }

  return value;
}

/**
 * Auto-detects the conversion direction for a parsed value tree and toggles
 * UUID representation: Binary → string if it currently holds Binary UUIDs,
 * otherwise string → Binary.
 */
export function toggleUuidRepresentation(value: any): any {
  const direction = containsBinaryUuids(value) && !containsPlainUuids(value) ? 'unwrap' : 'wrap';
  return convertUuidsDeep(value, direction);
}

/**
 * Convert ISO date string to MongoDB Date EJSON format
 */
export function dateToMongoEjson(dateStr: string): any {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return { $date: date.toISOString() };
  } catch {
    return dateStr;
  }
}

// ISO 8601 date patterns
// Full: 2024-01-15T10:30:00.000Z or 2024-01-15T10:30:00+05:30
// Date only: 2024-01-15
// With milliseconds: 2024-01-15T10:30:00.123Z
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})?)?$/;

/**
 * Check if a string is a valid GUID format
 */
export function isValidGuid(value: string): boolean {
  return GUID_PATTERN.test(value);
}

/**
 * Check if a string is a valid ISO 8601 date format
 */
export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) {
    return false;
  }
  // Also verify it's a valid date by parsing
  const date = new Date(value);
  return !isNaN(date.getTime());
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

  // Check for GUID - offer MongoDB Binary UUID conversion
  if (GUID_PATTERN.test(input)) {
    types.push({
      type: 'binaryUuid',
      label: 'UUID',
      color: '#9c27b0',
      value: uuidToBinaryEjson(input),
      description: 'MongoDB Binary UUID',
    });
  }

  // Check for ISO date - offer MongoDB Date conversion
  if (ISO_DATE_PATTERN.test(input)) {
    const date = new Date(input);
    if (!isNaN(date.getTime())) {
      types.push({
        type: 'mongoDate',
        label: 'D',
        color: '#00897b',
        value: dateToMongoEjson(input),
        description: 'MongoDB Date',
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
