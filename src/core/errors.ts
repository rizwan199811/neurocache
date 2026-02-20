/**
 * Base class for all NeuroCache errors
 */
export class NeuroCacheError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NeuroCacheError';
    Object.setPrototypeOf(this, NeuroCacheError.prototype);
  }
}

/**
 * Error thrown when provider operations fail
 */
export class ProviderError extends NeuroCacheError {
  public readonly originalError?: Error;

  constructor(message: string, originalError?: Error) {
    super(message);
    this.name = 'ProviderError';
    this.originalError = originalError;
    Object.setPrototypeOf(this, ProviderError.prototype);
  }
}

/**
 * Error thrown when store operations fail
 */
export class StoreError extends NeuroCacheError {
  public readonly originalError?: Error;

  constructor(message: string, originalError?: Error) {
    super(message);
    this.name = 'StoreError';
    this.originalError = originalError;
    Object.setPrototypeOf(this, StoreError.prototype);
  }
}

/**
 * Error thrown when hashing fails
 */
export class HashingError extends NeuroCacheError {
  constructor(message: string) {
    super(message);
    this.name = 'HashingError';
    Object.setPrototypeOf(this, HashingError.prototype);
  }
}

/**
 * Error thrown for invalid configuration
 */
export class ConfigurationError extends NeuroCacheError {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}
