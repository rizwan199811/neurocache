import { Hasher, deterministicStringify } from '../hashing/hasher';
import type { GenerateRequest } from '../core/types';

describe('Hasher', () => {
  let hasher: Hasher;

  beforeEach(() => {
    hasher = new Hasher('v1');
  });

  describe('deterministicStringify', () => {
    it('should stringify primitives consistently', () => {
      expect(deterministicStringify(null)).toBe('null');
      expect(deterministicStringify(undefined)).toBe('undefined');
      expect(deterministicStringify(42)).toBe('42');
      expect(deterministicStringify('hello')).toBe('"hello"');
      expect(deterministicStringify(true)).toBe('true');
    });

    it('should stringify arrays consistently', () => {
      const arr = [1, 2, 3];
      const result1 = deterministicStringify(arr);
      const result2 = deterministicStringify(arr);
      expect(result1).toBe(result2);
      expect(result1).toBe('[1,2,3]');
    });

    it('should stringify objects with sorted keys', () => {
      const obj1 = { b: 2, a: 1, c: 3 };
      const obj2 = { c: 3, a: 1, b: 2 };
      const result1 = deterministicStringify(obj1);
      const result2 = deterministicStringify(obj2);
      expect(result1).toBe(result2);
    });

    it('should handle nested objects', () => {
      const obj = {
        outer: {
          inner: {
            value: 42
          }
        }
      };
      const result = deterministicStringify(obj);
      expect(result).toContain('value');
      expect(result).toContain('42');
    });
  });

  describe('hash', () => {
    it('should generate consistent hashes for identical requests', () => {
      const request: GenerateRequest = {
        model: 'gpt-4',
        messages: [
          { role: 'user', content: 'Hello' }
        ],
        temperature: 0.7
      };

      const hash1 = hasher.hash(request);
      const hash2 = hasher.hash(request);

      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different requests', () => {
      const request1: GenerateRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }]
      };

      const request2: GenerateRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Goodbye' }]
      };

      const hash1 = hasher.hash(request1);
      const hash2 = hasher.hash(request2);

      expect(hash1).not.toBe(hash2);
    });

    it('should normalize whitespace in messages', () => {
      const request1: GenerateRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello  World' }]
      };

      const request2: GenerateRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: '  Hello  World  ' }]
      };

      const hash1 = hasher.hash(request1);
      const hash2 = hasher.hash(request2);

      expect(hash1).toBe(hash2);
    });

    it('should include temperature in hash', () => {
      const request1: GenerateRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 0.7
      };

      const request2: GenerateRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 0.9
      };

      const hash1 = hasher.hash(request1);
      const hash2 = hasher.hash(request2);

      expect(hash1).not.toBe(hash2);
    });

    it('should include version in hash', () => {
      const hasherV1 = new Hasher('v1');
      const hasherV2 = new Hasher('v2');

      const request: GenerateRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }]
      };

      const hash1 = hasherV1.hash(request);
      const hash2 = hasherV2.hash(request);

      expect(hash1).not.toBe(hash2);
    });

    it('should generate SHA256 hashes', () => {
      const request: GenerateRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }]
      };

      const hash = hasher.hash(request);

      // SHA256 hashes are 64 hex characters
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('getVersion', () => {
    it('should return the version', () => {
      const hasherV1 = new Hasher('v1');
      const hasherV2 = new Hasher('v2');

      expect(hasherV1.getVersion()).toBe('v1');
      expect(hasherV2.getVersion()).toBe('v2');
    });
  });
});
