/**
 * Value Type Detector
 * Detects specific value types for enhanced formatting in the results table.
 * Supports MongoDB Extended JSON types.
 */

export type DetectedValueType =
  | 'guid'
  | 'datetime'
  | 'timestamp'
  | 'url'
  | 'boolean'
  | 'number'
  | 'string'
  | 'object'
  | 'array'
  | 'null'
  | 'undefined'
  // MongoDB Extended JSON types
  | 'objectId'
  | 'binaryUuid'
  | 'binary'
  | 'mongoDate'
  | 'numberLong'
  | 'numberDecimal'
  | 'regex';

// GUID pattern: 8-4-4-4-12 hexadecimal characters
const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// MongoDB ObjectId pattern (24 hex characters)
const OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/i;

// ISO 8601 datetime pattern
const ISO_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

// URL pattern (http or https)
const URL_PATTERN = /^https?:\/\//i;

/**
 * Detects the specific type of a value for formatting purposes.
 * Goes beyond basic typeof to identify GUIDs, dates, URLs, MongoDB Extended JSON, etc.
 */
export function detectValueType(value: any, fieldPath?: string): DetectedValueType {
  if (value === null) {
    return 'null';
  }

  if (value === undefined) {
    return 'undefined';
  }

  if (typeof value === 'boolean') {
    return 'boolean';
  }

  if (typeof value === 'number') {
    // Check if it's a Unix timestamp (Cosmos _ts field is in seconds)
    if (fieldPath === '_ts' || isLikelyTimestamp(value)) {
      return 'timestamp';
    }
    return 'number';
  }

  if (Array.isArray(value)) {
    return 'array';
  }

  // Check for MongoDB Extended JSON types BEFORE generic object
  if (typeof value === 'object') {
    // ObjectId: { "$oid": "..." }
    if ('$oid' in value) return 'objectId';

    // UUID: { "$uuid": "..." }
    if ('$uuid' in value) return 'guid';

    // Binary: { "$binary": { "base64": "...", "subType": "..." } }
    if ('$binary' in value) {
      const subType = value.$binary?.subType;
      // SubTypes 03, 04 are UUID
      if (subType === '03' || subType === '04' || subType === 3 || subType === 4) {
        return 'binaryUuid';
      }
      return 'binary';
    }

    // Date: { "$date": "..." } or { "$date": { "$numberLong": "..." } }
    if ('$date' in value) return 'mongoDate';

    // NumberLong: { "$numberLong": "..." }
    if ('$numberLong' in value) return 'numberLong';

    // NumberDecimal: { "$numberDecimal": "..." }
    if ('$numberDecimal' in value) return 'numberDecimal';

    // Regex: { "$regex": "...", "$options": "..." }
    if ('$regex' in value) return 'regex';

    return 'object';
  }

  if (typeof value === 'string') {
    // Check for GUID
    if (GUID_PATTERN.test(value)) {
      return 'guid';
    }

    // Check for ObjectId string (24 hex chars)
    if (fieldPath === '_id' && OBJECT_ID_PATTERN.test(value)) {
      return 'objectId';
    }

    // Check for ISO datetime
    if (ISO_DATETIME_PATTERN.test(value)) {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        return 'datetime';
      }
    }

    // Check for URL
    if (URL_PATTERN.test(value)) {
      return 'url';
    }

    return 'string';
  }

  return 'string';
}

/**
 * Extracts display value from MongoDB Extended JSON types.
 * Returns the human-readable string representation.
 */
export function extractMongoDisplayValue(value: any): string {
  if (value === null || value === undefined) return '';

  if (typeof value !== 'object') return String(value);

  // ObjectId: { "$oid": "..." }
  if (value.$oid) return value.$oid;

  // UUID: { "$uuid": "..." }
  if (value.$uuid) return value.$uuid;

  // Binary UUID: { "$binary": { "base64": "...", "subType": "04" } }
  if (value.$binary) {
    const subType = value.$binary.subType;
    if (subType === '03' || subType === '04' || subType === 3 || subType === 4) {
      return binaryToUuid(value.$binary.base64);
    }
    // For other binary, show truncated base64
    const b64 = value.$binary.base64 || '';
    return b64.length > 20 ? b64.substring(0, 20) + '...' : b64;
  }

  // Date: { "$date": "..." }
  if (value.$date) {
    if (typeof value.$date === 'string') {
      return new Date(value.$date).toLocaleString();
    }
    if (value.$date.$numberLong) {
      return new Date(parseInt(value.$date.$numberLong, 10)).toLocaleString();
    }
  }

  // NumberLong: { "$numberLong": "..." }
  if (value.$numberLong) return value.$numberLong;

  // NumberDecimal: { "$numberDecimal": "..." }
  if (value.$numberDecimal) return value.$numberDecimal;

  // Regex: { "$regex": "...", "$options": "..." }
  if (value.$regex) {
    return `/${value.$regex}/${value.$options || ''}`;
  }

  return JSON.stringify(value);
}

/**
 * Converts base64 binary to UUID string format.
 */
function binaryToUuid(base64: string): string {
  try {
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    if (bytes.length !== 16) {
      // Not a standard UUID
      return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    }

    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  } catch {
    return base64;
  }
}

/**
 * Checks if a number looks like a Unix timestamp.
 * - Seconds: 1e9 to 2e9 (roughly 2001 to 2033)
 * - Milliseconds: 1e12 to 2e12
 */
function isLikelyTimestamp(value: number): boolean {
  // Unix seconds (10 digits)
  if (value >= 1_000_000_000 && value < 2_000_000_000) {
    return true;
  }
  // Unix milliseconds (13 digits)
  if (value >= 1_000_000_000_000 && value < 2_000_000_000_000) {
    return true;
  }
  return false;
}

/**
 * Parses a GUID into its segments for display.
 */
export function parseGuidSegments(guid: string): string[] {
  return guid.split('-');
}

/**
 * Checks if a value is a valid GUID.
 */
export function isGuid(value: any): boolean {
  return typeof value === 'string' && GUID_PATTERN.test(value);
}

/**
 * Checks if a value is a valid URL.
 */
export function isUrl(value: any): boolean {
  return typeof value === 'string' && URL_PATTERN.test(value);
}

/**
 * Checks if a value is a datetime string.
 */
export function isDateTimeString(value: any): boolean {
  if (typeof value !== 'string') return false;
  if (!ISO_DATETIME_PATTERN.test(value)) return false;
  const parsed = new Date(value);
  return !isNaN(parsed.getTime());
}
