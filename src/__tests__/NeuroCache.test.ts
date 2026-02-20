import { NeuroCache } from '../NeuroCache';
import { MemoryStore } from '../store/MemoryStore';
import type { LLMProvider, GenerateRequest, GenerateResponse } from '../core/types';

// Mock provider for testing
class MockProvider implements LLMProvider {
  private callCount = 0;
  private readonly responses: GenerateResponse[] = [];

  addResponse(response: GenerateResponse): void {
    this.responses.push(response);
  }

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    this.callCount++;

    if (this.responses.length === 0) {
      return {
        id: `mock-${this.callCount}`,
        model: request.model,
        content: 'Mock response',
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30
        },
        created: Date.now()
      };
    }

    return this.responses.shift()!;
  }

  getProviderName(): string {
    return 'MockProvider';
  }

  getModelName(request: GenerateRequest): string {
    return request.model;
  }

  getCallCount(): number {
    return this.callCount;
  }

  reset(): void {
    this.callCount = 0;
    this.responses.length = 0;
  }
}

describe('NeuroCache', () => {
  let provider: MockProvider;
  let store: MemoryStore;
  let cache: NeuroCache;

  beforeEach(() => {
    provider = new MockProvider();
    store = new MemoryStore();
    cache = new NeuroCache({
      provider,
      store,
      ttl: 3600,
      version: 'test-v1',
      logging: false
    });
  });

  afterEach(async () => {
    await cache.clearCache();
  });

  describe('basic caching', () => {
    it('should cache and reuse responses', async () => {
      const request: GenerateRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }]
      };

      // First call - should hit provider
      const response1 = await cache.generate(request);
      expect(response1.content).toBe('Mock response');
      expect(provider.getCallCount()).toBe(1);

      // Second call - should hit cache
      const response2 = await cache.generate(request);
      expect(response2.content).toBe('Mock response');
      expect(provider.getCallCount()).toBe(1); // Still 1!

      // Responses should be identical
      expect(response1.id).toBe(response2.id);
    });

    it('should call provider for different requests', async () => {
      const request1: GenerateRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }]
      };

      const request2: GenerateRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Goodbye' }]
      };

      await cache.generate(request1);
      await cache.generate(request2);

      expect(provider.getCallCount()).toBe(2);
    });
  });

  describe('metrics tracking', () => {
    it('should track cache hits and misses', async () => {
      const request: GenerateRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }]
      };

      // First call - miss
      await cache.generate(request);
      let metrics = cache.getMetrics();
      expect(metrics.cacheMisses).toBe(1);
      expect(metrics.cacheHits).toBe(0);

      // Second call - hit
      await cache.generate(request);
      metrics = cache.getMetrics();
      expect(metrics.cacheMisses).toBe(1);
      expect(metrics.cacheHits).toBe(1);
    });

    it('should track tokens saved', async () => {
      const request: GenerateRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }]
      };

      await cache.generate(request);
      await cache.generate(request); // Cache hit

      const metrics = cache.getMetrics();
      expect(metrics.tokensSaved).toBeGreaterThan(0);
    });

    it('should calculate hit rate', async () => {
      const request: GenerateRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }]
      };

      await cache.generate(request); // Miss
      await cache.generate(request); // Hit

      const hitRate = cache.getCacheHitRate();
      expect(hitRate).toBe(50);
    });
  });

  describe('concurrency deduplication', () => {
    it('should deduplicate concurrent identical requests', async () => {
      const request: GenerateRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }]
      };

      // Make 5 concurrent identical requests
      const promises = Array(5).fill(null).map(() => cache.generate(request));
      const responses = await Promise.all(promises);

      // Should only call provider once
      expect(provider.getCallCount()).toBe(1);

      // All responses should be identical
      const firstId = responses[0]!.id;
      for (const response of responses) {
        expect(response.id).toBe(firstId);
      }
    });

    it('should not deduplicate different requests', async () => {
      const request1: GenerateRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }]
      };

      const request2: GenerateRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Goodbye' }]
      };

      const promises = [
        cache.generate(request1),
        cache.generate(request2),
        cache.generate(request1),
        cache.generate(request2)
      ];

      await Promise.all(promises);

      expect(provider.getCallCount()).toBe(2);
    });
  });

  describe('cache clearing', () => {
    it('should clear cache', async () => {
      const request: GenerateRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }]
      };

      // Generate and cache
      await cache.generate(request);
      expect(provider.getCallCount()).toBe(1);

      // Clear cache
      await cache.clearCache();

      // Should call provider again
      await cache.generate(request);
      expect(provider.getCallCount()).toBe(2);
    });
  });

  describe('metrics reset', () => {
    it('should reset metrics', async () => {
      const request: GenerateRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }]
      };

      await cache.generate(request);
      await cache.generate(request);

      cache.resetMetrics();

      const metrics = cache.getMetrics();
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.cacheHits).toBe(0);
      expect(metrics.cacheMisses).toBe(0);
    });
  });
});
