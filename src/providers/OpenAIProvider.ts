import OpenAI from 'openai';
import type { LLMProvider, GenerateRequest, GenerateResponse } from '../core/types';
import { ProviderError } from '../core/errors';

/**
 * Configuration for OpenAI provider
 */
export interface OpenAIProviderConfig {
  apiKey: string;
  organization?: string;
  baseURL?: string;
  maxRetries?: number;
  timeout?: number;
}

/**
 * OpenAI LLM provider implementation
 */
export class OpenAIProvider implements LLMProvider {
  private readonly client: OpenAI;
  private readonly maxRetries: number;

  constructor(config: OpenAIProviderConfig) {
    if (!config.apiKey) {
      throw new ProviderError('OpenAI API key is required');
    }

    this.maxRetries = config.maxRetries ?? 3;

    this.client = new OpenAI({
      apiKey: config.apiKey,
      organization: config.organization,
      baseURL: config.baseURL,
      maxRetries: this.maxRetries,
      timeout: config.timeout ?? 60000
    });
  }

  /**
   * Generate a completion with retry logic
   */
  public async generate(request: GenerateRequest): Promise<GenerateResponse> {
    try {
      const completion = await this.client.chat.completions.create({
        model: request.model,
        messages: request.messages.map(msg => {
          const baseMessage = {
            role: msg.role,
            content: msg.content
          };
          
          // Only include name if it exists (required for function messages)
          if (msg.name) {
            return { ...baseMessage, name: msg.name };
          }
          
          return baseMessage;
        }) as OpenAI.Chat.ChatCompletionMessageParam[],
        temperature: request.temperature,
        top_p: request.top_p,
        max_tokens: request.max_tokens,
        frequency_penalty: request.frequency_penalty,
        presence_penalty: request.presence_penalty,
        stop: request.stop
      });

      const choice = completion.choices[0];
      
      if (!choice || !choice.message) {
        throw new ProviderError('No completion choice returned from OpenAI');
      }

      return {
        id: completion.id,
        model: completion.model,
        content: choice.message.content ?? '',
        usage: completion.usage ? {
          prompt_tokens: completion.usage.prompt_tokens,
          completion_tokens: completion.usage.completion_tokens,
          total_tokens: completion.usage.total_tokens
        } : undefined,
        finish_reason: choice.finish_reason ?? undefined,
        created: completion.created
      };
    } catch (error: unknown) {
      if (error instanceof OpenAI.APIError) {
        throw new ProviderError(
          `OpenAI API error: ${error.message} (status: ${error.status})`,
          error
        );
      }

      throw new ProviderError(
        `Failed to generate completion: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get provider name
   */
  public getProviderName(): string {
    return 'OpenAI';
  }

  /**
   * Get model name from request
   */
  public getModelName(request: GenerateRequest): string {
    return request.model;
  }
}
