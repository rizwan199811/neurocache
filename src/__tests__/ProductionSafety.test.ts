/**
 * Critical Safety Tests - Production Verification
 */

import { ContextDeduplicator } from '../context/ContextDeduplicator';
import { ContextOptimizer } from '../context/ContextOptimizer';
import type { Message, GenerateRequest } from '../core/types';

describe('Production Safety Critical Tests', () => {
  describe('1️⃣ Dedup is role-aware', () => {
    it('should NOT deduplicate same content across different roles', () => {
      const deduplicator = new ContextDeduplicator();
      
      const messages: Message[] = [
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hello' }  // Same content, different role
      ];

      const result = deduplicator.deduplicate(messages);

      // CRITICAL: Both should be kept
      expect(result.deduplicatedMessages.length).toBe(2);
      expect(result.duplicatesRemoved).toBe(0);
    });

    it('should deduplicate same content within same role', () => {
      const deduplicator = new ContextDeduplicator();
      
      const messages: Message[] = [
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi' },
        { role: 'user' as const, content: 'Hello' }  // Same role, same content
      ];

      const result = deduplicator.deduplicate(messages);

      // CRITICAL: Duplicate user message should be removed
      expect(result.deduplicatedMessages.length).toBe(2);
      expect(result.duplicatesRemoved).toBe(1);
    });
  });

  describe('2️⃣ History trimming is deterministic', () => {
    it('should always keep last N messages in same order', () => {
      const optimizer = new ContextOptimizer({
        enableHistoryTrimming: true,
        maxHistoryMessages: 2,
        preserveSystemMessages: true
      });

      const messages: Message[] = [
        { role: 'user' as const, content: 'First' },
        { role: 'assistant' as const, content: 'Second' },
        { role: 'user' as const, content: 'Third' },
        { role: 'assistant' as const, content: 'Fourth' }
      ];

      // Run multiple times
      const result1 = optimizer.optimize({ model: 'gpt-3.5-turbo', messages });
      const result2 = optimizer.optimize({ model: 'gpt-3.5-turbo', messages });

      // CRITICAL: Same result every time (deterministic)
      expect(result1.optimizedRequest.messages).toEqual(result2.optimizedRequest.messages);
      
      // CRITICAL: Should keep last 2
      expect(result1.optimizedRequest.messages.length).toBe(2);
      expect(result1.optimizedRequest.messages[0]!.content).toBe('Third');
      expect(result1.optimizedRequest.messages[1]!.content).toBe('Fourth');
    });
  });

  describe('3️⃣ Hash is taken AFTER optimization', () => {
    it('should generate same hash for semantically equivalent optimized requests', () => {
      const optimizer = new ContextOptimizer({
        enableDeduplication: true,
        normalizeContent: true
      });

      // Request with duplicates
      const request1: GenerateRequest = {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'user' as const, content: 'Hello' },
          { role: 'user' as const, content: 'Hello' }
        ]
      };

      // Request without duplicates
      const request2: GenerateRequest = {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'user' as const, content: 'Hello' }
        ]
      };

      const optimized1 = optimizer.optimize(request1);
      const optimized2 = optimizer.optimize(request2);

      // CRITICAL: After optimization, both should be identical
      expect(optimized1.optimizedRequest.messages).toEqual(optimized2.optimizedRequest.messages);
      
      // Therefore, their hashes should be the same
      expect(optimized1.optimization.contextHash).toBe(optimized2.optimization.contextHash);
    });
  });

  describe('4️⃣ System messages NEVER removed', () => {
    it('should never deduplicate system messages', () => {
      const deduplicator = new ContextDeduplicator();
      
      const messages: Message[] = [
        { role: 'system' as const, content: 'You are helpful' },
        { role: 'user' as const, content: 'Hi' },
        { role: 'system' as const, content: 'You are helpful' }  // Duplicate system
      ];

      const result = deduplicator.deduplicate(messages);

      // CRITICAL: Both system messages should be kept
      const systemCount = result.deduplicatedMessages.filter(m => m.role === 'system').length;
      expect(systemCount).toBe(2);
      expect(result.duplicatesRemoved).toBe(0);
    });

    it('should never trim system messages from history', () => {
      const optimizer = new ContextOptimizer({
        enableHistoryTrimming: true,
        maxHistoryMessages: 1,  // Very aggressive trimming
        preserveSystemMessages: true
      });

      const messages: Message[] = [
        { role: 'system' as const, content: 'You are helpful' },
        { role: 'user' as const, content: 'First' },
        { role: 'assistant' as const, content: 'OK' },
        { role: 'user' as const, content: 'Second' }
      ];

      const result = optimizer.optimize({ model: 'gpt-3.5-turbo', messages });

      // CRITICAL: System message should be preserved
      const hasSystem = result.optimizedRequest.messages.some(m => m.role === 'system');
      expect(hasSystem).toBe(true);
      
      // CRITICAL: Should have system + last 1 conversation message
      expect(result.optimizedRequest.messages.length).toBe(2);
      expect(result.optimizedRequest.messages[0]!.role).toBe('system');
      expect(result.optimizedRequest.messages[1]!.content).toBe('Second');
    });
  });
});
