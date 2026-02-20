import type { Metrics, MetricsAdapter } from '../core/types';
import { InMemoryMetricsAdapter } from './InMemoryMetricsAdapter';

/**
 * Analytics tracker for NeuroCache metrics
 * Wraps a MetricsAdapter for backward compatibility
 * 
 * @deprecated Use MetricsAdapter interface directly for new implementations
 */
export class Analytics {
  private readonly adapter: MetricsAdapter;

  constructor(
    costPerPromptToken: number = 0.00001,
    costPerCompletionToken: number = 0.00003,
    adapter?: MetricsAdapter
  ) {
    // Use provided adapter or create default in-memory adapter
    this.adapter = adapter ?? new InMemoryMetricsAdapter(costPerPromptToken, costPerCompletionToken);
  }

  /**
   * Record a cache hit
   */
  public recordCacheHit(tokensAvoided: number, latencySaved: number): void {
    this.adapter.recordCacheHit(tokensAvoided, latencySaved);
  }

  /**
   * Record a cache miss
   */
  public recordCacheMiss(): void {
    this.adapter.recordCacheMiss();
  }

  /**
   * Record a provider error
   */
  public recordProviderError(): void {
    this.adapter.recordProviderError();
  }

  /**
   * Record a store error
   */
  public recordStoreError(): void {
    this.adapter.recordStoreError();
  }

  /**
   * Get current metrics
   */
  public getMetrics(): Readonly<Metrics> {
    return this.adapter.getMetrics();
  }

  /**
   * Reset all metrics
   */
  public reset(): void {
    this.adapter.reset();
  }

  /**
   * Get cache hit rate
   */
  public getCacheHitRate(): number {
    return this.adapter.getCacheHitRate();
  }

  /**
   * Get formatted metrics summary
   */
  public getSummary(): string {
    return this.adapter.getSummary();
  }
}
