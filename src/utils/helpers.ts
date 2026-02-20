import { encoding_for_model, get_encoding, type TiktokenModel, type Tiktoken } from '@dqbd/tiktoken';

/**
 * Estimate token count for text using model-aware tokenizer
 * Falls back to heuristic if model is unsupported
 * 
 * @param text - Text to estimate tokens for
 * @param model - LLM model name (e.g., 'gpt-3.5-turbo', 'gpt-4')
 * @returns Estimated token count
 */
export function estimateTokenCount(text: string, model?: string): number {
  // Fallback to heuristic if no model provided
  if (!model) {
    return estimateTokenCountHeuristic(text);
  }

  let encoder: Tiktoken | null = null;

  try {
    // Try to get encoding for the specific model
    encoder = encoding_for_model(model as TiktokenModel);
    const tokens = encoder.encode(text);
    return tokens.length;
  } catch {
    // Model not supported by tiktoken, try common base encodings
    try {
      // GPT-4 and GPT-3.5-turbo use cl100k_base
      if (model.includes('gpt-4') || model.includes('gpt-3.5') || model.includes('gpt-35')) {
        encoder = get_encoding('cl100k_base');
        const tokens = encoder.encode(text);
        return tokens.length;
      }

      // Fallback to heuristic for unknown models
      return estimateTokenCountHeuristic(text);
    } catch {
      // Encoding failed, use heuristic
      return estimateTokenCountHeuristic(text);
    }
  } finally {
    // Free encoder resources to prevent memory leaks
    if (encoder) {
      encoder.free();
    }
  }
}

/**
 * Heuristic-based token estimation (fallback)
 * This is a rough estimation - ~4 characters per token for English
 * 
 * @param text - Text to estimate
 * @returns Estimated token count
 */
function estimateTokenCountHeuristic(text: string): number {
  // Rough estimation: ~4 characters per token for English
  // This is a conservative estimate
  return Math.ceil(text.length / 4);
}

/**
 * Estimate tokens for a single message
 * 
 * @param message - Message to estimate
 * @param model - Optional model name for accurate token counting
 * @returns Estimated token count
 */
export function estimateMessageTokens(
  message: { content: string; role?: string; name?: string },
  model?: string
): number {
  let total = estimateTokenCount(message.content, model);
  
  // Add overhead for role and name fields
  if (message.role) {
    total += 1;
  }
  if (message.name) {
    total += estimateTokenCount(message.name, model);
  }
  
  // Message formatting overhead
  total += 4;
  
  return total;
}

/**
 * Estimate total tokens for a request
 * 
 * @param messages - Array of messages
 * @param model - Optional model name for accurate token counting
 * @returns Estimated token count
 */
export function estimateRequestTokens(
  messages: { content: string }[],
  model?: string
): number {
  let total = 0;

  for (const message of messages) {
    total += estimateTokenCount(message.content, model);
  }

  // Add overhead for message formatting
  total += messages.length * 4;

  return total;
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Format duration in milliseconds to human-readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms.toFixed(0)}ms`;
  }

  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(2)}s`;
  }

  const minutes = seconds / 60;
  return `${minutes.toFixed(2)}m`;
}

/**
 * Safe JSON stringify with error handling
 */
export function safeStringify(obj: unknown): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return '[Unstringifiable Object]';
  }
}
