import { CosmosDocument } from '@core/models';
import {
  TableProviderStrategy,
  ExtendedValueType,
  FormattedValue,
} from './table-provider.strategy';

// GUID/UUID pattern
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// MongoDB ObjectId pattern (24 hex characters)
const OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/i;

// ISO 8601 datetime pattern
const ISO_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

// URL pattern
const URL_PATTERN = /^https?:\/\//i;

/**
 * Cosmos DB MongoDB API table strategy.
 * Handles MongoDB-specific document semantics and extended JSON formatting.
 */
export class CosmosMongoTableStrategy implements TableProviderStrategy {
  readonly providerType = 'cosmos-mongo';
  readonly primaryKeyField = '_id';
  readonly defaultQuery = '{}';

  // MongoDB _id is the only true system field (immutable after creation)
  private readonly systemFields = ['_id'];

  getDocumentId(doc: CosmosDocument): string {
    const id = (doc as any)._id;
    if (id === null || id === undefined) return '';

    // Handle string/number directly
    if (typeof id === 'string') return id;
    if (typeof id === 'number') return String(id);

    // Handle Extended JSON object formats
    if (typeof id === 'object') {
      // ObjectId: { "$oid": "507f1f77bcf86cd799439011" }
      if (id.$oid) return id.$oid;

      // UUID: { "$uuid": "550e8400-e29b-41d4-a716-446655440000" }
      if (id.$uuid) return id.$uuid;

      // Binary (including UUID subtype): { "$binary": { "base64": "...", "subType": "04" } }
      if (id.$binary) {
        const subType = id.$binary.subType;
        // SubType 03 = UUID (old), 04 = UUID (new)
        if (subType === '03' || subType === '04' || subType === 3 || subType === 4) {
          return this.binaryToUuid(id.$binary.base64);
        }
        // For other binary types, use base64 as identifier
        return id.$binary.base64 || JSON.stringify(id);
      }

      // NumberLong: { "$numberLong": "12345" }
      if (id.$numberLong) return id.$numberLong;

      // Buffer/BinData that might have been serialized differently
      if (id.type !== undefined && id.data) {
        // Handle {type: 4, data: [...]} format
        if (Array.isArray(id.data)) {
          return this.uint8ArrayToUuid(new Uint8Array(id.data));
        }
      }

      // Fallback: stringify the object
      return JSON.stringify(id);
    }

    return String(id);
  }

  /**
   * Convert base64 binary to UUID string
   */
  private binaryToUuid(base64: string): string {
    try {
      // Decode base64 to bytes
      const binaryStr = atob(base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      return this.uint8ArrayToUuid(bytes);
    } catch {
      return base64; // Return original if conversion fails
    }
  }

  /**
   * Convert Uint8Array to UUID string format
   */
  private uint8ArrayToUuid(bytes: Uint8Array): string {
    if (bytes.length !== 16) {
      // Not a standard UUID, convert to hex
      return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    }

    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    // Format as UUID: 8-4-4-4-12
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  }

  getSystemFields(): string[] {
    return this.systemFields;
  }

  isSystemField(path: string): boolean {
    const firstSegment = path.split('.')[0].split('[')[0];
    return firstSegment === '_id';
  }

  isIdColumn(path: string): boolean {
    return path === '_id';
  }

  detectValueType(value: any, fieldPath?: string): ExtendedValueType {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'boolean') return 'boolean';

    // Check for MongoDB extended JSON types BEFORE generic object check
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // ObjectId: { "$oid": "..." }
      if ('$oid' in value) return 'objectId';

      // Binary/UUID: { "$binary": { "base64": "...", "subType": "04" } }
      // or { "$uuid": "..." }
      if ('$binary' in value) {
        const subType = value.$binary?.subType;
        if (subType === '04' || subType === '03') return 'uuid';
        return 'binary';
      }
      if ('$uuid' in value) return 'uuid';

      // Date: { "$date": "..." } or { "$date": { "$numberLong": "..." } }
      if ('$date' in value) return 'date';

      // NumberLong: { "$numberLong": "..." }
      if ('$numberLong' in value) return 'numberLong';

      // NumberDecimal: { "$numberDecimal": "..." }
      if ('$numberDecimal' in value) return 'numberDecimal';

      // Regex: { "$regex": "...", "$options": "..." }
      if ('$regex' in value) return 'regex';

      // Generic object
      return 'object';
    }

