/**
 * Value Type Detector
 * Detects specific value types for enhanced formatting in the results table.
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
  | 'undefined';

// GUID pattern: 8-4-4-4-12 hexadecimal characters
const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ISO 8601 datetime pattern
const ISO_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

// URL pattern (http or https)
const URL_PATTERN = /^https?:\/\//i;

/**
 * Detects the specific type of a value for formatting purposes.
 * Goes beyond basic typeof to identify GUIDs, dates, URLs, etc.
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

  if (typeof value === 'object') {
    return 'object';
  }

  if (typeof value === 'string') {
    // Check for GUID
    if (GUID_PATTERN.test(value)) {
      return 'guid';
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
