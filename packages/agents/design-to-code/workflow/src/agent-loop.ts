/**
 * runAgentLoop — true ReAct (Reason + Act) agent loop.
 *
 * The orchestrator LLM receives:
 *   - A system prompt with the current project state summary
 *   - The full conversation history (thought/action/observation triplets)
 *   - The TOOL_REGISTRY (12 tools it can call)
 *
 * It picks a tool, we execute it, we feed the result back, and repeat —
 * until the LLM stops calling tools (finish_reason === 'stop'), the ZIP is
 * created, or we hit the MAX_ITERATIONS safety cap.
 *
 * If the proxy does not support native tool_use (no tool_calls in response),
 * we fall back to structured JSON text mode automatically.
 */

import { createLLMClient }        from './utils/llm-client.js';
import { AgentMemory }            from './agent-memory.js';
import type { AgentInput, AgentOutput } from './agent-memory.js';
import { buildOrchestratorPrompt } from './orchestrator-prompt.js';
import { TOOL_REGISTRY, dispatchTool } from './tools/registry.js';
import type { ToolCall }          from './types.js';

const MAX_ITERATIONS = 30;
const ORCHESTRATOR_MODEL = process.env['ORCHESTRATOR_MODEL'] ?? process.env['OPENAI_MODEL'] ?? 'gpt-4o';

export interface AgentLoopOptions {
  onStep?: (toolName: string, iteration: number) => void;
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function runAgentLoop(
  input: AgentInput,
  opts: AgentLoopOptions = {}
): Promise<AgentOutput> {
  const memory = AgentMemory.init(input);
  const llm    = createLLMClient();

  // Detect whether the proxy supports native tool calling on the first iteration.
  // If not, we switch to JSON text mode for the rest of the run.
  let useTextFallback = false;

  for (let i = 1; i <= MAX_ITERATIONS; i++) {
    memory.iteration = i;

    const systemPrompt = buildOrchestratorPrompt(memory);

    let toolCalls: ToolCall[];

    if (useTextFallback) {
      toolCalls = await reasonWithText(llm, systemPrompt, memory);
    } else {
      const response = await llm.chat({
        model:      ORCHESTRATOR_MODEL,
        system:     systemPrompt,
        messages:   memory.messages,
        tools:      TOOL_REGISTRY,
        tool_choice: 'auto',
        max_tokens: 1024,
      });

      // Record the assistant's reasoning message
      if (response.content) {
        memory.addAssistantMessage(response.content);
      }

      // Check for native tool call support
      if (!response.toolCalls?.length) {
        if (response.finishReason === 'stop') {
          // LLM said it's done — check if we actually have a ZIP
          break;
        }
        // Proxy returned no tool_calls and didn't stop — switch to text mode
        useTextFallback = true;
        memory.logs.push(`[iter ${i}] Proxy returned no tool_calls — switching to JSON text mode`);
        toolCalls = await reasonWithText(llm, systemPrompt, memory);
      } else {
        toolCalls = response.toolCalls;
      }
    }

    if (toolCalls.length === 0) {
      // Agent decided there's nothing more to do
      break;
    }

    // Execute each tool call and record observations
    for (const call of toolCalls) {
      opts.onStep?.(call.function.name, i);
      const result = await dispatchTool(call, memory);
      memory.addObservation(call, result);
    }

    // Short-circuit: if the ZIP was created, we're done
    if (memory.zipBuffer) break;
  }

  return memory.finalOutput();
}

// ─── Fallback: structured JSON text mode ──────────────────────────────────────
//
// When the LLM proxy doesn't support native tool_use, we instruct the LLM to
// output a JSON action object and parse it ourselves.

const TEXT_MODE_SUFFIX = `
## OUTPUT FORMAT (REQUIRED)
Since tool calling is not available, respond ONLY with a JSON object:
{
  "thought": "<one sentence reasoning>",
  "action": "<tool_name or 'done'>",
  "args": { <tool arguments as key-value pairs> }
}
If you are done, use action "done". Do not include any text outside the JSON.`;

async function reasonWithText(
  llm: ReturnType<typeof createLLMClient>,
  systemPrompt: string,
  memory: AgentMemory
): Promise<ToolCall[]> {
  const response = await llm.chat({
    model:   ORCHESTRATOR_MODEL,
    system:  systemPrompt + TEXT_MODE_SUFFIX,
    messages: memory.messages,
    response_format: { type: 'json_object' },
    max_tokens: 512,
  });

  memory.addAssistantMessage(response.content);

  let parsed: { thought?: string; action?: string; args?: Record<string, unknown> };
  try {
    parsed = JSON.parse(response.content) as typeof parsed;
  } catch {
    return [];
  }

  if (!parsed.action || parsed.action === 'done') return [];

  // Synthesise a ToolCall from the parsed JSON
  const call: ToolCall = {
    id: `text-${Date.now()}`,
    type: 'function',
    function: {
      name: parsed.action,
      arguments: JSON.stringify(parsed.args ?? {}),
    },
  };

  return [call];
}
