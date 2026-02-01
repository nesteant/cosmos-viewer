/**
 * CosmosSQL Monaco Editor Configuration
 * Provides syntax highlighting and autocomplete for Cosmos DB SQL queries
 */

// CosmosSQL keywords
const KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'BETWEEN',
  'LIKE', 'ORDER', 'BY', 'ASC', 'DESC', 'TOP', 'DISTINCT',
  'AS', 'JOIN', 'VALUE', 'NULL', 'TRUE', 'FALSE', 'UNDEFINED',
  'OFFSET', 'LIMIT', 'EXISTS', 'GROUP', 'HAVING',
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
  monaco.languages.registerCompletionItemProvider('cosmossql', {
    provideCompletionItems: (model: any, position: any) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const suggestions = [
        // Keywords
        ...KEYWORDS.map(kw => ({
          label: kw,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: kw,
          range,
        })),
        // Functions with signatures
        ...FUNCTIONS.map(fn => ({
          label: fn,
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: fn + '($0)',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: FUNCTION_SIGNATURES[fn] || fn + '(...)',
          range,
        })),
        // Common snippets
        {
          label: 'SELECT * FROM c',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'SELECT * FROM c',
          detail: 'Select all documents',
          range,
        },
        {
          label: 'SELECT TOP',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'SELECT TOP ${1:10} * FROM c',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'Select top N documents',
          range,
        },
        {
          label: 'WHERE ARRAY_CONTAINS',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'WHERE ARRAY_CONTAINS(c.${1:field}, ${2:value})',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'Filter by array containing value',
          range,
        },
        {
          label: 'ORDER BY',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'ORDER BY c.${1:field} ${2|ASC,DESC|}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'Order results',
          range,
        },
      ];

      return { suggestions };
    },
  });
}
