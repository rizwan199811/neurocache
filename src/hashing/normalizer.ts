import type { GenerateRequest, Message } from '../core/types';

/**
 * Normalizes a message for deterministic hashing
 */
export function normalizeMessage(message: Message): Message {
  return {
    role: message.role,
    content: message.content.trim(),
    ...(message.name && { name: message.name })
  };
}

/**
 * Normalizes messages array for deterministic hashing
 */
export function normalizeMessages(messages: Message[]): Message[] {
  return messages.map(normalizeMessage);
}

/**
 * Normalizes a request for deterministic hashing
 */
export function normalizeRequest(request: GenerateRequest): GenerateRequest {
  const normalized: GenerateRequest = {
    model: request.model,
    messages: normalizeMessages(request.messages)
  };

  // Include optional parameters that affect output
  if (request.temperature !== undefined) {
    normalized.temperature = request.temperature;
  }

  if (request.top_p !== undefined) {
    normalized.top_p = request.top_p;
  }

  if (request.max_tokens !== undefined) {
    normalized.max_tokens = request.max_tokens;
  }

  if (request.frequency_penalty !== undefined) {
    normalized.frequency_penalty = request.frequency_penalty;
  }

  if (request.presence_penalty !== undefined) {
    normalized.presence_penalty = request.presence_penalty;
  }

  if (request.stop !== undefined) {
    normalized.stop = request.stop;
  }

  return normalized;
}
