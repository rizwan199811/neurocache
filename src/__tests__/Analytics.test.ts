import { Analytics } from '../analytics/Analytics';

describe('Analytics', () => {
  let analytics: Analytics;

  beforeEach(() => {
    analytics = new Analytics();
  });

  describe('recordCacheHit', () => {
    it('should record cache hits', () => {
      analytics.recordCacheHit(100, 50);

      const metrics = analytics.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.cacheHits).toBe(1);
      expect(metrics.cacheMisses).toBe(0);
      expect(metrics.tokensSaved).toBe(100);
      expect(metrics.averageLatencySaved).toBe(50);
    });

    it('should calculate average latency correctly', () => {
      analytics.recordCacheHit(100, 50);
      analytics.recordCacheHit(200, 100);
      analytics.recordCacheHit(150, 75);

      const metrics = analytics.getMetrics();
      expect(metrics.averageLatencySaved).toBe(75); // (50 + 100 + 75) / 3
    });

    it('should accumulate tokens saved', () => {
      analytics.recordCacheHit(100, 50);
      analytics.recordCacheHit(200, 100);
      analytics.recordCacheHit(150, 75);

      const metrics = analytics.getMetrics();
      expect(metrics.tokensSaved).toBe(450); // 100 + 200 + 150
    });

    it('should estimate cost saved', () => {
      analytics.recordCacheHit(1000, 50);

      const metrics = analytics.getMetrics();
      expect(metrics.estimatedCostSaved).toBeGreaterThan(0);
    });
  });

  describe('recordCacheMiss', () => {
    it('should record cache misses', () => {
      analytics.recordCacheMiss();

      const metrics = analytics.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.cacheHits).toBe(0);
      expect(metrics.cacheMisses).toBe(1);
    });
  });

  describe('recordProviderError', () => {
    it('should record provider errors', () => {
      analytics.recordProviderError();
      analytics.recordProviderError();

      const metrics = analytics.getMetrics();
      expect(metrics.providerErrors).toBe(2);
    });
  });

  describe('recordStoreError', () => {
    it('should record store errors', () => {
      analytics.recordStoreError();

      const metrics = analytics.getMetrics();
      expect(metrics.storeErrors).toBe(1);
    });
  });

  describe('getCacheHitRate', () => {
    it('should return 0 for no requests', () => {
      expect(analytics.getCacheHitRate()).toBe(0);
    });

    it('should calculate hit rate correctly', () => {
      analytics.recordCacheHit(100, 50);
      analytics.recordCacheMiss();
      analytics.recordCacheHit(100, 50);
      analytics.recordCacheMiss();

      expect(analytics.getCacheHitRate()).toBe(50); // 2 hits out of 4 = 50%
    });

    it('should return 100 for all hits', () => {
      analytics.recordCacheHit(100, 50);
      analytics.recordCacheHit(100, 50);

      expect(analytics.getCacheHitRate()).toBe(100);
    });
  });

  describe('reset', () => {
    it('should reset all metrics', () => {
      analytics.recordCacheHit(100, 50);
      analytics.recordCacheMiss();
      analytics.recordProviderError();

      analytics.reset();

      const metrics = analytics.getMetrics();
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.cacheHits).toBe(0);
      expect(metrics.cacheMisses).toBe(0);
      expect(metrics.tokensSaved).toBe(0);
      expect(metrics.estimatedCostSaved).toBe(0);
      expect(metrics.averageLatencySaved).toBe(0);
      expect(metrics.providerErrors).toBe(0);
      expect(metrics.storeErrors).toBe(0);
    });
  });

  describe('getSummary', () => {
    it('should return a formatted summary', () => {
      analytics.recordCacheHit(100, 50);
      analytics.recordCacheMiss();

      const summary = analytics.getSummary();

      expect(summary).toContain('Total Requests: 2');
      expect(summary).toContain('Cache Hits: 1');
      expect(summary).toContain('Cache Misses: 1');
      expect(summary).toContain('Tokens Saved: 100');
    });
  });
});
