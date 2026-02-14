import { CosmosDocument } from '@core/models';

/**
 * Detected value type for formatting purposes.
 * Extended to support MongoDB-specific types.
 */
export type ExtendedValueType =
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
  // MongoDB extended types
  | 'objectId'
  | 'binary'
  | 'uuid'
  | 'date'
  | 'numberLong'
  | 'numberDecimal'
  | 'regex';

/**
 * Formatted value result for display
 */
export interface FormattedValue {
  type: ExtendedValueType;
  displayValue: string;
  rawValue: any;
  tooltip?: string;
  cssClass?: string;
}

/**
 * Strategy interface encapsulating provider-specific table behavior.
 * The table component delegates all provider-aware decisions to this strategy.
 */
export interface TableProviderStrategy {
  /** Provider type identifier */
  readonly providerType: string;

  /** The field name used as the primary document identifier */
  readonly primaryKeyField: string;

  /** Default query for this provider */
  readonly defaultQuery: string;

  /** Extract the unique document ID from any document */
  getDocumentId(doc: CosmosDocument): string;

  /** Fields that should never be user-editable */
  getSystemFields(): string[];

  /** Check if a field path is a system (non-editable) field */
  isSystemField(path: string): boolean;

  /** Check if a given column path is the primary ID column */
  isIdColumn(path: string): boolean;

  /**
   * Detect the extended type of a value for formatting.
   * Provider-specific to handle MongoDB extended JSON, etc.
   */
  detectValueType(value: any, fieldPath?: string): ExtendedValueType;

  /**
   * Format a value for display in a table cell.
   * Returns formatted representation with display string and metadata.
   */
  formatValue(value: any, fieldPath?: string): FormattedValue;

  /**
   * Parse a string value back to its proper typed representation.
   * Used when editing cells.
   */
  parseValue(stringValue: string, targetType?: ExtendedValueType): any;

  /**
   * Create a new empty document skeleton for this provider.
   * Returns the minimal valid document with a generated ID.
   */
  createEmptyDocument(): CosmosDocument;

  /**
   * Create a duplicate of an existing document.
   * Strips system fields and generates a new ID appropriate to the provider.
   */
  duplicateDocument(source: CosmosDocument): CosmosDocument;

  /**
   * Fields to always keep visible (never hide in column picker).
   */
  getAlwaysVisibleFields(): string[];

  /**
   * Get the column ordering priority for system/special fields.
   * Returns a map of field path -> sort priority (lower = first).
   * Fields not in the map get default priority (100).
   */
  getColumnSortPriority(): Map<string, number>;

  /**
   * Field prefixes that should be protected from user editing.
   * E.g., '_' prefix for Cosmos system fields.
   */
  getProtectedFieldPrefixes(): string[];

  /**
   * Check if a value represents a complex MongoDB type that needs special handling.
   */
  isExtendedJsonType(value: any): boolean;

  /**
   * Convert an extended JSON value to its raw/native representation for editing.
   */
  unwrapExtendedJson(value: any): any;

  /**
   * Wrap a raw value back into extended JSON format if needed.
   */
  wrapToExtendedJson(value: any, originalType: ExtendedValueType): any;
}
