/**
 * Context Deduplicator - Remove duplicate messages from conversation history
 * Production-safe: Operates on messages, deterministic, no semantic risk
 */

import type { Message } from '../core/types';
import type { DeduplicationResult } from './types';
import { createHash } from 'crypto';

/**
 * Deduplicate messages based on content
 * Strategy: Keep first occurrence of duplicate content
 */
export class ContextDeduplicator {
  /**
   * Deduplicate messages while preserving order and conversational flow
   * 
   * Rules:
   * 1. Always keep first occurrence of duplicate content
   * 2. Maintain chronological order
   * 3. Never deduplicate across different roles
   * 4. System messages are NEVER deduplicated (they set critical context)
   */
  public deduplicate(messages: Message[]): DeduplicationResult {
    const originalMessages = messages.map(m => ({ ...m }));
    const seenHashes = new Map<string, number>(); // hash -> first index
    const deduplicatedMessages: Message[] = [];
    
    let duplicatesRemoved = 0;
    let tokensSaved = 0;

    for (const message of messages) {
      const key = this.createDeduplicationKey(message);

      // System messages are never deduplicated - they provide critical context
      if (message.role === 'system') {
        deduplicatedMessages.push(message);
        seenHashes.set(key, deduplicatedMessages.length - 1);
        continue;
      }

      // Check if we've seen this exact content before (same role)
      const firstSeenIndex = seenHashes.get(key);

      if (firstSeenIndex !== undefined) {
        // Duplicate found - skip it
        duplicatesRemoved++;
        tokensSaved += this.estimateTokens(message.content);
        continue;
      }

      // First occurrence - keep it
      seenHashes.set(key, deduplicatedMessages.length);
      deduplicatedMessages.push(message);
    }

    return {
      originalMessages,
      deduplicatedMessages,
      duplicatesRemoved,
      tokensSaved
    };
  }

  /**
   * Create a deduplication key from message
   * Key includes role and content hash to prevent cross-role deduplication
   */
  private createDeduplicationKey(message: Message): string {
    const contentHash = this.hashContent(message.content);
    return `${message.role}:${contentHash}`;
  }

  /**
   * Hash message content deterministically
   */
  private hashContent(content: string): string {
    return createHash('sha256')
      .update(content.trim().toLowerCase())
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Estimate token count for a message
   */
  private estimateTokens(content: string): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(content.length / 4);
  }

  /**
   * Check if deduplication would be beneficial
   * Returns true if duplicates are detected
   */
  public hasDuplicates(messages: Message[]): boolean {
    const seen = new Set<string>();

    for (const message of messages) {
      // Skip system messages
      if (message.role === 'system') {
        continue;
      }

      const key = this.createDeduplicationKey(message);
      if (seen.has(key)) {
        return true;
      }
      seen.add(key);
    }

    return false;
  }

  /**
   * Get deduplication statistics without actually deduplicating
   */
  public analyzeDeduplication(messages: Message[]): {
    duplicateCount: number;
    estimatedTokenSavings: number;
    wouldDeduplicate: boolean;
  } {
    const seen = new Map<string, number>();
    let duplicateCount = 0;
    let estimatedTokenSavings = 0;

    for (const message of messages) {
      if (message.role === 'system') {
        continue;
      }

      const key = this.createDeduplicationKey(message);
      const count = seen.get(key) ?? 0;

      if (count > 0) {
        duplicateCount++;
        estimatedTokenSavings += this.estimateTokens(message.content);
      }

      seen.set(key, count + 1);
    }

    return {
      duplicateCount,
      estimatedTokenSavings,
      wouldDeduplicate: duplicateCount > 0
    };
  }
}
