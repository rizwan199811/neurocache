# NeuroCache

Intelligent caching layer for LLM APIs. Save money and improve response times by caching LLM completions.

[![npm version](https://img.shields.io/npm/v/neurocache.svg)](https://www.npmjs.com/package/neurocache)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org/)

## Why?

LLM API calls are expensive and slow. If your application makes similar requests repeatedly, you're wasting money and time. NeuroCache sits between your app and the LLM provider, caching responses intelligently.

**Features:**
- **Context Intelligence Layer** - Production-safe input optimization and deduplication
- Deterministic caching with SHA-256 hashing
- Automatic request deduplication for concurrent calls
- Multiple storage backends (in-memory, file, Redis)
- Full TypeScript support with strict typing
- Provider-agnostic design (currently supports OpenAI)
- Built-in metrics and cost tracking

---

## Documentation

📖 **Complete Documentation:**

- **[Getting Started](docs/GETTING_STARTED.md)** - Step-by-step tutorial (10 minutes)
- **[Configuration Guide](docs/CONFIGURATION.md)** - All options explained
- **[API Reference](docs/API_REFERENCE.md)** - Complete API documentation
- **[Best Practices](docs/BEST_PRACTICES.md)** - Production deployment guide
- **[Use Cases](docs/USE_CASES.md)** - Real-world examples
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Common issues & solutions
- **[Context Intelligence](docs/CONTEXT_INTELLIGENCE.md)** - Smart caching features
- **[Security Policy](SECURITY.md)** - Security guidelines

---

## Installation

```bash
npm install neurocache
```

If you want to use Redis as your cache backend:
```bash
npm install redis
```

## Quick Start

```typescript
import { NeuroCache, OpenAIProvider, MemoryStore } from 'neurocache';

const cache = new NeuroCache({
  provider: new OpenAIProvider({
    apiKey: process.env.OPENAI_API_KEY
  }),
  store: new MemoryStore(),
  ttl: 3600
});

const response = await cache.generate({
  model: 'gpt-4',
  messages: [
    { role: 'user', content: 'What is the capital of France?' }
  ]
});

console.log(response.content); // "The capital of France is Paris."

// Same request again - served from cache instantly
const cached = await cache.generate({
  model: 'gpt-4',
  messages: [
    { role: 'user', content: 'What is the capital of France?' }
  ]
});

// Check your savings
const metrics = cache.getMetrics();
console.log(`Cache hit rate: ${metrics.cacheHits / metrics.totalRequests * 100}%`);
console.log(`Tokens saved: ${metrics.tokensSaved}`);
console.log(`Cost saved: $${metrics.estimatedCostSaved.toFixed(4)}`);
```

##rovider Options

#### OpenAI Provider

```typescript
import { OpenAIProvider } from 'neurocache';

const provider = new OpenAIProvider({
  apiKey: 'your-api-key',
  organization: 'org-id',      // Optional
  baseURL: 'custom-url',       // Optional
  maxRetries: 3,               // Optional (default: 3)
  timeout: 60000               // Optional (default: 60000ms)
});
```

### Store Options

#### Memory Store

Fast, in-memory cache. Perfect for development and short-lived processes.

```typescript
import { MemoryStore } from 'neurocache';

const store = new MemoryStore();
```

#### File Sts

**OpenAI** (built-in):
```typescript
const provider = new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY,
  maxRetries: 3,
  timeout: 60000
});
```

### Storage Backends

**Memory** - Fast, but doesn't persist:
```typescript
const store = new MemoryStore();
```

**File** - Persists to disk:
```typescript
const store = new FileStore('.cache/neurocache');
```

**Redis** - For distributed systems:
```typescript
const store = new RedisStore({
  host: 'localhost',
  port: 6379,
  keyPrefix: 'neurocache:'
});
```

###
With NeuroCache (70% hit rate):
- 30 API calls (70 cached)
- Average latency: 600ms (70% faster)
- Total cost: $0.18 (70% savings)
- Total time: 60 seconds

### Benchmark Results

Run the included benchmark:

```bash
npm run benchmark
```

Expected results:
- **Cache hit latency**: <10ms
In a typical scenario with repeated questions:
- **Without caching**: 100 requests to GPT-4 = $0.60, ~200 seconds
- **With NeuroCache** (70% hit rate): 30 API calls = $0.18, ~60 seconds

Cache hits are served in <10ms vs 500-2000ms for API calls.

##he.generate(sameRequest)
);

// Only 1 API call is made, others wait for result
const responses = await Promise.all(promises);
```

### 3. Development Testing

```typescript
const cache = new NeuroCache({
  provider: new OpenAIProvider({ apiKey }),
  store: new MemoryStore(),
  ttl: 300, // 5 minutes
  logging: true
});

// Iterate quickly without burning API credits
```

---

## 🧠 Context Intelligence Layer (Level 3)

**Production-Safe**: Optimizes INPUT context only, no partial response reuse.

### Quick Enable

```typescript
import { NeuroCache } from 'neurocache';

const cache = new NeuroCache({
  provider: new OpenAIProvider({ apiKey }),
  store: new MemoryStore(),
  
  // Enable Context Intelligence (production-safe)
  enableContextIntelligence: true,
  contextOptimizationStrategy: {
    enableDeduplication: true,      // Remove duplicate messages
    normalizeContent: true,         // Cleanup whitespace
    enableHistoryTrimming: false,   // Optional: trim old history
    preserveSystemMessages: true    // Never remove system messages
  },
  minOptimizationThreshold: 10      // Min tokens to trigger optimization
});
```

### What It Does

**Context Deduplication**: Removes repeated messages automatically
```typescript
// Input (5 messages with duplicates)
await cache.generate({
  messages: [
    { role: 'user', content: 'Hello' },
    { role: 'assistant', content: 'Hi' },
    { role: 'user', content: 'Hello' },     // Duplicate - removed!
    { role: 'assistant', content: 'Hi' },   // Duplicate - removed!
    { role: 'user', content: 'How are you?' }
  ]
});

// Actually sent to LLM (3 messages, duplicates removed)
// Result: Same quality response, fewer tokens used
```

**Content Normalization**: Cleans up whitespace for better cache hits
```typescript
// These become equivalent after normalization:
"Hello   world"  →  "Hello world"
"Hello\n\nworld" →  "Hello world"
```

**Safety Guarantees**:
- ✅ Deterministic (SHA-256 hashing)
- ✅ No semantic changes to responses
- ✅ Input optimization only (no response manipulation)
- ✅ Graceful fallback on errors
- ✅ System messages never removed

**Results**: 10-30% token savings on conversational workloads with duplicate context

👉 **[Full Documentation](docs/CONTEXT_INTELLIGENCE.md)** | **[Examples](examples/context-intelligence.ts)**

---

## 📈 Metrics & Analytics

### Get Metrics

```typescript
const metrics = cache.getMetrics();

console.log(metrics.totalRequests);       // Total requests
console.log(metrics.cacheHits);           // Cache hits
console.log(metrics.cacheMisses);         // Cache misses
console.log(metrics.tokensSaved);         // Tokens saved
console.log(metrics.estimatedCostSaved);  // Money saved
console.log(metrics.averageLatencySaved); // Avg latency saved

// Context Intelligence metrics (if enabled)
console.log(metrics.duplicateMessagesRemoved);   // Messages deduplicated
console.log(metrics.totalInputTokensSaved);      // Tokens saved from optimization
console.log(metrics.optimizationsApplied);       // Number of optimizations applied
```

### Get Summary

```typescript
console.log(cache.getMetricsSummary());
```

Output:
```
NeuroCache Metrics Summary
==========================
Total Requests: 150
Cache Hits: 105 (70.00%)
Cache Misses: 45
Tokens Saved: 42,500
Cost Saved: $0.4250
Avg Latency Saved: 1,234.56ms
Provider Errors: 0
Store Errors: 0
```

### Get Hit Rate

```typescript
const hitRate = cache.getCacheHitRate(); // Returns percentage
console.log(`Hit rate: ${hitRate.toFixed(1)}%`);
```

---

## 🧪 Testing

```bash
npm test
npm run test:coverage
```

## Advanced

**Custom Provider** - Implement `LLMProvider`:
```typescript
class CustomProvider implements LLMProvider {
  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    // your implementation
  }
  getProviderName(): string { return 'Custom'; }
  getModelName(request: GenerateRequest): string { return request.model; }
}
```

**Custom Store** - Implement `CacheStore`:
```typescript
class CustomStore implements CacheStore {
  async get(key: string): Promise<CacheEntry | null> { /* ... */ }
  async set(key: string, value: CacheEntry, ttl?: number): Promise<void> { /* ... */ }
  async delete(key: string): Promise<void> { /* ... */ }
  async clear(): Promise<void> { /* ... */ }
  getName(): string { return 'Custom'; }
}
```

**Cache Versioning** - Invalidate all caches:
```typescript
const cache = new NeuroCache({
  provider,
  store,
  version: 'v2' // bump version to invalidate old cache
});
```

## API

**Methods:**
- `generate(request)` - Generate completion with caching
- `getMetrics()` - Get metrics snapshot
- `getMetricsSummary()` - Formatted metrics string
- `getCacheHitRate()` - Hit rate percentage
- `resetMetrics()` - Reset all metrics
- `clearCache()` - Clear all entries

## Contributing

PRs welcome. Please add tests for new features.

## License

MIT
