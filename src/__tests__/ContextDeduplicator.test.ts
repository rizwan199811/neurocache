/**
 * Tests for ContextDeduplicator (Production-Safe)
 */

import { ContextDeduplicator } from '../context/ContextDeduplicator';
import type { Message } from '../core/types';

describe('ContextDeduplicator', () => {
  let deduplicator: ContextDeduplicator;

  beforeEach(() => {
    deduplicator = new ContextDeduplicator();
  });

  describe('deduplicate', () => {
    it('should remove duplicate messages', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' },
        { role: 'user', content: 'Hello' } // Duplicate
      ];

      const result = deduplicator.deduplicate(messages);

      expect(result.deduplicatedMessages.length).toBe(2);
      expect(result.duplicatesRemoved).toBe(1);
      expect(result.tokensSaved).toBeGreaterThan(0);
    });

    it('should never deduplicate system messages', () => {
      const messages: Message[] = [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hi' },
        { role: 'system', content: 'You are helpful' } // Same content, different position
      ];

      const result = deduplicator.deduplicate(messages);

      expect(result.deduplicatedMessages.length).toBe(3);
      expect(result.duplicatesRemoved).toBe(0);
    });

    it('should keep first occurrence of duplicate', () => {
      const messages: Message[] = [
        { role: 'user', content: 'First' },
        { role: 'assistant', content: 'OK' },
        { role: 'user', content: 'First' }, // Duplicate
        { role: 'user', content: 'Second' }
      ];

      const result = deduplicator.deduplicate(messages);

      expect(result.deduplicatedMessages.length).toBe(3);
      expect(result.deduplicatedMessages[0]!.content).toBe('First');
      expect(result.deduplicatedMessages[1]!.content).toBe('OK');
      expect(result.deduplicatedMessages[2]!.content).toBe('Second');
    });

    it('should not deduplicate across different roles', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hello' }
      ];

      const result = deduplicator.deduplicate(messages);

      expect(result.deduplicatedMessages.length).toBe(2); // Both kept
      expect(result.duplicatesRemoved).toBe(0);
    });
  });

  describe('hasDuplicates', () => {
    it('should detect duplicates', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hi' },
        { role: 'user', content: 'Hi' }
      ];

      expect(deduplicator.hasDuplicates(messages)).toBe(true);
    });

    it('should return false when no duplicates', () => {
      const messages: Message[] = [
        { role: 'user', content: 'First' },
        { role: 'user', content: 'Second' }
      ];

      expect(deduplicator.hasDuplicates(messages)).toBe(false);
    });
  });

  describe('analyzeDeduplication', () => {
    it('should analyze deduplication potential', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Test message' },
        { role: 'user', content: 'Test message' }
      ];

      const analysis = deduplicator.analyzeDeduplication(messages);

      expect(analysis.duplicateCount).toBe(1);
      expect(analysis.estimatedTokenSavings).toBeGreaterThan(0);
      expect(analysis.wouldDeduplicate).toBe(true);
    });
  });
});