    if (Array.isArray(value)) return 'array';

    if (typeof value === 'number') {
      if (this.isLikelyTimestamp(value)) return 'timestamp';
      return 'number';
    }

    if (typeof value === 'string') {
      // Check if it looks like an ObjectId string
      if (fieldPath === '_id' && OBJECT_ID_PATTERN.test(value)) return 'objectId';
      if (UUID_PATTERN.test(value)) return 'uuid';
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
        const tsDate = new Date(value * 1000);
        return {
          type,
          displayValue: tsDate.toLocaleString(),
          rawValue: value,
          tooltip: `Unix timestamp: ${value}`,
          cssClass: 'datetime-value',
        };

      case 'objectId':
        const oidValue = typeof value === 'object' && value.$oid ? value.$oid : String(value);
        return {
          type,
          displayValue: oidValue,
          rawValue: value,
          tooltip: 'MongoDB ObjectId',
          cssClass: 'objectid-value',
        };

      case 'uuid':
        const uuidValue = this.extractUuid(value);
        return {
          type,
          displayValue: uuidValue,
          rawValue: value,
          tooltip: 'UUID',
          cssClass: 'uuid-value',
        };

      case 'binary':
        const binInfo = this.extractBinaryInfo(value);
        return {
          type,
          displayValue: `Binary(${binInfo.subType})`,
          rawValue: value,
          tooltip: `Base64: ${binInfo.base64.substring(0, 50)}...`,
          cssClass: 'binary-value',
        };

      case 'date':
        const dateValue = this.extractDate(value);
        return {
          type,
          displayValue: dateValue ? dateValue.toLocaleString() : 'Invalid Date',
          rawValue: value,
          tooltip: dateValue?.toISOString(),
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

      case 'numberLong':
        const longValue = value.$numberLong || value;
        return {
          type,
          displayValue: longValue,
          rawValue: value,
          tooltip: 'Int64 (NumberLong)',
          cssClass: 'number-value',
        };

      case 'numberDecimal':
        const decValue = value.$numberDecimal || value;
        return {
          type,
          displayValue: decValue,
          rawValue: value,
          tooltip: 'Decimal128 (NumberDecimal)',
          cssClass: 'number-value',
        };

      case 'regex':
        const pattern = value.$regex || '';
        const options = value.$options || '';
        return {
          type,
          displayValue: `/${pattern}/${options}`,
          rawValue: value,
          tooltip: 'Regular Expression',
          cssClass: 'regex-value',
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

    // If we have a target type, try to parse accordingly
    if (targetType === 'objectId' && OBJECT_ID_PATTERN.test(stringValue)) {
      return { $oid: stringValue };
    }

    if (targetType === 'uuid' && UUID_PATTERN.test(stringValue)) {
      return { $uuid: stringValue };
    }

    // Try to parse as number
    const num = Number(stringValue);
    if (!isNaN(num) && stringValue.trim() !== '') {
      return num;
    }

    // Try to parse as JSON (for objects/arrays/extended JSON)
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
    // MongoDB auto-generates _id on insert, so return empty object
    return {} as CosmosDocument;
  }

  duplicateDocument(source: CosmosDocument): CosmosDocument {
    const copy: Record<string, any> = {};
    Object.keys(source).forEach(key => {
      // Skip _id - MongoDB will auto-generate a new one
      if (key !== '_id') {
        copy[key] = structuredClone(source[key]);
      }
    });
    return copy as CosmosDocument;
  }

  getAlwaysVisibleFields(): string[] {
    return ['_id'];
  }

  getColumnSortPriority(): Map<string, number> {
    // Only _id is special in MongoDB
    return new Map([
      ['_id', 0],
    ]);
  }

  getProtectedFieldPrefixes(): string[] {
    // In MongoDB, only _id is truly protected
    // Other _ prefixed fields are user-defined
    return [];
  }

  isExtendedJsonType(value: any): boolean {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return false;
    }
    const extendedKeys = ['$oid', '$binary', '$uuid', '$date', '$numberLong', '$numberDecimal', '$regex'];
    return extendedKeys.some(key => key in value);
  }

  unwrapExtendedJson(value: any): any {
    if (!this.isExtendedJsonType(value)) return value;

    if ('$oid' in value) return value.$oid;
    if ('$uuid' in value) return value.$uuid;
    if ('$numberLong' in value) return value.$numberLong;
    if ('$numberDecimal' in value) return value.$numberDecimal;
    if ('$date' in value) {
      const d = this.extractDate(value);
      return d?.toISOString() || value.$date;
    }
    if ('$binary' in value) {
      if (value.$binary?.subType === '04' || value.$binary?.subType === '03') {
        return this.extractUuid(value);
      }
      return value.$binary?.base64 || '';
    }
    if ('$regex' in value) {
      return `/${value.$regex}/${value.$options || ''}`;
    }

    return value;
  }

  wrapToExtendedJson(value: any, originalType: ExtendedValueType): any {
    switch (originalType) {
      case 'objectId':
        if (typeof value === 'string' && OBJECT_ID_PATTERN.test(value)) {
          return { $oid: value };
        }
        return value;

      case 'uuid':
        if (typeof value === 'string' && UUID_PATTERN.test(value)) {
          // Convert UUID string to binary format (subType 04)
          return this.uuidToBinary(value);
        }
        return value;

      case 'binary':
        // Binary values should be returned as-is (already in EJSON format)
        return value;

      case 'numberLong':
        return { $numberLong: String(value) };

      case 'numberDecimal':
        return { $numberDecimal: String(value) };

      case 'date':
        if (value instanceof Date) {
          return { $date: value.toISOString() };
        }
        if (typeof value === 'string') {
          return { $date: value };
        }
        return value;

      case 'regex':
        // If it's already a regex object, return as-is
        if (typeof value === 'object' && value.$regex) {
          return value;
        }
        // If it's a string like /pattern/flags, parse it
        if (typeof value === 'string') {
          const match = value.match(/^\/(.*)\/([gimsuy]*)$/);
          if (match) {
            return { $regex: match[1], $options: match[2] || '' };
          }
        }
        return value;

      default:
        return value;
    }
  }

  /**
   * Convert UUID string to MongoDB Binary EJSON format
   */
  private uuidToBinary(uuid: string): any {
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
      // If conversion fails, return as $uuid format
      return { $uuid: uuid };
    }
  }

