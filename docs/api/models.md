# TypeScript Models Reference

## Connection Models

### CosmosConnection

Represents a saved Cosmos DB connection configuration.

```typescript
interface CosmosConnection {
  /** Unique identifier for the connection */
  id: string;

  /** User-friendly name for the connection */
  name: string;

  /** Cosmos DB account endpoint URL */
  endpoint: string;

  /** Cosmos DB account key (primary or secondary) */
  key: string;

  /** Optional default database to select on connect */
  defaultDatabase?: string;

  /** When the connection was created */
  createdAt: Date;

  /** When the connection was last used */
  lastUsedAt?: Date;
}
```

### ConnectionTestResult

Result of testing a connection.

```typescript
interface ConnectionTestResult {
  /** ID of the connection that was tested */
  connectionId: string;

  /** Whether the connection was successful */
  success: boolean;

  /** Number of databases found (if successful) */
  databaseCount?: number;

  /** Error message (if failed) */
  error?: string;
}
```

---

## Document Models

### CosmosDocument

Represents a Cosmos DB document.

```typescript
interface CosmosDocument {
  /** Document ID (required by Cosmos DB) */
  id: string;

  /** Any additional properties */
  [key: string]: any;

  // System properties (read-only, set by Cosmos DB)
  _rid?: string;
  _self?: string;
  _etag?: string;
  _attachments?: string;
  _ts?: number;
}
```

### FlatDocument

Document flattened for table display.

```typescript
interface FlatDocument {
  /** Document ID */
  id: string;

  /** Values at each column path */
  [path: string]: any;
}
```

---

## Query Models

### QueryParams

Parameters for executing a query.

```typescript
interface QueryParams {
  /** ID of the connection to use */
  connectionId: string;

  /** Target database ID */
  databaseId: string;

  /** Target container ID */
  containerId: string;

  /** CosmosSQL query string */
  query: string;

  /** Number of documents per page */
  pageSize: number;

  /** Continuation token for pagination (null for first page) */
  continuationToken: string | null;
}
```

### QueryResult

Result of a query execution.

```typescript
interface QueryResult {
  /** Array of documents returned */
  documents: CosmosDocument[];

  /** Token for fetching next page (null if no more) */
  continuationToken: string | null;

  /** Whether more results are available */
  hasMoreResults: boolean;

  /** Request units consumed by this query */
  requestCharge: number;
}
```

### QueryHistoryItem

Entry in the query history.

```typescript
interface QueryHistoryItem {
  /** The query that was executed */
  query: string;

  /** When the query was executed */
  executedAt: Date;

  /** Database the query was run against */
  databaseId: string;

  /** Container the query was run against */
  containerId: string;
}
```

### ColumnDefinition

Definition of a column detected from documents.

```typescript
interface ColumnDefinition {
  /** JSON path to the value (e.g., "address.city") */
  key: string;

  /** Human-readable column name */
  displayName: string;

  /** Detected data type */
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null';

  /** Whether the value is a nested structure */
  isNested: boolean;

  /** Optional column width for display */
  width?: number;
}
```

---

## Tree Models

### DatabaseInfo

Information about a database.

```typescript
interface DatabaseInfo {
  /** Database ID */
  id: string;

  /** Database name (same as ID in Cosmos DB) */
  name: string;
}
```

### ContainerInfo

Information about a container.

```typescript
interface ContainerInfo {
  /** Container ID */
  id: string;

  /** Container name (same as ID in Cosmos DB) */
  name: string;

  /** Partition key path (e.g., "/userId") */
  partitionKeyPath: string;

  /** Parent database ID */
  databaseId: string;
}
```

### TreeNode

Node in the database explorer tree.

```typescript
interface TreeNode {
  /** Node ID (database or container ID) */
  id: string;

  /** Display name */
  name: string;

  /** Node type */
  type: 'database' | 'container';

  /** Partition key path (containers only) */
  partitionKeyPath?: string;

  /** Parent database ID (containers only) */
  databaseId?: string;

  /** Child nodes (databases have container children) */
  children?: TreeNode[];
}
```

---

## Edit Models

### CellEditEvent

Event emitted when a cell is edited.

```typescript
interface CellEditEvent {
  /** ID of the document being edited */
  documentId: string;

  /** JSON path of the cell (e.g., "name" or "address.city") */
  path: string;

  /** New value for the cell */
  value: any;
}
```

### CellRevertEvent

Event emitted when a cell is reverted.

```typescript
interface CellRevertEvent {
  /** ID of the document */
  documentId: string;

  /** JSON path of the cell to revert */
  path: string;
}
```

### ChangesSummary

Summary of pending changes.

```typescript
interface ChangesSummary {
  /** Number of modified documents */
  modified: number;

  /** Number of documents pending deletion */
  deleted: number;

  /** Number of new documents to create */
  created: number;
}
```

### SaveProgress

Progress of a batch save operation.

```typescript
interface SaveProgress {
  /** Number of operations completed */
  completed: number;

  /** Total number of operations */
  total: number;
}
```

### SaveError

Error from a save operation.

```typescript
interface SaveError {
  /** ID of the document that failed */
  documentId: string;

  /** Error message */
  error: string;
}
```

---

## Dialog Data Models

### ConfirmDialogData

Data passed to confirm dialog.

```typescript
interface ConfirmDialogData {
  /** Dialog title */
  title: string;

  /** Confirmation message */
  message: string;

  /** Text for confirm button */
  confirmText?: string;

  /** Text for cancel button */
  cancelText?: string;

  /** Color of confirm button */
  confirmColor?: 'primary' | 'accent' | 'warn';
}
```

### ExportDialogData

Data passed to export dialog.

```typescript
interface ExportDialogData {
  /** Documents to export */
  documents: CosmosDocument[];

  /** Name of the container for filename */
  containerName: string;
}
```

---

## Type Guards

Useful type guard functions.

```typescript
/** Check if a value is a CosmosDocument */
function isCosmosDocument(value: any): value is CosmosDocument {
  return typeof value === 'object' && value !== null && 'id' in value;
}

/** Check if a node is a database node */
function isDatabaseNode(node: TreeNode): boolean {
  return node.type === 'database';
}

/** Check if a node is a container node */
function isContainerNode(node: TreeNode): boolean {
  return node.type === 'container';
}
```

---

## Utility Types

```typescript
/** Make all properties optional except specified keys */
type PartialExcept<T, K extends keyof T> = Partial<T> & Pick<T, K>;

/** Document without system properties */
type UserDocument = Omit<CosmosDocument, '_rid' | '_self' | '_etag' | '_attachments' | '_ts'>;

/** Connection config for creating (without auto-generated fields) */
type NewConnectionConfig = Omit<CosmosConnection, 'id' | 'createdAt'>;
```
