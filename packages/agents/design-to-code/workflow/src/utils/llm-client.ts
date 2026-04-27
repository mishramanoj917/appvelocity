/**
 * LLM client — routes through the Coforge QuasarMarket LLM proxy.
 *
 * Both Claude and OpenAI models are accessed via the same proxy endpoint
 * using the OpenAI-compatible chat completions format. The proxy authenticates
 * with a shared API key regardless of the target model.
 *
 * Config (env vars):
 *   LLM_API_URL      — proxy endpoint (defaults to v2/chat/completions)
 *   ANTHROPIC_API_KEY or OPENAI_API_KEY — shared bearer token for the proxy
 */

import type { LLMClient, LLMChatOptions, LLMResponse, LLMContentPart } from '../types.js';

const DEFAULT_API_URL =
  'https://quasarmarket.coforge.com/qag/llmrouter-api/v2/chat/completions';
const DEFAULT_MODEL = 'claude-sonnet-4';
const DEFAULT_MAX_TOKENS = 4096;

// ─── OpenAI-compatible wire types ────────────────────────────────────────────

type OpenAIContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | OpenAIContentPart[];
}

interface OpenAIRequestBody {
  model: string;
  messages: OpenAIMessage[];
  max_tokens?: number;
  response_format?: { type: 'json_object' | 'text' };
}

interface OpenAIResponse {
  choices: Array<{ message: { content: string } }>;
  model: string;
  usage: { prompt_tokens: number; completion_tokens: number };
}

// ─── Client implementation ────────────────────────────────────────────────────

class ProxyLLMClient implements LLMClient {
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor() {
    this.apiUrl =
      process.env.LLM_API_URL ?? DEFAULT_API_URL;

    // All model keys point to the same shared proxy key
    this.apiKey =
      process.env.ANTHROPIC_API_KEY ??
      process.env.OPENAI_API_KEY ??
      process.env.GEMINI_API_KEY ??
      '';

    if (!this.apiKey) {
      throw new Error(
        'LLM proxy requires ANTHROPIC_API_KEY or OPENAI_API_KEY to be set.'
      );
    }
  }

  async chat(options: LLMChatOptions): Promise<LLMResponse> {
    const model = options.model ?? DEFAULT_MODEL;
    const maxTokens = options.max_tokens ?? DEFAULT_MAX_TOKENS;

    // Build the messages array — system prompt goes first as a 'system' role message
    const messages: OpenAIMessage[] = [];

    if (options.system) {
      const jsonSuffix =
        options.response_format?.type === 'json_object'
          ? '\n\nIMPORTANT: Respond with valid JSON only. No markdown, no explanation.'
          : '';
      messages.push({ role: 'system', content: options.system + jsonSuffix });
    }

    for (const m of options.messages) {
      if (typeof m.content === 'string') {
        messages.push({ role: m.role, content: m.content });
      } else {
        // Multimodal content (text + images) — pass through as OpenAI content parts
        const parts: OpenAIContentPart[] = (m.content as LLMContentPart[]).map((p) => {
          if (p.type === 'image_url' && p.image_url) {
            return { type: 'image_url', image_url: { url: p.image_url.url } };
          }
          return { type: 'text', text: p.text ?? '' };
        });
        messages.push({ role: m.role, content: parts });
      }
    }

    const body: OpenAIRequestBody = {
      model,
      messages,
      max_tokens: maxTokens,
      ...(options.response_format ? { response_format: options.response_format } : {}),
    };

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '(no body)');
      throw new Error(
        `LLM proxy returned ${response.status} ${response.statusText}: ${errorText}`
      );
    }

    const data = (await response.json()) as OpenAIResponse;
    const content = data.choices?.[0]?.message?.content ?? '';

    return {
      content,
      model: data.model ?? model,
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
    };
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _instance: LLMClient | null = null;

/** Returns a singleton proxy LLM client. */
export function createLLMClient(): LLMClient {
  if (!_instance) {
    _instance = new ProxyLLMClient();
  }
  return _instance;
}

/** Replaces the singleton — useful for testing. */
export function setLLMClient(client: LLMClient): void {
  _instance = client;
}
