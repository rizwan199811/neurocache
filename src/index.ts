// Core exports
export { NeuroCache } from './NeuroCache';

// Types
export type {
  Message,
  GenerateRequest,
  GenerateResponse,
  TokenUsage,
  LLMProvider,
  CacheStore,
  CacheEntry,
  Metrics,
  MetricsAdapter,
  NeuroCacheConfig
} from './core/types';

// Errors
export {
  NeuroCacheError,
  ProviderError,
  StoreError,
  HashingError,
  ConfigurationError
} from './core/errors';

// Providers
export { OpenAIProvider } from './providers/OpenAIProvider';
export type { OpenAIProviderConfig } from './providers/OpenAIProvider';

// Stores
export { MemoryStore } from './store/MemoryStore';
export { FileStore } from './store/FileStore';
export { RedisStore } from './store/RedisStore';
export type { RedisStoreOptions } from './store/RedisStore';

// Analytics
export { Analytics } from './analytics/Analytics';
export { InMemoryMetricsAdapter } from './analytics/InMemoryMetricsAdapter';

// Hashing
export { Hasher } from './hashing/hasher';

// Context Intelligence Layer (Level 3) - Production-Safe
export {
  ContextIntelligence,
  ContextOptimizer,
  ContextDeduplicator,
  ContextIntelligenceAnalytics
} from './context';

export type {
  ChunkType,
  MessageMetadata,
  OptimizedContext,
  OptimizedRequest,
  DeduplicationResult,
  TemplatePattern,
  ContextIntelligenceMetrics,
  ContextOptimizationStrategy,
  ContextIntelligenceConfig
} from './context';
