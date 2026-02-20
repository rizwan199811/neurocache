/**
 * Context Intelligence Layer - Production-Safe Example
 * Demonstrates Level 3 caching with context optimization (input-only)
 */

import { NeuroCache } from '../src';
import { OpenAIProvider } from '../src/providers/OpenAIProvider';
import { MemoryStore } from '../src/store/MemoryStore';

async function contextIntelligenceDemo(): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('Error: OPENAI_API_KEY not set');
    process.exit(1);
  }

  console.log('=== Context Intelligence Layer Demo (Production-Safe) ===\n');

  // Create provider
  const provider = new OpenAIProvider({ apiKey });

  // Create cache with Context Intelligence enabled (production-safe)
  const cache = new NeuroCache({
    provider,
    store: new MemoryStore(),
    enableContextIntelligence: true, // Enable Level 3
    contextOptimizationStrategy: {
      enableDeduplication: true,      // Remove duplicate messages
      normalizeContent: true,         // Cleanup whitespace
      enableHistoryTrimming: false,   // Optional: trim old history
      preserveSystemMessages: true    // Never remove system messages
    },
    minOptimizationThreshold: 5,      // Min tokens to trigger optimization
    ttl: 3600,
    logging: true
  });

  console.log('Step 1: First request with duplicate messages');
  console.log('-----------------------------------------------\n');

  const response1 = await cache.generate({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: 'You are a helpful assistant. Give concise answers.' },
      { role: 'user', content: 'What is the capital of France?' },
      { role: 'assistant', content: 'Paris.' },
      { role: 'user', content: 'What is the capital of France?' } // Duplicate - will be removed!
    ]
  });

  console.log(`Response: ${response1.content}\n`);
  console.log('Note: Duplicate user message was automatically removed before sending to LLM\n');

  console.log('\nStep 2: Another request with repeated context');
  console.log('----------------------------------------------\n');

  const response2 = await cache.generate({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'user', content: 'Count to 3' },
      { role: 'assistant', content: '1, 2, 3' },
      { role: 'user', content: 'Count to 3' }, // Duplicate
      { role: 'assistant', content: '1, 2, 3' },
      { role: 'user', content: 'Now count to 5' }
    ]
  });

  console.log(`Response: ${response2.content}\n`);

  console.log('\n=== Metrics ===');
  console.log(cache.getMetricsSummary());
}

async function deduplicationDemo(): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return;

  console.log('\n\n=== Context Deduplication Demo ===\n');

  const provider = new OpenAIProvider({ apiKey });
  const cache = new NeuroCache({
    provider,
    store: new MemoryStore(),
    enableContextIntelligence: true,
    contextOptimizationStrategy: {
      enableDeduplication: true,
      normalizeContent: true
    },
    minOptimizationThreshold: 1,
    logging: false
  });

  // Conversation with repeated user message
  console.log('Original messages: 5');
  console.log('After deduplication: fewer (duplicates removed)\n');
  
  const response = await cache.generate({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'user', content: 'Count to 3' },
      { role: 'assistant', content: '1, 2, 3' },
      { role: 'user', content: 'Count to 3' }, // Duplicate - removed
      { role: 'assistant', content: '1, 2, 3' }, // Duplicate - removed
      { role: 'user', content: 'Now count to 5' }
    ]
  });

  console.log(`Response: ${response.content}\n`);
  console.log('Metrics:');
  console.log(cache.getMetricsSummary());
}

async function comparisonDemo(): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return;

  console.log('\n\n=== Performance Comparison ===\n');

  const provider = new OpenAIProvider({ apiKey });

  // WITHOUT Context Intelligence
  console.log('Testing WITHOUT Context Intelligence:');
  const cacheBasic = new NeuroCache({
    provider,
    store: new MemoryStore(),
    enableContextIntelligence: false,
    logging: false
  });

  const start1 = Date.now();
  
  // Requests with duplicates (no optimization)
  await cacheBasic.generate({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'user', content: 'Hi' },
      { role: 'user', content: 'Hi' } // Duplicate sent to LLM
    ]
  });

  const duration1 = Date.now() - start1;
  console.log(`Duration: ${duration1}ms`);
  console.log(`Cache hits: ${cacheBasic.getMetrics().cacheHits}`);
  console.log(`Duplicates removed: 0 (no optimization)\n`);

  // WITH Context Intelligence
  console.log('Testing WITH Context Intelligence:');
  const cacheIntelligent = new NeuroCache({
    provider,
    store: new MemoryStore(),
    enableContextIntelligence: true,
    contextOptimizationStrategy: {
      enableDeduplication: true,
      normalizeContent: true
    },
    minOptimizationThreshold: 1,
    logging: false
  });

  const start2 = Date.now();

  // Same request, but duplicates are removed before LLM call
  await cacheIntelligent.generate({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'user', content: 'Hi' },
      { role: 'user', content: 'Hi' } // Automatically removed!
    ]
  });

  const duration2 = Date.now() - start2;
  const ciMetrics = cacheIntelligent.getMetrics();
  
  console.log(`Duration: ${duration2}ms`);
  console.log(`Cache hits: ${ciMetrics.cacheHits}`);
  console.log(`Tokens saved: ${ciMetrics.tokensSaved}\n`);
}

async function main(): Promise<void> {
  try {
    await contextIntelligenceDemo();
    await deduplicationDemo();
    await comparisonDemo();
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
