# ADR-005: Dirty State Tracking for Document Editing

## Status
**Accepted**

## Context

The application needs to support editing Cosmos DB documents similar to how DataGrip or DBeaver handle database record editing:

- Edit individual cell values
- See which cells have been modified (dirty state)
- Revert individual changes or all changes
- Batch commit all changes at once
- Track new documents and pending deletions

### Requirements

1. Cell-level change tracking (not just document-level)
2. Visual indication of modified cells
3. Ability to revert single cell, single document, or all changes
4. Batch commit/discard operations
5. Support for nested JSON paths (e.g., `address.city`)

### Options Considered

1. **Immutable snapshots with diff on commit** (compare on save)
2. **Event-sourced changes** (record each change as event)
3. **Original + Modified document maps** (store both versions)
4. **Path-based dirty tracking** (track modified paths per document)

## Decision

We will use a **Path-based dirty tracking** approach combined with **Original + Modified document maps**.

## Rationale

### Why This Approach?

| Criterion | Snapshots | Event-sourced | Our Approach |
|-----------|-----------|---------------|--------------|
| Cell-level tracking | Compute on demand | Yes (complex) | Yes (simple) |
| Memory efficiency | Good | Grows over time | Good |
| Revert single cell | Compute diff | Replay events | Direct lookup |
| Implementation complexity | Medium | High | Medium |
| Performance | Good | Variable | Good |

### Key Design

1. **Original Documents Map**: Store pristine copy when query executes
2. **Modified Documents Map**: Store only documents with changes
3. **Dirty Paths Map**: Track which JSON paths changed per document
4. **Pending Deletions Set**: Documents marked for deletion
5. **New Documents Array**: Documents to be created

## Implementation

### State Interface

```typescript
interface DocumentsState {
  // Original documents keyed by ID (pristine copies)
  originalDocuments: Record<string, CosmosDocument>;

  // Modified documents keyed by ID (only dirty documents)
  modifiedDocuments: Record<string, CosmosDocument>;

  // Dirty paths per document (documentId -> Set of JSON paths)
  dirtyPaths: Record<string, Set<string>>;

  // Documents pending deletion
  pendingDeletions: Set<string>;

  // New documents not yet saved
  newDocuments: CosmosDocument[];

  // Saving state
  isSaving: boolean;
  saveProgress: { completed: number; total: number } | null;
  saveErrors: Array<{ documentId: string; error: string }>;
}
```

### Core Operations

#### Tracking Documents

When query results arrive:

```typescript
trackDocuments(documents: CosmosDocument[]) {
  const originals: Record<string, CosmosDocument> = {};

  documents.forEach(doc => {
    // Deep clone to preserve original
    originals[doc.id] = structuredClone(doc);
  });

  patchState(store, {
    originalDocuments: originals,
    modifiedDocuments: {},
    dirtyPaths: {},
  });
}
```

#### Updating a Cell

```typescript
updateCell(documentId: string, path: string, value: any) {
  const original = store.originalDocuments()[documentId];
  if (!original) return;

  // Get or clone modified document
  let modified = store.modifiedDocuments()[documentId]
    ?? structuredClone(original);

  // Set value at path (e.g., "address.city" → value)
  setValueAtPath(modified, path, value);

  // Track dirty path
  const paths = new Set(store.dirtyPaths()[documentId] ?? []);
  const originalValue = getValueAtPath(original, path);

  if (deepEquals(originalValue, value)) {
    // Value reverted to original
    paths.delete(path);
  } else {
    // Value changed
    paths.add(path);
  }

  // Update state
  const modifiedDocs = { ...store.modifiedDocuments() };
  const dirtyPathsMap = { ...store.dirtyPaths() };

  if (paths.size === 0) {
    // No more changes for this document
    delete modifiedDocs[documentId];
    delete dirtyPathsMap[documentId];
  } else {
    modifiedDocs[documentId] = modified;
    dirtyPathsMap[documentId] = paths;
  }

  patchState(store, {
    modifiedDocuments: modifiedDocs,
    dirtyPaths: dirtyPathsMap,
  });
}
```

#### Checking if Cell is Dirty

```typescript
// Computed signal
isCellDirty = computed(() => (documentId: string, path: string) => {
  return store.dirtyPaths()[documentId]?.has(path) ?? false;
});

// Usage in component
<td [class.dirty]="documentsStore.isCellDirty()(doc.id, 'address.city')">
  {{ doc.address.city }}
</td>
```

#### Reverting a Cell

```typescript
revertCell(documentId: string, path: string) {
  const original = store.originalDocuments()[documentId];
  const originalValue = getValueAtPath(original, path);

  // This will detect it matches original and remove from dirty
  store.updateCell(documentId, path, originalValue);
}
```

#### Committing Changes

