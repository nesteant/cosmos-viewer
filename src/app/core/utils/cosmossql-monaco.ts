/**
 * CosmosSQL Monaco Editor Configuration
 * Provides syntax highlighting and autocomplete for Cosmos DB SQL queries
 */

// Store for dynamic field suggestions - now a nested schema tree
interface SchemaNode {
  [key: string]: SchemaNode | null; // null means leaf (primitive), object means has children
}
let schemaTree: SchemaNode = {};
let completionDisposable: any = null;

/**
 * Update document fields for autocomplete suggestions (legacy - flat list)
 */
export function updateDocumentFields(fields: string[]): void {
  // Convert flat fields to simple schema tree for backwards compatibility
  schemaTree = {};
  for (const field of fields) {
    schemaTree[field] = null;
  }
}

/**
 * Build schema tree from documents with smart sampling:
 * 1. Take first 50 docs to collect all root-level keys
 * 2. For each root key, merge structure from up to 10 docs that have it
 */
export function updateSchemaFromDocuments(documents: any[]): void {
  if (!documents || documents.length === 0) {
    schemaTree = {};
    return;
  }

  // Step 1: Sample first 50 docs (or all if less)
  const sampleSize = Math.min(50, documents.length);
  const sampledDocs = documents.slice(0, sampleSize);

  // Step 2: Collect all root-level keys and group docs by which keys they have
  const docsPerRootKey = new Map<string, any[]>();

  for (const doc of sampledDocs) {
    if (!doc || typeof doc !== 'object') continue;

    for (const key of Object.keys(doc)) {
      if (!docsPerRootKey.has(key)) {
        docsPerRootKey.set(key, []);
      }
      const docs = docsPerRootKey.get(key)!;
      if (docs.length < 10) { // Keep up to 10 docs per root key
        docs.push(doc);
      }
    }
  }

  // Step 3: Build merged schema tree
  schemaTree = {};

  for (const [rootKey, docs] of docsPerRootKey) {
    // Skip system fields
    if (rootKey.startsWith('_')) continue;

    // Merge schema from all sampled docs for this root key
    let mergedSchema: SchemaNode | null = null;

    for (const doc of docs) {
      const value = doc[rootKey];
      const nodeSchema = buildSchemaNode(value, 5); // Max depth 5
      mergedSchema = mergeSchemaNodes(mergedSchema, nodeSchema);
    }

    schemaTree[rootKey] = mergedSchema;
  }
}

/**
 * Build schema node from a value (recursive)
 */
function buildSchemaNode(value: any, maxDepth: number): SchemaNode | null {
  if (maxDepth <= 0) return null;
  if (value === null || value === undefined) return null;

  if (Array.isArray(value)) {
    // For arrays, analyze first few items to get item schema
    if (value.length === 0) return null;

    let itemSchema: SchemaNode | null = null;
    const itemsToCheck = Math.min(3, value.length);

    for (let i = 0; i < itemsToCheck; i++) {
      const item = value[i];
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const nodeSchema = buildSchemaNode(item, maxDepth - 1);
        itemSchema = mergeSchemaNodes(itemSchema, nodeSchema);
      }
    }

    // Return schema with [n] notation for array access
    if (itemSchema) {
      return { '[n]': itemSchema };
    }
    return null;
  }

  if (typeof value === 'object') {
    const node: SchemaNode = {};
    for (const key of Object.keys(value)) {
      const childValue = value[key];
      node[key] = buildSchemaNode(childValue, maxDepth - 1);
    }
    return Object.keys(node).length > 0 ? node : null;
  }

  // Primitive value - leaf node
  return null;
}

/**
 * Merge two schema nodes (union of all keys)
 */
function mergeSchemaNodes(a: SchemaNode | null, b: SchemaNode | null): SchemaNode | null {
  if (!a) return b;
  if (!b) return a;

  const merged: SchemaNode = { ...a };

  for (const key of Object.keys(b)) {
    if (key in merged) {
      merged[key] = mergeSchemaNodes(merged[key], b[key]);
    } else {
      merged[key] = b[key];
    }
  }

  return merged;
}

/**
 * Get suggestions for a given path (e.g., "memberTags.systemValue")
 */
function getSuggestionsForPath(path: string[]): string[] {
  let current: SchemaNode | null = schemaTree;

  for (const segment of path) {
    if (!current) return [];

    // Handle array access - skip [n] or [0] etc
    if (segment.match(/^\[\d*n?\]$/)) {
      current = current['[n]'] ?? null;
      continue;
    }

    current = current[segment] ?? null;
  }

  if (!current) return [];
  return Object.keys(current);
}

