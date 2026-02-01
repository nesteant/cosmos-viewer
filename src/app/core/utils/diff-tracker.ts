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
}

/**
 * Tracks changes between original and modified documents
 */
export class DiffTracker {
  private dirtyDocuments = new Map<string, DirtyDocument>();

  /**
   * Registers a document for tracking
   */
  trackDocument(doc: CosmosDocument): void {
    if (!this.dirtyDocuments.has(doc.id)) {
      this.dirtyDocuments.set(doc.id, {
        original: structuredClone(doc),
        modified: structuredClone(doc),
        changes: new Map(),
      });
    }
  }

  /**
   * Updates a field in a tracked document
   */
  updateField(documentId: string, path: string, newValue: any): void {
    const tracked = this.dirtyDocuments.get(documentId);
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
    const tracked = this.dirtyDocuments.get(documentId);
    if (!tracked) return [];
    return Array.from(tracked.changes.values());
  }

  /**
   * Checks if a specific field is dirty
   */
  isFieldDirty(documentId: string, path: string): boolean {
    const tracked = this.dirtyDocuments.get(documentId);
    return tracked?.changes.has(path) ?? false;
  }

  /**
   * Checks if a document has any changes
   */
  isDocumentDirty(documentId: string): boolean {
    const tracked = this.dirtyDocuments.get(documentId);
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
    return this.dirtyDocuments.get(documentId)?.modified;
  }

  /**
   * Discards changes and reverts to original
   */
  discardChanges(documentId: string): void {
    const tracked = this.dirtyDocuments.get(documentId);
    if (tracked) {
      tracked.modified = structuredClone(tracked.original);
      tracked.changes.clear();
    }
  }

  /**
   * Discards all changes
   */
  discardAllChanges(): void {
    for (const [id] of this.dirtyDocuments) {
      this.discardChanges(id);
    }
  }

  /**
   * Commits changes (updates original to match modified)
   */
  commitChanges(documentId: string, updatedDoc?: CosmosDocument): void {
    const tracked = this.dirtyDocuments.get(documentId);
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
    this.dirtyDocuments.delete(documentId);
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
