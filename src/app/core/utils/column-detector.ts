import { CosmosDocument, ColumnDefinition } from '../models';
import { getAllPaths, pathToString } from './path-utils';

/**
 * Detects columns from a set of documents
 * Analyzes all documents to find common and unique paths
 */
export function detectColumns(documents: CosmosDocument[]): ColumnDefinition[] {
  if (documents.length === 0) return [];

  const columnMap = new Map<
    string,
    {
      path: string;
      types: Set<string>;
      count: number;
      isSystem: boolean;
      maxDepth: number;
    }
  >();

  // System fields that should appear first
  const systemFields = ['id', '_rid', '_self', '_etag', '_attachments', '_ts'];

  // Analyze each document
  for (const doc of documents) {
    const paths = getAllPaths(doc);

    for (const { path, value } of paths) {
      if (path.length === 0) continue;

      const pathStr = pathToString(path);
      const valueType = getValueType(value);

      // Skip intermediate object/array paths, only track leaf values
      if (valueType === 'object' || valueType === 'array') {
        // Only include if empty
        if (
          (valueType === 'object' && Object.keys(value).length > 0) ||
          (valueType === 'array' && value.length > 0)
        ) {
          continue;
        }
      }

      const existing = columnMap.get(pathStr);
      if (existing) {
        existing.types.add(valueType);
        existing.count++;
      } else {
        const firstSegment = String(path[0]);
        columnMap.set(pathStr, {
          path: pathStr,
          types: new Set([valueType]),
          count: 1,
          isSystem: firstSegment.startsWith('_'),
          maxDepth: path.length,
        });
      }
    }
  }

  // Convert to ColumnDefinition array
  const columns: ColumnDefinition[] = Array.from(columnMap.entries()).map(
    ([path, info]) => ({
      path,
      label: getColumnLabel(path),
      type: inferColumnType(info.types),
      isSystem: info.isSystem,
      width: calculateColumnWidth(path, info.types),
    })
  );

  // Sort: 'id' first, then user fields alphabetically, then system fields (starting with _) at end
  columns.sort((a, b) => {
    // 'id' always first
    if (a.path === 'id') return -1;
    if (b.path === 'id') return 1;

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
 * Creates a display label from a path
 */
function getColumnLabel(path: string): string {
  // For nested paths, show the last segment
  const segments = path.split('.');
  let lastSegment = segments[segments.length - 1];

  // Handle array indices
  if (lastSegment.includes('[')) {
    lastSegment = lastSegment.replace(/\[(\d+)\]/g, '[$1]');
  }

  return lastSegment;
}

/**
 * Calculates suggested column width based on path and type
 */
function calculateColumnWidth(path: string, types: Set<string>): number {
  const baseWidth = 120;

  // System fields are typically shorter
  if (path === 'id') return 280;
  if (path.startsWith('_')) return 150;

  // Adjust based on path length (nested paths need more space)
  const depth = path.split('.').length;
  const depthBonus = (depth - 1) * 20;

  // Adjust based on type
  let typeBonus = 0;
  if (types.has('object') || types.has('array')) {
    typeBonus = 50;
  } else if (types.has('boolean')) {
    typeBonus = -30;
  }

  return Math.min(400, Math.max(80, baseWidth + depthBonus + typeBonus));
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
      const paths = getAllPaths(doc);
      if (paths.some((p) => pathToString(p.path) === col.path)) {
        count++;
      }
    }
    return count === docCount;
  });
}
