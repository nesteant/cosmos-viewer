/**
 * Provider-specific error classes
 */

import { ProviderType } from './types';

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly providerType: ProviderType,
    public readonly code?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export class ConnectionError extends ProviderError {
  constructor(
    message: string,
    providerType: ProviderType,
    code?: string,
    cause?: Error
  ) {
    super(message, providerType, code, cause);
    this.name = 'ConnectionError';
  }
}

export class QueryExecutionError extends ProviderError {
  constructor(
    message: string,
    providerType: ProviderType,
    public readonly query?: string,
    code?: string,
    cause?: Error
  ) {
    super(message, providerType, code, cause);
    this.name = 'QueryExecutionError';
  }
}

export class DocumentOperationError extends ProviderError {
  constructor(
    message: string,
    providerType: ProviderType,
    public readonly operation: 'create' | 'update' | 'delete',
    public readonly documentId?: string,
    code?: string,
    cause?: Error
  ) {
    super(message, providerType, code, cause);
    this.name = 'DocumentOperationError';
  }
}

export class ProviderNotFoundError extends Error {
  constructor(public readonly providerType: string) {
    super(`Provider not found: ${providerType}`);
    this.name = 'ProviderNotFoundError';
  }
}

export class ConnectionNotFoundError extends Error {
  constructor(public readonly connectionId: string) {
    super(`Connection not found: ${connectionId}`);
    this.name = 'ConnectionNotFoundError';
  }
}
