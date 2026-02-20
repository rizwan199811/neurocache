import type { CacheStore, CacheEntry } from '../core/types';
import { StoreError } from '../core/errors';

/**
 * In-memory cache store implementation with LRU eviction
 * Thread-safe for Node.js single-threaded event loop
 * 
 * Features:
 * - LRU (Least Recently Used) eviction when max size reached
 * - TTL support with automatic cleanup
 * - O(1) get/set operations
 */
export class MemoryStore implements CacheStore {
  private readonly cache: Map<string, CacheEntry>;
  private readonly ttlTimers: Map<string, NodeJS.Timeout>;
  private readonly accessOrder: Map<string, number>;
  private readonly maxSize: number;
  private accessCounter: number;

  /**
   * @param maxSize Maximum number of entries to store (default: 1000)
   */
  constructor(maxSize: number = 1000) {
    if (maxSize < 1) {
      throw new Error('maxSize must be at least 1');
    }

    this.cache = new Map();
    this.ttlTimers = new Map();
    this.accessOrder = new Map();
    this.maxSize = maxSize;
    this.accessCounter = 0;
  }

  /**
   * Get a cache entry by key
   * Updates access order for LRU tracking
   */
  public async get(key: string): Promise<CacheEntry | null> {
    try {
      const entry = this.cache.get(key);

      if (!entry) {
        return null;
      }

      // Check if entry has expired
      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        await this.delete(key);
        return null;
      }

      // Update access order for LRU
      this.updateAccessOrder(key);

      return entry;
    } catch (error) {
      throw new StoreError(
        `Failed to get entry from MemoryStore: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Set a cache entry with optional TTL
   * Evicts least recently used entry if max size reached
   */
  public async set(key: string, value: CacheEntry, ttl?: number): Promise<void> {
    try {
      // Clear existing TTL timer if any
      const existingTimer = this.ttlTimers.get(key);
      if (existingTimer) {
        clearTimeout(existingTimer);
        this.ttlTimers.delete(key);
      }

      // Check if we need to evict (only if adding new entry)
      if (!this.cache.has(key) && this.cache.size >= this.maxSize) {
        await this.evictLRU();
      }

      // Set expiration time if TTL is provided
      if (ttl && ttl > 0) {
        value.expiresAt = Date.now() + ttl * 1000;

        // Set up auto-deletion timer
        const timer = setTimeout(() => {
          this.cache.delete(key);
          this.ttlTimers.delete(key);
          this.accessOrder.delete(key);
        }, ttl * 1000);

        this.ttlTimers.set(key, timer);
      }

      this.cache.set(key, value);
      this.updateAccessOrder(key);
    } catch (error) {
      throw new StoreError(
        `Failed to set entry in MemoryStore: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Delete a cache entry
   */
  public async delete(key: string): Promise<void> {
    try {
      const timer = this.ttlTimers.get(key);
      if (timer) {
        clearTimeout(timer);
        this.ttlTimers.delete(key);
      }

      this.cache.delete(key);
      this.accessOrder.delete(key);
    } catch (error) {
      throw new StoreError(
        `Failed to delete entry from MemoryStore: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Clear all cache entries
   */
  public async clear(): Promise<void> {
    try {
      // Clear all timers
      for (const timer of this.ttlTimers.values()) {
        clearTimeout(timer);
      }

      this.ttlTimers.clear();
      this.cache.clear();
      this.accessOrder.clear();
      this.accessCounter = 0;
    } catch (error) {
      throw new StoreError(
        `Failed to clear MemoryStore: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get store name
   */
  public getName(): string {
    return 'MemoryStore';
  }

  /**
   * Get the current cache size
   */
  public size(): number {
    return this.cache.size;
  }

  /**
   * Update access order for LRU tracking
   * @private
   */
  private updateAccessOrder(key: string): void {
    this.accessOrder.set(key, ++this.accessCounter);
  }

  /**
   * Evict the least recently used entry
   * @private
   */
  private async evictLRU(): Promise<void> {
    if (this.cache.size === 0) {
      return;
    }

    // Find the key with the smallest access counter (least recently used)
    let lruKey: string | null = null;
    let lruValue = Infinity;

    for (const [key, accessTime] of this.accessOrder.entries()) {
      if (accessTime < lruValue) {
        lruValue = accessTime;
        lruKey = key;
      }
    }

    if (lruKey) {
      await this.delete(lruKey);
    }
  }
}
