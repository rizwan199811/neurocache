/**
 * Context Intelligence Analytics - Production-Safe Metrics
 * Tracks only safe input optimization metrics
 */

import type { ContextIntelligenceMetrics, OptimizedContext } from './types';

/**
 * Collect and aggregate metrics for context intelligence layer
 */
export class ContextIntelligenceAnalytics {
  private metrics: ContextIntelligenceMetrics;
  private readonly costPerToken: number = 0.00002; // $0.02 per 1K tokens (rough estimate)

  constructor() {
    this.metrics = this.createEmptyMetrics();
  }

  /**
   * Record a successful optimization
   */
  public recordOptimization(optimization: OptimizedContext, latencyMs: number): void {
    this.metrics.totalOptimizedRequests++;
    
    if (optimization.duplicatesRemoved > 0 || optimization.messagesTrimmed > 0) {
      this.metrics.optimizationsApplied++;
    } else {
      this.metrics.optimizationsBypassed++;
    }

    // Deduplication
    this.metrics.duplicateMessagesRemoved += optimization.duplicatesRemoved;
    
    // Trimming
    this.metrics.messagesTotalTrimmed += optimization.messagesTrimmed;

    // Token savings
    const tokensSaved = optimization.tokensSaved;
    this.metrics.totalInputTokensSaved += tokensSaved;
    
    // Update dedup and trimming specific saves (estimate split)
    if (optimization.duplicatesRemoved > 0) {
      const dedupPortion = optimization.duplicatesRemoved / 
        (optimization.duplicatesRemoved + optimization.messagesTrimmed || 1);
      this.metrics.tokensSavedFromDedup += Math.floor(tokensSaved * dedupPortion);
    }
    
    if (optimization.messagesTrimmed > 0) {
      const trimPortion = optimization.messagesTrimmed / 
        (optimization.duplicatesRemoved + optimization.messagesTrimmed || 1);
      this.metrics.tokensSavedFromTrimming += Math.floor(tokensSaved * trimPortion);
    }

    // Cost estimation
    this.metrics.estimatedCostSaved = this.metrics.totalInputTokensSaved * this.costPerToken;

    // Performance
    this.metrics.totalOptimizationLatency += latencyMs;
    this.metrics.averageOptimizationLatency =
      this.metrics.totalOptimizationLatency / this.metrics.totalOptimizedRequests;
  }

  /**
   * Record a bypass (optimization skipped)
   */
  public recordBypass(_reason: 'below_threshold' | 'no_benefit' | 'error'): void {
    this.metrics.optimizationsBypassed++;
  }

  /**
   * Record a template detection
   */
  public recordTemplateDetection(cacheHit: boolean): void {
    this.metrics.templatesDetected++;
    if (cacheHit) {
      this.metrics.templateCacheHits++;
    }
  }

  /**
   * Record an error during optimization
   */
  public recordError(): void {
    this.metrics.optimizationErrors++;
  }

  /**
   * Get current metrics snapshot
   */
  public getMetrics(): Readonly<ContextIntelligenceMetrics> {
    return { ...this.metrics };
  }

  /**
   * Reset all metrics
   */
  public reset(): void {
    this.metrics = this.createEmptyMetrics();
  }

  /**
   * Get formatted summary of metrics
   */
  public getSummary(): string {
    const m = this.metrics;
    
    const lines = [
      '=== Context Intelligence Metrics ===',
      `Total Optimized Requests: ${m.totalOptimizedRequests}`,
      `Optimizations Applied: ${m.optimizationsApplied}`,
      `Optimizations Bypassed: ${m.optimizationsBypassed}`,
      '',
      '--- Deduplication ---',
      `Duplicate Messages Removed: ${m.duplicateMessagesRemoved}`,
      `Tokens Saved (Dedup): ${m.tokensSavedFromDedup}`,
      '',
      '--- History Trimming ---',
      `Messages Trimmed: ${m.messagesTotalTrimmed}`,
      `Tokens Saved (Trim): ${m.tokensSavedFromTrimming}`,
      '',
      '--- Template Detection ---',
      `Templates Detected: ${m.templatesDetected}`,
      `Template Cache Hits: ${m.templateCacheHits}`,
      '',
      '--- Total Savings ---',
      `Total Input Tokens Saved: ${m.totalInputTokensSaved.toLocaleString()}`,
      `Estimated Cost Saved: $${m.estimatedCostSaved.toFixed(4)}`,
      '',
      '--- Performance ---',
      `Avg Optimization Latency: ${m.averageOptimizationLatency.toFixed(2)}ms`,
      `Optimization Errors: ${m.optimizationErrors}`
    ];

    return lines.join('\n');
  }

  /**
   * Create empty metrics object
   */
  private createEmptyMetrics(): ContextIntelligenceMetrics {
    return {
      totalOptimizedRequests: 0,
      optimizationsApplied: 0,
      optimizationsBypassed: 0,
      duplicateMessagesRemoved: 0,
      tokensSavedFromDedup: 0,
      messagesTotalTrimmed: 0,
      tokensSavedFromTrimming: 0,
      templatesDetected: 0,
      templateCacheHits: 0,
      totalInputTokensSaved: 0,
      estimatedCostSaved: 0,
      totalOptimizationLatency: 0,
      averageOptimizationLatency: 0,
      optimizationErrors: 0
    };
  }
}