// CosmosSQL keywords (uppercase for syntax highlighting)
const KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'BETWEEN',
  'LIKE', 'ORDER', 'BY', 'ASC', 'DESC', 'TOP', 'DISTINCT',
  'AS', 'JOIN', 'VALUE', 'OFFSET', 'LIMIT', 'EXISTS', 'GROUP', 'HAVING',
];

// Cosmos DB literals - must be lowercase in queries
const LITERALS = [
  { label: 'true', detail: 'Boolean true', insertText: 'true' },
  { label: 'false', detail: 'Boolean false', insertText: 'false' },
  { label: 'null', detail: 'Null value', insertText: 'null' },
  { label: 'undefined', detail: 'Undefined value', insertText: 'undefined' },
];

// CosmosSQL built-in functions
const FUNCTIONS = [
  // Array functions
  'ARRAY_CONCAT', 'ARRAY_CONTAINS', 'ARRAY_LENGTH', 'ARRAY_SLICE',
  'SetIntersect', 'SetUnion',
  // Math functions
  'ABS', 'ACOS', 'ASIN', 'ATAN', 'ATN2', 'CEILING', 'COS', 'COT',
  'DEGREES', 'EXP', 'FLOOR', 'LOG', 'LOG10', 'PI', 'POWER',
  'RADIANS', 'RAND', 'ROUND', 'SIGN', 'SIN', 'SQRT', 'SQUARE',
  'TAN', 'TRUNC',
  // String functions
  'CONCAT', 'CONTAINS', 'ENDSWITH', 'INDEX_OF', 'LEFT', 'LENGTH',
  'LOWER', 'LTRIM', 'REPLACE', 'REPLICATE', 'REVERSE', 'RIGHT',
  'RTRIM', 'STARTSWITH', 'StringToArray', 'SUBSTRING', 'ToString',
  'TRIM', 'UPPER', 'RegexMatch',
  // Type checking functions
  'IS_ARRAY', 'IS_BOOL', 'IS_DEFINED', 'IS_NULL', 'IS_NUMBER',
  'IS_OBJECT', 'IS_PRIMITIVE', 'IS_STRING',
  // Aggregate functions
  'AVG', 'COUNT', 'MAX', 'MIN', 'SUM',
  // Spatial functions
  'ST_DISTANCE', 'ST_WITHIN', 'ST_INTERSECTS', 'ST_ISVALID',
  'ST_ISVALIDDETAILED',
  // Date/time functions
  'GetCurrentDateTime', 'GetCurrentTimestamp', 'GetCurrentTicks',
  'DateTimeAdd', 'DateTimeDiff', 'DateTimeFromParts', 'DateTimePart',
  'DateTimeToTicks', 'DateTimeToTimestamp', 'TicksToDateTime',
  'TimestampToDateTime',
  // Other functions
  'COALESCE', 'IIF',
];

