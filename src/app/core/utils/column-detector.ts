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
    }
  >();

  // System fields that should appear first
  const systemFields = ['id', '_rid', '_self', '_etag', '_attachments', '_ts'];

  // Analyze each document - only top-level keys
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
        });
      }
    }
  }

  // Convert to ColumnDefinition array
  const columns: ColumnDefinition[] = Array.from(columnMap.entries()).map(
    ([key, info]) => ({
      path: key,
      label: key,
      type: inferColumnType(info.types),
      isSystem: info.isSystem,
      width: calculateColumnWidth(key, info.types),
    })
  );

  // Sort: 'id'/'_id' first, then partition key fields, then user fields alphabetically, then system fields at end
  columns.sort((a, b) => {
    // 'id' or '_id' always first
    if (a.path === 'id' || a.path === '_id') return -1;
    if (b.path === 'id' || b.path === '_id') return 1;

    // Partition key fields come next (in order they appear in the path)
    const aIsPk = pkFields.includes(a.path);
    const bIsPk = pkFields.includes(b.path);
    if (aIsPk && !bIsPk) return -1;
    if (!aIsPk && bIsPk) return 1;
    if (aIsPk && bIsPk) {
      // Maintain partition key order
      return pkFields.indexOf(a.path) - pkFields.indexOf(b.path);
    }

    // System fields (starting with _) go to the end
    const aIsSystem = a.path.startsWith('_');
    const bIsSystem = b.path.startsWith('_');

    if (aIsSystem && !bIsSystem) return 1;
    if (!aIsSystem && bIsSystem) return -1;

    // Within system fields, maintain standard order
    if (aIsSystem && bIsSystem) {
      const aIndex = systemFields.indexOf(a.path);
      const bIndex = systemFields.indexOf(b.path);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    }

    // Otherwise alphabetical
    return a.path.localeCompare(b.path);
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