  private extractUuid(value: any): string {
    // { "$uuid": "..." } format
    if (value.$uuid) return value.$uuid;

    // { "$binary": { "base64": "...", "subType": "04" } } format
    if (value.$binary?.base64) {
      try {
        const bytes = atob(value.$binary.base64);
        const hex = Array.from(bytes, (c: string) =>
          c.charCodeAt(0).toString(16).padStart(2, '0')
        ).join('');

        // Format as UUID: 8-4-4-4-12
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
      } catch {
        return value.$binary.base64;
      }
    }

    return String(value);
  }

  private extractBinaryInfo(value: any): { base64: string; subType: string } {
    if (value.$binary) {
      return {
        base64: value.$binary.base64 || '',
        subType: value.$binary.subType || '00',
      };
    }
    return { base64: '', subType: '00' };
  }

  private extractDate(value: any): Date | null {
    if (!value.$date) return null;

    // { "$date": "2024-01-01T00:00:00Z" }
    if (typeof value.$date === 'string') {
      return new Date(value.$date);
    }

    // { "$date": { "$numberLong": "1234567890000" } }
    if (value.$date.$numberLong) {
      return new Date(parseInt(value.$date.$numberLong, 10));
    }

    return null;
  }

  private formatNumber(value: number): string {
    if (Number.isInteger(value)) {
      return value.toLocaleString();
    }
    return value.toLocaleString(undefined, { maximumFractionDigits: 6 });
  }

  private isLikelyTimestamp(value: number): boolean {
    if (value >= 1_000_000_000 && value < 2_000_000_000) return true;
    if (value >= 1_000_000_000_000 && value < 2_000_000_000_000) return true;
    return false;
  }
}
