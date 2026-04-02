/**
 * LLM client wrapper — backed by the Anthropic SDK.
 * Provides a uniform interface used by planner, critic, and generator nodes.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { LLMClient, LLMChatOptions, LLMResponse } from '../types.js';

const DEFAULT_MODEL = 'claude-sonnet-4-6';
const DEFAULT_MAX_TOKENS = 4096;

class AnthropicLLMClient implements LLMClient {
  private readonly client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async chat(options: LLMChatOptions): Promise<LLMResponse> {
    const model = options.model ?? DEFAULT_MODEL;
    const maxTokens = options.max_tokens ?? DEFAULT_MAX_TOKENS;

    // For JSON mode, prepend a reminder to the system prompt
    const jsonSuffix =
      options.response_format?.type === 'json_object'
        ? '\n\nIMPORTANT: Respond with valid JSON only. No markdown, no explanation.'
        : '';

    const systemPrompt = options.system
      ? options.system + jsonSuffix
      : jsonSuffix || undefined;

    const response = await this.client.messages.create({
      model,
      max_tokens: maxTokens,
      ...(systemPrompt ? { system: systemPrompt } : {}),
      messages: options.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    const content = textBlock?.type === 'text' ? textBlock.text : '';

    return {
      content,
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  }
}

let _instance: LLMClient | null = null;

/** Returns a singleton LLM client. */
export function createLLMClient(): LLMClient {
  if (!_instance) {
    _instance = new AnthropicLLMClient();
  }
  return _instance;
}

/** Replaces the singleton — useful for testing. */
export function setLLMClient(client: LLMClient): void {
  _instance = client;
}
