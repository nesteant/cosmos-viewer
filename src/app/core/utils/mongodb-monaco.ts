/**
 * MongoDB Monaco Editor Configuration
 * Provides syntax highlighting and autocomplete for MongoDB queries
 * Supports both strict JSON and relaxed JSON5 syntax (unquoted keys)
 */

// Store for dynamic field suggestions - nested schema tree
interface SchemaNode {
  [key: string]: SchemaNode | null;
}
let mongoSchemaTree: SchemaNode = {};
let mongoCompletionDisposable: any = null;
let mongoTokensDisposable: any = null;
let monacoInstance: any = null;

// Flatten schema tree to get all field paths
function getFlatFieldNames(schema: SchemaNode, prefix = ''): string[] {
  const fields: string[] = [];
  for (const key of Object.keys(schema)) {
    if (key === '$elem') continue; // Skip array marker
    const fullPath = prefix ? `${prefix}.${key}` : key;
    fields.push(key); // Add just the key name for highlighting
    fields.push(fullPath); // Add full path for nested fields
    const child = schema[key];
    if (child && typeof child === 'object') {
      fields.push(...getFlatFieldNames(child, fullPath));
    }
  }
  return [...new Set(fields)]; // Remove duplicates
}

/**
 * Build schema tree from documents
 */
export function updateMongoSchemaFromDocuments(documents: any[]): void {
  if (!documents || documents.length === 0) {
    mongoSchemaTree = {};
    updateTokenizer();
    return;
  }

  const sampleSize = Math.min(50, documents.length);
  const sampledDocs = documents.slice(0, sampleSize);

  const docsPerRootKey = new Map<string, any[]>();

  for (const doc of sampledDocs) {
    if (!doc || typeof doc !== 'object') continue;

    for (const key of Object.keys(doc)) {
      if (!docsPerRootKey.has(key)) {
        docsPerRootKey.set(key, []);
      }
      const docs = docsPerRootKey.get(key)!;
      if (docs.length < 10) {
        docs.push(doc);
      }
    }
  }

  mongoSchemaTree = {};

  for (const [rootKey, docs] of docsPerRootKey) {
    let mergedSchema: SchemaNode | null = null;

    for (const doc of docs) {
      const value = doc[rootKey];
      const nodeSchema = buildSchemaNode(value, 5);
      mergedSchema = mergeSchemaNodes(mergedSchema, nodeSchema);
    }

    mongoSchemaTree[rootKey] = mergedSchema;
  }

  // Update tokenizer with new field names
  updateTokenizer();
}

