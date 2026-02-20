import { NeuroCache } from '../src/NeuroCache';
import { OpenAIProvider } from '../src/providers/OpenAIProvider';
import { MemoryStore } from '../src/store/MemoryStore';
import type { GenerateRequest } from '../src/core/types';

/**
 * Simple benchmark comparing cached vs uncached requests
 */
async function runBenchmark(): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error('Error: OPENAI_API_KEY not set');
    console.error('Set it in .env or export OPENAI_API_KEY=your-key');
    process.exit(1);
  }

  console.log('NeuroCache Benchmark');
  console.log('===================\n');

  const provider = new OpenAIProvider({ apiKey });
  const cache = new NeuroCache({
    provider,
    store: new MemoryStore(),
    ttl: 3600,
    version: 'v1',
    logging: false
  });

  const requests: GenerateRequest[] = [
    {
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'What is the capital of France?' }
      ],
      temperature: 0.7
    },
    {
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'What is 2 + 2?' }
      ],
      temperature: 0.7
    }
  ];

  console.log(`Testing with ${requests.length} unique requests\n`);

  // Phase 1: Initial requests (cache misses)
  console.log('Phase 1: Initial requests (cache misses)');
  console.log('----------------------------------------');

  const phase1Start = Date.now();

  for (const request of requests) {
    const start = Date.now();
    const response = await cache.generate(request);
    const duration = Date.now() - start;
    console.log(`  ${duration}ms - ${response.content.substring(0, 40)}...`);
  }

  const phase1Duration = Date.now() - phase1Start;

  // Phase 2: Repeated requests (cache hits)
  console.log('\nPhase 2: Repeated requests (cache hits)');
  console.log('---------------------------------------');

  const phase2Start = Date.now();

  for (const request of requests) {
    const start = Date.now();
    await cache.generate(request);
    const duration = Date.now() - start;
    console.log(`  ${duration}ms (cached)`);
  }

  const phase2Duration = Date.now() - phase2Start;

  // Results
  console.log('\nResults');
  console.log('=======');
  console.log(`Phase 1 (uncached): ${phase1Duration}ms total`);
  console.log(`Phase 2 (cached):   ${phase2Duration}ms total`);
  console.log(`Speedup: ${(phase1Duration / phase2Duration).toFixed(1)}x`);

  const metrics = cache.getMetrics();
  console.log(`\nCache hit rate: ${cache.getCacheHitRate().toFixed(1)}%`);
  console.log(`Tokens saved: ${metrics.tokensSaved}`);
  console.log(`Cost saved: $${metrics.estimatedCostSaved.toFixed(4)}`);
}

runBenchmark().catch(console.error);
