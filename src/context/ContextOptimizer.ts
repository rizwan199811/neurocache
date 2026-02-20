/**
 * Context Optimizer - Production-safe context optimization
 * Optimizes INPUT only, no partial response reuse
 */

import type { Message, GenerateRequest } from '../core/types';
import type { OptimizedRequest, OptimizedContext, ContextOptimizationStrategy } from './types';
import { ContextDeduplicator } from './ContextDeduplicator';
import { createHash } from 'crypto';

/**
 * Optimizes LLM request context through safe transformations
 */
export class ContextOptimizer {
  private readonly deduplicator: ContextDeduplicator;
  private readonly strategy: ContextOptimizationStrategy;
  private readonly logging: boolean;

  constructor(strategy: ContextOptimizationStrategy, logging: boolean = false) {
    this.deduplicator = new ContextDeduplicator();
    this.strategy = {
      enableDeduplication: true,
      enableHistoryTrimming: false,
      maxHistoryMessages: 0,
      preserveSystemMessages: true,
      enableTemplateDetection: false,
      normalizeContent: true,
      collapseWhitespace: false,  // Safe default: don't collapse whitespace
      ...strategy
    };
    this.logging = logging;
  }

  /**
   * Optimize a request by preprocessing context
   * Returns optimized request ready for cache/provider
   */
  public optimize(request: GenerateRequest): OptimizedRequest {
    const originalMessages = request.messages;
    let optimizedMessages = [...originalMessages];
    let duplicatesRemoved = 0;
    let messagesTrimmed = 0;
    let tokensSaved = 0;

    // Step 1: Normalize content (whitespace cleanup)
    if (this.strategy.normalizeContent) {
      optimizedMessages = optimizedMessages.map(msg => ({
        ...msg,
        content: this.normalizeContent(msg.content)
      }));
    }

    // Step 2: Deduplicate messages
    if (this.strategy.enableDeduplication && optimizedMessages.length > 1) {
      const dedupResult = this.deduplicator.deduplicate(optimizedMessages);
      if (dedupResult.duplicatesRemoved > 0) {
        optimizedMessages = dedupResult.deduplicatedMessages;
        duplicatesRemoved = dedupResult.duplicatesRemoved;
        tokensSaved += dedupResult.tokensSaved;

        if (this.logging) {
          console.log(`[ContextOptimizer] Removed ${duplicatesRemoved} duplicates, saved ~${dedupResult.tokensSaved} tokens`);
        }
      }
    }

    // Step 3: Trim history (keep recent N messages + system)
    if (this.strategy.enableHistoryTrimming && this.strategy.maxHistoryMessages && this.strategy.maxHistoryMessages > 0) {
      const trimResult = this.trimHistory(
        optimizedMessages,
        this.strategy.maxHistoryMessages,
        this.strategy.preserveSystemMessages ?? true
      );
      
      if (trimResult.trimmed > 0) {
        optimizedMessages = trimResult.messages;
        messagesTrimmed = trimResult.trimmed;
        tokensSaved += trimResult.tokensSaved;

        if (this.logging) {
          console.log(`[ContextOptimizer] Trimmed ${messagesTrimmed} old messages, saved ~${trimResult.tokensSaved} tokens`);
        }
      }
    }

    // Step 4: Generate deterministic hash
    const contextHash = this.hashMessages(optimizedMessages);

    // Check if optimization was beneficial
    const optimizationApplied = duplicatesRemoved > 0 || messagesTrimmed > 0;

    const optimization: OptimizedContext = {
      messages: optimizedMessages,
      originalMessageCount: originalMessages.length,
      duplicatesRemoved,
      messagesTrimmed,
      tokensSaved,
      contextHash
    };

    const optimizedRequest: GenerateRequest = {
      ...request,
      messages: optimizedMessages
    };

    return {
      originalRequest: request,
      optimizedRequest,
      optimization,
      optimizationApplied
    };
  }

  /**
   * Normalize message content (safe whitespace handling)
   * 
   * By default, only trims leading/trailing whitespace (safe).
   * Optionally collapses internal whitespace if collapseWhitespace is enabled.
   */
  private normalizeContent(content: string): string {
    // Safe default: only trim leading/trailing whitespace
    let normalized = content.trim();

    // Optional: collapse multiple whitespace into single spaces
    // Only if explicitly enabled (not safe for all prompts)
    if (this.strategy.collapseWhitespace) {
      normalized = normalized.replace(/\s+/g, ' ');
    }

    return normalized;
  }

  /**
   * Trim conversation history to keep recent messages
   */
  private trimHistory(
    messages: Message[],
    maxMessages: number,
    preserveSystem: boolean
  ): {
    messages: Message[];
    trimmed: number;
    tokensSaved: number;
  } {
    if (messages.length <= maxMessages) {
      return { messages, trimmed: 0, tokensSaved: 0 };
    }

    // Separate system messages from conversation
    const systemMessages = preserveSystem
      ? messages.filter(m => m.role === 'system')
      : [];

    const conversationMessages = messages.filter(m => m.role !== 'system');

    // Keep only recent N messages
    const recentMessages = conversationMessages.slice(-maxMessages);

    // Calculate what was trimmed
    const trimmedCount = conversationMessages.length - recentMessages.length;
    const trimmedMessages = conversationMessages.slice(0, trimmedCount);
    const tokensSaved = trimmedMessages.reduce(
      (sum, msg) => sum + this.estimateTokens(msg.content),
      0
    );

    // Recombine: system messages first, then recent conversation
    const result = [...systemMessages, ...recentMessages];

    return {
      messages: result,
      trimmed: trimmedCount,
      tokensSaved
    };
  }

  /**
   * Create deterministic hash of messages
   */
  private hashMessages(messages: Message[]): string {
    const content = messages
      .map(m => `${m.role}:${m.content}`)
      .join('|');

    return createHash('sha256')
      .update(content)
      .digest('hex')
      .substring(0, 32);
  }

  /**
   * Estimate token count
   */
  private estimateTokens(content: string): number {
    return Math.ceil(content.length / 4);
  }

  /**
   * Analyze what optimizations would be applied without actually applying them
   */
  public analyze(request: GenerateRequest): {
    wouldOptimize: boolean;
    estimatedTokenSavings: number;
    duplicatesDetected: number;
    messagesWouldTrim: number;
  } {
    let estimatedTokenSavings = 0;
    let duplicatesDetected = 0;
    let messagesWouldTrim = 0;

    // Check for duplicates
    if (this.strategy.enableDeduplication) {
      const dedupAnalysis = this.deduplicator.analyzeDeduplication(request.messages);
      duplicatesDetected = dedupAnalysis.duplicateCount;
      estimatedTokenSavings += dedupAnalysis.estimatedTokenSavings;
    }

    // Check trim potential
    if (this.strategy.enableHistoryTrimming && this.strategy.maxHistoryMessages) {
      const conversationMessages = request.messages.filter(m => m.role !== 'system');
      if (conversationMessages.length > this.strategy.maxHistoryMessages) {
        messagesWouldTrim = conversationMessages.length - this.strategy.maxHistoryMessages;
        // Estimate tokens in messages that would be trimmed
        const toTrim = conversationMessages.slice(0, messagesWouldTrim);
        const trimSavings = toTrim.reduce(
          (sum, msg) => sum + this.estimateTokens(msg.content),
          0
        );
        estimatedTokenSavings += trimSavings;
      }
    }

    return {
      wouldOptimize: duplicatesDetected > 0 || messagesWouldTrim > 0,
      estimatedTokenSavings,
      duplicatesDetected,
      messagesWouldTrim
    };
  }
}
