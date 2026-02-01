/**
 * Date Utilities
 * Functions for parsing and formatting dates/timestamps.
 */

/**
 * Parses various date formats into a Date object.
 * Handles: ISO strings, Unix seconds, Unix milliseconds.
 */
export function parseDate(value: any): Date | null {
  if (value === null || value === undefined) {
    return null;
  }

  // Already a Date
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  // Unix timestamp (number)
  if (typeof value === 'number') {
    // Determine if seconds or milliseconds
    // Unix seconds are 10 digits (1e9 range), milliseconds are 13 digits (1e12 range)
    const ms = value > 1_000_000_000_000 ? value : value * 1000;
    const date = new Date(ms);
    return isNaN(date.getTime()) ? null : date;
  }

  // ISO string or other parseable format
  if (typeof value === 'string') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }

  return null;
}

/**
 * Formats a date as a relative time string (e.g., "2 hours ago").
 */
export function formatRelativeTime(date: Date | null): string {
  if (!date) {
    return '';
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(Math.abs(diffMs) / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  const isFuture = diffMs < 0;
  const suffix = isFuture ? 'from now' : 'ago';

  if (diffSec < 60) {
    return 'just now';
  }

  if (diffMin < 60) {
    return `${diffMin} minute${diffMin > 1 ? 's' : ''} ${suffix}`;
  }

  if (diffHour < 24) {
    return `${diffHour} hour${diffHour > 1 ? 's' : ''} ${suffix}`;
  }

  if (diffDay < 7) {
    return `${diffDay} day${diffDay > 1 ? 's' : ''} ${suffix}`;
  }

  if (diffWeek < 4) {
    return `${diffWeek} week${diffWeek > 1 ? 's' : ''} ${suffix}`;
  }

  if (diffMonth < 12) {
    return `${diffMonth} month${diffMonth > 1 ? 's' : ''} ${suffix}`;
  }

  return `${diffYear} year${diffYear > 1 ? 's' : ''} ${suffix}`;
}

/**
 * Formats a date as a full datetime string.
 */
export function formatFullDateTime(date: Date | null): string {
  if (!date) {
    return '';
  }

  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  });
}

/**
 * Formats a date as ISO string.
 */
export function formatIsoDateTime(date: Date | null): string {
  if (!date) {
    return '';
  }

  return date.toISOString();
}

/**
 * Formats a Unix timestamp (seconds) as relative time.
 */
export function formatTimestamp(timestamp: number): string {
  const date = parseDate(timestamp);
  return formatRelativeTime(date);
}

/**
 * Gets the full datetime tooltip for a timestamp.
 */
export function getTimestampTooltip(timestamp: number): string {
  const date = parseDate(timestamp);
  if (!date) {
    return String(timestamp);
  }

  return `${formatFullDateTime(date)}\nUnix: ${timestamp}`;
}
