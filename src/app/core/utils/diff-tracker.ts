import { CosmosDocument } from '../models';
import { getValueAtPath, stringToPath, pathToString, getAllPaths } from './path-utils';

export interface DocumentChange {
  documentId: string;
  path: string;
  originalValue: any;
  newValue: any;
  changeType: 'modified' | 'added' | 'removed';
}

export interface DirtyDocument {
  original: CosmosDocument;
  modified: CosmosDocument;
  changes: Map<string, DocumentChange>;
  documentKey: string; // Composite key: id + partition key value
}

/**
 * Get document ID (supports both 'id' for CosmosSQL and '_id' for MongoDB)
 */
function getDocId(doc: CosmosDocument): string {
  return doc.id ?? (doc as any)._id?.toString() ?? '';
}

/**
 * Creates a composite key from document id and partition key value
 * This ensures uniqueness when documents with same id exist in different partitions
 */
export function createDocumentKey(docId: string, partitionKeyValue?: any): string {
  if (partitionKeyValue === undefined || partitionKeyValue === null) {
    return docId;
  }
  // Use JSON.stringify to handle complex partition key values
  return `${docId}::${JSON.stringify(partitionKeyValue)}`;
}

/**
 * Extracts partition key value from a document given the partition key path
 */
export function extractPartitionKeyValue(doc: CosmosDocument, partitionKeyPath?: string): any {
  if (!partitionKeyPath) return undefined;
  const path = partitionKeyPath.startsWith('/') ? partitionKeyPath.slice(1) : partitionKeyPath;
  const segments = path.split('/');
  let value: any = doc;
  for (const segment of segments) {
    if (value === null || value === undefined) return undefined;
    value = value[segment];
  }
  return value;
}

/**
 * Tracks changes between original and modified documents
 */
export class DiffTracker {
  private dirtyDocuments = new Map<string, DirtyDocument>();
  private partitionKeyPath: string | null = null;

  /**
   * Sets the partition key path for this tracker
   */
  setPartitionKeyPath(path: string | null): void {
    this.partitionKeyPath = path;
  }

  /**
   * Gets the composite key for a document
   */
  private getDocumentKey(doc: CosmosDocument): string {
    const pkValue = extractPartitionKeyValue(doc, this.partitionKeyPath ?? undefined);
    return createDocumentKey(getDocId(doc), pkValue);
  }

  /**
   * Gets the composite key for a document by id (looks up from tracked docs)
   */
  private getKeyById(documentId: string): string | null {
    // First try direct lookup (for backwards compatibility and simple cases)
    if (this.dirtyDocuments.has(documentId)) {
      return documentId;
    }
    // Search for document with matching id in tracked documents
    for (const [key, tracked] of this.dirtyDocuments) {
      if (getDocId(tracked.modified) === documentId) {
        return key;
      }
    }
    return null;
  }

  /**
   * Registers a document for tracking
   */
  trackDocument(doc: CosmosDocument): void {
    const key = this.getDocumentKey(doc);
    if (!this.dirtyDocuments.has(key)) {
      this.dirtyDocuments.set(key, {
        original: structuredClone(doc),
        modified: structuredClone(doc),
        changes: new Map(),
        documentKey: key,
      });
    }
  }

  /**
   * Updates a field in a tracked document
   */
  updateField(documentId: string, path: string, newValue: any): void {
    const key = this.getKeyById(documentId);
    if (!key) return;
    const tracked = this.dirtyDocuments.get(key);
    if (!tracked) return;

    const pathArray = stringToPath(path);
    const originalValue = getValueAtPath(tracked.original, pathArray);

    // Update the modified document
    setNestedValueMutable(tracked.modified, pathArray, newValue);

    // Track the change
    if (deepEqual(originalValue, newValue)) {
      tracked.changes.delete(path);
    } else {
      tracked.changes.set(path, {
        documentId,
        path,
        originalValue,
        newValue,
        changeType: originalValue === undefined ? 'added' : 'modified',
      });
    }

    // Clean up if no changes remain
    if (tracked.changes.size === 0) {
      tracked.modified = structuredClone(tracked.original);
    }
  }

