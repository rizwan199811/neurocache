import { NeuroCache } from '../src/NeuroCache';
import { OpenAIProvider } from '../src/providers/OpenAIProvider';
import { MemoryStore } from '../src/store/MemoryStore';
import { FileStore } from '../src/store/FileStore';
import type { GenerateResponse } from '../src/core/types';

async function basicExample(): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('Error: OPENAI_API_KEY not set');
    process.exit(1);
  }

  console.log('Basic Example\n');
  const provider = new OpenAIProvider({ apiKey });
  const cache = new NeuroCache({
    provider,
    store: new MemoryStore(),
    ttl: 3600,
    logging: true
  });

  console.log('Making first request...\n');
  const response1 = await cache.generate({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: 'What is the capital of France?' }]
  });

  console.log('Response:', response1.content);
  console.log('\nMaking same request (from cache)...\n');

  const response2 = await cache.generate({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: 'What is the capital of France?' }]
  });

  console.log('Cached:', response1.id === response2.id);
  console.log('\n' + cache.getMetricsSummary());
}

async function fileStoreExample(): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return;

  console.log('\nFileStore Example\n');
  const provider = new OpenAIProvider({ apiKey });
  const cache = new NeuroCache({
    provider,
    store: new FileStore('.cache'),
    ttl: 86400
  });

  const response = await cache.generate({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: 'Tell me a joke' }]
  });

  console.log('Response:', response.content);
  console.log('Cached to .cache/ directory');
}

async function concurrencyExample(): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return;

  console.log('\nConcurrency Example\n');
  const provider = new OpenAIProvider({ apiKey });
  const cache = new NeuroCache({
    provider,
    store: new MemoryStore(),
    enableDeduplication: true
  });

  console.log('Making 5 identical concurrent requests...');
  const start = Date.now();
  
  const promises = Array(5).fill(null).map(() =>
    cache.generate({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'What is 1+1?' }]
    })
  );

  const responses = await Promise.all(promises);
  console.log('All same ID:', responses.every((r: GenerateResponse) => r.id === responses[0]!.id));
  console.log('Completed in: ' + (Date.now() - start) + 'ms');
  console.log('(Only 1 actual API call was made)');
}


async function main(): Promise<void> {
  await basicExample();
  await fileStoreExample();
  await concurrencyExample();
}

main().catch(console.error);
