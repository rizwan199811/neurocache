# Best Practices

Production-ready guidelines for deploying NeuroCache.

## Table of Contents

1. [Production Deployment](#production-deployment)
2. [Security](#security)
3. [Performance Optimization](#performance-optimization)
4. [Monitoring & Observability](#monitoring--observability)
5. [Cache Strategy](#cache-strategy)
6. [Error Handling](#error-handling)
7. [Testing](#testing)
8. [Common Pitfalls](#common-pitfalls)

---

## Production Deployment

### ✅ Checklist

**Before deploying to production:**

- [ ] Use **RedisStore** (not MemoryStore)
- [ ] Set appropriate **TTL** for your use case
- [ ] Configure **environment variables** (no hardcoded secrets)
- [ ] Disable **logging** (use metrics instead)
- [ ] Set up **monitoring** (metrics, alerts)
- [ ] Implement **error handling** (provider/store failures)
- [ ] Test **concurrent requests** behavior
- [ ] Configure **Redis persistence** (RDB/AOF)
- [ ] Set up **Redis backups** (if critical data)
- [ ] Review **security policy** ([SECURITY.md](../SECURITY.md))

---

### Production Configuration

**✅ Recommended:**

```typescript
import { NeuroCache, OpenAIProvider, RedisStore } from 'neurocache';

const cache = new NeuroCache({
  provider: new OpenAIProvider({
    apiKey: process.env.OPENAI_API_KEY!,
    timeout: 30000,        // 30s timeout
    maxRetries: 2          // Retry twice
  }),
  store: new RedisStore({
    host: process.env.REDIS_HOST!,
    port: parseInt(process.env.REDIS_PORT!),
    password: process.env.REDIS_PASSWORD,
    keyPrefix: `${process.env.APP_NAME}:cache:`,
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined
  }),
  ttl: parseInt(process.env.CACHE_TTL || '3600'),
  logging: false,          // Disable in production
  enableContextIntelligence: true
});
```

**❌ Avoid:**

```typescript
// ❌ Hardcoded secrets
const provider = new OpenAIProvider({
  apiKey: 'sk-...'  // Security risk!
});

// ❌ MemoryStore in production
const store = new MemoryStore();  // Lost on restart, not shared

// ❌ Logging enabled in production
const cache = new NeuroCache({
  logging: true  // Performance overhead, log spam
});

// ❌ No TTL or very long TTL
const cache = new NeuroCache({
  ttl: 0  // Cache forever (stale data risk)
});
```

---

### Environment Variables

Create `.env` file:

```bash
# Required
OPENAI_API_KEY=sk-...
REDIS_HOST=your-redis-host
REDIS_PORT=6379

# Optional
REDIS_PASSWORD=your-password
REDIS_TLS=true
REDIS_DB=0
APP_NAME=myapp
CACHE_TTL=3600
NODE_ENV=production
```

Load with `dotenv`:

```typescript
import 'dotenv/config';

const cache = new NeuroCache({
  provider: new OpenAIProvider({
    apiKey: process.env.OPENAI_API_KEY!
  }),
  store: new RedisStore({
    host: process.env.REDIS_HOST!,
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD
  })
});
```

**Never commit `.env` to version control!**

Add to `.gitignore`:
```bash
.env
.env.*
!.env.example
```

Create `.env.example` (safe to commit):
```bash
OPENAI_API_KEY=sk-your-key-here
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

---

## Security

### API Key Protection

**✅ DO:**

```typescript
// ✅ Environment variables
const apiKey = process.env.OPENAI_API_KEY!;

// ✅ Secret management (AWS Secrets Manager, Vault)
const apiKey = await getSecret('openai-api-key');

// ✅ Validate key exists
if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is required');
}
```

**❌ DON'T:**

```typescript
// ❌ Hardcoded keys
const apiKey = 'sk-...';

// ❌ Logged in code
console.log('API Key:', apiKey);

// ❌ Exposed in client-side code
const provider = new OpenAIProvider({ apiKey });  // In browser JS

// ❌ Committed to Git
```

---

### Redis Authentication

**✅ Secure Redis:**

```typescript
const store = new RedisStore({
  host: process.env.REDIS_HOST!,
  port: 6379,
  password: process.env.REDIS_PASSWORD,  // ← Required in production
  username: process.env.REDIS_USERNAME,  // ← ACL support
  tls: {                                 // ← Encrypt connection
    rejectUnauthorized: true
  }
});
```

**Redis Security Checklist:**

- [ ] Enable authentication (`requirepass`)
- [ ] Use TLS/SSL for connections
- [ ] Bind to private network only (not `0.0.0.0`)
- [ ] Use Redis ACLs (limit permissions)
- [ ] Regular security updates
- [ ] Firewall rules (restrict access)

---

### Input Validation

**Sanitize user input before caching:**

```typescript
function isValidRequest(request: GenerateRequest): boolean {
  // Check message count
  if (!request.messages || request.messages.length === 0) {
    return false;
  }
  
  // Check message size
  const totalLength = request.messages.reduce(
    (sum, msg) => sum + msg.content.length,
    0
  );
  if (totalLength > 100000) {  // 100KB limit
    return false;
  }
  
  // Check for malicious content
  for (const msg of request.messages) {
    if (containsMaliciousContent(msg.content)) {
      return false;
    }
  }
  
  return true;
}

// Usage
if (!isValidRequest(request)) {
  throw new Error('Invalid request');
}

const response = await cache.generate(request);
```

---

### Rate Limiting

**Protect against abuse:**

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                   // 100 requests per window
  message: 'Too many requests, please try again later.'
});

app.post('/api/chat', limiter, async (req, res) => {
  try {
    const response = await cache.generate(req.body);
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

---

## Performance Optimization

### 1. Choose the Right Store

**Development:**
```typescript
const store = new MemoryStore(1000);  // Fast, ephemeral
```

**Production (single server):**
```typescript
const store = new MemoryStore(10000);  // Fast, limited to one instance
```

**Production (multi-server):**
```typescript
const store = new RedisStore({...});  // Shared, scalable
```

---

### 2. Optimize TTL

**Too short** → Low hit rate, increased costs
**Too long** → Stale data, wasted storage

**Recommendation by use case:**

| Use Case | TTL | Reason |
|----------|-----|--------|
| Static FAQ | 86400 (24h) | Rarely changes |
| Product info | 3600 (1h) | Occasional updates |
| Weather data | 300 (5m) | Frequently changes |
| Real-time data | 60 (1m) or disable | Constantly changing |
| Code generation | 604800 (7d) | Deterministic output |

---

### 3. Connection Pooling (Redis)

**Use connection pooling for high traffic:**

```typescript
import { createClient } from 'redis';

const redisClient = createClient({
  socket: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT!)
  },
  password: process.env.REDIS_PASSWORD
});

await redisClient.connect();

// Share client across requests
const store = new RedisStore(redisClient as any);
```

---

### 4. Context Intelligence

**Optimize cache hit rate:**

```typescript
// ✅ Enabled (default) - Better hit rate
const cache = new NeuroCache({
  enableContextIntelligence: true  // Normalizes whitespace, removes duplicates
});

// Results in more cache hits:
// "What is 2+2?" === "What is  2+2?" === "  What is 2+2?  "
```

**When to disable:**

```typescript
// Exact matching needed (e.g., code generation)
const cache = new NeuroCache({
  enableContextIntelligence: false
});
```

---

### 5. Monitor Hit Rate

**Target: 40-60% hit rate**

Below 40% → Review TTL, context intelligence settings
Above 80% → Great! But verify data freshness

```typescript
setInterval(() => {
  const hitRate = cache.getCacheHitRate();
  
  if (hitRate < 0.4) {
    logger.warn('Low cache hit rate', { hitRate });
  }
  
  console.log(`Cache hit rate: ${(hitRate * 100).toFixed(1)}%`);
}, 60000);  // Every minute
```

---

## Monitoring & Observability

### 1. Metrics Dashboard

**Track key metrics:**

```typescript
import express from 'express';

const app = express();

app.get('/metrics', (req, res) => {
  const metrics = cache.getMetrics();
  
  res.json({
    totalRequests: metrics.totalRequests,
    cacheHits: metrics.cacheHits,
    cacheMisses: metrics.cacheMisses,
    hitRate: (metrics.cacheHits / metrics.totalRequests * 100).toFixed(1) + '%',
    tokensSaved: metrics.tokensSaved,
    costSaved: metrics.estimatedCostSaved.toFixed(4),
    avgLatencySaved: metrics.averageLatencySaved.toFixed(0) + 'ms',
    errors: {
      provider: metrics.providerErrors,
      store: metrics.storeErrors
    }
  });
});

app.listen(3000);
```

---

### 2. Health Checks

```typescript
app.get('/health', async (req, res) => {
  try {
    // Test cache operation
    const testKey = 'health-check';
    await cache.generate({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'ping' }]
    });
    
    const metrics = cache.getMetrics();
    const hasErrors = metrics.providerErrors > 0 || metrics.storeErrors > 0;
    
    res.status(hasErrors ? 503 : 200).json({
      status: hasErrors ? 'degraded' : 'healthy',
      cache: {
        hitRate: cache.getCacheHitRate(),
        errors: {
          provider: metrics.providerErrors,
          store: metrics.storeErrors
        }
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
```

---

### 3. Prometheus Integration

See [API Reference - Custom MetricsAdapter](./API_REFERENCE.md#custom-metricsadapter) for full example.

---

### 4. Logging

**Structured logging:**

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Log metrics periodically
setInterval(() => {
  const metrics = cache.getMetrics();
  logger.info('NeuroCache metrics', {
    hitRate: cache.getCacheHitRate(),
    totalRequests: metrics.totalRequests,
    tokensSaved: metrics.tokensSaved,
    costSaved: metrics.estimatedCostSaved
  });
}, 60000);
```

---

## Cache Strategy

### When to Cache

**✅ Good candidates:**
- Identical requests (FAQ, common queries)
- Expensive computations
- High-latency API calls
- Deterministic outputs (temperature=0)
- Static content

**❌ Poor candidates:**
- Real-time data (stock prices, weather)
- User-specific content (without proper key namespacing)
- Non-deterministic outputs (high temperature)
- Sensitive data (PII, secrets)

---

### Cache Invalidation

**Option 1: TTL-based (Recommended)**

```typescript
const cache = new NeuroCache({
  ttl: 3600  // Auto-expire after 1 hour
});
```

**Option 2: Manual invalidation**

```typescript
// Clear specific entry (requires custom implementation)
// NeuroCache doesn't expose per-key deletion yet

// Clear all cache
await cache.clearCache();
```

**Option 3: Event-based invalidation**

```typescript
// When data changes, clear cache
eventEmitter.on('product-updated', async () => {
  await cache.clearCache();  // Or implement selective clearing
});
```

---

### Cache Key Design

NeuroCache automatically creates keys from request parameters. To namespace by user:

```typescript
// Include user ID in system message (not recommended for privacy)
const response = await cache.generate({
  model: 'gpt-3.5-turbo',
  messages: [
    { role: 'system', content: `User ID: ${userId}` },  // Makes cache user-specific
    { role: 'user', content: userQuestion }
  ]
});

// Better: Use separate cache instance per user (if needed)
const userCaches = new Map<string, NeuroCache>();

function getCacheForUser(userId: string): NeuroCache {
  if (!userCaches.has(userId)) {
    userCaches.set(userId, new NeuroCache({
      provider,
      store: new RedisStore({
        ...redisConfig,
        keyPrefix: `user:${userId}:cache:`  // User-specific namespace
      })
    }));
  }
  return userCaches.get(userId)!;
}
```

---

## Error Handling

### Graceful Degradation

**Always handle provider errors:**

```typescript
try {
  const response = await cache.generate(request);
  return response;
} catch (error) {
  logger.error('Cache generation failed', { error, request });
  
  // Option 1: Return error to user
  throw new Error('Failed to generate response');
  
  // Option 2: Retry with exponential backoff
  return await retryWithBackoff(() => cache.generate(request));
  
  // Option 3: Fallback to default response
  return { content: 'Sorry, service temporarily unavailable.' };
}
```

---

### Retry Logic

```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      const delay = baseDelay * Math.pow(2, i);  // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries exceeded');
}

// Usage
const response = await retryWithBackoff(() =>
  cache.generate(request)
);
```

---

### Store Error Handling

**Store errors are non-fatal:**

```typescript
// If store.get() fails → Cache miss (calls provider)
// If store.set() fails → Response still returned (just not cached)

// Metrics will show store errors:
const metrics = cache.getMetrics();
if (metrics.storeErrors > 0) {
  logger.warn('Store errors detected', { count: metrics.storeErrors });
  // Alert ops team, check Redis health
}
```

---

## Testing

### Unit Tests

```typescript
import { NeuroCache, MemoryStore } from 'neurocache';

describe('NeuroCache', () => {
  let cache: NeuroCache;
  
  beforeEach(() => {
    cache = new NeuroCache({
      provider: new MockProvider(),
      store: new MemoryStore(),
      ttl: 60
    });
  });
  
  it('should cache identical requests', async () => {
    const request = {
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'test' }]
    };
    
    const response1 = await cache.generate(request);
    const response2 = await cache.generate(request);
    
    expect(response1).toEqual(response2);
    expect(cache.getCacheHitRate()).toBe(0.5);  // 1 hit, 1 miss
  });
});
```

---

### Integration Tests

```typescript
describe('NeuroCache Integration', () => {
  it('should work with real OpenAI API', async () => {
    const cache = new NeuroCache({
      provider: new OpenAIProvider({
        apiKey: process.env.OPENAI_API_KEY!
      }),
      store: new MemoryStore()
    });
    
    const response = await cache.generate({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Say "test"' }]
    });
    
    expect(response.content).toContain('test');
  });
});
```

---

## Common Pitfalls

### 1. Forgetting to Handle Errors

**❌ Bad:**

```typescript
const response = await cache.generate(request);  // Unhandled rejection
```

**✅ Good:**

```typescript
try {
  const response = await cache.generate(request);
} catch (error) {
  logger.error('Generation failed', { error });
  throw error;
}
```

---

### 2. Using MemoryStore in Production

**❌ Bad:**

```typescript
const cache = new NeuroCache({
  store: new MemoryStore()  // Lost on restart!
});
```

**✅ Good:**

```typescript
const cache = new NeuroCache({
  store: new RedisStore({...})  // Persistent, shared
});
```

---

### 3. Hardcoding API Keys

**❌ Bad:**

```typescript
const provider = new OpenAIProvider({
  apiKey: 'sk-...'  // Security risk!
});
```

**✅ Good:**

```typescript
const provider = new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY!
});
```

---

### 4. Ignoring Metrics

**❌ Bad:**

```typescript
// No monitoring → No visibility into performance
```

**✅ Good:**

```typescript
setInterval(() => {
  console.log(cache.getMetricsSummary());
}, 60000);
```

---

### 5. Setting TTL Too High

**❌ Bad:**

```typescript
const cache = new NeuroCache({
  ttl: 86400 * 365  // 1 year → Stale data risk
});
```

**✅ Good:**

```typescript
const cache = new NeuroCache({
  ttl: 3600  // 1 hour → Balance freshness and performance
});
```

---

### 6. No Redis Connection Management

**❌ Bad:**

```typescript
const store = new RedisStore({...});
// Never disconnect → Connection leak
```

**✅ Good:**

```typescript
const store = new RedisStore({...});

process.on('SIGTERM', async () => {
  await store.disconnect();
  process.exit(0);
});
```

---

### 7. Not Testing Cache Behavior

**❌ Bad:**

```typescript
// Deploying without testing cache hit/miss behavior
```

**✅ Good:**

```typescript
// Test with real requests
const request = {...};

const t1 = Date.now();
await cache.generate(request);
console.log('First request:', Date.now() - t1, 'ms');  // ~2000ms

const t2 = Date.now();
await cache.generate(request);
console.log('Second request:', Date.now() - t2, 'ms');  // ~5ms

console.log('Hit rate:', cache.getCacheHitRate());  // 0.5
```

---

## Quick Reference

### Production Checklist

```typescript
// ✅ Complete production setup
import 'dotenv/config';
import { NeuroCache, OpenAIProvider, RedisStore } from 'neurocache';
import winston from 'winston';

const logger = winston.createLogger({...});

const cache = new NeuroCache({
  provider: new OpenAIProvider({
    apiKey: process.env.OPENAI_API_KEY!,
    timeout: 30000,
    maxRetries: 2
  }),
  store: new RedisStore({
    host: process.env.REDIS_HOST!,
    port: parseInt(process.env.REDIS_PORT!),
    password: process.env.REDIS_PASSWORD,
    keyPrefix: `${process.env.APP_NAME}:cache:`,
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined
  }),
  ttl: parseInt(process.env.CACHE_TTL || '3600'),
  logging: false,
  enableContextIntelligence: true
});

// Metrics monitoring
setInterval(() => {
  const summary = cache.getMetricsSummary();
  logger.info('NeuroCache metrics', { summary });
}, 60000);

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Shutting down...');
  await cache.clearCache();  // Optional
  process.exit(0);
});

// Health check
app.get('/health', (req, res) => {
  const metrics = cache.getMetrics();
  res.json({
    status: 'ok',
    hitRate: cache.getCacheHitRate(),
    errors: metrics.providerErrors + metrics.storeErrors
  });
});

// Error handling
app.post('/api/generate', async (req, res) => {
  try {
    const response = await cache.generate(req.body);
    res.json(response);
  } catch (error) {
    logger.error('Generation failed', { error, request: req.body });
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

---

**Ready for production!** See [Use Cases](./USE_CASES.md) for real-world examples.
