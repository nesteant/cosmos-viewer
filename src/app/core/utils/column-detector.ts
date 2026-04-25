import { CosmosDocument, ColumnDefinition } from '../models';

/**
 * Detects columns from a set of documents
 * Only analyzes top-level keys - nested objects/arrays are shown as complex values
 * @param documents Array of documents to analyze
 * @param partitionKeyPaths Optional comma-separated partition key paths (e.g., "/userId" or "/tenant,/user")
 */
export function detectColumns(documents: CosmosDocument[], partitionKeyPaths?: string): ColumnDefinition[] {
  if (documents.length === 0) return [];

  // Parse partition key fields for ordering
  const pkFields = partitionKeyPaths
    ? partitionKeyPaths.split(',').map(p => p.trim().replace(/^\//, ''))
    : [];

  const columnMap = new Map<
    string,
    {
      path: string;
      types: Set<string>;
      count: number;
      isSystem: boolean;
      firstSeen: number;
    }
  >();

  // System fields that should appear first within the system group
  const systemFields = ['id', '_rid', '_self', '_etag', '_attachments', '_ts'];

  // Analyze each document - only top-level keys.
  // `firstSeen` records the order in which a key first appears across all
  // documents; this is what we use to preserve the SELECT-clause order from
  // Cosmos / Mongo, since both engines emit projection fields in declared
  // order in their result objects.
  let order = 0;
  for (const doc of documents) {
    for (const key of Object.keys(doc)) {
      const value = doc[key];
      const valueType = getValueType(value);

      const existing = columnMap.get(key);
      if (existing) {
        existing.types.add(valueType);
        existing.count++;
      } else {
        columnMap.set(key, {
          path: key,
          types: new Set([valueType]),
          count: 1,
          isSystem: key.startsWith('_'),
          firstSeen: order++,
        });
      }
    }
  }

  // Convert to ColumnDefinition array, preserving the firstSeen order on each
  // entry so the comparator below can use it.
  const firstSeenByPath = new Map<string, number>();
  for (const [key, info] of columnMap.entries()) {
    firstSeenByPath.set(key, info.firstSeen);
  }

  const columns: ColumnDefinition[] = Array.from(columnMap.entries()).map(
    ([key, info]) => ({
      path: key,
      label: key,
      type: inferColumnType(info.types),
      isSystem: info.isSystem,
      width: calculateColumnWidth(key, info.types),
    })
  );

  // Sort: id/_id first → partition keys → user fields in projection order →
  // system fields last. We use first-seen order for user fields rather than
  // alphabetical so a query like `SELECT c.foo, c.bar` keeps its column order.
  columns.sort((a, b) => {
    if (a.path === 'id' || a.path === '_id') return -1;
    if (b.path === 'id' || b.path === '_id') return 1;

    const aIsPk = pkFields.includes(a.path);
    const bIsPk = pkFields.includes(b.path);
    if (aIsPk && !bIsPk) return -1;
    if (!aIsPk && bIsPk) return 1;
    if (aIsPk && bIsPk) {
      return pkFields.indexOf(a.path) - pkFields.indexOf(b.path);
    }

    const aIsSystem = a.path.startsWith('_');
    const bIsSystem = b.path.startsWith('_');
    if (aIsSystem && !bIsSystem) return 1;
    if (!aIsSystem && bIsSystem) return -1;

    if (aIsSystem && bIsSystem) {
      const aIndex = systemFields.indexOf(a.path);
      const bIndex = systemFields.indexOf(b.path);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      // Fall through to first-seen for unknown system fields.
    }

    const aOrder = firstSeenByPath.get(a.path) ?? 0;
    const bOrder = firstSeenByPath.get(b.path) ?? 0;
    return aOrder - bOrder;
  });

  return columns;
}

/**
 * Gets the type of a value for column detection
 */
function getValueType(value: any): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/**
 * Infers the primary column type from observed types
 */
function inferColumnType(
  types: Set<string>
): 'string' | 'number' | 'boolean' | 'object' | 'array' | 'mixed' {
  // Remove null/undefined as they can appear with any type
  const significantTypes = new Set(types);
  significantTypes.delete('null');
  significantTypes.delete('undefined');

  if (significantTypes.size === 0) return 'string';
  if (significantTypes.size === 1) {
    const type = significantTypes.values().next().value;
    if (
      type === 'string' ||
      type === 'number' ||
      type === 'boolean' ||
      type === 'object' ||
      type === 'array'
    ) {
      return type;
    }
  }
  return 'mixed';
}


/**
 * Calculates suggested column width based on key and type
 */
function calculateColumnWidth(key: string, types: Set<string>): number {
  const baseWidth = 120;

  // System fields are typically shorter
  if (key === 'id') return 280;
  if (key.startsWith('_')) return 150;

  // Adjust based on type
  let typeBonus = 0;
  if (types.has('object') || types.has('array')) {
    typeBonus = 50; // Complex values need more space for preview
  } else if (types.has('boolean')) {
    typeBonus = -30;
  }

  return Math.min(400, Math.max(80, baseWidth + typeBonus));
}

/**
 * Filters columns to show only selected ones
 */
export function filterColumns(
  columns: ColumnDefinition[],
  selectedPaths: string[]
): ColumnDefinition[] {
  if (selectedPaths.length === 0) return columns;
  const pathSet = new Set(selectedPaths);
  return columns.filter((col) => pathSet.has(col.path));
}

/**
 * Gets columns that are common across all documents
 */
export function getCommonColumns(
  documents: CosmosDocument[]
): ColumnDefinition[] {
  const allColumns = detectColumns(documents);

  // A column is common if it appears in all documents
  const docCount = documents.length;

  return allColumns.filter((col) => {
    let count = 0;
    for (const doc of documents) {
      if (col.path in doc) {
        count++;
      }
    }
    return count === docCount;
  });
}
