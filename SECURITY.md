# Security Policy

## Supported Versions

We support the following versions with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security issues seriously. If you discover a security vulnerability in NeuroCache, please report it responsibly.

### Please DO NOT:
- Open a public GitHub issue for security vulnerabilities
- Disclose the vulnerability publicly before it has been addressed

### Please DO:
1. **Email:** Send details to [eneswrites@protonmail.com](mailto:eneswrites@protonmail.com)
2. **Include:**
   - Description of the vulnerability
   - Steps to reproduce
   - Affected versions
   - Potential impact
   - Any suggested fixes (if applicable)

### What to Expect:
- **Initial Response:** Within 48 hours
- **Status Update:** Within 7 days
- **Fix Timeline:** Security patches will be released as soon as possible, typically within 30 days for critical issues

### Security Best Practices

When using NeuroCache in production:

1. **API Keys:** Never commit API keys to version control
   ```typescript
   // ✅ Use environment variables
   const provider = new OpenAIProvider({
     apiKey: process.env.OPENAI_API_KEY
   });
   
   // ❌ Never hardcode
   const provider = new OpenAIProvider({
     apiKey: 'sk-...' // DON'T DO THIS
   });
   ```

2. **Cache Storage:** Be mindful of sensitive data in cache
   - Use TTL to expire cached responses
   - Consider encrypting cached data for sensitive applications
   - Use Redis with authentication in production

3. **Dependencies:** Keep dependencies up to date
   ```bash
   npm audit
   npm audit fix
   ```

4. **Input Validation:** Validate all user inputs before passing to LLM providers

5. **Rate Limiting:** Implement rate limiting to prevent abuse

## Security Features

NeuroCache includes several security features:

- **Deterministic Hashing:** SHA-256 for cache keys (no secret exposure)
- **No Credential Storage:** API keys are never cached
- **Type Safety:** Strict TypeScript prevents many runtime errors
- **Input Sanitization:** Optional content normalization
- **Graceful Degradation:** Failures don't expose sensitive data

## Disclosure Policy

When a security vulnerability is fixed:
1. A security advisory will be published
2. Credit will be given to the reporter (unless anonymity is requested)
3. A CVE will be requested for critical vulnerabilities
4. Release notes will include security fix details

## Contact

**Primary:** eneswrites@protonmail.com  
**Repository:** https://github.com/eneswritescode/neurocache

---

*Last Updated: February 20, 2026*
