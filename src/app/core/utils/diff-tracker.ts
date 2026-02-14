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
 * Get document ID (supports both 'id' for CosmosSQL and '_id' for MongoDB with EJSON)
 */
function getDocId(doc: CosmosDocument): string {
  // CosmosSQL uses 'id'
  if (doc.id !== undefined) return doc.id;

  // MongoDB uses '_id' which can be a complex EJSON object
  const id = (doc as any)._id;
  if (id === null || id === undefined) return '';

  // Handle string/number directly
  if (typeof id === 'string') return id;
  if (typeof id === 'number') return String(id);

  // Handle Extended JSON object formats
  if (typeof id === 'object') {
    // ObjectId: { "$oid": "507f1f77bcf86cd799439011" }
    if (id.$oid) return id.$oid;

    // UUID: { "$uuid": "550e8400-e29b-41d4-a716-446655440000" }
    if (id.$uuid) return id.$uuid;

    // Binary (including UUID subtype): { "$binary": { "base64": "...", "subType": "04" } }
    if (id.$binary) {
      const subType = id.$binary.subType;
      if (subType === '03' || subType === '04' || subType === 3 || subType === 4) {
        return binaryToUuid(id.$binary.base64);
      }
      return id.$binary.base64 || JSON.stringify(id);
    }

    // NumberLong: { "$numberLong": "12345" }
    if (id.$numberLong) return id.$numberLong;

    // Fallback: stringify the object
    return JSON.stringify(id);
  }

  return String(id);
}

/**
 * Convert base64 binary to UUID string
 */
function binaryToUuid(base64: string): string {
  try {
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    if (bytes.length !== 16) {
      return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    }

    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  } catch {
    return base64;
  }
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
  private partitionKeyPaths: string[] = []; // For composite partition keys

  /**
   * Sets the partition key path for this tracker (single or composite)
   * @param path Single path like "/category" or array for composite ["/tenantId", "/userId"]
   */
  setPartitionKeyPath(path: string | string[] | null): void {
    if (path === null) {
      this.partitionKeyPath = null;
      this.partitionKeyPaths = [];
    } else if (Array.isArray(path)) {
      this.partitionKeyPaths = path;
      this.partitionKeyPath = path[0] ?? null; // Keep first for backwards compat
    } else {
      this.partitionKeyPath = path;
      this.partitionKeyPaths = [path];
    }
  }

  /**
   * Gets the composite key for a document
   */
  getDocumentKey(doc: CosmosDocument): string {
    const pkValue = this.extractFullPartitionKey(doc);
    return createDocumentKey(getDocId(doc), pkValue);
  }

  /**
   * Extracts full partition key value (handles composite keys)
   */
  private extractFullPartitionKey(doc: CosmosDocument): any {
    if (this.partitionKeyPaths.length === 0) {
      return undefined;
    }
    if (this.partitionKeyPaths.length === 1) {
      return extractPartitionKeyValue(doc, this.partitionKeyPaths[0]);
    }
    // Composite partition key - return array of values
    return this.partitionKeyPaths.map(p => extractPartitionKeyValue(doc, p));
  }

  /**
   * Resolves a document identifier to its tracking key
   * @param docOrKey Either a document object or a pre-computed document key string
   */
  private resolveKey(docOrKey: CosmosDocument | string): string | null {
    if (typeof docOrKey === 'string') {
      // It's already a key - check if it exists
      if (this.dirtyDocuments.has(docOrKey)) {
        return docOrKey;
      }
      return null;
    }
    // It's a document - compute the key
    const key = this.getDocumentKey(docOrKey);
    if (this.dirtyDocuments.has(key)) {
      return key;
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
   * @param doc The document object (used to compute unique key with partition key)
   */
  updateField(doc: CosmosDocument, path: string, newValue: any): void {
    const key = this.resolveKey(doc);
    if (!key) return;
    const tracked = this.dirtyDocuments.get(key);
    if (!tracked) return;

    const pathArray = stringToPath(path);
    const originalValue = getValueAtPath(tracked.original, pathArray);

    // Update the modified document
    setNestedValueMutable(tracked.modified, pathArray, newValue);

    // Track the change
    const documentId = getDocId(doc);
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
  getDocumentChanges(doc: CosmosDocument): DocumentChange[] {
    const key = this.resolveKey(doc);
    if (!key) return [];
    const tracked = this.dirtyDocuments.get(key);
    if (!tracked) return [];
    return Array.from(tracked.changes.values());
  }

  /**
   * Checks if a specific field is dirty
   */
  isFieldDirty(doc: CosmosDocument, path: string): boolean {
    const key = this.resolveKey(doc);
    if (!key) return false;
    const tracked = this.dirtyDocuments.get(key);
    return tracked?.changes.has(path) ?? false;
  }

  /**
   * Checks if a document has any changes
   */
  isDocumentDirty(doc: CosmosDocument): boolean {
    const key = this.resolveKey(doc);
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
  getModifiedDocument(doc: CosmosDocument): CosmosDocument | undefined {
    const key = this.resolveKey(doc);
    if (!key) return undefined;
    return this.dirtyDocuments.get(key)?.modified;
  }

  /**
   * Gets the modified version by document key
   */
  getModifiedDocumentByKey(documentKey: string): CosmosDocument | undefined {
    return this.dirtyDocuments.get(documentKey)?.modified;
  }

  /**
   * Discards changes and reverts to original
   */
  discardChanges(doc: CosmosDocument): void {
    const key = this.resolveKey(doc);
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
  commitChanges(doc: CosmosDocument, updatedDoc?: CosmosDocument): void {
    const key = this.resolveKey(doc);
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
  untrackDocument(doc: CosmosDocument): void {
    const key = this.resolveKey(doc);
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
