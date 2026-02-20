# Getting Started with NeuroCache

Complete step-by-step guide to get you up and running with NeuroCache in 10 minutes.

## Table of Contents

1. [What is NeuroCache?](#what-is-neurocache)
2. [Installation](#installation)
3. [Your First Cache](#your-first-cache)
4. [Understanding Cache Behavior](#understanding-cache-behavior)
5. [Choosing a Storage Backend](#choosing-a-storage-backend)
6. [Monitoring & Metrics](#monitoring--metrics)
7. [Next Steps](#next-steps)

---

## What is NeuroCache?

NeuroCache is a **smart caching layer** for LLM APIs that:
- ✅ Reduces API costs by 40-90%
- ✅ Improves response times (10ms vs 2000ms)
- ✅ Handles concurrent identical requests automatically
- ✅ Works with any LLM provider (OpenAI, Anthropic, etc.)

**How it works:** When you make an LLM request, NeuroCache:
1. Creates a deterministic hash of your request
2. Checks if we've seen this exact request before
3. Returns cached response instantly (if found)
4. Otherwise, calls the LLM provider and caches the result

---

## Installation

### Step 1: Install NeuroCache

```bash
npm install neurocache
```

### Step 2: Install LLM Provider SDK

For OpenAI:
```bash
npm install openai
```

### Step 3: (Optional) Install Redis for Production

```bash
npm install redis
```

---

## Your First Cache

### Example 1: Basic Setup (5 minutes)

Create a file `app.ts`:

```typescript
import { NeuroCache, OpenAIProvider, MemoryStore } from 'neurocache';

// 1. Create cache instance
const cache = new NeuroCache({
  provider: new OpenAIProvider({
    apiKey: process.env.OPENAI_API_KEY  // Get from https://platform.openai.com
  }),
  store: new MemoryStore(),             // In-memory cache (development)
  ttl: 3600,                            // Cache for 1 hour
  logging: true                         // See what's happening
});

// 2. Make your first request
async function main() {
  const question = "What is the capital of France?";
  
  console.log('First request (cache MISS - calls OpenAI):');
  console.time('Request 1');
  const response1 = await cache.generate({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: question }]
  });
  console.timeEnd('Request 1');
  console.log('Answer:', response1.content);
  
  console.log('\nSecond request (cache HIT - instant):');
  console.time('Request 2');
  const response2 = await cache.generate({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: question }]
  });
  console.timeEnd('Request 2');
  console.log('Answer:', response2.content);
  
  // 3. Check your savings
  const metrics = cache.getMetrics();
  console.log('\n📊 Stats:');
  console.log(`  Cache Hit Rate: ${(metrics.cacheHits / metrics.totalRequests * 100).toFixed(1)}%`);
  console.log(`  Tokens Saved: ${metrics.tokensSaved}`);
  console.log(`  Money Saved: $${metrics.estimatedCostSaved.toFixed(4)}`);
}

main();
```

Run it:
```bash
export OPENAI_API_KEY="sk-..."  # Your OpenAI API key
npx ts-node app.ts
```

**Expected output:**
```
First request (cache MISS - calls OpenAI):
Request 1: 1823ms
Answer: The capital of France is Paris.

Second request (cache HIT - instant):
Request 2: 3ms
Answer: The capital of France is Paris.

📊 Stats:
  Cache Hit Rate: 50.0%
  Tokens Saved: 28
  Money Saved: $0.0006
```

**🎉 Congratulations!** You just saved ~1800ms and a few cents on your second request.

---

## Understanding Cache Behavior

### What Gets Cached?

NeuroCache creates a **deterministic hash** from:
- ✅ Model name (`gpt-3.5-turbo`)
- ✅ Messages (with roles)
- ✅ Temperature (if specified)
- ✅ max_tokens (if specified)
- ✅ All other parameters

**Example - These are DIFFERENT cache entries:**

```typescript
// Request 1
await cache.generate({
  model: 'gpt-3.5-turbo',
  messages: [{ role: 'user', content: 'Hello' }],
  temperature: 0.7
});

// Request 2 - DIFFERENT (different temperature)
await cache.generate({
  model: 'gpt-3.5-turbo',
  messages: [{ role: 'user', content: 'Hello' }],
  temperature: 0.9  // ← Different!
});

// Request 3 - DIFFERENT (different model)
await cache.generate({
  model: 'gpt-4',  // ← Different!
  messages: [{ role: 'user', content: 'Hello' }]
});
```

### Whitespace & Formatting

NeuroCache **normalizes whitespace** by default:

```typescript
// These are treated as THE SAME:
"What is  2+2?"     // Multiple spaces
"What is 2+2?"      // Single space
"  What is 2+2?  "  // Leading/trailing spaces
```

To disable this:
```typescript
const cache = new NeuroCache({
  // ...
  enableContextIntelligence: false  // Exact matching only
});
```

---

## Choosing a Storage Backend

### Development: MemoryStore

**Best for:** Local development, testing
**Pros:** Fast, zero setup
**Cons:** Data lost on restart, not shared across processes

```typescript
import { MemoryStore } from 'neurocache';

const store = new MemoryStore(1000);  // Max 1000 entries (LRU eviction)
```

### Single Server: FileStore

**Best for:** Single-server deployments, persistence needed
**Pros:** Survives restarts, simple
**Cons:** Slower than memory, file I/O overhead

```typescript
import { FileStore } from 'neurocache';

const store = new FileStore('./cache/neurocache');  // Path to cache directory
```

### Production: RedisStore

**Best for:** Multiple servers, high traffic, distributed systems
**Pros:** Fast, shared across instances, battle-tested
**Cons:** Requires Redis server

```typescript
import { RedisStore } from 'neurocache';

const store = new RedisStore({
  host: 'localhost',
  port: 6379,
  password: 'your-password',  // If auth enabled
  keyPrefix: 'neurocache:',   // Namespace your keys
  db: 0                       // Redis database number
});
```

**Docker Redis (for local testing):**
```bash
docker run -d -p 6379:6379 redis:7-alpine
```

---

## Monitoring & Metrics

### Real-time Metrics

```typescript
const metrics = cache.getMetrics();

console.log({
  totalRequests: metrics.totalRequests,      // All requests made
  cacheHits: metrics.cacheHits,              // Served from cache
  cacheMisses: metrics.cacheMisses,          // Called provider
  hitRate: (metrics.cacheHits / metrics.totalRequests * 100).toFixed(1) + '%',
  tokensSaved: metrics.tokensSaved,          // Tokens not sent to provider
  costSaved: '$' + metrics.estimatedCostSaved.toFixed(4),
  avgLatencySaved: metrics.averageLatencySaved.toFixed(0) + 'ms'
});
```

### Pretty Summary

```typescript
console.log(cache.getMetricsSummary());
```

Output:
```
NeuroCache Metrics Summary
==========================
Total Requests: 100
Cache Hits: 73 (73.00%)
Cache Misses: 27
Tokens Saved: 12,450
Cost Saved: $0.2490
Avg Latency Saved: 1,234ms
Provider Errors: 0
Store Errors: 0
```

### Monitoring in Production

**Option 1: Custom Metrics Adapter**

```typescript
import { MetricsAdapter, InMemoryMetricsAdapter } from 'neurocache';

class PrometheusMetricsAdapter extends InMemoryMetricsAdapter {
  recordCacheHit(tokens: number, latency: number) {
    super.recordCacheHit(tokens, latency);
    prometheusClient.increment('neurocache_hits');
  }
  
  recordCacheMiss() {
    super.recordCacheMiss();
    prometheusClient.increment('neurocache_misses');
  }
}

const cache = new NeuroCache({
  // ...
  metricsAdapter: new PrometheusMetricsAdapter()
});
```

**Option 2: Periodic Logging**

```typescript
setInterval(() => {
  const summary = cache.getMetricsSummary();
  logger.info('NeuroCache Stats', { summary });
}, 60000);  // Every minute
```

---

## Next Steps

Now that you have the basics:

1. **📖 Configuration Guide** - [docs/CONFIGURATION.md](./CONFIGURATION.md)
   - All configuration options explained
   - Performance tuning tips

2. **🎯 Best Practices** - [docs/BEST_PRACTICES.md](./BEST_PRACTICES.md)
   - Production deployment checklist
   - Security guidelines
   - Cache invalidation strategies

3. **🔧 API Reference** - [docs/API_REFERENCE.md](./API_REFERENCE.md)
   - Complete method documentation
   - Type definitions

4. **💡 Use Cases** - [docs/USE_CASES.md](./USE_CASES.md)
   - Chatbots
   - RAG systems
   - Code generation
   - Content creation

5. **❓ Troubleshooting** - [docs/TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
   - Common issues & solutions

---

## Quick Tips

### ✅ DO's

```typescript
// ✅ Use environment variables for API keys
const provider = new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY
});

// ✅ Enable logging during development
const cache = new NeuroCache({ logging: true });

// ✅ Set appropriate TTL
const cache = new NeuroCache({ ttl: 3600 });  // 1 hour

// ✅ Monitor your hit rate
setInterval(() => {
  console.log('Hit rate:', cache.getCacheHitRate());
}, 60000);
```

### ❌ DON'Ts

```typescript
// ❌ Don't hardcode API keys
const provider = new OpenAIProvider({
  apiKey: 'sk-...'  // Security risk!
});

// ❌ Don't use MemoryStore in production
const cache = new NeuroCache({
  store: new MemoryStore()  // Data lost on restart!
});

// ❌ Don't set TTL too high for dynamic data
const cache = new NeuroCache({
  ttl: 86400 * 365  // 1 year - probably too long
});
```

---

## Need Help?

- 📖 **Documentation:** [Full Docs](../README.md)
- 💬 **Issues:** [GitHub Issues](https://github.com/eneswritescode/neurocache/issues)
- 🔒 **Security:** [Security Policy](../SECURITY.md)
- 📧 **Contact:** eneswrites@protonmail.com

---

**Ready to optimize your LLM costs?** Continue to [Configuration Guide](./CONFIGURATION.md) →
