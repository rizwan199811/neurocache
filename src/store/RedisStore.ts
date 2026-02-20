import type { CacheStore, CacheEntry } from '../core/types';
import { StoreError } from '../core/errors';

/**
 * Redis connection options
 */
export interface RedisStoreOptions {
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
}

/**
 * Redis cache store implementation
 * Requires redis to be installed as peer dependency
 */
export class RedisStore implements CacheStore {
  private client: unknown;
  private readonly keyPrefix: string;
  private isConnected = false;

  constructor(options: RedisStoreOptions = {}) {
    this.keyPrefix = options.keyPrefix ?? 'neurocache:';
    
    // Lazy load redis to make it an optional dependency
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
      const redis = require('redis');
      
      this.client = redis.createClient({
        url: options.url,
        socket: {
          host: options.host ?? 'localhost',
          port: options.port ?? 6379
        },
        password: options.password,
        database: options.db ?? 0
      });

      // Type assertion for Redis client
      const typedClient = this.client as {
        connect(): Promise<void>;
        on(event: string, listener: (...args: unknown[]) => void): void;
      };

      typedClient.on('error', (...args: unknown[]) => {
        const err = args[0];
        console.error('Redis Client Error:', err);
      });

      typedClient.on('connect', () => {
        this.isConnected = true;
      });

    } catch (error) {
      throw new StoreError(
        'Redis package not found. Install it with: npm install redis',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Ensure connection is established
   */
  private async ensureConnection(): Promise<void> {
    if (!this.isConnected) {
      const typedClient = this.client as { connect(): Promise<void> };
      await typedClient.connect();
      this.isConnected = true;
    }
  }

  /**
   * Get full key with prefix
   */
  private getKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  /**
   * Get a cache entry by key
   */
  public async get(key: string): Promise<CacheEntry | null> {
    try {
      await this.ensureConnection();

      const typedClient = this.client as {
        get(key: string): Promise<string | null>;
      };

      const data = await typedClient.get(this.getKey(key));

      if (!data) {
        return null;
      }

      const entry = JSON.parse(data) as CacheEntry;

      // Redis handles TTL automatically, but check expiresAt for consistency
      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        await this.delete(key);
        return null;
      }

      return entry;
    } catch (error) {
      throw new StoreError(
        `Failed to get entry from RedisStore: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Set a cache entry with optional TTL
   */
  public async set(key: string, value: CacheEntry, ttl?: number): Promise<void> {
    try {
      await this.ensureConnection();

      // Set expiration time if TTL is provided
      if (ttl && ttl > 0) {
        value.expiresAt = Date.now() + ttl * 1000;
      }

      const data = JSON.stringify(value);

      const typedClient = this.client as {
        set(key: string, value: string, options?: { EX: number }): Promise<void>;
      };

      if (ttl && ttl > 0) {
        await typedClient.set(this.getKey(key), data, { EX: ttl });
      } else {
        await typedClient.set(this.getKey(key), data);
      }
    } catch (error) {
      throw new StoreError(
        `Failed to set entry in RedisStore: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Delete a cache entry
   */
  public async delete(key: string): Promise<void> {
    try {
      await this.ensureConnection();

      const typedClient = this.client as {
        del(key: string): Promise<number>;
      };

      await typedClient.del(this.getKey(key));
    } catch (error) {
      throw new StoreError(
        `Failed to delete entry from RedisStore: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Clear all cache entries with this prefix
   */
  public async clear(): Promise<void> {
    try {
      await this.ensureConnection();

      const typedClient = this.client as {
        keys(pattern: string): Promise<string[]>;
        del(...keys: string[]): Promise<number>;
      };

      const keys = await typedClient.keys(`${this.keyPrefix}*`);

      if (keys.length > 0) {
        await typedClient.del(...keys);
      }
    } catch (error) {
      throw new StoreError(
        `Failed to clear RedisStore: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get store name
   */
  public getName(): string {
    return 'RedisStore';
  }

  /**
   * Disconnect from Redis
   */
  public async disconnect(): Promise<void> {
    if (this.isConnected) {
      const typedClient = this.client as { disconnect(): Promise<void> };
      await typedClient.disconnect();
      this.isConnected = false;
    }
  }
}
