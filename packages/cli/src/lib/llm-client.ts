/**
 * Slim LLM client for CLI use — no Next.js env dependencies.
 * Routes through the Coforge QuasarMarket proxy (OpenAI-compatible).
 */

export interface LLMMessage {
  role:    'system' | 'user' | 'assistant';
  content: string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>;
}

export interface LLMOptions {
  model?:      string;
  system?:     string;
  messages:    LLMMessage[];
  max_tokens?: number;
  json?:       boolean;
}

export interface LLMResponse {
  content: string;
}

export async function llmChat(opts: LLMOptions, config: { apiUrl: string; apiKey: string }): Promise<LLMResponse> {
  const model = process.env['OVERRIDE_MODEL'] ?? opts.model ?? 'gemini-1.5-pro';

  const messages: LLMMessage[] = [];
  if (opts.system) messages.push({ role: 'system', content: opts.system });
  messages.push(...opts.messages);

  const body: Record<string, unknown> = {
    model,
    messages,
    max_tokens: opts.max_tokens ?? 4096,
  };
  if (opts.json) body['response_format'] = { type: 'json_object' };

  const res = await fetch(config.apiUrl, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
      'x-api-key':     config.apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`LLM API error ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json() as { choices: Array<{ message: { content: string } }> };
  return { content: data.choices[0]?.message?.content ?? '' };
}
