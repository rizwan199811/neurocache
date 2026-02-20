/**
 * Context Intelligence Layer - Type Definitions
 * Production-safe context optimization (input-only, no partial reuse)
 */

import type { Message, GenerateRequest } from '../core/types';

/**
 * Type of message role for grouping
 */
export type ChunkType = 'system' | 'user' | 'assistant';

/**
 * Metadata for normalized messages
 */
export interface MessageMetadata {
  /**
   * Estimated token count
   */
  tokenEstimate: number;

  /**
   * Hash of normalized content
   */
  contentHash: string;

  /**
   * Original position before optimization
   */
  originalPosition: number;
}

/**
 * Result of context optimization
 */
export interface OptimizedContext {
  /**
   * Optimized messages (deduplicated, trimmed, normalized)
   */
  messages: Message[];

  /**
   * Original message count before optimization
   */
  originalMessageCount: number;

  /**
   * Number of duplicate messages removed
   */
  duplicatesRemoved: number;

  /**
   * Number of messages trimmed (history)
   */
  messagesTrimmed: number;

  /**
   * Estimated tokens saved from optimization
   */
  tokensSaved: number;

  /**
   * Deterministic hash of optimized context
   */
  contextHash: string;
}

/**
 * Result of applying optimizations to a request
 */
export interface OptimizedRequest {
  /**
   * Original request
   */
  originalRequest: GenerateRequest;

  /**
   * Optimized request ready for provider/cache
   */
  optimizedRequest: GenerateRequest;

  /**
   * Context optimization details
   */
  optimization: OptimizedContext;

  /**
   * Whether optimization provided benefit
   */
  optimizationApplied: boolean;
}

/**
 * Context deduplication result
 */
export interface DeduplicationResult {
  /**
   * Original messages before deduplication
   */
  originalMessages: Message[];

  /**
   * Deduplicated messages
   */
  deduplicatedMessages: Message[];

  /**
   * Number of duplicate messages removed
   */
  duplicatesRemoved: number;

  /**
   * Estimated tokens saved from deduplication
   */
  tokensSaved: number;
}

/**
 * Template detection result
 */
export interface TemplatePattern {
  /**
   * Template identifier
   */
  templateId: string;

  /**
   * Pattern structure
   */
  pattern: string;

  /**
   * Detected parameters
   */
  parameters: Record<string, string>;

  /**
   * Confidence score (0-1)
   */
  confidence: number;
}

/**
 * Metrics for context intelligence layer (production-safe)
 */
export interface ContextIntelligenceMetrics {
  // Optimization statistics
  totalOptimizedRequests: number;
  optimizationsApplied: number;
  optimizationsBypassed: number;

  // Deduplication
  duplicateMessagesRemoved: number;
  tokensSavedFromDedup: number;

  // History trimming
  messagesTotalTrimmed: number;
  tokensSavedFromTrimming: number;

  // Template detection
  templatesDetected: number;
  templateCacheHits: number;

  // Token savings (input-level only)
  totalInputTokensSaved: number;
  estimatedCostSaved: number;

  // Performance
  totalOptimizationLatency: number;
  averageOptimizationLatency: number;

  // Failures
  optimizationErrors: number;
}

/**
 * Context optimization strategy configuration
 */
export interface ContextOptimizationStrategy {
  /**
   * Enable context deduplication
   */
  enableDeduplication?: boolean;

  /**
   * Enable history trimming
   */
  enableHistoryTrimming?: boolean;

  /**
   * Maximum messages to keep in history (0 = keep all)
   */
  maxHistoryMessages?: number;

  /**
   * Always preserve system messages
   */
  preserveSystemMessages?: boolean;

  /**
   * Enable template detection
   */
  enableTemplateDetection?: boolean;

  /**
   * Normalize whitespace and formatting
   * When true, only trims leading/trailing whitespace (safe)
   */
  normalizeContent?: boolean;

  /**
   * Collapse multiple whitespace characters into single spaces
   * WARNING: Only enable if your prompts don't rely on whitespace formatting
   * Default: false (safe)
   */
  collapseWhitespace?: boolean;
}

/**
 * Configuration for context intelligence layer
 */
export interface ContextIntelligenceConfig {
  /**
   * Enable context intelligence features
   */
  enabled: boolean;

  /**
   * Optimization strategy
   */
  strategy: ContextOptimizationStrategy;

  /**
   * Whether to enable logging for debugging
   */
  logging?: boolean;

  /**
   * Minimum token savings threshold
   * Below this, skip optimization
   */
  minTokenSavingsThreshold?: number;
}
