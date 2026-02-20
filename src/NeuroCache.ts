import type {
  NeuroCacheConfig,
  GenerateRequest,
  GenerateResponse,
  CacheEntry,
  Metrics
} from './core/types';
import { Hasher } from './hashing/hasher';
import { Analytics } from './analytics/Analytics';
import { StoreError, ProviderError, ConfigurationError } from './core/errors';
import { estimateRequestTokens } from './utils/helpers';
import { ContextIntelligence } from './context/ContextIntelligence';
import type { ContextOptimizationStrategy } from './context/types';

/**
 * In-flight request tracker for deduplication
 */
interface InFlightRequest {
  promise: Promise<GenerateResponse>;
  timestamp: number;
}

/**
 * Main NeuroCache class
 * Production-grade LLM caching layer with optional context intelligence
 */
export class NeuroCache {
  private readonly provider;
  private readonly store;
  private readonly hasher: Hasher;
  private readonly analytics: Analytics;
  private readonly ttl: number;
  private readonly logging: boolean;
  private readonly enableDeduplication: boolean;
  private readonly inFlightRequests: Map<string, InFlightRequest>;
  private readonly contextIntelligence?: ContextIntelligence;

  constructor(config: NeuroCacheConfig) {
    // Validate configuration
    if (!config.provider) {
      throw new ConfigurationError('Provider is required');
    }

    if (!config.store) {
      throw new ConfigurationError('Store is required');
    }

    this.provider = config.provider;
    this.store = config.store;
    this.ttl = config.ttl ?? 86400; // Default 24 hours
    this.logging = config.logging ?? false;
    this.enableDeduplication = config.enableDeduplication ?? true;

    // Initialize hasher
    this.hasher = new Hasher(config.version ?? 'v1');

    // Initialize analytics with custom adapter if provided
    const costConfig = config.costPerToken;
    if (config.metricsAdapter) {
      // Use custom metrics adapter
      this.analytics = new Analytics(
        costConfig?.prompt ?? 0.00001,
        costConfig?.completion ?? 0.00003,
        config.metricsAdapter
      );
    } else {
      // Use default in-memory adapter
      this.analytics = new Analytics(
        costConfig?.prompt ?? 0.00001,
        costConfig?.completion ?? 0.00003
      );
    }

    // Initialize in-flight request tracker
    this.inFlightRequests = new Map();

    // Initialize Context Intelligence Layer if enabled
    if (config.enableContextIntelligence) {
      const strategy: ContextOptimizationStrategy = {
        enableDeduplication: config.contextOptimizationStrategy?.enableDeduplication ?? true,
        enableHistoryTrimming: config.contextOptimizationStrategy?.enableHistoryTrimming ?? false,
        maxHistoryMessages: config.contextOptimizationStrategy?.maxHistoryMessages ?? 0,
        preserveSystemMessages: config.contextOptimizationStrategy?.preserveSystemMessages ?? true,
        normalizeContent: config.contextOptimizationStrategy?.normalizeContent ?? true,
        collapseWhitespace: config.contextOptimizationStrategy?.collapseWhitespace ?? false
      };

      this.contextIntelligence = new ContextIntelligence({
        enabled: true,
        strategy,
        logging: this.logging,
        minTokenSavingsThreshold: config.minOptimizationThreshold ?? 10
      });

      if (this.logging) {
        this.log('Context Intelligence Layer enabled (production-safe)');
      }
    }

    if (this.logging) {
      this.log('NeuroCache initialized', {
        provider: this.provider.getProviderName(),
        store: this.store.getName(),
        version: this.hasher.getVersion(),
        ttl: this.ttl,
        deduplication: this.enableDeduplication,
        contextIntelligence: !!this.contextIntelligence
      });
    }
  }

  /**
   * Generate a completion with caching
   */
  public async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const startTime = Date.now();

