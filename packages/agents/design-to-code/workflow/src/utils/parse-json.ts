/**
 * Robust JSON parser for LLM responses.
 *
 * Many LLM proxy configurations ignore `response_format: { type: 'json_object' }`
 * and return JSON wrapped in markdown code fences (```json ... ```) or with
 * surrounding prose. This utility strips all common wrappers before parsing.
 */

/**
 * Parses a JSON string that may be wrapped in markdown code fences or
 * surrounded by prose. Throws a descriptive SyntaxError on failure.
 */
export function parseJsonResponse<T = unknown>(raw: string): T {
  const cleaned = stripMarkdown(raw.trim());

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Last resort: find first `{` and last `}` (handles trailing text)
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as T;
      } catch {
        // fall through to throw below
      }
    }
    throw new SyntaxError(
      `LLM returned non-JSON response. First 200 chars: ${raw.slice(0, 200)}`
    );
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function stripMarkdown(text: string): string {
  // Remove ```json ... ``` or ``` ... ``` fences (closed)
  const fenceMatch = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenceMatch) return fenceMatch[1].trim();

  // Handle unclosed fence (response truncated before closing ```)
  // e.g. "```json\n{ ... " — extract everything after the opening fence
  const openFenceMatch = text.match(/^```(?:json)?\s*([\s\S]+)/);
  if (openFenceMatch) return openFenceMatch[1].trim();

  // Remove single backtick wrapping
  if (text.startsWith('`') && text.endsWith('`')) {
    return text.slice(1, -1).trim();
  }

  return text;
}
