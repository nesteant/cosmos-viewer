/**
 * Utilities for working with JSON paths
 */

/**
 * Converts a path array to a dot-notation string
 * Example: ['address', 'city'] -> 'address.city'
 */
export function pathToString(path: (string | number)[]): string {
  return path
    .map((segment, index) => {
      if (typeof segment === 'number') {
        return `[${segment}]`;
      }
      if (index === 0) {
        return segment;
      }
      return `.${segment}`;
    })
    .join('');
}

/**
 * Parses a dot-notation path string to an array
 * Example: 'address.city' -> ['address', 'city']
 * Example: 'items[0].name' -> ['items', 0, 'name']
 */
export function stringToPath(pathStr: string): (string | number)[] {
  const result: (string | number)[] = [];
  const regex = /([^.\[\]]+)|\[(\d+)\]/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(pathStr)) !== null) {
    if (match[1] !== undefined) {
      result.push(match[1]);
    } else if (match[2] !== undefined) {
      result.push(parseInt(match[2], 10));
    }
  }

  return result;
}

/**
 * Gets a value from an object using a path array
 */
export function getValueAtPath(obj: any, path: (string | number)[]): any {
  let current = obj;
  for (const segment of path) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

/**
 * Sets a value in an object using a path array (immutably)
 */
export function setValueAtPath(
  obj: any,
  path: (string | number)[],
  value: any
): any {
  if (path.length === 0) {
    return value;
  }

  const [head, ...tail] = path;
  const isArray = Array.isArray(obj);
  const result = isArray ? [...obj] : { ...obj };

  if (tail.length === 0) {
    result[head] = value;
  } else {
    result[head] = setValueAtPath(
      obj[head] ?? (typeof tail[0] === 'number' ? [] : {}),
      tail,
      value
    );
  }

  return result;
}

/**
 * Checks if a path is a system field that shouldn't be edited
 */
export function isSystemField(path: string): boolean {
  const systemFields = ['id', '_rid', '_self', '_etag', '_attachments', '_ts'];
  const firstSegment = path.split('.')[0].split('[')[0];
  return systemFields.includes(firstSegment);
}

/**
 * Check if array should be treated as a single value (not expanded into columns)
 * This includes: primitive arrays, vectors (numeric arrays), large arrays
 */
function shouldTreatArrayAsValue(arr: any[]): boolean {
  // Empty arrays are single values
  if (arr.length === 0) return true;

  // Large arrays (likely vectors or data blobs) - don't expand
  if (arr.length > 20) return true;

  // Check if all elements are primitives (numbers, strings, booleans)
  const allPrimitives = arr.every(
    (item) =>
      item === null ||
      typeof item === 'number' ||
      typeof item === 'string' ||
      typeof item === 'boolean'
  );

  // Numeric arrays (vectors/embeddings) should not be expanded
  if (allPrimitives && arr.every((item) => typeof item === 'number')) {
    return true;
  }

  return false;
}

/**
 * Generates all paths in an object for flattening
 */
export function getAllPaths(
  obj: any,
  currentPath: (string | number)[] = []
): { path: (string | number)[]; value: any }[] {
  const results: { path: (string | number)[]; value: any }[] = [];

  if (obj === null || obj === undefined) {
    results.push({ path: currentPath, value: obj });
    return results;
  }

  if (Array.isArray(obj)) {
    // Treat primitive/large arrays as single values
    if (shouldTreatArrayAsValue(obj)) {
      results.push({ path: currentPath, value: obj });
    } else {
      // Only expand arrays of objects
      obj.forEach((item, index) => {
        results.push(...getAllPaths(item, [...currentPath, index]));
      });
    }
    return results;
  }

  if (typeof obj === 'object') {
    const keys = Object.keys(obj);
    if (keys.length === 0) {
      results.push({ path: currentPath, value: obj });
    } else {
      keys.forEach((key) => {
        results.push(...getAllPaths(obj[key], [...currentPath, key]));
      });
    }
    return results;
  }

  results.push({ path: currentPath, value: obj });
  return results;
}
