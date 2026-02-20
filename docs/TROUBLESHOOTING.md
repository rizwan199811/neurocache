# Troubleshooting Guide

Common issues and solutions for NeuroCache.

## Table of Contents

1. [Installation Issues](#installation-issues)
2. [Cache Not Working](#cache-not-working)
3. [Low Cache Hit Rate](#low-cache-hit-rate)
4. [Performance Issues](#performance-issues)
5. [Redis Connection Problems](#redis-connection-problems)
6. [Provider Errors](#provider-errors)
7. [Memory Issues](#memory-issues)
8. [TypeScript Errors](#typescript-errors)
9. [Debugging Tips](#debugging-tips)

---

## Installation Issues

### Problem: `Cannot find module 'neurocache'`

**Symptoms:**
```bash
Error: Cannot find module 'neurocache'
```

**Solution:**

```bash
# Install NeuroCache
npm install neurocache

# Verify installation
npm list neurocache
```

**Still not working?**

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

---

### Problem: `Peer dependency warnings`

**Symptoms:**
```bash
npm WARN neurocache@1.0.0 requires a peer of redis@^4.0.0 but none is installed
```

**Solution:**

```bash
# If using RedisStore
npm install redis

# If using OpenAI provider
npm install openai

# Both
npm install redis openai
```

**Note:** These are optional peer dependencies. Only install what you need:
- `redis` - Only if using `RedisStore`
- `openai` - Only if using `OpenAIProvider`

---

## Cache Not Working

### Problem: Always calling provider (0% hit rate)

**Symptoms:**
- Every request takes ~2 seconds
- `cache.getCacheHitRate()` returns `0`
- Metrics show 0 cache hits

**Diagnosis:**

```typescript
// Enable logging
const cache = new NeuroCache({
  // ...
  logging: true  // See what's happening
});

// Make two identical requests
await cache.generate(request);
await cache.generate(request);

// Check metrics
console.log(cache.getMetrics());
```

**Common Causes:**

#### 1. Non-deterministic parameters

**Problem:**
```typescript
// ❌ Different timestamp each time
const response = await cache.generate({
  model: 'gpt-3.5-turbo',
  messages: [
    { role: 'user', content: `What is 2+2? (${Date.now()})` }  // ← Changes!
  ]
});
```

**Solution:**
```typescript
// ✅ Remove dynamic elements
const response = await cache.generate({
  model: 'gpt-3.5-turbo',
  messages: [
    { role: 'user', content: 'What is 2+2?' }  // ← Static
  ]
});
```

---

#### 2. High temperature

**Problem:**
```typescript
// Even identical requests have different hashes due to temperature
const response = await cache.generate({
  model: 'gpt-3.5-turbo',
  messages: [{ role: 'user', content: 'Hello' }],
  temperature: 1.5  // ← Cache key includes this
});
```

**Solution:**
```typescript
// Use consistent temperature
const response = await cache.generate({
  model: 'gpt-3.5-turbo',
  messages: [{ role: 'user', content: 'Hello' }],
  temperature: 0  // ← Deterministic
});
```

**Note:** Temperature is part of cache key. Requests with different temperatures won't match.

---

#### 3. Store not working

**Check store:**

```typescript
// Test store directly
const store = cache['store'];  // Access private property for debugging

await store.set('test-key', 'test-value', 60);
const value = await store.get('test-key');

if (value === null) {
  console.error('Store is not working!');
}
```

**Solution:** See [Redis Connection Problems](#redis-connection-problems) or [Performance Issues](#performance-issues).

---

#### 4. TTL too short

**Problem:**
```typescript
const cache = new NeuroCache({
  // ...
  ttl: 1  // 1 second - expires immediately!
});

await cache.generate(request);
await sleep(2000);  // Wait 2 seconds
await cache.generate(request);  // Cache miss (expired)
```

**Solution:**
```typescript
const cache = new NeuroCache({
  // ...
  ttl: 3600  // 1 hour
});
```

---

### Problem: Cache hits but returns different responses

**This should not happen!** NeuroCache returns exact cached responses.

**Diagnosis:**

```typescript
const response1 = await cache.generate(request);
const response2 = await cache.generate(request);

console.log('Same?', response1.content === response2.content);  // Should be true
```

**If false:**
- Check if you're modifying responses after receiving them
- Verify store is working correctly
- File a [bug report](https://github.com/eneswritescode/neurocache/issues)

---

## Low Cache Hit Rate

### Target: 40-60% hit rate

Below 40% → Investigate why

**Diagnosis:**

```typescript
// Check metrics
const metrics = cache.getMetrics();
console.log({
  hitRate: (metrics.cacheHits / metrics.totalRequests * 100).toFixed(1) + '%',
  totalRequests: metrics.totalRequests,
  cacheHits: metrics.cacheHits,
  cacheMisses: metrics.cacheMisses
});
```

**Common Causes:**

#### 1. Unique requests

**Problem:** Every request is different.

```typescript
// Each user asks different questions
await cache.generate({
  messages: [{ role: 'user', content: 'Tell me about penguins' }]
});
await cache.generate({
  messages: [{ role: 'user', content: 'What is quantum physics?' }]
});
await cache.generate({
  messages: [{ role: 'user', content: 'How to bake cookies?' }]
});
```

**Solution:** This is expected for unique content. Low hit rate is normal.

---

#### 2. Whitespace variations

**Problem:**

```typescript
// These are different without Context Intelligence
"What is 2+2?"
"What  is  2+2?"   // Extra spaces
"  What is 2+2?  " // Leading/trailing spaces
```

**Solution:**

```typescript
const cache = new NeuroCache({
  // ...
  enableContextIntelligence: true  // Default - normalizes whitespace
});
```

---

#### 3. Similar but not identical requests

**Problem:**

```typescript
await cache.generate({ messages: [{ role: 'user', content: 'What is 2+2?' }] });
await cache.generate({ messages: [{ role: 'user', content: 'What is 2 + 2?' }] });  // Space around +
await cache.generate({ messages: [{ role: 'user', content: 'Calculate 2+2' }] });   // Different wording
```

**Solution:** These are genuinely different requests. Consider:
1. Normalizing input on your side
2. Using semantic similarity (future feature)
3. Accepting lower hit rate for varied input

---

## Performance Issues

### Problem: Cache slower than expected

**Expected:**
- Cold request (miss): ~1,500-2,000ms (OpenAI API latency)
- Cached request (hit): ~5-15ms (MemoryStore) or ~10-30ms (RedisStore)

**Symptoms:**
- Cached requests taking >100ms
- High latency even with high hit rate

**Diagnosis:**

```typescript
const t1 = Date.now();
await cache.generate(request);
console.log('First request:', Date.now() - t1, 'ms');

const t2 = Date.now();
await cache.generate(request);
console.log('Second request:', Date.now() - t2, 'ms');  // Should be <30ms
```

**Common Causes:**

#### 1. Slow store

**Problem:** FileStore or RedisStore is slow.

```typescript
// Benchmark store
const store = cache['store'];

const t1 = Date.now();
await store.get('test-key');
console.log('Store get:', Date.now() - t1, 'ms');  // Should be <5ms
```

**Solution:**

```typescript
// Use MemoryStore for best performance
const cache = new NeuroCache({
  // ...
  store: new MemoryStore(10000)
});
```

---

#### 2. Redis network latency

**Problem:** Redis is on remote server.

**Solution:**

```typescript
// Deploy Redis closer to app server
// Or use MemoryStore if single-instance app
```

---

#### 3. Large responses

**Problem:** Serialization/deserialization overhead.

```typescript
// 10KB response takes longer than 100 byte response
```

**Solution:** This is expected. Still much faster than calling provider.

---

### Problem: High memory usage

**Symptoms:**
- App using 500MB+ RAM
- Out of memory errors
- Slow garbage collection

**Diagnosis:**

```typescript
// Check MemoryStore size
const store = cache['store'] as MemoryStore;
console.log('Cache entries:', store['cache'].size);  // Access private property
```

**Solution:**

```typescript
// Reduce max entries
const cache = new NeuroCache({
  // ...
  store: new MemoryStore(1000)  // Limit to 1000 entries
});

// Or use RedisStore (offload memory to Redis)
const cache = new NeuroCache({
  // ...
  store: new RedisStore({...})
});
```

---

## Redis Connection Problems

### Problem: `Error: Redis connection failed`

**Symptoms:**
```bash
Error: getaddrinfo ENOTFOUND localhost
Error: ECONNREFUSED 127.0.0.1:6379
```

**Solution:**

#### 1. Verify Redis is running

```bash
# Check if Redis is running
redis-cli ping
# Should return: PONG

# If not installed
# macOS
brew install redis
brew services start redis

# Ubuntu
sudo apt install redis-server
sudo systemctl start redis

# Windows
# Download from https://github.com/microsoftarchive/redis/releases

# Docker
docker run -d -p 6379:6379 redis:7-alpine
```

---

#### 2. Check connection config

```typescript
// Verify host/port
const store = new RedisStore({
  host: 'localhost',  // ← Correct hostname?
  port: 6379          // ← Correct port?
});

// Test connection
await store.set('ping', 'pong', 60);
const value = await store.get('ping');
console.log(value);  // Should be 'pong'
```

---

#### 3. Authentication issues

**Problem:**
```bash
Error: NOAUTH Authentication required
```

**Solution:**

```typescript
const store = new RedisStore({
  host: 'localhost',
  port: 6379,
  password: process.env.REDIS_PASSWORD  // ← Add password
});
```

---

#### 4. TLS issues

**Problem:**
```bash
Error: unable to verify the first certificate
```

**Solution:**

```typescript
const store = new RedisStore({
  host: 'your-redis-cloud.com',
  port: 6380,
  password: 'your-password',
  tls: {
    rejectUnauthorized: false  // ← For self-signed certs (dev only!)
  }
});
```

**Production:**

```typescript
const store = new RedisStore({
  host: 'your-redis-cloud.com',
  port: 6380,
  password: 'your-password',
  tls: {}  // ← Use proper CA-signed certificate
});
```

---

### Problem: Intermittent Redis disconnects

**Symptoms:**
- Works for a while, then errors
- `Error: Connection closed`

**Solution:**

```typescript
// Implement reconnection logic
const redisClient = createClient({...});

redisClient.on('error', (err) => {
  console.error('Redis error:', err);
});

redisClient.on('reconnecting', () => {
  console.log('Redis reconnecting...');
});

redisClient.on('ready', () => {
  console.log('Redis connected!');
});

await redisClient.connect();
```

---

## Provider Errors

### Problem: `Error: Invalid API key`

**Symptoms:**
```bash
Error: Incorrect API key provided
OpenAI API error: 401 Unauthorized
```

**Solution:**

```typescript
// Verify API key is set
if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY not set');
}

// Check key is valid (starts with 'sk-')
if (!process.env.OPENAI_API_KEY.startsWith('sk-')) {
  throw new Error('Invalid OPENAI_API_KEY format');
}

const provider = new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY
});
```

**Get API key:** https://platform.openai.com/api-keys

---

### Problem: Rate limit errors

**Symptoms:**
```bash
Error: Rate limit exceeded
OpenAI API error: 429 Too Many Requests
```

**Solution:**

```typescript
// Implement retry with exponential backoff
const provider = new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY!,
  maxRetries: 3  // Retry up to 3 times
});
```

**Or:**

```typescript
// Upgrade OpenAI plan
// Or reduce request frequency
```

---

### Problem: Timeout errors

**Symptoms:**
```bash
Error: Request timed out
```

**Solution:**

```typescript
const provider = new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY!,
  timeout: 60000  // 60 seconds (default is 60000)
});
```

---

## Memory Issues

### Problem: Memory leak

**Symptoms:**
- Memory usage grows over time
- Never releases memory
- Eventually crashes

**Diagnosis:**

```typescript
// Monitor memory usage
setInterval(() => {
  const usage = process.memoryUsage();
  console.log({
    rss: Math.round(usage.rss / 1024 / 1024) + 'MB',
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + 'MB'
  });
}, 60000);
```

**Solution:**

```typescript
// 1. Limit MemoryStore size
const cache = new NeuroCache({
  store: new MemoryStore(1000)  // LRU eviction
});

// 2. Or use RedisStore (offload to Redis)
const cache = new NeuroCache({
  store: new RedisStore({...})
});

// 3. Clear cache periodically
setInterval(() => {
  cache.clearCache();
}, 3600000);  // Every hour
```

---

### Problem: Out of memory errors

**Symptoms:**
```bash
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
```

**Solution:**

```bash
# Increase Node.js heap size
node --max-old-space-size=4096 app.js  # 4GB

# Or in package.json
{
  "scripts": {
    "start": "node --max-old-space-size=4096 app.js"
  }
}
```

**Long-term fix:**

```typescript
// Reduce cache size or use RedisStore
const cache = new NeuroCache({
  store: new RedisStore({...})  // Moves memory to Redis
});
```

---

## TypeScript Errors

### Problem: `Type 'X' is not assignable to type 'Y'`

**Common errors:**

#### 1. Missing response types

**Error:**
```typescript
const response = await cache.generate(request);
console.log(response.text);  // Error: Property 'text' does not exist
```

**Solution:**

```typescript
import type { GenerateResponse } from 'neurocache';

const response: GenerateResponse = await cache.generate(request);
console.log(response.content);  // ✅ Correct property
```

---

#### 2. Custom provider types

**Error:**
```typescript
class MyProvider implements Provider {
  async generate(request: any): Promise<any> {  // ❌ Using 'any'
    // ...
  }
}
```

**Solution:**

```typescript
import type { Provider, GenerateRequest, GenerateResponse } from 'neurocache';

class MyProvider implements Provider {
  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    // TypeScript will enforce correct types
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

## Debugging Tips

### Enable Logging

```typescript
const cache = new NeuroCache({
  // ...
  logging: true  // See cache hits/misses in console
});
```

---

### Inspect Cache Keys

**See what keys are being generated:**

```typescript
// Add this to NeuroCache source (for debugging only)
console.log('Cache key:', cacheKey);
```

**Or:**

```typescript
// Compute hash manually
import crypto from 'crypto';

const request = { model: 'gpt-3.5-turbo', messages: [...] };
const hash = crypto.createHash('sha256')
  .update(JSON.stringify(request))
  .digest('hex');
console.log('Expected cache key:', hash);
```

---

### Test Store Directly

```typescript
const store = new MemoryStore();

// Test set
await store.set('test', JSON.stringify({ foo: 'bar' }), 60);

// Test get
const value = await store.get('test');
console.log('Retrieved:', value);  // Should be '{"foo":"bar"}'

// Test expiration
await sleep(61000);
const expired = await store.get('test');
console.log('After TTL:', expired);  // Should be null
```

---

### Monitor Metrics Continuously

```typescript
setInterval(() => {
  const metrics = cache.getMetrics();
  console.log({
    requests: metrics.totalRequests,
    hits: metrics.cacheHits,
    misses: metrics.cacheMisses,
    hitRate: cache.getCacheHitRate().toFixed(2),
    providerErrors: metrics.providerErrors,
    storeErrors: metrics.storeErrors
  });
}, 10000);  // Every 10 seconds
```

---

### Check for Errors

```typescript
const metrics = cache.getMetrics();

if (metrics.providerErrors > 0) {
  console.error('Provider errors detected!', metrics.providerErrors);
  // Check OpenAI API status, API key, rate limits
}

if (metrics.storeErrors > 0) {
  console.error('Store errors detected!', metrics.storeErrors);
  // Check Redis connection, disk space (FileStore)
}
```

---

## Still Having Issues?

### 1. Check GitHub Issues

Search existing issues: https://github.com/eneswritescode/neurocache/issues

### 2. Enable Debug Mode

```typescript
const cache = new NeuroCache({
  // ...
  logging: true  // Detailed logs
});

// Also enable store logging (if supported)
```

### 3. Create Minimal Reproduction

```typescript
// app.ts
import { NeuroCache, OpenAIProvider, MemoryStore } from 'neurocache';

const cache = new NeuroCache({
  provider: new OpenAIProvider({
    apiKey: process.env.OPENAI_API_KEY!
  }),
  store: new MemoryStore(),
  logging: true
});

async function main() {
  const request = {
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: 'test' }]
  };
  
  console.log('Request 1...');
  await cache.generate(request);
  
  console.log('Request 2 (should hit cache)...');
  await cache.generate(request);
  
  console.log('Metrics:', cache.getMetrics());
}

main();
```

### 4. File a Bug Report

Include:
- NeuroCache version (`npm list neurocache`)
- Node.js version (`node --version`)
- Store type (MemoryStore, FileStore, RedisStore)
- Provider type (OpenAIProvider, custom)
- Minimal reproduction code
- Error messages
- Metrics output

---

**Still stuck?** Contact: eneswrites@protonmail.com or file an [issue](https://github.com/eneswritescode/neurocache/issues).
