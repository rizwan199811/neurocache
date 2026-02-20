import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import type { CacheStore, CacheEntry } from '../core/types';
import { StoreError } from '../core/errors';

/**
 * File-based cache store implementation
 * Uses atomic writes to prevent corruption
 */
export class FileStore implements CacheStore {
  private readonly baseDir: string;
  private readonly fileExtension = '.json';

  constructor(baseDir: string = '.neurocache') {
    this.baseDir = baseDir;
  }

  /**
   * Initialize the store directory
   */
  private async ensureDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.baseDir, { recursive: true });
    } catch (error) {
      throw new StoreError(
        `Failed to create cache directory: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get file path for a cache key
   */
  private getFilePath(key: string): string {
    // Use first 2 chars for sharding to avoid too many files in one directory
    const shard = key.substring(0, 2);
    return join(this.baseDir, shard, `${key}${this.fileExtension}`);
  }

  /**
   * Get a cache entry by key
   */
  public async get(key: string): Promise<CacheEntry | null> {
    try {
      const filePath = this.getFilePath(key);

      try {
        const data = await fs.readFile(filePath, 'utf-8');
        const entry = JSON.parse(data) as CacheEntry;

        // Check if entry has expired
        if (entry.expiresAt && entry.expiresAt < Date.now()) {
          await this.delete(key);
          return null;
        }

        return entry;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return null;
        }
        throw error;
      }
    } catch (error) {
      throw new StoreError(
        `Failed to get entry from FileStore: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Set a cache entry with optional TTL
   */
  public async set(key: string, value: CacheEntry, ttl?: number): Promise<void> {
    try {
      await this.ensureDirectory();

      // Set expiration time if TTL is provided
      if (ttl && ttl > 0) {
        value.expiresAt = Date.now() + ttl * 1000;
      }

      const filePath = this.getFilePath(key);
      const fileDir = dirname(filePath);

      // Ensure shard directory exists
      await fs.mkdir(fileDir, { recursive: true });

      // Atomic write: write to temp file then rename
      const tempPath = `${filePath}.tmp`;
      const data = JSON.stringify(value, null, 2);

      await fs.writeFile(tempPath, data, 'utf-8');
      await fs.rename(tempPath, filePath);
    } catch (error) {
      throw new StoreError(
        `Failed to set entry in FileStore: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Delete a cache entry
   */
  public async delete(key: string): Promise<void> {
    try {
      const filePath = this.getFilePath(key);

      try {
        await fs.unlink(filePath);
      } catch (error) {
        // Ignore if file doesn't exist
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
      }
    } catch (error) {
      throw new StoreError(
        `Failed to delete entry from FileStore: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Clear all cache entries
   */
  public async clear(): Promise<void> {
    try {
      try {
        await fs.rm(this.baseDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore if directory doesn't exist
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
      }
    } catch (error) {
      throw new StoreError(
        `Failed to clear FileStore: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get store name
   */
  public getName(): string {
    return 'FileStore';
  }
}