// Function signatures for autocomplete descriptions
const FUNCTION_SIGNATURES: Record<string, string> = {
  'ARRAY_CONTAINS': 'ARRAY_CONTAINS(array, value [, partial_match])',
  'ARRAY_LENGTH': 'ARRAY_LENGTH(array)',
  'ARRAY_SLICE': 'ARRAY_SLICE(array, start [, length])',
  'ARRAY_CONCAT': 'ARRAY_CONCAT(array1, array2 [, ...])',
  'CONTAINS': 'CONTAINS(string, substring [, ignoreCase])',
  'STARTSWITH': 'STARTSWITH(string, prefix [, ignoreCase])',
  'ENDSWITH': 'ENDSWITH(string, suffix [, ignoreCase])',
  'INDEX_OF': 'INDEX_OF(string, substring [, start])',
  'SUBSTRING': 'SUBSTRING(string, start, length)',
  'CONCAT': 'CONCAT(string1, string2 [, ...])',
  'LOWER': 'LOWER(string)',
  'UPPER': 'UPPER(string)',
  'TRIM': 'TRIM(string)',
  'LENGTH': 'LENGTH(string)',
  'REPLACE': 'REPLACE(string, find, replace)',
  'RegexMatch': 'RegexMatch(string, pattern [, modifiers])',
  'IS_DEFINED': 'IS_DEFINED(expression)',
  'IS_NULL': 'IS_NULL(expression)',
  'IS_ARRAY': 'IS_ARRAY(expression)',
  'IS_BOOL': 'IS_BOOL(expression)',
  'IS_NUMBER': 'IS_NUMBER(expression)',
  'IS_OBJECT': 'IS_OBJECT(expression)',
  'IS_STRING': 'IS_STRING(expression)',
  'IS_PRIMITIVE': 'IS_PRIMITIVE(expression)',
  'COALESCE': 'COALESCE(expression1, expression2 [, ...])',
  'IIF': 'IIF(condition, true_value, false_value)',
  'ABS': 'ABS(number)',
  'ROUND': 'ROUND(number [, decimals])',
  'FLOOR': 'FLOOR(number)',
  'CEILING': 'CEILING(number)',
  'POWER': 'POWER(base, exponent)',
  'SQRT': 'SQRT(number)',
  'AVG': 'AVG(expression)',
  'COUNT': 'COUNT(expression)',
  'MAX': 'MAX(expression)',
  'MIN': 'MIN(expression)',
  'SUM': 'SUM(expression)',
  'ST_DISTANCE': 'ST_DISTANCE(point1, point2)',
  'ST_WITHIN': 'ST_WITHIN(point, polygon)',
  'ST_INTERSECTS': 'ST_INTERSECTS(geometry1, geometry2)',
  'GetCurrentDateTime': 'GetCurrentDateTime()',
  'GetCurrentTimestamp': 'GetCurrentTimestamp()',
  'DateTimeAdd': 'DateTimeAdd(part, number, datetime)',
  'DateTimeDiff': 'DateTimeDiff(part, startDate, endDate)',
};

/**
 * Register CosmosSQL language with Monaco editor
 */