    try {
      // Generate cache key
      const cacheKey = this.hasher.hash(request);

      if (this.logging) {
        this.log('Request received', {
          model: request.model,
          cacheKey: cacheKey.substring(0, 16) + '...'
        });
      }

      // Check for in-flight request (deduplication)
      if (this.enableDeduplication) {
        const inFlight = this.inFlightRequests.get(cacheKey);
        if (inFlight) {
          if (this.logging) {
            this.log('Deduplication: waiting for in-flight request', { cacheKey });
          }
          return await inFlight.promise;
        }
      }

      // Create and register the execution promise immediately for deduplication
      const executionPromise = this.executeRequest(request, cacheKey, startTime);

      // Track in-flight request for deduplication
      if (this.enableDeduplication) {
        this.inFlightRequests.set(cacheKey, {
          promise: executionPromise,
          timestamp: Date.now()
        });
      }

      try {
        return await executionPromise;
      } finally {
        // Remove from in-flight tracker
        if (this.enableDeduplication) {
          this.inFlightRequests.delete(cacheKey);
        }
      }
    } catch (error) {
      if (error instanceof ProviderError) {
        this.analytics.recordProviderError();
      }

      if (this.logging) {
        this.log('Error during generation', {
          error: error instanceof Error ? error.message : String(error)
        });
      }

      throw error;
    }
  }

  /**
   * Execute the actual request (checking cache, calling provider)
   */
  private async executeRequest(
    request: GenerateRequest,
    cacheKey: string,
    startTime: number
  ): Promise<GenerateResponse> {
    let actualRequest = request;
    let requestWasOptimized = false;

    // LEVEL 3: Try Context Intelligence Layer first (if enabled)
    // This optimizes the INPUT, then we use exact cache on optimized input
    if (this.contextIntelligence) {
      try {
        const optimizedRequest = await this.contextIntelligence.process(request);

        if (optimizedRequest) {
          // Successfully optimized the request
          actualRequest = optimizedRequest.optimizedRequest;
          requestWasOptimized = true;

          if (this.logging) {
            this.log('Context Intelligence optimized request', {
              duplicatesRemoved: optimizedRequest.optimization.duplicatesRemoved,
              messagesTrimmed: optimizedRequest.optimization.messagesTrimmed,
              tokensSaved: optimizedRequest.optimization.tokensSaved
            });
          }

          // Generate new cache key for optimized request
          cacheKey = this.hasher.hash(actualRequest);
        } else {
          // Context intelligence decided not to optimize
          if (this.logging) {
            this.log('Context Intelligence bypassed');
          }
        }

      } catch (error) {
        // Context intelligence failed, use original request
        if (this.logging) {
          this.log('Context Intelligence error, using original request', {
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }

    // LEVEL 1: Try exact cache (with potentially optimized request)
    const cached = await this.getCached(cacheKey);

    if (cached) {
      const latency = Date.now() - startTime;

      // Estimate tokens from the cached response
      const tokensAvoided = cached.response.usage?.total_tokens ?? 
        estimateRequestTokens(actualRequest.messages);

      this.analytics.recordCacheHit(tokensAvoided, latency);

      if (this.logging) {
        this.log(`Exact Cache HIT${requestWasOptimized ? ' (optimized request)' : ''}`, {
          latency: `${latency}ms`,
          tokensSaved: tokensAvoided
        });
      }

      return cached.response;
    }

    // Cache miss - call provider with actual request (potentially optimized)
    if (this.logging) {
      this.log(`Cache MISS${requestWasOptimized ? ' (optimized request)' : ''} - calling provider`, {
        model: actualRequest.model
      });
    }

    this.analytics.recordCacheMiss();

    // Call provider
    const response = await this.callProvider(actualRequest);

    // Save to cache
    await this.saveToCache(cacheKey, request, response);

    const totalLatency = Date.now() - startTime;

    if (this.logging) {
      this.log('Provider response received', {
        latency: `${totalLatency}ms`,
        tokens: response.usage?.total_tokens ?? 'unknown'
      });
    }

    return response;
  }

  /**
   * Get cached entry
   */
  private async getCached(key: string): Promise<CacheEntry | null> {
    try {
      return await this.store.get(key);
    } catch (error) {
      this.analytics.recordStoreError();

      if (this.logging) {
        this.log('Store error during get (continuing without cache)', {
          error: error instanceof Error ? error.message : String(error)
        });
      }

      // Fail gracefully - continue without cache
      return null;
    }
  }

  /**
   * Save to cache
   */
  private async saveToCache(
    key: string,
    request: GenerateRequest,
    response: GenerateResponse
  ): Promise<void> {
    try {
      const entry: CacheEntry = {
        key,
        request,
        response,
        timestamp: Date.now(),
        version: this.hasher.getVersion()
      };

      await this.store.set(key, entry, this.ttl);
    } catch (error) {
      this.analytics.recordStoreError();

      if (this.logging) {
        this.log('Store error during set (continuing without caching)', {
          error: error instanceof Error ? error.message : String(error)
        });
      }

      // Fail gracefully - continue without caching
      // Don't throw, as we have the response
    }
  }

  /**
   * Call the provider
   */
  private async callProvider(request: GenerateRequest): Promise<GenerateResponse> {
    try {
      return await this.provider.generate(request);
    } catch (error) {
      throw new ProviderError(
        `Provider call failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get current metrics
   */
  public getMetrics(): Readonly<Metrics> {
    return this.analytics.getMetrics();
  }

  /**
   * Get metrics summary
   */
  public getMetricsSummary(): string {
    let summary = this.analytics.getSummary();

    // Append context intelligence metrics if enabled
    if (this.contextIntelligence) {
      summary += '\n\n' + this.contextIntelligence.getMetricsSummary();
    }

    return summary;
  }

  /**
   * Get cache hit rate
   */
  public getCacheHitRate(): number {
    return this.analytics.getCacheHitRate();
  }

  /**
   * Reset metrics
   */
  public resetMetrics(): void {
    this.analytics.reset();
  }

  /**
   * Clear cache
   */
  public async clearCache(): Promise<void> {
    try {
      await this.store.clear();

      // Also clear context intelligence cache if enabled
      if (this.contextIntelligence) {
        await this.contextIntelligence.clear();
      }

      if (this.logging) {
        this.log('Cache cleared');
      }
    } catch (error) {
      throw new StoreError(
        `Failed to clear cache: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Log message
   */
  private log(message: string, data?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString();
    if (data) {
      console.log(`[NeuroCache ${timestamp}] ${message}`, data);
    } else {
      console.log(`[NeuroCache ${timestamp}] ${message}`);
    }
  }
}