```typescript
commitChanges: rxMethod<void>(
  pipe(
    tap(() => patchState(store, {
      isSaving: true,
      saveErrors: [],
      saveProgress: { completed: 0, total: store.pendingChangesCount() },
    })),
    switchMap(() => {
      const operations: Observable<BatchResult>[] = [];
      let completed = 0;

      // Updates
      Object.entries(store.modifiedDocuments()).forEach(([id, doc]) => {
        operations.push(
          from(electronService.updateDocument({
            connectionId,
            databaseId,
            containerId,
            document: doc,
            partitionKey: getPartitionKey(doc),
          })).pipe(
            tap(() => {
              completed++;
              patchState(store, {
                saveProgress: { completed, total: store.pendingChangesCount() }
              });
            }),
            map(() => ({ type: 'update', id, success: true })),
            catchError(err => of({ type: 'update', id, success: false, error: err.message }))
          )
        );
      });

      // Deletions
      store.pendingDeletions().forEach(id => {
        const doc = store.originalDocuments()[id];
        operations.push(
          from(electronService.deleteDocument({
            connectionId,
            databaseId,
            containerId,
            documentId: id,
            partitionKey: getPartitionKey(doc),
          })).pipe(
            // ... similar pattern
          )
        );
      });

      // Creates
      store.newDocuments().forEach(doc => {
        operations.push(
          from(electronService.createDocument({
            connectionId,
            databaseId,
            containerId,
            document: doc,
          })).pipe(
            // ... similar pattern
          )
        );
      });

      return forkJoin(operations);
    }),
    tapResponse({
      next: (results) => {
        const errors = results.filter(r => !r.success);

        if (errors.length === 0) {
          // All succeeded - reset dirty state
          patchState(store, {
            modifiedDocuments: {},
            dirtyPaths: {},
            pendingDeletions: new Set(),
            newDocuments: [],
            isSaving: false,
            saveProgress: null,
          });
          // Re-execute query to refresh
          queryStore.executeQuery({ pageSize: 100 });
        } else {
          patchState(store, {
            isSaving: false,
            saveProgress: null,
            saveErrors: errors.map(e => ({ documentId: e.id, error: e.error! })),
          });
        }
      },
      error: (error) => { /* handle */ },
    })
  )
)
```

### Utility Functions

```typescript
// path-utils.ts

/**
 * Get value at a JSON path like "address.city" or "items[0].name"
 */
export function getValueAtPath(obj: any, path: string): any {
  const parts = path.split(/[.\[\]]/).filter(Boolean);
  let current = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[part];
  }

  return current;
}

/**
 * Set value at a JSON path
 */
export function setValueAtPath(obj: any, path: string, value: any): void {
  const parts = path.split(/[.\[\]]/).filter(Boolean);
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] === undefined) {
      // Create intermediate object/array
      current[part] = isNaN(Number(parts[i + 1])) ? {} : [];
    }
    current = current[part];
  }

  current[parts[parts.length - 1]] = value;
}

/**
 * Deep equality check
 */
export function deepEquals(a: any, b: any): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;

  if (typeof a === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    return keysA.every(key => deepEquals(a[key], b[key]));
  }

  return false;
}
```

### UI Integration

```scss
// Dirty cell styling
.cell {
  &.dirty {
    background-color: rgba(255, 193, 7, 0.2);  // Yellow highlight
    border-left: 3px solid #ffc107;
  }

  &.pending-delete {
    background-color: rgba(244, 67, 54, 0.2);  // Red highlight
    text-decoration: line-through;
  }

  &.new-row {
    background-color: rgba(76, 175, 80, 0.2);  // Green highlight
  }
}
```

```html
<!-- Changes toolbar -->
<div class="changes-toolbar" *ngIf="documentsStore.hasDirtyChanges()">
  <span>
    {{ documentsStore.changesSummary().modified }} modified,
    {{ documentsStore.changesSummary().deleted }} deleted,
    {{ documentsStore.changesSummary().created }} new
  </span>

  <button mat-button (click)="documentsStore.discardAllChanges()">
    Discard All
  </button>

  <button mat-raised-button color="primary"
          [disabled]="documentsStore.isSaving()"
          (click)="documentsStore.commitChanges()">
    Commit Changes
  </button>
</div>
```

## Consequences

### Positive
- Cell-level granularity for change tracking
- Efficient - only stores changed documents
- Easy to revert individual cells or documents
- Visual feedback for users on what changed
- Batch operations reduce API calls

### Negative
- Need to maintain two document maps
- Path-based tracking adds complexity
- Deep cloning has memory overhead for large documents

### Neutral
- Need careful handling of nested paths
- Array modifications need special handling

## References

- [structuredClone() MDN](https://developer.mozilla.org/en-US/docs/Web/API/structuredClone)
- [DataGrip Edit Data](https://www.jetbrains.com/help/datagrip/editing-data.html)
