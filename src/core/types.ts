/**
 * Represents a message in a conversation
 */
export interface Message {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
  name?: string;
}

/**
 * Request to generate a completion
 */
export interface GenerateRequest {
  model: string;
  messages: Message[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  [key: string]: unknown;
}

/**
 * Token usage information
 */
export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/**
 * Response from generation
 */
export interface GenerateResponse {
  id: string;
  model: string;
  content: string;
  usage?: TokenUsage;
  finish_reason?: string;
  created: number;
}

/**
 * LLM Provider interface
 */
export interface LLMProvider {
  /**
   * Generate a completion
   */
  generate(request: GenerateRequest): Promise<GenerateResponse>;

  /**
   * Get the provider name
   */
  getProviderName(): string;

  /**
   * Get the model name
   */
  getModelName(request: GenerateRequest): string;
}

/**
 * Cache entry stored in cache store
 */
export interface CacheEntry {
  key: string;
  request: GenerateRequest;
  response: GenerateResponse;
  timestamp: number;
  version: string;
  expiresAt?: number;
}

/**
 * Cache store interface
 */
export interface CacheStore {
  /**
   * Get a cache entry by key
   */
  get(key: string): Promise<CacheEntry | null>;

  /**
   * Set a cache entry
   */
  set(key: string, value: CacheEntry, ttl?: number): Promise<void>;

  /**
   * Delete a cache entry
   */
  delete(key: string): Promise<void>;

  /**
   * Clear all cache entries
   */
  clear(): Promise<void>;

  /**
   * Get store name for debugging
   */
  getName(): string;
}

/**
 * Metrics tracked by NeuroCache
 */
export interface Metrics {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  tokensSaved: number;
  estimatedCostSaved: number;
  averageLatencySaved: number;
  providerErrors: number;
  storeErrors: number;
}

/**
 * Metrics adapter interface for pluggable metrics backends
 * Allows custom implementations (e.g., Redis, Prometheus, DataDog)
 */
export interface MetricsAdapter {
  /**
   * Record a cache hit event
   */
  recordCacheHit(tokensAvoided: number, latencySaved: number): void;

  /**
   * Record a cache miss event
   */
  recordCacheMiss(): void;

  /**
   * Record a provider error
   */
  recordProviderError(): void;

  /**
   * Record a store error
   */
  recordStoreError(): void;

  /**
   * Get current metrics snapshot
   */
  getMetrics(): Readonly<Metrics>;

  /**
   * Get cache hit rate percentage
   */
  getCacheHitRate(): number;

  /**
   * Get formatted metrics summary
   */
  getSummary(): string;

  /**
   * Reset all metrics
   */
  reset(): void;
}

/**
 * Configuration options for NeuroCache
 */
export interface NeuroCacheConfig {
  /**
   * LLM provider to use
   */
  provider: LLMProvider;

  /**
   * Cache store to use
   */
  store: CacheStore;

  /**
   * Cache version (changing this invalidates all cached entries)
   */
  version?: string;

  /**
   * Default TTL for cache entries in seconds
   */
  ttl?: number;

  /**
   * Enable logging
   */
  logging?: boolean;

  /**
   * Cost per 1K tokens (for cost estimation)
   */
  costPerToken?: {
    prompt: number;
    completion: number;
  };

  /**
   * Custom metrics adapter
   * Allows pluggable metrics backends (e.g., Redis, Prometheus)
   * If not provided, uses in-memory metrics adapter
   */
  metricsAdapter?: MetricsAdapter;

  /**
   * Enable request deduplication
   */
  enableDeduplication?: boolean;

  /**
   * Enable Context Intelligence Layer (Level 3)
   * Production-safe: Optimizes input context only
   */
  enableContextIntelligence?: boolean;

  /**
   * Context optimization strategy
   */
  contextOptimizationStrategy?: {
    enableDeduplication?: boolean;
    enableHistoryTrimming?: boolean;
    maxHistoryMessages?: number;
    preserveSystemMessages?: boolean;
    normalizeContent?: boolean;
    collapseWhitespace?: boolean;
  };

  /**
   * Minimum token savings threshold to apply optimizations
   * Default: 10 tokens
   */
  minOptimizationThreshold?: number;
}

/**
 * Hash configuration
 */
export interface HashConfig {
  version: string;
  includeModel: boolean;
  includeTemperature: boolean;
  includeTopP: boolean;
}
