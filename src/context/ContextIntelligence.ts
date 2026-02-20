/**
 * Context Intelligence Layer - Production-Safe Version
 * Optimizes INPUT context only, NO partial response reuse
 */

import type { GenerateRequest } from '../core/types';
import type { OptimizedRequest, ContextIntelligenceConfig } from './types';
import { ContextOptimizer } from './ContextOptimizer';
import { ContextIntelligenceAnalytics } from './ContextIntelligenceAnalytics';

/**
 * Main orchestrator for context intelligence
 * Production-safe: Only optimizes input, maintains determinism
 */
export class ContextIntelligence {
  private readonly optimizer: ContextOptimizer;
  private readonly analytics: ContextIntelligenceAnalytics;
  private readonly config: ContextIntelligenceConfig;
  private readonly logging: boolean;

  constructor(config: ContextIntelligenceConfig) {
    this.config = {
      minTokenSavingsThreshold: 10,
      ...config
    };
    
    this.logging = config.logging ?? false;
    this.optimizer = new ContextOptimizer(config.strategy, this.logging);
    this.analytics = new ContextIntelligenceAnalytics();
  }

  /**
   * Process a request through context intelligence
   * Returns optimized request ready for exact cache lookup
   */
  public async process(request: GenerateRequest): Promise<OptimizedRequest | null> {
    if (!this.config.enabled) {
      return null;
    }

    const startTime = Date.now();

    try {
      // Analyze potential benefit
      const analysis = this.optimizer.analyze(request);

      // Skip if benefit is too small
      if (this.config.minTokenSavingsThreshold && 
          analysis.estimatedTokenSavings < this.config.minTokenSavingsThreshold) {
        
        this.analytics.recordBypass('below_threshold');
        
        if (this.logging) {
          console.log(`[ContextIntelligence] Bypassing - savings (${analysis.estimatedTokenSavings}) below threshold`);
        }
        
        return null;
      }

      // Perform optimization
      const optimizedRequest = this.optimizer.optimize(request);

      // Record metrics
      const latency = Date.now() - startTime;
      this.analytics.recordOptimization(optimizedRequest.optimization, latency);

      if (this.logging) {
        console.log(`[ContextIntelligence] Optimized request:`, {
          duplicatesRemoved: optimizedRequest.optimization.duplicatesRemoved,
          messagesTrimmed: optimizedRequest.optimization.messagesTrimmed,
          tokensSaved: optimizedRequest.optimization.tokensSaved,
          latency: `${latency}ms`
        });
      }

      return optimizedRequest;

    } catch (error) {
      this.analytics.recordError();
      
      if (this.logging) {
        console.error(`[ContextIntelligence] Error during optimization:`, error);
      }
      
      // Always fall back to original request on error
      return null;
    }
  }

  /**
   * Get current metrics
   */
  public getMetrics() {
    return this.analytics.getMetrics();
  }

  /**
   * Get formatted metrics summary
   */
  public getMetricsSummary(): string {
    return this.analytics.getSummary();
  }

  /**
   * Reset all metrics
   */
  public resetMetrics(): void {
    this.analytics.reset();
  }

  /**
   * Clear any cached data (template patterns, etc.)
   */
  public async clear(): Promise<void> {
    // Future: Clear template cache if implemented
    this.resetMetrics();
  }
}
