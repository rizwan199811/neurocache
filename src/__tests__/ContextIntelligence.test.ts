/**
 * Tests for ContextIntelligence (Production-Safe)
 */

import { ContextIntelligence } from '../context/ContextIntelligence';
import type { GenerateRequest } from '../core/types';

describe('ContextIntelligence', () => {
  describe('Production-safe optimization', () => {
    it('should optimize request by removing duplicates', async () => {
      const intelligence = new ContextIntelligence({
        enabled: true,
        strategy: {
          enableDeduplication: true,
          normalizeContent: true
        },
        minTokenSavingsThreshold: 1 // Very low threshold
      });

      const request: GenerateRequest = {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'user', content: 'Hello there how are you doing?' },
          { role: 'assistant', content: 'I am doing great thank you!' },
          { role: 'user', content: 'Hello there how are you doing?' } // Duplicate
        ]
      };

      const result = await intelligence.process(request);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.optimizedRequest.messages.length).toBeLessThan(request.messages.length);
        expect(result.optimization.duplicatesRemoved).toBeGreaterThan(0);
        expect(result.optimization.tokensSaved).toBeGreaterThan(0);
      }
    });

    it('should bypass when savings below threshold', async () => {
      const intelligence = new ContextIntelligence({
        enabled: true,
        strategy: {
          enableDeduplication: true
        },
        minTokenSavingsThreshold: 1000 // Very high threshold
      });

      const request: GenerateRequest = {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'user', content: 'Hi' },
          { role: 'user', content: 'Hi' }
        ]
      };

      const result = await intelligence.process(request);

      expect(result).toBeNull(); // Bypassed due to low savings
    });

    it('should collect metrics', async () => {
      const intelligence = new ContextIntelligence({
        enabled: true,
        strategy: {
          enableDeduplication: true
        },
        minTokenSavingsThreshold: 1 // Very low threshold
      });

      const request: GenerateRequest = {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'user', content: 'This is a test message with enough tokens' },
          { role: 'user', content: 'This is a test message with enough tokens' }
        ]
      };

      await intelligence.process(request);

      const metrics = intelligence.getMetrics();

      expect(metrics.totalOptimizedRequests).toBeGreaterThan(0);
      expect(metrics.averageOptimizationLatency).toBeGreaterThanOrEqual(0);
    });

    it('should reset metrics', async () => {
      const intelligence = new ContextIntelligence({
        enabled: true,
        strategy: {
          enableDeduplication: true
        }
      });

      const request: GenerateRequest = {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'user', content: 'Test' },
          { role: 'user', content: 'Test' }
        ]
      };

      await intelligence.process(request);
      intelligence.resetMetrics();

      const metrics = intelligence.getMetrics();

      expect(metrics.totalOptimizedRequests).toBe(0);
      expect(metrics.duplicateMessagesRemoved).toBe(0);
    });

    it('should handle errors gracefully', async () => {
      const intelligence = new ContextIntelligence({
        enabled: true,
        strategy: {
          enableDeduplication: true
        }
      });

      // Malformed request
      const request: GenerateRequest = {
        model: 'gpt-3.5-turbo',
        messages: [] // Empty messages
      };

      const result = await intelligence.process(request);

      // Should return null (bypass) or handle gracefully
      expect(result === null || result.optimizedRequest !== undefined).toBe(true);
    });
  });
});
