import { MemoryStore } from '../store/MemoryStore';
import type { CacheEntry } from '../core/types';

describe('MemoryStore', () => {
  let store: MemoryStore;

  beforeEach(() => {
    store = new MemoryStore();
  });

  afterEach(async () => {
    await store.clear();
  });

  describe('get and set', () => {
    it('should store and retrieve entries', async () => {
      const entry: CacheEntry = {
        key: 'test-key',
        request: {
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello' }]
        },
        response: {
          id: 'test-id',
          model: 'gpt-4',
          content: 'Hi there!',
          created: Date.now()
        },
        timestamp: Date.now(),
        version: 'v1'
      };

      await store.set('test-key', entry);
      const retrieved = await store.get('test-key');

      expect(retrieved).toEqual(entry);
    });

    it('should return null for non-existent keys', async () => {
      const result = await store.get('non-existent');
      expect(result).toBeNull();
    });

    it('should overwrite existing entries', async () => {
      const entry1: CacheEntry = {
        key: 'test-key',
        request: {
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello' }]
        },
        response: {
          id: 'test-id-1',
          model: 'gpt-4',
          content: 'First',
          created: Date.now()
        },
        timestamp: Date.now(),
        version: 'v1'
      };

      const entry2: CacheEntry = {
        ...entry1,
        response: {
          ...entry1.response,
          id: 'test-id-2',
          content: 'Second'
        }
      };

      await store.set('test-key', entry1);
      await store.set('test-key', entry2);

      const retrieved = await store.get('test-key');
      expect(retrieved?.response.content).toBe('Second');
    });
  });

  describe('TTL', () => {
    it('should respect TTL and expire entries', async () => {
      const entry: CacheEntry = {
        key: 'test-key',
        request: {
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello' }]
        },
        response: {
          id: 'test-id',
          model: 'gpt-4',
          content: 'Hi there!',
          created: Date.now()
        },
        timestamp: Date.now(),
        version: 'v1'
      };

      // Set with 1 second TTL
      await store.set('test-key', entry, 1);

      // Should exist immediately
      const retrieved1 = await store.get('test-key');
      expect(retrieved1).not.toBeNull();

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should be expired
      const retrieved2 = await store.get('test-key');
      expect(retrieved2).toBeNull();
    });

    it('should clear TTL timer when entry is overwritten', async () => {
      const entry: CacheEntry = {
        key: 'test-key',
        request: {
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello' }]
        },
        response: {
          id: 'test-id',
          model: 'gpt-4',
          content: 'Hi there!',
          created: Date.now()
        },
        timestamp: Date.now(),
        version: 'v1'
      };

      // Set with 1 second TTL
      await store.set('test-key', entry, 1);

      // Immediately overwrite with long TTL
      await store.set('test-key', entry, 10);

      // Wait past first TTL
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should still exist
      const retrieved = await store.get('test-key');
      expect(retrieved).not.toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete entries', async () => {
      const entry: CacheEntry = {
        key: 'test-key',
        request: {
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello' }]
        },
        response: {
          id: 'test-id',
          model: 'gpt-4',
          content: 'Hi there!',
          created: Date.now()
        },
        timestamp: Date.now(),
        version: 'v1'
      };

      await store.set('test-key', entry);
      await store.delete('test-key');

      const retrieved = await store.get('test-key');
      expect(retrieved).toBeNull();
    });

    it('should clear TTL timer when deleting', async () => {
      const entry: CacheEntry = {
        key: 'test-key',
        request: {
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello' }]
        },
        response: {
          id: 'test-id',
          model: 'gpt-4',
          content: 'Hi there!',
          created: Date.now()
        },
        timestamp: Date.now(),
        version: 'v1'
      };

      await store.set('test-key', entry, 10);
      await store.delete('test-key');

      // Should be deleted immediately
      const retrieved = await store.get('test-key');
      expect(retrieved).toBeNull();
    });
  });

  describe('clear', () => {
    it('should clear all entries', async () => {
      const entry: CacheEntry = {
        key: 'test-key',
        request: {
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello' }]
        },
        response: {
          id: 'test-id',
          model: 'gpt-4',
          content: 'Hi there!',
          created: Date.now()
        },
        timestamp: Date.now(),
        version: 'v1'
      };

      await store.set('key1', entry);
      await store.set('key2', entry);
      await store.set('key3', entry);

      expect(store.size()).toBe(3);

      await store.clear();

      expect(store.size()).toBe(0);
      expect(await store.get('key1')).toBeNull();
      expect(await store.get('key2')).toBeNull();
      expect(await store.get('key3')).toBeNull();
    });
  });

  describe('getName', () => {
    it('should return the store name', () => {
      expect(store.getName()).toBe('MemoryStore');
    });
  });
});
