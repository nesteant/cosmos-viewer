import { CosmosDocument } from '@core/models';
import {
  TableProviderStrategy,
  ExtendedValueType,
  FormattedValue,
} from './table-provider.strategy';

// GUID pattern: 8-4-4-4-12 hexadecimal characters
const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ISO 8601 datetime pattern
const ISO_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

// URL pattern (http or https)
const URL_PATTERN = /^https?:\/\//i;

/**
 * Cosmos DB SQL API table strategy.
 * Handles Cosmos SQL-specific document semantics and formatting.
 */
export class CosmosSqlTableStrategy implements TableProviderStrategy {
  readonly providerType = 'cosmos-sql';
  readonly primaryKeyField = 'id';
  readonly defaultQuery = 'SELECT * FROM c';

  private readonly systemFields = ['id', '_rid', '_self', '_etag', '_attachments', '_ts'];

  getDocumentId(doc: CosmosDocument): string {
    return doc.id ?? '';
  }

  getSystemFields(): string[] {
    return this.systemFields;
  }

  isSystemField(path: string): boolean {
    const firstSegment = path.split('.')[0].split('[')[0];
    return this.systemFields.includes(firstSegment);
  }

  isIdColumn(path: string): boolean {
    return path === 'id';
  }

  detectValueType(value: any, fieldPath?: string): ExtendedValueType {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'boolean') return 'boolean';

    if (typeof value === 'number') {
      // Check if it's a Unix timestamp (Cosmos _ts field is in seconds)
      if (fieldPath === '_ts' || this.isLikelyTimestamp(value)) {
        return 'timestamp';
      }
      return 'number';
    }

    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';

    if (typeof value === 'string') {
      if (GUID_PATTERN.test(value)) return 'guid';
      if (ISO_DATETIME_PATTERN.test(value)) {
        const parsed = new Date(value);
        if (!isNaN(parsed.getTime())) return 'datetime';
      }
      if (URL_PATTERN.test(value)) return 'url';
      return 'string';
    }

    return 'string';
  }

  formatValue(value: any, fieldPath?: string): FormattedValue {
    const type = this.detectValueType(value, fieldPath);

    switch (type) {
      case 'null':
        return { type, displayValue: 'null', rawValue: null, cssClass: 'subtle-value' };

      case 'undefined':
        return { type, displayValue: 'empty', rawValue: undefined, cssClass: 'subtle-value' };

      case 'boolean':
        return {
          type,
          displayValue: value ? 'true' : 'false',
          rawValue: value,
          cssClass: value ? 'boolean-true' : 'boolean-false',
        };

      case 'number':
        return {
          type,
          displayValue: this.formatNumber(value),
          rawValue: value,
          cssClass: 'number-value',
        };

      case 'timestamp':
        const date = new Date(value * 1000);
        return {
          type,
          displayValue: date.toLocaleString(),
          rawValue: value,
          tooltip: `Unix timestamp: ${value}`,
          cssClass: 'datetime-value',
        };

      case 'datetime':
        return {
          type,
          displayValue: new Date(value).toLocaleString(),
          rawValue: value,
          tooltip: value,
          cssClass: 'datetime-value',
        };

      case 'guid':
        return {
          type,
          displayValue: value,
          rawValue: value,
          cssClass: 'guid-value',
        };

      case 'url':
        return {
          type,
          displayValue: value,
          rawValue: value,
          cssClass: 'url-value',
        };

      case 'array':
        const arrLen = Array.isArray(value) ? value.length : 0;
        return {
          type,
          displayValue: `[${arrLen} items]`,
          rawValue: value,
          tooltip: JSON.stringify(value, null, 2),
          cssClass: 'complex-value',
        };

      case 'object':
        const keys = Object.keys(value || {});
        return {
          type,
          displayValue: `{${keys.length} props}`,
          rawValue: value,
          tooltip: JSON.stringify(value, null, 2),
          cssClass: 'complex-value',
        };

      default:
        return {
          type: 'string',
          displayValue: String(value),
          rawValue: value,
        };
    }
  }

  parseValue(stringValue: string, targetType?: ExtendedValueType): any {
    if (stringValue === 'null') return null;
    if (stringValue === 'undefined' || stringValue === '') return undefined;
    if (stringValue === 'true') return true;
    if (stringValue === 'false') return false;

    // Try to parse as number
    const num = Number(stringValue);
    if (!isNaN(num) && stringValue.trim() !== '') {
      return num;
    }

    // Try to parse as JSON (for objects/arrays)
    if (stringValue.startsWith('{') || stringValue.startsWith('[')) {
      try {
        return JSON.parse(stringValue);
      } catch {
        // Not valid JSON, return as string
      }
    }

    return stringValue;
  }

  createEmptyDocument(): CosmosDocument {
    return { id: this.generateGuid() };
  }

  duplicateDocument(source: CosmosDocument): CosmosDocument {
    const copy: Record<string, any> = {};
    Object.keys(source).forEach(key => {
      // Skip system fields (those starting with _)
      if (!key.startsWith('_')) {
        copy[key] = structuredClone(source[key]);
      }
    });
    // Generate new ID
    copy['id'] = this.generateGuid();
    return copy as CosmosDocument;
  }

  getAlwaysVisibleFields(): string[] {
    return ['id'];
  }

  getColumnSortPriority(): Map<string, number> {
    return new Map([
      ['id', 0],
      ['_rid', 900],
      ['_self', 901],
      ['_etag', 902],
      ['_attachments', 903],
      ['_ts', 904],
    ]);
  }

  getProtectedFieldPrefixes(): string[] {
    return ['_'];
  }

  isExtendedJsonType(_value: any): boolean {
    // Cosmos SQL doesn't use MongoDB extended JSON
    return false;
  }

  unwrapExtendedJson(value: any): any {
    return value;
  }

  wrapToExtendedJson(value: any, _originalType: ExtendedValueType): any {
    return value;
  }

  private generateGuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  private formatNumber(value: number): string {
    if (Number.isInteger(value)) {
      return value.toLocaleString();
    }
    // For decimals, show up to 6 significant digits
    return value.toLocaleString(undefined, { maximumFractionDigits: 6 });
  }

  private isLikelyTimestamp(value: number): boolean {
    // Unix seconds (10 digits) - roughly 2001 to 2033
    if (value >= 1_000_000_000 && value < 2_000_000_000) {
      return true;
    }
    // Unix milliseconds (13 digits)
    if (value >= 1_000_000_000_000 && value < 2_000_000_000_000) {
      return true;
    }
    return false;
  }
}