export function registerCosmosSQL(monaco: any): void {
  // Register the language
  monaco.languages.register({ id: 'cosmossql' });

  // Set language configuration (brackets, comments, etc.)
  monaco.languages.setLanguageConfiguration('cosmossql', {
    comments: {
      lineComment: '--',
      blockComment: ['/*', '*/'],
    },
    brackets: [
      ['[', ']'],
      ['(', ')'],
      ['{', '}'],
    ],
    autoClosingPairs: [
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '{', close: '}' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
    surroundingPairs: [
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '{', close: '}' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
  });

  // Set monarch tokenizer for syntax highlighting
  monaco.languages.setMonarchTokensProvider('cosmossql', {
    ignoreCase: true,
    keywords: KEYWORDS,
    functions: FUNCTIONS,
    literals: ['true', 'false', 'null', 'undefined'],
    operators: [
      '=', '>', '<', '!', '~', '?', ':', '==', '<=', '>=', '!=',
      '&&', '||', '++', '--', '+', '-', '*', '/', '&', '|', '^',
      '%', '<<', '>>', '>>>', '+=', '-=', '*=', '/=', '&=', '|=',
      '^=', '%=', '<<=', '>>=', '>>>='
    ],
    symbols: /[=><!~?:&|+\-*\/\^%]+/,
    escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,

    tokenizer: {
      root: [
        // Identifiers and keywords
        [/[a-zA-Z_]\w*/, {
          cases: {
            '@literals': 'keyword.literal',
            '@keywords': 'keyword',
            '@functions': 'function',
            '@default': 'identifier'
          }
        }],

        // Whitespace
        { include: '@whitespace' },

        // Delimiters and operators
        [/[{}()\[\]]/, '@brackets'],
        [/[<>](?!@symbols)/, '@brackets'],
        [/@symbols/, {
          cases: {
            '@operators': 'operator',
            '@default': ''
          }
        }],

        // Numbers
        [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
        [/\d+/, 'number'],

        // Strings
        [/"([^"\\]|\\.)*$/, 'string.invalid'],
        [/'([^'\\]|\\.)*$/, 'string.invalid'],
        [/"/, 'string', '@string_double'],
        [/'/, 'string', '@string_single'],
      ],

      whitespace: [
        [/[ \t\r\n]+/, 'white'],
        [/--.*$/, 'comment'],
        [/\/\*/, 'comment', '@comment'],
      ],

      comment: [
        [/[^\/*]+/, 'comment'],
        [/\*\//, 'comment', '@pop'],
        [/[\/*]/, 'comment']
      ],

      string_double: [
        [/[^\\"]+/, 'string'],
        [/@escapes/, 'string.escape'],
        [/\\./, 'string.escape.invalid'],
        [/"/, 'string', '@pop']
      ],

      string_single: [
        [/[^\\']+/, 'string'],
        [/@escapes/, 'string.escape'],
        [/\\./, 'string.escape.invalid'],
        [/'/, 'string', '@pop']
      ],
    },
  });

  // Register completion provider for autocomplete
  if (completionDisposable) {
    completionDisposable.dispose();
  }

  completionDisposable = monaco.languages.registerCompletionItemProvider('cosmossql', {
    triggerCharacters: ['.', ' '],
    provideCompletionItems: (model: any, position: any) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      // Check if we're after "c." or deeper path to provide field suggestions
      const lineContent = model.getLineContent(position.lineNumber);
      const textBeforeCursor = lineContent.substring(0, position.column - 1);

      // Match patterns like: c. | c.field. | c.field.nested. | c.field[0]. | c.field[n].
      const pathMatch = textBeforeCursor.match(/c\.([a-zA-Z_][\w]*(?:(?:\[\d*n?\])?\.[\w]*)*)?\.?$/);
      const isAfterPath = pathMatch !== null;

      const suggestions: any[] = [];

      if (isAfterPath) {
        // Extract the path segments
        const fullPath = pathMatch[1] || '';
        const pathSegments = fullPath
          ? fullPath.split(/\./).filter((s: string) => s.length > 0).map((s: string) => {
              // Handle array notation within segment: field[0] -> field, [0]
              const arrayMatch = s.match(/^([a-zA-Z_]\w*)(\[\d*n?\])$/);
              if (arrayMatch) {
                return [arrayMatch[1], arrayMatch[2]];
              }
              return [s];
            }).flat()
          : [];

        // Check if we're completing after a dot (need suggestions for next level)
        const endsWithDot = textBeforeCursor.endsWith('.');

        let targetPath: string[];
        if (endsWithDot) {
          // Suggest children of the current path
          targetPath = pathSegments;
        } else {
          // Suggest siblings (complete current segment)
          targetPath = pathSegments.slice(0, -1);
        }

        const fieldSuggestions = getSuggestionsForPath(targetPath);

        fieldSuggestions.forEach((field, index) => {
          const isArray = field === '[n]';
          suggestions.push({
            label: isArray ? '[0]' : field,
            kind: monaco.languages.CompletionItemKind.Field,
            insertText: isArray ? '[0]' : field,
            detail: isArray ? 'Array index' : 'Document field',
            sortText: String(index).padStart(3, '0'),
            range,
          });
        });
      }

      // Add root-level field suggestions with c. prefix for general context
      if (!isAfterPath && Object.keys(schemaTree).length > 0) {
        Object.keys(schemaTree).forEach((field, index) => {
          suggestions.push({
            label: `c.${field}`,
            kind: monaco.languages.CompletionItemKind.Field,
            insertText: `c.${field}`,
            detail: 'Document field',
            sortText: `1_${String(index).padStart(3, '0')}`,
            range,
          });
        });
      }

      // Keywords
      KEYWORDS.forEach(kw => {
        suggestions.push({
          label: kw,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: kw,
          sortText: `2_${kw}`,
          range,
        });
      });

      // Literals (must be lowercase in Cosmos DB)
      LITERALS.forEach(lit => {
        suggestions.push({
          label: lit.label,
          kind: monaco.languages.CompletionItemKind.Constant,
          insertText: lit.insertText,
          detail: lit.detail,
          sortText: `2_${lit.label}`,
          range,
        });
      });

      // Functions with signatures
      FUNCTIONS.forEach(fn => {
        suggestions.push({
          label: fn,
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: fn + '($0)',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: FUNCTION_SIGNATURES[fn] || fn + '(...)',
          sortText: `3_${fn}`,
          range,
        });
      });

      // Common snippets
      suggestions.push(
        {
          label: 'SELECT * FROM c',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'SELECT * FROM c',
          detail: 'Select all documents',
          sortText: '4_select_all',
          range,
        },
        {
          label: 'SELECT TOP',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'SELECT TOP ${1:10} * FROM c',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'Select top N documents',
          sortText: '4_select_top',
          range,
        },
        {
          label: 'WHERE ARRAY_CONTAINS',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'WHERE ARRAY_CONTAINS(c.${1:field}, ${2:value})',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'Filter by array containing value',
          sortText: '4_where_array',
          range,
        },
        {
          label: 'ORDER BY',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'ORDER BY c.${1:field} ${2|ASC,DESC|}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'Order results',
          sortText: '4_order_by',
          range,
        }
      );

      return { suggestions };
    },
  });
}
