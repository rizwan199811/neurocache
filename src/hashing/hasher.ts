import { createHash } from 'crypto';
import type { GenerateRequest } from '../core/types';
import { normalizeRequest } from './normalizer';
import { HashingError } from '../core/errors';

/**
 * Deterministic JSON stringification
 * Ensures consistent key ordering for hashing
 */
export function deterministicStringify(obj: unknown): string {
  if (obj === null) return 'null';
  if (obj === undefined) return 'undefined';
  
  if (typeof obj !== 'object') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    const items = obj.map(item => deterministicStringify(item));
    return `[${items.join(',')}]`;
  }

  const keys = Object.keys(obj).sort();
  const pairs = keys.map(key => {
    const value = (obj as Record<string, unknown>)[key];
    return `${JSON.stringify(key)}:${deterministicStringify(value)}`;
  });

  return `{${pairs.join(',')}}`;
}

/**
 * Hasher class for generating deterministic cache keys
 */
export class Hasher {
  private readonly version: string;

  constructor(version: string = 'v1') {
    this.version = version;
  }

  /**
   * Generate a deterministic hash for a request
   */
  public hash(request: GenerateRequest): string {
    try {
      const normalized = normalizeRequest(request);
      
      const hashInput = {
        version: this.version,
        request: normalized
      };

      const stringified = deterministicStringify(hashInput);
      const hash = createHash('sha256').update(stringified).digest('hex');

      return hash;
    } catch (error) {
      throw new HashingError(
        `Failed to hash request: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get the version used by this hasher
   */
  public getVersion(): string {
    return this.version;
  }
}
