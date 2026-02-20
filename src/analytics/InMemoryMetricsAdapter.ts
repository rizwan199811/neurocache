import type { Metrics, MetricsAdapter } from '../core/types';

/**
 * In-memory metrics adapter
 * Default implementation that stores metrics in memory
 * Not suitable for multi-instance deployments
 */
export class InMemoryMetricsAdapter implements MetricsAdapter {
  private metrics: Metrics;
  private readonly latencies: number[];
  private readonly costPerPromptToken: number;
  private readonly costPerCompletionToken: number;

  constructor(
    costPerPromptToken: number = 0.00001,
    costPerCompletionToken: number = 0.00003
  ) {
    this.metrics = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      tokensSaved: 0,
      estimatedCostSaved: 0,
      averageLatencySaved: 0,
      providerErrors: 0,
      storeErrors: 0
    };

    this.latencies = [];
    this.costPerPromptToken = costPerPromptToken;
    this.costPerCompletionToken = costPerCompletionToken;
  }

  /**
   * Record a cache hit
   */
  public recordCacheHit(tokensAvoided: number, latencySaved: number): void {
    this.metrics.totalRequests++;
    this.metrics.cacheHits++;
    this.metrics.tokensSaved += tokensAvoided;

    // Estimate cost saved (simplified: assume half prompt, half completion)
    const promptTokens = Math.floor(tokensAvoided / 2);
    const completionTokens = tokensAvoided - promptTokens;
    const costSaved =
      promptTokens * this.costPerPromptToken +
      completionTokens * this.costPerCompletionToken;

    this.metrics.estimatedCostSaved += costSaved;

    // Track latency
    this.latencies.push(latencySaved);
    this.updateAverageLatency();
  }

  /**
   * Record a cache miss
   */
  public recordCacheMiss(): void {
    this.metrics.totalRequests++;
    this.metrics.cacheMisses++;
  }

  /**
   * Record a provider error
   */
  public recordProviderError(): void {
    this.metrics.providerErrors++;
  }

  /**
   * Record a store error
   */
  public recordStoreError(): void {
    this.metrics.storeErrors++;
  }

  /**
   * Update average latency saved
   */
  private updateAverageLatency(): void {
    if (this.latencies.length === 0) {
      this.metrics.averageLatencySaved = 0;
      return;
    }

    const sum = this.latencies.reduce((acc, val) => acc + val, 0);
    this.metrics.averageLatencySaved = sum / this.latencies.length;
  }

  /**
   * Get current metrics
   */
  public getMetrics(): Readonly<Metrics> {
    return { ...this.metrics };
  }

  /**
   * Reset all metrics
   */
  public reset(): void {
    this.metrics = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      tokensSaved: 0,
      estimatedCostSaved: 0,
      averageLatencySaved: 0,
      providerErrors: 0,
      storeErrors: 0
    };

    this.latencies.length = 0;
  }

  /**
   * Get cache hit rate
   */
  public getCacheHitRate(): number {
    if (this.metrics.totalRequests === 0) {
      return 0;
    }

    return (this.metrics.cacheHits / this.metrics.totalRequests) * 100;
  }

  /**
   * Get formatted metrics summary
   */
  public getSummary(): string {
    const hitRate = this.getCacheHitRate().toFixed(2);

    return `
NeuroCache Metrics Summary
==========================
Total Requests: ${this.metrics.totalRequests}
Cache Hits: ${this.metrics.cacheHits} (${hitRate}%)
Cache Misses: ${this.metrics.cacheMisses}
Tokens Saved: ${this.metrics.tokensSaved.toLocaleString()}
Cost Saved: $${this.metrics.estimatedCostSaved.toFixed(4)}
Avg Latency Saved: ${this.metrics.averageLatencySaved.toFixed(2)}ms
Provider Errors: ${this.metrics.providerErrors}
Store Errors: ${this.metrics.storeErrors}
    `.trim();
  }
}
