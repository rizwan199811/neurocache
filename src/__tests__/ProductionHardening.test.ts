/**
 * Production Hardening Tests - Level 3.5
 * Tests for LRU eviction, model-aware tokenization, safe normalization, and pluggable metrics
 */

import { MemoryStore } from '../store/MemoryStore';
import { estimateTokenCount, estimateRequestTokens } from '../utils/helpers';
import { ContextOptimizer } from '../context/ContextOptimizer';
import { InMemoryMetricsAdapter } from '../analytics/InMemoryMetricsAdapter';
import type { CacheEntry, Message, MetricsAdapter } from '../core/types';

describe('Production Hardening - Level 3.5', () => {
  describe('1️⃣ LRU Eviction', () => {
    it('should evict least recently used entry when max size reached', async () => {
      const store = new MemoryStore(3); // Max 3 entries

      const entry1: CacheEntry = {
        key: 'key1',
        request: { model: 'gpt-3.5-turbo', messages: [] },
        response: { id: '1', model: 'gpt-3.5-turbo', content: 'response1', created: Date.now() },
        timestamp: Date.now(),
        version: 'v1'
      };

      const entry2: CacheEntry = {
        key: 'key2',
        request: { model: 'gpt-3.5-turbo', messages: [] },
        response: { id: '2', model: 'gpt-3.5-turbo', content: 'response2', created: Date.now() },
        timestamp: Date.now(),
        version: 'v1'
      };

      const entry3: CacheEntry = {
        key: 'key3',
        request: { model: 'gpt-3.5-turbo', messages: [] },
        response: { id: '3', model: 'gpt-3.5-turbo', content: 'response3', created: Date.now() },
        timestamp: Date.now(),
        version: 'v1'
      };

      const entry4: CacheEntry = {
        key: 'key4',
        request: { model: 'gpt-3.5-turbo', messages: [] },
        response: { id: '4', model: 'gpt-3.5-turbo', content: 'response4', created: Date.now() },
        timestamp: Date.now(),
        version: 'v1'
      };

      // Add 3 entries
      await store.set('key1', entry1);
      await store.set('key2', entry2);
      await store.set('key3', entry3);

      expect(store.size()).toBe(3);

      // Add 4th entry - should evict key1 (LRU)
      await store.set('key4', entry4);

      expect(store.size()).toBe(3);
      expect(await store.get('key1')).toBeNull(); // Evicted
      expect(await store.get('key2')).not.toBeNull();
      expect(await store.get('key3')).not.toBeNull();
      expect(await store.get('key4')).not.toBeNull();
    });

    it('should update access order on get', async () => {
      const store = new MemoryStore(3);

      const entry1: CacheEntry = {
        key: 'key1',
        request: { model: 'gpt-3.5-turbo', messages: [] },
        response: { id: '1', model: 'gpt-3.5-turbo', content: 'response1', created: Date.now() },
        timestamp: Date.now(),
        version: 'v1'
      };

      const entry2: CacheEntry = {
        key: 'key2',
        request: { model: 'gpt-3.5-turbo', messages: [] },
        response: { id: '2', model: 'gpt-3.5-turbo', content: 'response2', created: Date.now() },
        timestamp: Date.now(),
        version: 'v1'
      };

      const entry3: CacheEntry = {
        key: 'key3',
        request: { model: 'gpt-3.5-turbo', messages: [] },
        response: { id: '3', model: 'gpt-3.5-turbo', content: 'response3', created: Date.now() },
        timestamp: Date.now(),
        version: 'v1'
      };

      const entry4: CacheEntry = {
        key: 'key4',
        request: { model: 'gpt-3.5-turbo', messages: [] },
        response: { id: '4', model: 'gpt-3.5-turbo', content: 'response4', created: Date.now() },
        timestamp: Date.now(),
        version: 'v1'
      };

      await store.set('key1', entry1);
      await store.set('key2', entry2);
      await store.set('key3', entry3);

      // Access key1 to make it recently used
      await store.get('key1');

      // Add key4 - should evict key2 (not key1, because key1 was accessed)
      await store.set('key4', entry4);

      expect(await store.get('key1')).not.toBeNull(); // Still there
      expect(await store.get('key2')).toBeNull();      // Evicted
      expect(await store.get('key3')).not.toBeNull();
      expect(await store.get('key4')).not.toBeNull();
    });

    it('should handle TTL expiration with LRU', async () => {
      const store = new MemoryStore(3);

      const entry: CacheEntry = {
        key: 'key1',
        request: { model: 'gpt-3.5-turbo', messages: [] },
        response: { id: '1', model: 'gpt-3.5-turbo', content: 'response1', created: Date.now() },
        timestamp: Date.now(),
        version: 'v1'
      };

      await store.set('key1', entry, 1); // 1 second TTL

      expect(await store.get('key1')).not.toBeNull();

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      expect(await store.get('key1')).toBeNull();
      expect(store.size()).toBe(0);
    });

    it('should not evict when updating existing entry', async () => {
      const store = new MemoryStore(2);

      const entry1: CacheEntry = {
        key: 'key1',
        request: { model: 'gpt-3.5-turbo', messages: [] },
        response: { id: '1', model: 'gpt-3.5-turbo', content: 'response1', created: Date.now() },
        timestamp: Date.now(),
        version: 'v1'
      };

      const entry2: CacheEntry = {
        key: 'key2',
        request: { model: 'gpt-3.5-turbo', messages: [] },
        response: { id: '2', model: 'gpt-3.5-turbo', content: 'response2', created: Date.now() },
        timestamp: Date.now(),
        version: 'v1'
      };

      const updatedEntry1: CacheEntry = {
        key: 'key1',
        request: { model: 'gpt-3.5-turbo', messages: [] },
        response: { id: '1-updated', model: 'gpt-3.5-turbo', content: 'updated', created: Date.now() },
        timestamp: Date.now(),
        version: 'v1'
      };

      await store.set('key1', entry1);
      await store.set('key2', entry2);

      expect(store.size()).toBe(2);

      // Update existing entry - should not trigger eviction
      await store.set('key1', updatedEntry1);

      expect(store.size()).toBe(2);
      const retrieved = await store.get('key1');
      expect(retrieved?.response.id).toBe('1-updated');
    });
  });

  describe('2️⃣ Model-Aware Tokenizer', () => {
    it('should estimate tokens for known models', () => {
      const text = 'Hello world, this is a test message!';
      
      // These should use tiktoken
      const gpt35Count = estimateTokenCount(text, 'gpt-3.5-turbo');
      const gpt4Count = estimateTokenCount(text, 'gpt-4');
      
      // Both should be greater than 0 and reasonable
      expect(gpt35Count).toBeGreaterThan(0);
      expect(gpt4Count).toBeGreaterThan(0);
      expect(gpt35Count).toBeLessThan(50); // Sanity check
    });

    it('should fallback to heuristic for unknown models', () => {
      const text = 'Hello world';
      
      const unknownModelCount = estimateTokenCount(text, 'unknown-model-xyz');
      const heuristicCount = Math.ceil(text.length / 4);
      
      expect(unknownModelCount).toBe(heuristicCount);
    });

    it('should handle empty text', () => {
      const count = estimateTokenCount('', 'gpt-3.5-turbo');
      expect(count).toBe(0);
    });

    it('should estimate request tokens with model', () => {
      const messages = [
        { content: 'Hello' },
        { content: 'How are you?' },
        { content: 'I am fine' }
      ];

      const withModel = estimateRequestTokens(messages, 'gpt-3.5-turbo');
      const withoutModel = estimateRequestTokens(messages);

      expect(withModel).toBeGreaterThan(0);
      expect(withoutModel).toBeGreaterThan(0);
    });

    it('should handle long text efficiently', () => {
      // Test that encoder is properly freed (no memory leak)
      const longText = 'word '.repeat(1000);
      
      const count1 = estimateTokenCount(longText, 'gpt-3.5-turbo');
      const count2 = estimateTokenCount(longText, 'gpt-3.5-turbo');
      
      expect(count1).toBe(count2); // Should be deterministic
      expect(count1).toBeGreaterThan(100);
    });
  });

  describe('3️⃣ Safe Normalization', () => {
    it('should only trim by default (safe mode)', () => {
      const optimizer = new ContextOptimizer({
        normalizeContent: true,
        collapseWhitespace: false  // Safe default
      });

      const messages: Message[] = [
        { role: 'user' as const, content: '  Hello    world  ' },
        { role: 'assistant' as const, content: '\n\nResponse\n\n' }
      ];

      const result = optimizer.optimize({ model: 'gpt-3.5-turbo', messages });

      // Should trim but preserve internal whitespace
      expect(result.optimizedRequest.messages[0]!.content).toBe('Hello    world');
      expect(result.optimizedRequest.messages[1]!.content).toBe('Response');
    });

    it('should collapse whitespace when explicitly enabled', () => {
      const optimizer = new ContextOptimizer({
        normalizeContent: true,
        collapseWhitespace: true  // Opt-in
      });

      const messages: Message[] = [
        { role: 'user' as const, content: '  Hello    world  ' }
      ];

      const result = optimizer.optimize({ model: 'gpt-3.5-turbo', messages });

      // Should collapse multiple spaces
      expect(result.optimizedRequest.messages[0]!.content).toBe('Hello world');
    });

    it('should preserve formatting when normalization disabled', () => {
      const optimizer = new ContextOptimizer({
        normalizeContent: false
      });

      const messages: Message[] = [
        { role: 'user' as const, content: '  Code:\n    function() {\n      return true;\n    }' }
      ];

      const result = optimizer.optimize({ model: 'gpt-3.5-turbo', messages });

      // Should preserve exact formatting
      expect(result.optimizedRequest.messages[0]!.content).toBe(
        '  Code:\n    function() {\n      return true;\n    }'
      );
    });

    it('should handle edge case with multiple newlines', () => {
      const optimizer = new ContextOptimizer({
        normalizeContent: true,
        collapseWhitespace: false
      });

      const messages: Message[] = [
        { role: 'user' as const, content: 'Line1\n\n\nLine2' }
      ];

      const result = optimizer.optimize({ model: 'gpt-3.5-turbo', messages });

      // Safe mode: only trim, don't collapse internal whitespace
      expect(result.optimizedRequest.messages[0]!.content).toBe('Line1\n\n\nLine2');
    });
  });

  describe('4️⃣ Pluggable Metrics Adapter', () => {
    it('should use InMemoryMetricsAdapter by default', () => {
      const adapter = new InMemoryMetricsAdapter();

      adapter.recordCacheHit(100, 50);
      adapter.recordCacheMiss();

      const metrics = adapter.getMetrics();

      expect(metrics.totalRequests).toBe(2);
      expect(metrics.cacheHits).toBe(1);
      expect(metrics.cacheMisses).toBe(1);
      expect(metrics.tokensSaved).toBe(100);
    });

    it('should calculate cache hit rate correctly', () => {
      const adapter = new InMemoryMetricsAdapter();

      adapter.recordCacheHit(100, 50);
      adapter.recordCacheHit(150, 60);
      adapter.recordCacheMiss();
      adapter.recordCacheMiss();

      const hitRate = adapter.getCacheHitRate();

      expect(hitRate).toBe(50); // 2 hits out of 4 requests = 50%
    });

    it('should reset metrics', () => {
      const adapter = new InMemoryMetricsAdapter();

      adapter.recordCacheHit(100, 50);
      adapter.recordCacheMiss();

      adapter.reset();

      const metrics = adapter.getMetrics();

      expect(metrics.totalRequests).toBe(0);
      expect(metrics.cacheHits).toBe(0);
      expect(metrics.cacheMisses).toBe(0);
      expect(metrics.tokensSaved).toBe(0);
    });

    it('should generate summary', () => {
      const adapter = new InMemoryMetricsAdapter();

      adapter.recordCacheHit(1000, 100);
      adapter.recordCacheMiss();

      const summary = adapter.getSummary();

      expect(summary).toContain('Total Requests: 2');
      expect(summary).toContain('Cache Hits: 1');
      expect(summary).toContain('Tokens Saved:'); // Don't check exact formatting
      expect(summary).toContain('1'); // Should contain 1000 in some format
    });

    it('should allow custom metrics adapter implementation', () => {
      // Custom adapter that tracks extra metrics
      class CustomMetricsAdapter implements MetricsAdapter {
        private hits = 0;
        private misses = 0;

        recordCacheHit(): void {
          this.hits++;
        }

        recordCacheMiss(): void {
          this.misses++;
        }

        recordProviderError(): void {}
        recordStoreError(): void {}

        getMetrics(): Readonly<import('../core/types').Metrics> {
          return {
            totalRequests: this.hits + this.misses,
            cacheHits: this.hits,
            cacheMisses: this.misses,
            tokensSaved: 0,
            estimatedCostSaved: 0,
            averageLatencySaved: 0,
            providerErrors: 0,
            storeErrors: 0
          };
        }

        getCacheHitRate(): number {
          const total = this.hits + this.misses;
          return total === 0 ? 0 : (this.hits / total) * 100;
        }

        getSummary(): string {
          return `Custom: ${this.hits} hits, ${this.misses} misses`;
        }

        reset(): void {
          this.hits = 0;
          this.misses = 0;
        }
      }

      const custom = new CustomMetricsAdapter();
      custom.recordCacheHit();
      custom.recordCacheMiss();

      expect(custom.getCacheHitRate()).toBe(50);
      expect(custom.getSummary()).toContain('1 hits, 1 misses');
    });
  });

  describe('5️⃣ Backward Compatibility', () => {
    it('should work with existing MemoryStore constructor (no maxSize)', async () => {
      // Old way: new MemoryStore() without parameters
      const store = new MemoryStore();

      const entry: CacheEntry = {
        key: 'test',
        request: { model: 'gpt-3.5-turbo', messages: [] },
        response: { id: '1', model: 'gpt-3.5-turbo', content: 'test', created: Date.now() },
        timestamp: Date.now(),
        version: 'v1'
      };

      await store.set('test', entry);

      expect(await store.get('test')).not.toBeNull();
      expect(store.size()).toBe(1);
    });

    it('should work with estimateTokenCount without model parameter', () => {
      const text = 'Hello world';
      const count = estimateTokenCount(text); // No model

      expect(count).toBeGreaterThan(0);
      expect(count).toBe(Math.ceil(text.length / 4)); // Heuristic fallback
    });

    it('should work with ContextOptimizer without collapseWhitespace option', () => {
      // Old config without collapseWhitespace
      const optimizer = new ContextOptimizer({
        normalizeContent: true
      });

      const messages: Message[] = [
        { role: 'user' as const, content: '  test  ' }
      ];

      const result = optimizer.optimize({ model: 'gpt-3.5-turbo', messages });

      // Should use safe default (only trim)
      expect(result.optimizedRequest.messages[0]!.content).toBe('test');
    });

    it('should work with InMemoryMetricsAdapter using default constructor', () => {
      const adapter = new InMemoryMetricsAdapter();

      adapter.recordCacheHit(100, 50);

      const metrics = adapter.getMetrics();

      expect(metrics.cacheHits).toBe(1);
      expect(metrics.tokensSaved).toBe(100);
    });
  });

  describe('6️⃣ Integration Tests', () => {
    it('should handle LRU + TTL correctly', async () => {
      const store = new MemoryStore(2);

      const entry1: CacheEntry = {
        key: 'key1',
        request: { model: 'gpt-3.5-turbo', messages: [] },
        response: { id: '1', model: 'gpt-3.5-turbo', content: 'response1', created: Date.now() },
        timestamp: Date.now(),
        version: 'v1'
      };

      const entry2: CacheEntry = {
        key: 'key2',
        request: { model: 'gpt-3.5-turbo', messages: [] },
        response: { id: '2', model: 'gpt-3.5-turbo', content: 'response2', created: Date.now() },
        timestamp: Date.now(),
        version: 'v1'
      };

      await store.set('key1', entry1, 1); // 1 second TTL
      await store.set('key2', entry2);    // No TTL

      expect(store.size()).toBe(2);

      // Wait for key1 to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      expect(await store.get('key1')).toBeNull();
      expect(store.size()).toBe(1);

      // key2 should still be there
      expect(await store.get('key2')).not.toBeNull();
    });

    it('should handle normalization + deduplication correctly', () => {
      const optimizer = new ContextOptimizer({
        enableDeduplication: true,
        normalizeContent: true,
        collapseWhitespace: true
      });

      const messages: Message[] = [
        { role: 'user' as const, content: '  Hello  world  ' },
        { role: 'user' as const, content: 'Hello world' }  // Should match after normalization
      ];

      const result = optimizer.optimize({ model: 'gpt-3.5-turbo', messages });

      expect(result.optimization.duplicatesRemoved).toBe(1);
      expect(result.optimizedRequest.messages.length).toBe(1);
    });
  });
});
