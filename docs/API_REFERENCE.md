# API Reference

Complete API documentation for NeuroCache.

## Table of Contents

1. [NeuroCache Class](#neurocache-class)
2. [Providers](#providers)
3. [Stores](#stores)
4. [Types & Interfaces](#types--interfaces)
5. [Metrics API](#metrics-api)
6. [Utilities](#utilities)

---

## NeuroCache Class

### Constructor

```typescript
constructor(options: NeuroCacheOptions)
```

Creates a new NeuroCache instance.

**Parameters:**

```typescript
interface NeuroCacheOptions {
  provider: Provider;              // LLM provider (required)
  store?: Store;                   // Storage backend (default: MemoryStore(1000))
  ttl?: number;                    // Cache TTL in seconds (default: 3600)
  logging?: boolean;               // Enable logging (default: false)
  enableContextIntelligence?: boolean;  // Smart input optimization (default: true)
  metricsAdapter?: MetricsAdapter; // Custom metrics (default: InMemoryMetricsAdapter)
}
```

**Example:**

```typescript
import { NeuroCache, OpenAIProvider, RedisStore } from 'neurocache';

const cache = new NeuroCache({
  provider: new OpenAIProvider({
    apiKey: process.env.OPENAI_API_KEY!
  }),
  store: new RedisStore({ host: 'localhost', port: 6379 }),
  ttl: 3600,
  logging: true,
  enableContextIntelligence: true
});
```

---

### Methods

#### `generate()`

Generate a completion using the LLM provider (with caching).

```typescript
async generate(request: GenerateRequest): Promise<GenerateResponse>
```

**Parameters:**

```typescript
interface GenerateRequest {
  model: string;                           // Model name (e.g., 'gpt-3.5-turbo')
  messages: Array<{                        // Chat messages
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;                    // Sampling temperature (0-2)
  max_tokens?: number;                     // Max tokens to generate
  top_p?: number;                          // Nucleus sampling
  frequency_penalty?: number;              // Frequency penalty (-2 to 2)
  presence_penalty?: number;               // Presence penalty (-2 to 2)
  stop?: string | string[];                // Stop sequences
  [key: string]: any;                      // Additional provider-specific params
}
```

**Returns:**

```typescript
interface GenerateResponse {
  content: string;                         // Generated completion
  usage: {
    promptTokens: number;                  // Input tokens
    completionTokens: number;              // Output tokens
    totalTokens: number;                   // Total tokens
  };
}
```

**Example:**

```typescript
const response = await cache.generate({
  model: 'gpt-3.5-turbo',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'What is the capital of France?' }
  ],
  temperature: 0.7,
  max_tokens: 100
});

console.log(response.content);  // "The capital of France is Paris."
console.log(response.usage);    // { promptTokens: 23, completionTokens: 8, totalTokens: 31 }
```

**Throws:**
- `Error` - If provider fails
- `Error` - If store operation fails

---

#### `getMetrics()`

Get current cache metrics.

```typescript
getMetrics(): Metrics
```

**Returns:**

```typescript
interface Metrics {
  totalRequests: number;          // Total generate() calls
  cacheHits: number;              // Served from cache
  cacheMisses: number;            // Called provider
  tokensSaved: number;            // Tokens not sent to provider
  estimatedCostSaved: number;     // $ saved (based on gpt-3.5-turbo pricing)
  averageLatencySaved: number;    // Average ms saved per cache hit
  providerErrors: number;         // Provider failures
  storeErrors: number;            // Store failures
}
```

**Example:**

```typescript
const metrics = cache.getMetrics();

console.log({
  totalRequests: metrics.totalRequests,
  cacheHits: metrics.cacheHits,
  cacheMisses: metrics.cacheMisses,
  hitRate: (metrics.cacheHits / metrics.totalRequests * 100).toFixed(1) + '%',
  tokensSaved: metrics.tokensSaved,
  costSaved: '$' + metrics.estimatedCostSaved.toFixed(4)
});
```

---

#### `getMetricsSummary()`

Get formatted metrics summary.

```typescript
getMetricsSummary(): string
```

**Returns:** Formatted string with metrics overview.

**Example:**

```typescript
console.log(cache.getMetricsSummary());
```

**Output:**

```
NeuroCache Metrics Summary
==========================
Total Requests: 150
Cache Hits: 98 (65.33%)
Cache Misses: 52
Tokens Saved: 3,421
Cost Saved: $0.0684
Avg Latency Saved: 1,234ms
Provider Errors: 0
Store Errors: 0
```

---

#### `getCacheHitRate()`

Get cache hit rate as decimal.

```typescript
getCacheHitRate(): number
```

**Returns:** Hit rate between 0.0 and 1.0.

**Example:**

```typescript
const hitRate = cache.getCacheHitRate();
console.log(`Hit rate: ${(hitRate * 100).toFixed(1)}%`);  // "Hit rate: 65.3%"
```

---

#### `resetMetrics()`

Reset all metrics to zero.

```typescript
resetMetrics(): void
```

**Example:**

```typescript
cache.resetMetrics();
console.log(cache.getMetrics().totalRequests);  // 0
```

---

#### `clearCache()`

Clear all cached entries.

```typescript
async clearCache(): Promise<void>
```

**Example:**

```typescript
await cache.clearCache();
console.log('Cache cleared!');
```

---

## Providers

### OpenAIProvider

Provider for OpenAI API (GPT models).

```typescript
class OpenAIProvider implements Provider
```

**Constructor:**

```typescript
constructor(options: OpenAIProviderOptions)
```

**Options:**

```typescript
interface OpenAIProviderOptions {
  apiKey: string;                          // Required: OpenAI API key
  baseURL?: string;                        // Optional: Custom endpoint
  organization?: string;                   // Optional: OpenAI org ID
  defaultHeaders?: Record<string, string>; // Optional: HTTP headers
  timeout?: number;                        // Optional: Request timeout (ms, default: 60000)
  maxRetries?: number;                     // Optional: Retry attempts (default: 2)
}
```

**Example:**

```typescript
import { OpenAIProvider } from 'neurocache';

const provider = new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY!,
  timeout: 30000,
  maxRetries: 3
});
```

**Methods:**

```typescript
async generate(request: GenerateRequest): Promise<GenerateResponse>
```

---

### Custom Provider

Implement the `Provider` interface for custom LLM providers.

```typescript
interface Provider {
  generate(request: GenerateRequest): Promise<GenerateResponse>;
}
```

**Example - Anthropic Provider:**

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { Provider, GenerateRequest, GenerateResponse } from 'neurocache';

class AnthropicProvider implements Provider {
  private client: Anthropic;
  
  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }
  
  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const response = await this.client.messages.create({
      model: request.model || 'claude-3-sonnet-20240229',
      messages: request.messages.map(msg => ({
        role: msg.role === 'system' ? 'user' : msg.role,
        content: msg.content
      })),
      max_tokens: request.max_tokens || 1024,
      temperature: request.temperature
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

// Usage
const cache = new NeuroCache({
  provider: new AnthropicProvider(process.env.ANTHROPIC_API_KEY!)
});
```

---

## Stores

### MemoryStore

In-memory cache with LRU eviction.

```typescript
class MemoryStore implements Store
```

**Constructor:**

```typescript
constructor(maxEntries: number = 1000)
```

**Parameters:**
- `maxEntries` - Maximum cache entries (default: 1000)

**Example:**

```typescript
import { MemoryStore } from 'neurocache';

const store = new MemoryStore(5000);  // Max 5000 entries
```

**Methods:**

```typescript
async get(key: string): Promise<string | null>
async set(key: string, value: string, ttl: number): Promise<void>
async delete(key: string): Promise<void>
async clear(): Promise<void>
```

---

### FileStore

File-based persistent cache.

```typescript
class FileStore implements Store
```

**Constructor:**

```typescript
constructor(directory: string)
```

**Parameters:**
- `directory` - Path to cache directory (created if doesn't exist)

**Example:**

```typescript
import { FileStore } from 'neurocache';

const store = new FileStore('./cache/neurocache');
```

**Methods:**

```typescript
async get(key: string): Promise<string | null>
async set(key: string, value: string, ttl: number): Promise<void>
async delete(key: string): Promise<void>
async clear(): Promise<void>
```

---

### RedisStore

Redis-based distributed cache.

```typescript
class RedisStore implements Store
```

**Constructor:**

```typescript
constructor(options: RedisOptions)
```

**Options:**

```typescript
interface RedisOptions {
  host?: string;                   // Default: 'localhost'
  port?: number;                   // Default: 6379
  password?: string;               // Optional: Auth password
  db?: number;                     // Default: 0
  keyPrefix?: string;              // Default: 'neurocache:'
  tls?: tls.TlsOptions;            // Optional: TLS config
  username?: string;               // Optional: ACL username
}
```

**Example:**

```typescript
import { RedisStore } from 'neurocache';

const store = new RedisStore({
  host: 'localhost',
  port: 6379,
  password: process.env.REDIS_PASSWORD,
  keyPrefix: 'myapp:cache:'
});
```

**Methods:**

```typescript
async get(key: string): Promise<string | null>
async set(key: string, value: string, ttl: number): Promise<void>
async delete(key: string): Promise<void>
async clear(): Promise<void>
async disconnect(): Promise<void>  // Close Redis connection
```

---

### Custom Store

Implement the `Store` interface for custom storage backends.

```typescript
interface Store {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttl: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}
```

**Example - DynamoDB Store:**

```typescript
import { DynamoDBClient, GetItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { Store } from 'neurocache';

class DynamoDBStore implements Store {
  private client: DynamoDBClient;
  private tableName: string;
  
  constructor(tableName: string) {
    this.client = new DynamoDBClient({});
    this.tableName = tableName;
  }
  
  async get(key: string): Promise<string | null> {
    const response = await this.client.send(new GetItemCommand({
      TableName: this.tableName,
      Key: { key: { S: key } }
    }));
    
    if (!response.Item) return null;
    
    const expiresAt = parseInt(response.Item.expiresAt.N!);
    if (Date.now() > expiresAt) return null;
    
    return response.Item.value.S || null;
  }
  
  async set(key: string, value: string, ttl: number): Promise<void> {
    const expiresAt = Date.now() + (ttl * 1000);
    
    await this.client.send(new PutItemCommand({
      TableName: this.tableName,
      Item: {
        key: { S: key },
        value: { S: value },
        expiresAt: { N: expiresAt.toString() },
        ttl: { N: Math.floor(expiresAt / 1000).toString() }  // DynamoDB TTL
      }
    }));
  }
  
  async delete(key: string): Promise<void> {
    // Implementation...
  }
  
  async clear(): Promise<void> {
    // Implementation...
  }
}
```

---

## Types & Interfaces

### GenerateRequest

```typescript
interface GenerateRequest {
  model: string;                           // Model name
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;                    // 0-2
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  [key: string]: any;                      // Provider-specific params
}
```

---

### GenerateResponse

```typescript
interface GenerateResponse {
  content: string;                         // Generated text
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
```

---

### Metrics

```typescript
interface Metrics {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  tokensSaved: number;
  estimatedCostSaved: number;
  averageLatencySaved: number;
  providerErrors: number;
  storeErrors: number;
}
```

---

### Provider

```typescript
interface Provider {
  generate(request: GenerateRequest): Promise<GenerateResponse>;
}
```

---

### Store

```typescript
interface Store {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttl: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}
```

---

### MetricsAdapter

```typescript
interface MetricsAdapter {
  recordCacheHit(tokensSaved: number, latencySaved: number): void;
  recordCacheMiss(): void;
  recordProviderError(error: Error): void;
  recordStoreError(error: Error): void;
  getMetrics(): Metrics;
  reset(): void;
}
```

---

## Metrics API

### InMemoryMetricsAdapter

Default metrics implementation.

```typescript
class InMemoryMetricsAdapter implements MetricsAdapter
```

**Methods:**

```typescript
recordCacheHit(tokensSaved: number, latencySaved: number): void
recordCacheMiss(): void
recordProviderError(error: Error): void
recordStoreError(error: Error): void
getMetrics(): Metrics
reset(): void
```

**Example:**

```typescript
import { InMemoryMetricsAdapter } from 'neurocache';

const metrics = new InMemoryMetricsAdapter();

metrics.recordCacheHit(45, 1234);  // 45 tokens saved, 1234ms saved
metrics.recordCacheMiss();

console.log(metrics.getMetrics());
```

---

### Custom MetricsAdapter

**Example - Prometheus Integration:**

```typescript
import { MetricsAdapter, Metrics } from 'neurocache';
import { Counter, Histogram, register } from 'prom-client';

class PrometheusMetricsAdapter implements MetricsAdapter {
  private hitsCounter: Counter;
  private missesCounter: Counter;
  private tokensHistogram: Histogram;
  private latencyHistogram: Histogram;
  
  constructor() {
    this.hitsCounter = new Counter({
      name: 'neurocache_hits_total',
      help: 'Total cache hits',
      registers: [register]
    });
    
    this.missesCounter = new Counter({
      name: 'neurocache_misses_total',
      help: 'Total cache misses',
      registers: [register]
    });
    
    this.tokensHistogram = new Histogram({
      name: 'neurocache_tokens_saved',
      help: 'Tokens saved by cache hits',
      buckets: [10, 50, 100, 500, 1000, 5000],
      registers: [register]
    });
    
    this.latencyHistogram = new Histogram({
      name: 'neurocache_latency_saved_ms',
      help: 'Latency saved by cache hits (ms)',
      buckets: [10, 50, 100, 500, 1000, 2000, 5000],
      registers: [register]
    });
  }
  
  recordCacheHit(tokensSaved: number, latencySaved: number): void {
    this.hitsCounter.inc();
    this.tokensHistogram.observe(tokensSaved);
    this.latencyHistogram.observe(latencySaved);
  }
  
  recordCacheMiss(): void {
    this.missesCounter.inc();
  }
  
  recordProviderError(error: Error): void {
    // Log or send to error tracking
  }
  
  recordStoreError(error: Error): void {
    // Log or send to error tracking
  }
  
  getMetrics(): Metrics {
    // Return aggregated metrics
    const hits = this.hitsCounter['hashMap'][''];
    const misses = this.missesCounter['hashMap'][''];
    
    return {
      totalRequests: hits + misses,
      cacheHits: hits,
      cacheMisses: misses,
      tokensSaved: 0,  // Calculate from histogram
      estimatedCostSaved: 0,
      averageLatencySaved: 0,
      providerErrors: 0,
      storeErrors: 0
    };
  }
  
  reset(): void {
    this.hitsCounter.reset();
    this.missesCounter.reset();
    this.tokensHistogram.reset();
    this.latencyHistogram.reset();
  }
}

// Usage
const cache = new NeuroCache({
  // ...
  metricsAdapter: new PrometheusMetricsAdapter()
});

// Expose metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

---

## Utilities

### `createHash()`

Internal hash function (not exported, but documented for advanced users).

Creates deterministic hash from request parameters.

**Algorithm:**
1. Normalize input (if Context Intelligence enabled)
2. Stringify request to canonical JSON
3. Compute SHA-256 hash
4. Return hex digest

**Note:** This is an internal implementation detail. Do not rely on hash format.

---

## Error Handling

### Provider Errors

```typescript
try {
  const response = await cache.generate(request);
} catch (error) {
  if (error instanceof Error) {
    console.error('Provider error:', error.message);
    // Retry, fallback, or return error to user
  }
}
```

Recorded in `metrics.providerErrors`.

---

### Store Errors

```typescript
try {
  const response = await cache.generate(request);
} catch (error) {
  if (error instanceof Error && error.message.includes('Store')) {
    console.error('Store error:', error.message);
    // Cache failed, but request succeeded (provider was called)
  }
}
```

Recorded in `metrics.storeErrors`.

**Note:** Store errors are non-fatal. NeuroCache will continue calling the provider even if cache operations fail.

---

## TypeScript Support

NeuroCache is written in TypeScript with full type definitions.

**Import types:**

```typescript
import type {
  NeuroCache,
  NeuroCacheOptions,
  GenerateRequest,
  GenerateResponse,
  Provider,
  Store,
  MetricsAdapter,
  Metrics
} from 'neurocache';
```

**Type-safe custom provider:**

```typescript
import type { Provider, GenerateRequest, GenerateResponse } from 'neurocache';

class MyProvider implements Provider {
  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    // TypeScript will enforce correct return shape
    return {
      content: "...",
      usage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30
      }
    };
  }
}
```

---

## Next Steps

- **📖 Configuration:** [CONFIGURATION.md](./CONFIGURATION.md)
- **🎯 Best Practices:** [BEST_PRACTICES.md](./BEST_PRACTICES.md)
- **💡 Use Cases:** [USE_CASES.md](./USE_CASES.md)
- **❓ Troubleshooting:** [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

---

**Questions?** File an [issue](https://github.com/eneswritescode/neurocache/issues) or check [Troubleshooting](./TROUBLESHOOTING.md).
