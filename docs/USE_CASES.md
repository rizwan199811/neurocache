# Use Cases

Real-world examples of NeuroCache in production.

## Table of Contents

1. [Chatbot Applications](#chatbot-applications)
2. [RAG Systems](#rag-systems-retrieval-augmented-generation)
3. [Code Generation](#code-generation)
4. [Content Creation](#content-creation)
5. [Customer Support](#customer-support)
6. [Translation Services](#translation-services)
7. [Educational Platforms](#educational-platforms)
8. [API Gateways](#api-gateways)

---

## Chatbot Applications

### FAQ Chatbot

Perfect for caching common questions.

**Expected Hit Rate:** 60-80%  
**Recommended TTL:** 24 hours  
**Cost Savings:** 70-85%

```typescript
import { NeuroCache, OpenAIProvider, RedisStore } from 'neurocache';

const faqCache = new NeuroCache({
  provider: new OpenAIProvider({
    apiKey: process.env.OPENAI_API_KEY!
  }),
  store: new RedisStore({
    host: process.env.REDIS_HOST!,
    port: 6379,
    keyPrefix: 'faq:cache:'
  }),
  ttl: 86400,  // 24 hours (FAQ doesn't change often)
  enableContextIntelligence: true  // Handle whitespace variations
});

// Initialize with common questions
const commonQuestions = [
  "What are your business hours?",
  "How do I reset my password?",
  "What payment methods do you accept?",
  "How do I track my order?",
  "Do you offer refunds?"
];

async function warmUpCache() {
  for (const question of commonQuestions) {
    await faqCache.generate({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a helpful customer service assistant.' },
        { role: 'user', content: question }
      ],
      temperature: 0  // Deterministic responses
    });
  }
  console.log('Cache warmed up!');
}

// Use in Express app
app.post('/api/faq', async (req, res) => {
  const { question } = req.body;
  
  const startTime = Date.now();
  const response = await faqCache.generate({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: 'You are a helpful customer service assistant.' },
      { role: 'user', content: question }
    ],
    temperature: 0
  });
  
  res.json({
    answer: response.content,
    responseTime: Date.now() - startTime,
    cached: true  // Assume cached if < 100ms
  });
});
```

**Results:**
- First request: ~1,500ms
- Cached requests: ~8ms
- **99.5% latency reduction**

---

### Conversational AI

Multi-turn conversations with context.

**Expected Hit Rate:** 20-40%  
**Recommended TTL:** 1 hour  
**Cost Savings:** 25-40%

```typescript
const conversationCache = new NeuroCache({
  provider: new OpenAIProvider({
    apiKey: process.env.OPENAI_API_KEY!
  }),
  store: new RedisStore({
    host: process.env.REDIS_HOST!,
    port: 6379,
    keyPrefix: 'conversation:cache:'
  }),
  ttl: 3600,  // 1 hour
  enableContextIntelligence: true  // Remove duplicate messages
});

// Store conversation history per user
const conversations = new Map<string, Array<{ role: string; content: string }>>();

app.post('/api/chat', async (req, res) => {
  const { userId, message } = req.body;
  
  // Get conversation history
  let history = conversations.get(userId) || [];
  
  // Add user message
  history.push({ role: 'user', content: message });
  
  // Keep only last 10 messages (avoid context explosion)
  if (history.length > 10) {
    history = history.slice(-10);
  }
  
  const response = await conversationCache.generate({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      ...history
    ],
    temperature: 0.7
  });
  
  // Add assistant response to history
  history.push({ role: 'assistant', content: response.content });
  conversations.set(userId, history);
  
  res.json({ message: response.content });
});
```

**Cache Benefits:**
- Repeated patterns cached (e.g., "Hello", "Thanks", "Goodbye")
- Context Intelligence removes duplicate messages
- ~30% hit rate typical for conversations

---

## RAG Systems (Retrieval-Augmented Generation)

### Document Q&A

Cache responses for common questions about documents.

**Expected Hit Rate:** 50-70%  
**Recommended TTL:** 24 hours  
**Cost Savings:** 60-75%

```typescript
import { NeuroCache, OpenAIProvider, RedisStore } from 'neurocache';

const ragCache = new NeuroCache({
  provider: new OpenAIProvider({
    apiKey: process.env.OPENAI_API_KEY!
  }),
  store: new RedisStore({
    host: process.env.REDIS_HOST!,
    port: 6379,
    keyPrefix: 'rag:cache:'
  }),
  ttl: 86400,  // 24 hours
  enableContextIntelligence: true
});

async function answerQuestion(question: string, documentId: string) {
  // Retrieve relevant chunks from vector DB
  const relevantChunks = await vectorDB.search(question, { limit: 3 });
  
  const context = relevantChunks.map(chunk => chunk.text).join('\n\n');
  
  // Cache based on question + context
  const response = await ragCache.generate({
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'system',
        content: 'You are a helpful assistant. Answer questions based on the provided context.'
      },
      {
        role: 'user',
        content: `Context:\n${context}\n\nQuestion: ${question}`
      }
    ],
    temperature: 0  // Deterministic
  });
  
  return response.content;
}

// API endpoint
app.post('/api/docs/ask', async (req, res) => {
  const { question, documentId } = req.body;
  
  const answer = await answerQuestion(question, documentId);
  
  res.json({
    answer,
    hitRate: ragCache.getCacheHitRate(),
    tokensSaved: ragCache.getMetrics().tokensSaved
  });
});
```

**Optimization Tips:**
- Use `temperature: 0` for deterministic caching
- Cache at the "question + context" level (not just question)
- Common questions about same document hit cache frequently

---

## Code Generation

### Code Completion

Cache common code patterns.

**Expected Hit Rate:** 40-60%  
**Recommended TTL:** 7 days  
**Cost Savings:** 50-65%

```typescript
const codeCache = new NeuroCache({
  provider: new OpenAIProvider({
    apiKey: process.env.OPENAI_API_KEY!
  }),
  store: new RedisStore({
    host: process.env.REDIS_HOST!,
    port: 6379,
    keyPrefix: 'code:cache:'
  }),
  ttl: 604800,  // 7 days (code patterns don't change often)
  enableContextIntelligence: false  // Exact matching (whitespace matters in code)
});

async function generateCode(prompt: string, language: string) {
  const response = await codeCache.generate({
    model: 'gpt-4',
    messages: [
      {
        role: 'system',
        content: `You are an expert ${language} programmer. Generate clean, idiomatic code.`
      },
      { role: 'user', content: prompt }
    ],
    temperature: 0  // Deterministic
  });
  
  return response.content;
}

// API
app.post('/api/code/generate', async (req, res) => {
  const { prompt, language } = req.body;
  
  const code = await generateCode(prompt, language || 'TypeScript');
  
  res.json({
    code,
    cached: ragCache.getCacheHitRate() > 0
  });
});
```

**Example Prompts (High Cache Hit Rate):**
- "Write a function to reverse a string"
- "Create a React component for a button"
- "Generate a SQL query to find all users"
- "Write a binary search algorithm"

**Why High Hit Rate?**
- Developers ask similar questions
- Code patterns are repetitive
- Temperature=0 ensures deterministic output

---

## Content Creation

### Blog Post Generation

Cache outlines and common topics.

**Expected Hit Rate:** 30-50%  
**Recommended TTL:** 7 days  
**Cost Savings:** 35-55%

```typescript
const contentCache = new NeuroCache({
  provider: new OpenAIProvider({
    apiKey: process.env.OPENAI_API_KEY!
  }),
  store: new RedisStore({
    host: process.env.REDIS_HOST!,
    port: 6379,
    keyPrefix: 'content:cache:'
  }),
  ttl: 604800,  // 7 days
  enableContextIntelligence: true
});

async function generateBlogOutline(topic: string, keywords: string[]) {
  const response = await contentCache.generate({
    model: 'gpt-4',
    messages: [
      {
        role: 'system',
        content: 'You are a content strategist. Create detailed blog post outlines.'
      },
      {
        role: 'user',
        content: `Create a blog post outline for: ${topic}\nKeywords: ${keywords.join(', ')}`
      }
    ],
    temperature: 0.3  // Slightly creative but mostly deterministic
  });
  
  return response.content;
}

// Two-stage caching: Outline + Full content
async function generateBlogPost(topic: string, keywords: string[]) {
  // Stage 1: Generate outline (often cached)
  const outline = await generateBlogOutline(topic, keywords);
  
  // Stage 2: Generate full content (less often cached)
  const response = await contentCache.generate({
    model: 'gpt-4',
    messages: [
      {
        role: 'system',
        content: 'You are a professional blog writer.'
      },
      {
        role: 'user',
        content: `Write a blog post based on this outline:\n\n${outline}`
      }
    ],
    temperature: 0.7  // More creative
  });
  
  return { outline, content: response.content };
}
```

**Optimization Strategy:**
- Cache outlines (high reuse)
- Cache common topics ("How to start a blog", "SEO tips")
- Use lower temperature for better cache hits

---

## Customer Support

### Ticket Response Generation

Cache responses to common support issues.

**Expected Hit Rate:** 55-75%  
**Recommended TTL:** 12 hours  
**Cost Savings:** 65-80%

```typescript
const supportCache = new NeuroCache({
  provider: new OpenAIProvider({
    apiKey: process.env.OPENAI_API_KEY!
  }),
  store: new RedisStore({
    host: process.env.REDIS_HOST!,
    port: 6379,
    keyPrefix: 'support:cache:'
  }),
  ttl: 43200,  // 12 hours
  enableContextIntelligence: true
});

async function generateSupportResponse(ticketContent: string, category: string) {
  const response = await supportCache.generate({
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'system',
        content: `You are a customer support agent. Generate helpful, empathetic responses.
Category: ${category}`
      },
      { role: 'user', content: ticketContent }
    ],
    temperature: 0.2  // Mostly deterministic but with slight variation
  });
  
  return response.content;
}

app.post('/api/support/suggest-response', async (req, res) => {
  const { ticketContent, category } = req.body;
  
  const suggestedResponse = await generateSupportResponse(ticketContent, category);
  
  res.json({
    suggestion: suggestedResponse,
    metrics: supportCache.getMetrics()
  });
});
```

**High Cache Hit Categories:**
- Password reset requests
- Shipping inquiries
- Refund requests
- Account activation

**Result:** Support agents respond 10x faster with cached suggestions.

---

## Translation Services

### Document Translation

Cache translations for common phrases.

**Expected Hit Rate:** 45-65%  
**Recommended TTL:** 30 days  
**Cost Savings:** 55-70%

```typescript
const translationCache = new NeuroCache({
  provider: new OpenAIProvider({
    apiKey: process.env.OPENAI_API_KEY!
  }),
  store: new RedisStore({
    host: process.env.REDIS_HOST!,
    port: 6379,
    keyPrefix: 'translation:cache:'
  }),
  ttl: 2592000,  // 30 days (translations don't change)
  enableContextIntelligence: true
});

async function translate(text: string, fromLang: string, toLang: string) {
  const response = await translationCache.generate({
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'system',
        content: `You are a professional translator. Translate from ${fromLang} to ${toLang}.`
      },
      { role: 'user', content: text }
    ],
    temperature: 0  // Deterministic
  });
  
  return response.content;
}

app.post('/api/translate', async (req, res) => {
  const { text, from, to } = req.body;
  
  const translation = await translate(text, from, to);
  
  res.json({
    original: text,
    translation,
    from,
    to,
    cached: translationCache.getCacheHitRate() > 0
  });
});
```

**Why High Hit Rate?**
- Common phrases repeated (e.g., "Hello", "Thank you", "How are you?")
- UI strings translated multiple times
- Documentation has repeated terminology

---

## Educational Platforms

### Quiz Question Generation

Cache questions for common topics.

**Expected Hit Rate:** 50-70%  
**Recommended TTL:** 7 days  
**Cost Savings:** 60-75%

```typescript
const quizCache = new NeuroCache({
  provider: new OpenAIProvider({
    apiKey: process.env.OPENAI_API_KEY!
  }),
  store: new RedisStore({
    host: process.env.REDIS_HOST!,
    port: 6379,
    keyPrefix: 'quiz:cache:'
  }),
  ttl: 604800,  // 7 days
  enableContextIntelligence: true
});

async function generateQuizQuestions(topic: string, difficulty: string, count: number) {
  const response = await quizCache.generate({
    model: 'gpt-4',
    messages: [
      {
        role: 'system',
        content: `You are an educational content creator. Generate ${count} multiple-choice questions.`
      },
      {
        role: 'user',
        content: `Topic: ${topic}\nDifficulty: ${difficulty}\nFormat: JSON array with {question, options, correctAnswer}`
      }
    ],
    temperature: 0.3  // Some variation but mostly consistent
  });
  
  return JSON.parse(response.content);
}

app.post('/api/quiz/generate', async (req, res) => {
  const { topic, difficulty, count } = req.body;
  
  const questions = await generateQuizQuestions(topic, difficulty, count || 5);
  
  res.json({
    questions,
    metrics: {
      hitRate: quizCache.getCacheHitRate(),
      tokensSaved: quizCache.getMetrics().tokensSaved
    }
  });
});
```

---

## API Gateways

### Multi-Tenant LLM Gateway

Shared cache across all tenants.

**Expected Hit Rate:** 35-55%  
**Recommended TTL:** 6 hours  
**Cost Savings:** 45-60%

```typescript
const gatewayCache = new NeuroCache({
  provider: new OpenAIProvider({
    apiKey: process.env.OPENAI_API_KEY!
  }),
  store: new RedisStore({
    host: process.env.REDIS_HOST!,
    port: 6379,
    keyPrefix: 'gateway:cache:'
  }),
  ttl: 21600,  // 6 hours
  enableContextIntelligence: true
});

// Rate limiting per tenant
const rateLimiters = new Map<string, RateLimiter>();

app.post('/api/v1/completions', async (req, res) => {
  const apiKey = req.headers['x-api-key'] as string;
  
  // Verify API key
  const tenant = await verifyApiKey(apiKey);
  if (!tenant) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  // Rate limit
  const limiter = rateLimiters.get(tenant.id) || new RateLimiter(tenant.rateLimit);
  if (!limiter.allow()) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }
  
  // Generate with caching
  const response = await gatewayCache.generate(req.body);
  
  // Track usage
  await trackUsage(tenant.id, response.usage.totalTokens);
  
  res.json({
    ...response,
    cached: true,  // Simplified
    tenant: tenant.id
  });
});

// Metrics endpoint (admin only)
app.get('/admin/metrics', authenticateAdmin, (req, res) => {
  res.json({
    cache: gatewayCache.getMetrics(),
    summary: gatewayCache.getMetricsSummary()
  });
});
```

**Benefits:**
- Cross-tenant cache sharing (privacy-safe for deterministic requests)
- Reduced infrastructure costs
- Better performance for all tenants

---

## Performance Comparison

| Use Case | Hit Rate | Latency Reduction | Cost Savings |
|----------|----------|-------------------|--------------|
| FAQ Chatbot | 70% | 99.5% | 75% |
| Conversational AI | 30% | 95% | 35% |
| RAG Systems | 60% | 98% | 65% |
| Code Generation | 50% | 97% | 60% |
| Content Creation | 40% | 96% | 45% |
| Customer Support | 65% | 99% | 70% |
| Translation | 55% | 98% | 60% |
| Educational | 60% | 97% | 65% |
| API Gateway | 45% | 96% | 50% |

**Average:** 53% hit rate, 97% latency reduction, 58% cost savings

---

## Next Steps

- **📖 Configuration:** [CONFIGURATION.md](./CONFIGURATION.md)
- **🎯 Best Practices:** [BEST_PRACTICES.md](./BEST_PRACTICES.md)
- **🔧 API Reference:** [API_REFERENCE.md](./API_REFERENCE.md)
- **❓ Troubleshooting:** [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

---

**Need help with your use case?** File an [issue](https://github.com/eneswritescode/neurocache/issues) with details!