  /**
   * Gets all changes for a document
   */
  getDocumentChanges(documentId: string): DocumentChange[] {
    const key = this.getKeyById(documentId);
    if (!key) return [];
    const tracked = this.dirtyDocuments.get(key);
    if (!tracked) return [];
    return Array.from(tracked.changes.values());
  }

  /**
   * Checks if a specific field is dirty
   */
  isFieldDirty(documentId: string, path: string): boolean {
    const key = this.getKeyById(documentId);
    if (!key) return false;
    const tracked = this.dirtyDocuments.get(key);
    return tracked?.changes.has(path) ?? false;
  }

  /**
   * Checks if a document has any changes
   */
  isDocumentDirty(documentId: string): boolean {
    const key = this.getKeyById(documentId);
    if (!key) return false;
    const tracked = this.dirtyDocuments.get(key);
    return (tracked?.changes.size ?? 0) > 0;
  }

  /**
   * Gets all dirty documents
   */
  getAllDirtyDocuments(): DirtyDocument[] {
    return Array.from(this.dirtyDocuments.values()).filter(
      (d) => d.changes.size > 0
    );
  }

  /**
   * Gets the modified version of a document
   */
  getModifiedDocument(documentId: string): CosmosDocument | undefined {
    const key = this.getKeyById(documentId);
    if (!key) return undefined;
    return this.dirtyDocuments.get(key)?.modified;
  }

  /**
   * Discards changes and reverts to original
   */
  discardChanges(documentId: string): void {
    const key = this.getKeyById(documentId);
    if (!key) return;
    const tracked = this.dirtyDocuments.get(key);
    if (tracked) {
      tracked.modified = structuredClone(tracked.original);
      tracked.changes.clear();
    }
  }

  /**
   * Discards all changes
   */
  discardAllChanges(): void {
    for (const [key] of this.dirtyDocuments) {
      const tracked = this.dirtyDocuments.get(key);
      if (tracked) {
        tracked.modified = structuredClone(tracked.original);
        tracked.changes.clear();
      }
    }
  }

  /**
   * Commits changes (updates original to match modified)
   */
  commitChanges(documentId: string, updatedDoc?: CosmosDocument): void {
    const key = this.getKeyById(documentId);
    if (!key) return;
    const tracked = this.dirtyDocuments.get(key);
    if (tracked) {
      const newDoc = updatedDoc ?? tracked.modified;
      tracked.original = structuredClone(newDoc);
      tracked.modified = structuredClone(newDoc);
      tracked.changes.clear();
    }
  }

  /**
   * Removes a document from tracking
   */
  untrackDocument(documentId: string): void {
    const key = this.getKeyById(documentId);
    if (key) {
      this.dirtyDocuments.delete(key);
    }
  }

  /**
   * Clears all tracked documents
   */
  clear(): void {
    this.dirtyDocuments.clear();
  }

  /**
   * Gets count of dirty documents
   */
  getDirtyCount(): number {
    return this.getAllDirtyDocuments().length;
  }
}

/**
 * Deep equality check
 */
function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return a === b;

  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  return keysA.every((key) => deepEqual(a[key], b[key]));
}

/**
 * Sets a nested value mutably
 */
function setNestedValueMutable(
  obj: any,
  path: (string | number)[],
  value: any
): void {
  let current = obj;

  for (let i = 0; i < path.length - 1; i++) {
    const segment = path[i];
    const nextSegment = path[i + 1];

    if (current[segment] === undefined || current[segment] === null) {
      current[segment] = typeof nextSegment === 'number' ? [] : {};
    }

    current = current[segment];
  }

  if (path.length > 0) {
    current[path[path.length - 1]] = value;
  }
}
