# Configuration Guide

Complete reference for all NeuroCache configuration options.

## Table of Contents

1. [NeuroCache Options](#neurocache-options)
2. [Provider Configuration](#provider-configuration)
3. [Store Configuration](#store-configuration)
4. [Context Intelligence](#context-intelligence)
5. [Metrics & Monitoring](#metrics--monitoring)
6. [Performance Tuning](#performance-tuning)

---

## NeuroCache Options

### Constructor

```typescript
const cache = new NeuroCache(options);
```

### All Options

```typescript
interface NeuroCacheOptions {
  provider: Provider;              // Required: LLM provider
  store?: Store;                   // Optional: Storage backend (default: MemoryStore)
  ttl?: number;                    // Optional: Cache TTL in seconds (default: 3600)
  logging?: boolean;               // Optional: Enable logging (default: false)
  enableContextIntelligence?: boolean;  // Optional: Smart deduplication (default: true)
  metricsAdapter?: MetricsAdapter; // Optional: Custom metrics (default: InMemoryMetricsAdapter)
}
```

---

### `provider` (Required)

The LLM provider to use when cache misses occur.

**OpenAI Provider:**

```typescript
import { OpenAIProvider } from 'neurocache';

const provider = new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY,  // Required
  baseURL?: string,                    // Optional: Custom endpoint
  organization?: string,               // Optional: OpenAI org ID
  defaultHeaders?: Record<string, string>, // Optional: Custom headers
  timeout?: number,                    // Optional: Request timeout (ms)
  maxRetries?: number                  // Optional: Retry attempts (default: 2)
});
```

**Example - Custom OpenAI Endpoint:**

```typescript
const provider = new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'https://api.openai.com/v1',  // Custom endpoint
  timeout: 30000,                         // 30 second timeout
  maxRetries: 3                           // Retry 3 times
});
```

**Custom Provider (Advanced):**

```typescript
import { Provider, GenerateRequest, GenerateResponse } from 'neurocache';

class AnthropicProvider implements Provider {
  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    // Your implementation
    const response = await anthropic.messages.create({
      model: request.model,
      messages: request.messages,
      max_tokens: request.max_tokens
    });
    
    return {
      content: response.content[0].text,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens
      }
    };
  }
}

const cache = new NeuroCache({
  provider: new AnthropicProvider()
});
```

---

### `store` (Optional)

Storage backend for cached responses.

**Default:** `MemoryStore(1000)` (in-memory, LRU eviction)

**Options:**
- `MemoryStore` - In-memory (development)
- `FileStore` - File-based (single server)
- `RedisStore` - Redis-based (production)

See [Store Configuration](#store-configuration) for details.

---

### `ttl` (Optional)

Time-to-live for cached entries in **seconds**.

**Default:** `3600` (1 hour)

```typescript
// Cache for 10 minutes
const cache = new NeuroCache({
  // ...
  ttl: 600
});

// Cache for 24 hours
const cache = new NeuroCache({
  // ...
  ttl: 86400
});

// No expiration (cache forever)
const cache = new NeuroCache({
  // ...
  ttl: 0
});
```

**Recommendations:**

| Use Case | Recommended TTL |
|----------|----------------|
| Static FAQ/Documentation | `86400` (24 hours) |
| Product Info | `3600` (1 hour) |
| Dynamic Content | `300` (5 minutes) |
| Real-time Data | `60` (1 minute) or disable caching |
| Development/Testing | `60` (1 minute) |

---

### `logging` (Optional)

Enable detailed logging to console.

**Default:** `false`

```typescript
const cache = new NeuroCache({
  // ...
  logging: true  // Logs all cache hits/misses
});
```

**Example Output:**

```
[NeuroCache] Cache MISS - Calling provider (model: gpt-3.5-turbo)
[NeuroCache] Cache HIT - Serving from cache (saved 1234ms, 45 tokens)
```

**Best Practices:**
- ✅ Enable in development: `logging: process.env.NODE_ENV === 'development'`
- ❌ Disable in production (use metrics instead)

---

### `enableContextIntelligence` (Optional)

Enable smart input optimization before hashing.

**Default:** `true`

**What it does:**
1. **Whitespace normalization** - Trim and collapse whitespace
2. **Duplicate message removal** - Remove consecutive identical messages
3. **History trimming** - Keep only recent context (configurable)

```typescript
// Enabled (default) - Smart matching
const cache = new NeuroCache({
  // ...
  enableContextIntelligence: true  // "What is  2+2?" === "What is 2+2?"
});

// Disabled - Exact matching only
const cache = new NeuroCache({
  // ...
  enableContextIntelligence: false  // "What is  2+2?" !== "What is 2+2?"
});
```

**Impact:**

```typescript
// With Context Intelligence (default):
await cache.generate({
  model: 'gpt-3.5-turbo',
  messages: [
    { role: 'user', content: 'Hello' },
    { role: 'assistant', content: 'Hi!' },
    { role: 'user', content: 'Hello' },      // ← Duplicate, removed
    { role: 'assistant', content: 'Hi!' },   // ← Duplicate, removed
    { role: 'user', content: 'What is  2+2?' }  // ← Whitespace normalized
  ]
});
// Effective cache key uses optimized input (3 messages instead of 5)

// Without Context Intelligence:
// All 5 messages included in cache key exactly as provided
```

**When to disable:**
- You need exact input matching (e.g., code generation)
- Your app already normalizes input
- Testing/debugging

---

### `metricsAdapter` (Optional)

Custom metrics collection adapter.

**Default:** `InMemoryMetricsAdapter`

**Built-in Adapter:**

```typescript
import { InMemoryMetricsAdapter } from 'neurocache';

const cache = new NeuroCache({
  // ...
  metricsAdapter: new InMemoryMetricsAdapter()  // Default
});
```

**Custom Adapter:**

```typescript
import { MetricsAdapter } from 'neurocache';

class PrometheusAdapter implements MetricsAdapter {
  recordCacheHit(tokensSaved: number, latencySaved: number) {
    prometheusClient.increment('neurocache_hits', 1);
    prometheusClient.histogram('neurocache_tokens_saved', tokensSaved);
    prometheusClient.histogram('neurocache_latency_saved', latencySaved);
  }
  
  recordCacheMiss() {
    prometheusClient.increment('neurocache_misses', 1);
  }
  
  recordProviderError(error: Error) {
    prometheusClient.increment('neurocache_provider_errors', 1);
    logger.error('Provider error', { error });
  }
  
  recordStoreError(error: Error) {
    prometheusClient.increment('neurocache_store_errors', 1);
    logger.error('Store error', { error });
  }
  
  getMetrics() {
    // Return aggregated metrics
    return {
      totalRequests: prometheusClient.get('neurocache_hits') + prometheusClient.get('neurocache_misses'),
      cacheHits: prometheusClient.get('neurocache_hits'),
      cacheMisses: prometheusClient.get('neurocache_misses'),
      // ...
    };
  }
  
  reset() {
    prometheusClient.reset();
  }
}

const cache = new NeuroCache({
  // ...
  metricsAdapter: new PrometheusAdapter()
});
```

---

## Provider Configuration

### OpenAI Provider

```typescript
import { OpenAIProvider } from 'neurocache';

const provider = new OpenAIProvider({
  apiKey: string,              // Required: OpenAI API key
  baseURL?: string,            // Optional: Custom API endpoint
  organization?: string,       // Optional: OpenAI organization ID
  defaultHeaders?: Record<string, string>, // Optional: HTTP headers
  timeout?: number,            // Optional: Request timeout (ms, default: 60000)
  maxRetries?: number          // Optional: Retry attempts (default: 2)
});
```

**Example - Azure OpenAI:**

```typescript
const provider = new OpenAIProvider({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  baseURL: 'https://your-resource.openai.azure.com/openai/deployments/your-deployment',
  defaultHeaders: {
    'api-version': '2023-05-15'
  }
});
```

---

## Store Configuration

### MemoryStore

In-memory cache with LRU eviction.

```typescript
import { MemoryStore } from 'neurocache';

const store = new MemoryStore(maxEntries?: number);
```

**Parameters:**
- `maxEntries` (Optional) - Maximum cache entries (default: `1000`)
- Eviction: LRU (Least Recently Used)

**Example:**

```typescript
const store = new MemoryStore(5000);  // Max 5000 entries

const cache = new NeuroCache({
  // ...
  store
});
```

**Pros:**
- ✅ Fastest (no I/O)
- ✅ Zero setup
- ✅ Automatic eviction

**Cons:**
- ❌ Data lost on restart
- ❌ Not shared across processes
- ❌ Memory limited

**Best for:** Development, testing, single-instance apps

---

### FileStore

File-based persistent cache.

```typescript
import { FileStore } from 'neurocache';

const store = new FileStore(directory: string);
```

**Parameters:**
- `directory` (Required) - Path to cache directory (created if doesn't exist)

**Example:**

```typescript
const store = new FileStore('./cache/neurocache');

const cache = new NeuroCache({
  // ...
  store
});
```

**File Structure:**

```
cache/neurocache/
├── a1b2c3d4e5f6.json
├── f6e5d4c3b2a1.json
└── ...
```

Each file contains:
```json
{
  "value": "{\"content\":\"Paris\",\"usage\":{...}}",
  "expiresAt": 1735689600000
}
```

**Pros:**
- ✅ Survives restarts
- ✅ Simple setup
- ✅ No external dependencies

**Cons:**
- ❌ Slower than memory (disk I/O)
- ❌ Not shared across servers
- ❌ Manual cleanup needed (TTL respected but files remain)

**Best for:** Single-server deployments, persistence needed

---

### RedisStore

Redis-based distributed cache.

```typescript
import { RedisStore } from 'neurocache';

const store = new RedisStore(options: RedisOptions);
```

**Parameters:**

```typescript
interface RedisOptions {
  host?: string;        // Default: 'localhost'
  port?: number;        // Default: 6379
  password?: string;    // Optional: Auth password
  db?: number;          // Default: 0
  keyPrefix?: string;   // Default: 'neurocache:'
  tls?: tls.TlsOptions; // Optional: TLS config
  username?: string;    // Optional: ACL username
}
```

**Example - Local Redis:**

```typescript
const store = new RedisStore({
  host: 'localhost',
  port: 6379
});
```

**Example - Redis Cloud:**

```typescript
const store = new RedisStore({
  host: 'redis-12345.c123.us-east-1.ec2.cloud.redislabs.com',
  port: 12345,
  password: process.env.REDIS_PASSWORD,
  tls: {}  // Enable TLS
});
```

**Example - AWS ElastiCache:**

```typescript
const store = new RedisStore({
  host: 'your-cluster.cache.amazonaws.com',
  port: 6379,
  keyPrefix: 'prod:neurocache:'
});
```

**Key Structure:**

```
neurocache:a1b2c3d4e5f6  → {"content":"Paris","usage":{...}}
```

**Pros:**
- ✅ Shared across instances
- ✅ Fast (in-memory)
- ✅ Automatic TTL expiration
- ✅ Battle-tested

**Cons:**
- ❌ Requires Redis server
- ❌ Network latency
- ❌ Additional infrastructure cost

**Best for:** Production, distributed systems, high traffic

---

## Context Intelligence

Advanced input optimization configuration.

### Default Behavior

When `enableContextIntelligence: true` (default):

1. **Whitespace Normalization**
   - Trim leading/trailing whitespace
   - Collapse multiple spaces to single space
   
2. **Duplicate Message Removal**
   - Remove consecutive identical messages
   
3. **History Trimming**
   - Keep only recent messages (default: all)

### Advanced Configuration

Currently, Context Intelligence is enabled/disabled globally. Fine-grained control coming soon.

**Future Configuration (Roadmap):**

```typescript
const cache = new NeuroCache({
  // ...
  contextIntelligence: {
    enabled: true,
    whitespaceNormalization: true,    // Normalize whitespace
    deduplication: true,               // Remove duplicate messages
    historyLimit: 10,                  // Keep last 10 messages only
    semanticSimilarity: false          // Semantic chunking (experimental)
  }
});
```

---

## Metrics & Monitoring

### Available Metrics

```typescript
interface Metrics {
  totalRequests: number;          // Total generate() calls
  cacheHits: number;              // Served from cache
  cacheMisses: number;            // Called provider
  tokensSaved: number;            // Tokens not sent to provider
  estimatedCostSaved: number;     // $ saved (based on gpt-3.5-turbo pricing)
  averageLatencySaved: number;    // Average ms saved per hit
  providerErrors: number;         // Provider failures
  storeErrors: number;            // Store failures
}
```

### Access Metrics

```typescript
// Get current metrics
const metrics = cache.getMetrics();

// Get formatted summary
const summary = cache.getMetricsSummary();

// Get cache hit rate
const hitRate = cache.getCacheHitRate();  // 0.0 - 1.0

// Reset metrics
cache.resetMetrics();
```

### Monitoring Strategies

**1. Periodic Logging:**

```typescript
setInterval(() => {
  const metrics = cache.getMetrics();
  logger.info('NeuroCache Stats', {
    hitRate: (metrics.cacheHits / metrics.totalRequests * 100).toFixed(1) + '%',
    tokensSaved: metrics.tokensSaved,
    costSaved: '$' + metrics.estimatedCostSaved.toFixed(4)
  });
}, 60000);  // Every minute
```

**2. Custom Metrics Adapter:**

See [`metricsAdapter`](#metricsadapter-optional) above.

**3. Health Checks:**

```typescript
app.get('/health', (req, res) => {
  const metrics = cache.getMetrics();
  res.json({
    status: 'ok',
    cache: {
      hitRate: cache.getCacheHitRate(),
      totalRequests: metrics.totalRequests,
      errors: metrics.providerErrors + metrics.storeErrors
    }
  });
});
```

---

## Performance Tuning

### 1. Choose the Right Store

| Scenario | Recommended Store | Config |
|----------|------------------|--------|
| Development | MemoryStore | `new MemoryStore(100)` |
| Single server (low traffic) | FileStore | `new FileStore('./cache')` |
| Single server (high traffic) | MemoryStore | `new MemoryStore(10000)` |
| Multi-server | RedisStore | `new RedisStore({...})` |
| Serverless | External cache (Redis/DynamoDB) | Custom adapter |

---

### 2. Optimize TTL

**Too short:** Low hit rate, increased costs
**Too long:** Stale data, wasted storage

```typescript
// Dynamic TTL based on request
await cache.generate(request);  // Uses global TTL

// Override TTL per request (future feature - roadmap)
// await cache.generate(request, { ttl: 300 });
```

**Current workaround for per-request TTL:**

```typescript
class DynamicTTLCache extends NeuroCache {
  async generate(request: GenerateRequest, options?: { ttl?: number }) {
    // Implementation with custom TTL logic
  }
}
```

---

### 3. MemoryStore Size

```typescript
// Too small → Frequent evictions → Lower hit rate
const store = new MemoryStore(100);

// Too large → High memory usage → OOM risk
const store = new MemoryStore(1000000);

// Just right - based on your traffic and RAM
const store = new MemoryStore(10000);  // ~10-50MB depending on response size
```

**Estimation:**
- Average response: ~500 bytes
- 1000 entries ≈ 500KB
- 10,000 entries ≈ 5MB
- 100,000 entries ≈ 50MB

---

### 4. Context Intelligence

```typescript
// More cache hits (recommended for most apps)
const cache = new NeuroCache({
  // ...
  enableContextIntelligence: true
});

// Exact matching (better for code generation)
const cache = new NeuroCache({
  // ...
  enableContextIntelligence: false
});
```

---

### 5. Concurrent Requests

NeuroCache handles concurrent identical requests automatically:

```typescript
// 100 users ask "What is 2+2?" simultaneously
const promises = Array(100).fill(null).map(() =>
  cache.generate({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: 'What is 2+2?' }]
  })
);

// Only 1 API call made, 99 wait for result
const responses = await Promise.all(promises);

// All get the same cached response
```

No configuration needed - automatic!

---

## Environment Variables

Recommended `.env` structure:

```bash
# LLM Provider
OPENAI_API_KEY=sk-...

# Redis (Production)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-password

# NeuroCache
NEUROCACHE_TTL=3600
NEUROCACHE_LOGGING=false
NEUROCACHE_STORE_TYPE=redis  # memory | file | redis
NEUROCACHE_FILE_PATH=./cache/neurocache

# Environment
NODE_ENV=production
```

**Usage:**

```typescript
import { NeuroCache, OpenAIProvider, RedisStore, FileStore, MemoryStore } from 'neurocache';

function createStore() {
  switch (process.env.NEUROCACHE_STORE_TYPE) {
    case 'redis':
      return new RedisStore({
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD
      });
    case 'file':
      return new FileStore(process.env.NEUROCACHE_FILE_PATH || './cache');
    default:
      return new MemoryStore(1000);
  }
}

const cache = new NeuroCache({
  provider: new OpenAIProvider({
    apiKey: process.env.OPENAI_API_KEY!
  }),
  store: createStore(),
  ttl: parseInt(process.env.NEUROCACHE_TTL || '3600'),
  logging: process.env.NEUROCACHE_LOGGING === 'true'
});
```

---

## Next Steps

- **📖 Best Practices:** [BEST_PRACTICES.md](./BEST_PRACTICES.md)
- **🔧 API Reference:** [API_REFERENCE.md](./API_REFERENCE.md)
- **💡 Use Cases:** [USE_CASES.md](./USE_CASES.md)
- **❓ Troubleshooting:** [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

---

Need help? Check [Troubleshooting](./TROUBLESHOOTING.md) or file an [issue](https://github.com/eneswritescode/neurocache/issues).