function buildSchemaNode(value: any, maxDepth: number): SchemaNode | null {
  if (maxDepth <= 0) return null;
  if (value === null || value === undefined) return null;

  if (Array.isArray(value)) {
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

    if (itemSchema) {
      return { '$elem': itemSchema };
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

  return null;
}

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

// MongoDB query operators
const MONGO_OPERATORS = [
  // Comparison
  '$eq', '$ne', '$gt', '$gte', '$lt', '$lte', '$in', '$nin',
  // Logical
  '$and', '$or', '$not', '$nor',
  // Element
  '$exists', '$type',
  // Array
  '$all', '$elemMatch', '$size',
  // Evaluation
  '$regex', '$options', '$mod', '$text', '$search', '$where', '$expr',
  // Aggregation stages
  '$match', '$group', '$project', '$sort', '$limit', '$skip', '$unwind',
  '$lookup', '$count', '$addFields', '$set', '$replaceRoot', '$facet',
  // Aggregation operators
  '$sum', '$avg', '$min', '$max', '$first', '$last', '$push', '$addToSet',
  '$cond', '$ifNull', '$switch', '$concat', '$substr', '$toLower', '$toUpper',
  '$dateFromString', '$dateToString', '$year', '$month', '$dayOfMonth',
  '$add', '$subtract', '$multiply', '$divide', '$abs', '$ceil', '$floor',
];

// Operators with details for autocomplete
const COMPARISON_OPERATORS = [
  { label: '$eq', detail: 'Equals a specified value', insertText: '$eq: ${1:value}' },
  { label: '$ne', detail: 'Not equal to a specified value', insertText: '$ne: ${1:value}' },
  { label: '$gt', detail: 'Greater than a specified value', insertText: '$gt: ${1:value}' },
  { label: '$gte', detail: 'Greater than or equal to', insertText: '$gte: ${1:value}' },
  { label: '$lt', detail: 'Less than a specified value', insertText: '$lt: ${1:value}' },
  { label: '$lte', detail: 'Less than or equal to', insertText: '$lte: ${1:value}' },
  { label: '$in', detail: 'Matches any value in array', insertText: '$in: [${1:value1}, ${2:value2}]' },
  { label: '$nin', detail: 'Matches none of values in array', insertText: '$nin: [${1:value1}, ${2:value2}]' },
];

const LOGICAL_OPERATORS = [
  { label: '$and', detail: 'Joins with logical AND', insertText: '$and: [{ ${1:expr1} }, { ${2:expr2} }]' },
  { label: '$or', detail: 'Joins with logical OR', insertText: '$or: [{ ${1:expr1} }, { ${2:expr2} }]' },
  { label: '$not', detail: 'Inverts the effect of query', insertText: '$not: { ${1:expression} }' },
  { label: '$nor', detail: 'Joins with logical NOR', insertText: '$nor: [{ ${1:expr1} }, { ${2:expr2} }]' },
];

const ELEMENT_OPERATORS = [
  { label: '$exists', detail: 'Matches if field exists', insertText: '$exists: ${1|true,false|}' },
  { label: '$type', detail: 'Matches field type', insertText: '$type: "${1|string,number,object,array,bool,null|}"' },
];

const ARRAY_OPERATORS = [
  { label: '$all', detail: 'Matches arrays containing all elements', insertText: '$all: [${1:value1}, ${2:value2}]' },
  { label: '$elemMatch', detail: 'Matches if element matches all conditions', insertText: '$elemMatch: { ${1:condition} }' },
  { label: '$size', detail: 'Matches array with specific size', insertText: '$size: ${1:number}' },
];

const EVALUATION_OPERATORS = [
  { label: '$regex', detail: 'Matches values with regex', insertText: '$regex: "${1:pattern}", $options: "${2:i}"' },
  { label: '$mod', detail: 'Modulo operation', insertText: '$mod: [${1:divisor}, ${2:remainder}]' },
  { label: '$text', detail: 'Text search', insertText: '$text: { $search: "${1:term}" }' },
  { label: '$expr', detail: 'Aggregation expression', insertText: '$expr: { ${1:expression} }' },
];

const AGGREGATION_STAGES = [
  { label: '$match', detail: 'Filter documents', insertText: '$match: { ${1:filter} }' },
  { label: '$group', detail: 'Group by expression', insertText: '$group: { _id: "$${1:field}", ${2:acc}: { $${3:sum}: 1 } }' },
  { label: '$project', detail: 'Reshape documents', insertText: '$project: { ${1:field}: 1 }' },
  { label: '$sort', detail: 'Sort documents', insertText: '$sort: { ${1:field}: ${2|-1,1|} }' },
  { label: '$limit', detail: 'Limit results', insertText: '$limit: ${1:number}' },
  { label: '$skip', detail: 'Skip documents', insertText: '$skip: ${1:number}' },
  { label: '$unwind', detail: 'Deconstruct array field', insertText: '$unwind: "$${1:arrayField}"' },
  { label: '$lookup', detail: 'Left outer join', insertText: '$lookup: {\n  from: "${1:collection}",\n  localField: "${2:local}",\n  foreignField: "${3:foreign}",\n  as: "${4:output}"\n}' },
  { label: '$count', detail: 'Count documents', insertText: '$count: "${1:countField}"' },
  { label: '$addFields', detail: 'Add new fields', insertText: '$addFields: { ${1:newField}: ${2:expression} }' },
];

const AGGREGATION_OPERATORS = [
  { label: '$sum', detail: 'Sum values', insertText: '$sum: "$${1:field}"' },
  { label: '$avg', detail: 'Average value', insertText: '$avg: "$${1:field}"' },
  { label: '$min', detail: 'Minimum value', insertText: '$min: "$${1:field}"' },
  { label: '$max', detail: 'Maximum value', insertText: '$max: "$${1:field}"' },
  { label: '$first', detail: 'First value in group', insertText: '$first: "$${1:field}"' },
  { label: '$last', detail: 'Last value in group', insertText: '$last: "$${1:field}"' },
  { label: '$push', detail: 'Push to array', insertText: '$push: "$${1:field}"' },
  { label: '$addToSet', detail: 'Add unique to array', insertText: '$addToSet: "$${1:field}"' },
  { label: '$cond', detail: 'Conditional expression', insertText: '$cond: { if: { ${1:condition} }, then: ${2:true}, else: ${3:false} }' },
  { label: '$ifNull', detail: 'Return value if null', insertText: '$ifNull: ["$${1:field}", ${2:default}]' },
];

const ALL_OPERATORS = [
  ...COMPARISON_OPERATORS,
  ...LOGICAL_OPERATORS,
  ...ELEMENT_OPERATORS,
  ...ARRAY_OPERATORS,
  ...EVALUATION_OPERATORS,
  ...AGGREGATION_STAGES,
  ...AGGREGATION_OPERATORS,
];

// MongoDB query snippets
const QUERY_SNIPPETS = [
  { label: 'Find All', detail: 'Find all documents', insertText: '{}' },
  { label: 'Find by _id', detail: 'Find document by _id', insertText: '{ _id: "${1:id}" }' },
  { label: 'Find by field', detail: 'Find with field condition', insertText: '{ ${1:field}: "${2:value}" }' },
  { label: 'Find not null', detail: 'Find where field is not null', insertText: '{ ${1:field}: { $ne: null } }' },
  { label: 'Find with regex', detail: 'Case-insensitive regex search', insertText: '{ ${1:field}: { $regex: "${2:pattern}", $options: "i" } }' },
  { label: 'Find in array', detail: 'Find where field is in array', insertText: '{ ${1:field}: { $in: [${2:values}] } }' },
  { label: 'Find with AND', detail: 'Multiple conditions (AND)', insertText: '{\n  $and: [\n    { ${1:field1}: ${2:value1} },\n    { ${3:field2}: ${4:value2} }\n  ]\n}' },
  { label: 'Find with OR', detail: 'Multiple conditions (OR)', insertText: '{\n  $or: [\n    { ${1:field1}: ${2:value1} },\n    { ${3:field2}: ${4:value2} }\n  ]\n}' },
  { label: 'Find range', detail: 'Find within numeric range', insertText: '{ ${1:field}: { $gte: ${2:min}, $lte: ${3:max} } }' },
  { label: 'Find exists', detail: 'Find where field exists', insertText: '{ ${1:field}: { $exists: true } }' },
  { label: 'Aggregation pipeline', detail: 'Basic aggregation pipeline', insertText: '[\n  { $match: { ${1:filter} } },\n  { $group: { _id: "$${2:field}", count: { $sum: 1 } } },\n  { $sort: { count: -1 } }\n]' },
  { label: 'Aggregation with lookup', detail: 'Join with another collection', insertText: '[\n  { $match: { ${1:filter} } },\n  {\n    $lookup: {\n      from: "${2:collection}",\n      localField: "${3:localField}",\n      foreignField: "${4:foreignField}",\n      as: "${5:joined}"\n    }\n  }\n]' },
];

/**
 * Update the tokenizer with current schema fields
 */
function updateTokenizer(): void {
  if (!monacoInstance) return;

  const fieldNames = getFlatFieldNames(mongoSchemaTree);

  // Dispose old tokenizer
  if (mongoTokensDisposable) {
    mongoTokensDisposable.dispose();
  }

  // Re-register tokenizer with updated field names
  mongoTokensDisposable = monacoInstance.languages.setMonarchTokensProvider('mongodb', createTokenizer(fieldNames));
}

/**
 * Create a Monarch tokenizer with the given field names
 */
function createTokenizer(fieldNames: string[]) {
  return {
    defaultToken: '',

    keywords: ['true', 'false', 'null'],
    operators: MONGO_OPERATORS,
    fields: fieldNames,

    escapes: /\\(?:["\\/bfnrt]|u[0-9A-Fa-f]{4})/,

    tokenizer: {
      root: [
        // Whitespace
        [/[ \t\r\n]+/, 'white'],

        // Comments
        [/\/\/.*$/, 'comment'],
        [/\/\*/, 'comment', '@comment'],

        // MongoDB operators ($ prefixed) - both quoted and unquoted
        // Using 'keyword' for purple highlighting in vs-dark
        [/"\$[a-zA-Z_][a-zA-Z0-9_]*"/, 'keyword'],
        [/\$[a-zA-Z_][a-zA-Z0-9_]*/, 'keyword'],

        // Quoted string that might be a field name (key position)
        // Using 'type' for known fields (teal/cyan in vs-dark)
        // Using 'identifier' for unknown keys (light blue in vs-dark)
        [/"([^"\\]|\\.)*"(?=\s*:)/, {
          cases: {
            '@fields': 'type.identifier',
            '@default': 'identifier'
          }
        }],

        // Regular quoted strings
        [/"([^"\\]|\\.)*$/, 'string.invalid'],
        [/"/, 'string', '@string'],

        // Single-quoted strings
        [/'([^'\\]|\\.)*$/, 'string.invalid'],
        [/'/, 'string', '@stringSingle'],

        // Unquoted keys (before colon) - check if it's a known field
        [/[a-zA-Z_][a-zA-Z0-9_]*(?=\s*:)/, {
          cases: {
            '@fields': 'type.identifier',
            '@default': 'identifier'
          }
        }],

        // Field reference in aggregation (e.g., "$fieldName")
        [/"\$[a-zA-Z_][a-zA-Z0-9_.]*"/, 'variable'],

        // Keywords (true, false, null)
        [/true|false|null/, 'keyword.json'],

        // Numbers
        [/-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/, 'number'],
        [/-?\.?\d+/, 'number'],
        [/Infinity|-Infinity|NaN/, 'number'],

        // Delimiters
        [/[{}]/, 'delimiter.bracket'],
        [/[[\]]/, 'delimiter.array'],
        [/[,:]/, 'delimiter'],
      ],

      string: [
        [/[^\\"]+/, 'string'],
        [/@escapes/, 'string.escape'],
        [/\\./, 'string.escape.invalid'],
        [/"/, 'string', '@pop'],
      ],

      stringSingle: [
        [/[^\\']+/, 'string'],
        [/@escapes/, 'string.escape'],
        [/\\./, 'string.escape.invalid'],
        [/'/, 'string', '@pop'],
      ],

      comment: [
        [/[^/*]+/, 'comment'],
        [/\*\//, 'comment', '@pop'],
        [/[/*]/, 'comment'],
      ],
    },
  };
}

/**
 * Register MongoDB language with Monaco editor
 */
export function registerMongoDB(monaco: any): void {
  monacoInstance = monaco;

  // Register custom language ID for MongoDB queries
  monaco.languages.register({ id: 'mongodb' });

  // Initial tokenizer registration (empty fields)
  // Uses standard token types that work with vs-dark theme:
  // - 'keyword' (purple) for MongoDB operators ($ne, $and, etc.)
  // - 'type.identifier' (teal/cyan) for known document fields
  // - 'identifier' (light blue) for unknown keys
  // - 'variable' (light blue) for field references ("$fieldName")
  // - 'string' (orange) for string values
  // - 'number' (light green) for numbers
  // - 'comment' (green) for comments
  mongoTokensDisposable = monaco.languages.setMonarchTokensProvider('mongodb', createTokenizer([]));

  // Language configuration
  monaco.languages.setLanguageConfiguration('mongodb', {
    comments: {
      lineComment: '//',
      blockComment: ['/*', '*/'],
    },
    brackets: [
      ['{', '}'],
      ['[', ']'],
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
    wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\#\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g,
  });

  // Register completion provider
  if (mongoCompletionDisposable) {
    mongoCompletionDisposable.dispose();
  }

  mongoCompletionDisposable = monaco.languages.registerCompletionItemProvider('mongodb', {
    triggerCharacters: ['{', ',', ':', '$', '"', "'", ' '],
    provideCompletionItems: (model: any, position: any) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const lineContent = model.getLineContent(position.lineNumber);
      const textBeforeCursor = lineContent.substring(0, position.column - 1);
      const fullText = model.getValue();

      const suggestions: any[] = [];

      // Detect context
      const isAfterColon = /:\s*$/.test(textBeforeCursor);
      const isAfterOpenBrace = /\{\s*$/.test(textBeforeCursor);
      const isAfterComma = /,\s*$/.test(textBeforeCursor);
      const isTypingOperator = /\$\w*$/.test(textBeforeCursor);
      const isInArray = /\[\s*\{?\s*$/.test(textBeforeCursor) || isArrayContext(fullText, position);

      // Typing a $ operator
      if (isTypingOperator) {
        const partialOp = textBeforeCursor.match(/(\$\w*)$/)?.[1] || '';

        ALL_OPERATORS
          .filter(op => op.label.toLowerCase().startsWith(partialOp.toLowerCase()))
          .forEach((op, index) => {
            // Monaco preserves what matches the label, so we need to:
            // 1. Complete the operator name (what's left after partialOp)
            // 2. Add the rest of the insertText (everything after the operator name)
            const opName = op.label; // e.g., "$ne"
            const restOfOp = opName.substring(partialOp.length); // e.g., "e" if user typed "$n"
            // Get the part after the operator name from insertText
            const afterOp = op.insertText.substring(opName.length); // e.g., ": ${1:value}"
            const completionText = restOfOp + afterOp; // e.g., "e: ${1:value}" or ": ${1:value}"

            suggestions.push({
              label: op.label,
              kind: monaco.languages.CompletionItemKind.Keyword,
              insertText: completionText,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              detail: op.detail,
              documentation: `MongoDB operator: ${op.label}`,
              sortText: String(index).padStart(3, '0'),
              // Range starts at cursor position (insert, don't replace)
              range: {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: position.column,
                endColumn: position.column,
              },
            });
          });
        return { suggestions };
      }

      // After { or , - suggest field names and operators
      if (isAfterOpenBrace || isAfterComma) {
        // Document fields from schema (prioritized)
        Object.keys(mongoSchemaTree).forEach((field, index) => {
          suggestions.push({
            label: field,
            kind: monaco.languages.CompletionItemKind.Field,
            insertText: `${field}: `,
            detail: 'Document field',
            sortText: `0_${String(index).padStart(3, '0')}`,
            range,
          });
        });

        // Operators
        ALL_OPERATORS.forEach((op, index) => {
          suggestions.push({
            label: op.label,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: op.insertText,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: op.detail,
            sortText: `1_${String(index).padStart(3, '0')}`,
            filterText: op.label,
            range,
          });
        });
      }

      // After : - suggest values, operators for conditions
      if (isAfterColon) {
        suggestions.push(
          {
            label: '{ }',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '{ ${1} }',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: 'Object value',
            sortText: '0_object',
            range,
          },
          {
            label: '[ ]',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '[ ${1} ]',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: 'Array value',
            sortText: '0_array',
            range,
          },
          {
            label: 'null',
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: 'null',
            detail: 'Null value',
            sortText: '0_null',
            range,
          },
          {
            label: 'true',
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: 'true',
            sortText: '0_true',
            range,
          },
          {
            label: 'false',
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: 'false',
            sortText: '0_false',
            range,
          }
        );

        // Comparison operator patterns
        COMPARISON_OPERATORS.forEach((op, index) => {
          suggestions.push({
            label: `{ ${op.label}: ... }`,
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: `{ ${op.insertText} }`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: op.detail,
            sortText: `1_${String(index).padStart(3, '0')}`,
            range,
          });
        });
      }

      // In array context (aggregation pipeline)
      if (isInArray) {
        AGGREGATION_STAGES.forEach((stage, index) => {
          suggestions.push({
            label: `{ ${stage.label}: ... }`,
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: `{ ${stage.insertText} }`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: stage.detail,
            sortText: String(index).padStart(3, '0'),
            range,
          });
        });
      }

      // Always show snippets as fallback
      if (suggestions.length === 0) {
        QUERY_SNIPPETS.forEach((snippet, index) => {
          suggestions.push({
            label: snippet.label,
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: snippet.insertText,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: snippet.detail,
            sortText: `9_${String(index).padStart(3, '0')}`,
            range,
          });
        });
      }

      return { suggestions };
    },
  });
}

/**
 * Check if cursor is inside an array context (for aggregation pipeline)
 */
function isArrayContext(text: string, position: any): boolean {
  const beforeCursor = text.split('\n').slice(0, position.lineNumber).join('\n') +
    text.split('\n')[position.lineNumber - 1]?.substring(0, position.column - 1);

  let braceCount = 0;
  let bracketCount = 0;

  for (const char of beforeCursor) {
    if (char === '{') braceCount++;
    if (char === '}') braceCount--;
    if (char === '[') bracketCount++;
    if (char === ']') bracketCount--;
  }

  return bracketCount > 0 && braceCount <= 1;
}
