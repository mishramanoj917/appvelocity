/**
 * Node 5 — IRValidatorAgent
 *
 * Evaluates the DesignIR produced by IRBuilderAgent for structural integrity,
 * semantic quality, accessibility, and naming conventions.
 *
 * On failure the graph retries IRBuilderAgent (up to 2 times) before giving up.
 *
 * Input state:  designIR, retryCount
 * Output state: validationResult, retryCount (incremented on failure), currentStep, logs
 */

import { createLLMClient } from '../utils/llm-client.js';
import { makeLogEntry } from '../utils/logger.js';
import { parseJsonResponse } from '../utils/parse-json.js';
import type { WorkflowState, IRValidationResult } from '../types.js';
import type { DesignIR, IRElement } from '@appvelocity/agent-design-to-code-core';

// ─── Context builder ──────────────────────────────────────────────────────────

interface IRSummary {
  fileName: string;
  screens: Array<{
    id: string;
    name: string;
    componentName: string;
    dimensions: string;
    elementCount: number;
    elementTypes: Record<string, number>;
    hasTextContent: boolean;
    hasImages: boolean;
  }>;
  components: Array<{
    id: string;
    name: string;
    atomicLevel: string;
    variantCount: number;
  }>;
  tokens: {
    colorCount: number;
    typographyCount: number;
    spacingCount: number;
    radiiCount: number;
  };
  assetCount: number;
  stats: DesignIR['meta']['stats'];
}

function countElementTypes(el: IRElement, acc: Record<string, number> = {}): Record<string, number> {
  acc[el.type] = (acc[el.type] ?? 0) + 1;
  for (const child of el.children) {
    countElementTypes(child, acc);
  }
  return acc;
}

function hasType(el: IRElement, type: string): boolean {
  if (el.type === type) return true;
  return el.children.some((c) => hasType(c, type));
}

function buildIRSummary(ir: DesignIR): IRSummary {
  return {
    fileName: ir.fileName,
    screens: ir.screens.map((s) => ({
      id: s.id,
      name: s.name,
      componentName: s.componentName,
      dimensions: `${s.width}×${s.height}`,
      elementCount: Object.keys(s.elementIndex).length,
      elementTypes: countElementTypes(s.root),
      hasTextContent: hasType(s.root, 'text'),
      hasImages: hasType(s.root, 'image'),
    })),
    components: ir.components.map((c) => ({
      id: c.id,
      name: c.name,
      atomicLevel: c.atomicLevel,
      variantCount: c.variants.length,
    })),
    tokens: {
      colorCount: Object.keys(ir.tokens.colors).length,
      typographyCount: Object.keys(ir.tokens.typography).length,
      spacingCount: Object.keys(ir.tokens.spacing).length,
      radiiCount: Object.keys(ir.tokens.radii).length,
    },
    assetCount: ir.assets.length,
    stats: ir.meta.stats,
  };
}

// ─── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(summary: IRSummary, retryCount: number): string {
  const retryNote =
    retryCount > 0
      ? `\nNOTE: This is retry #${retryCount}. Be strict — only pass if the IR is genuinely usable.\n`
      : '';

  return `You are a design-to-code quality critic reviewing a DesignIR (Intermediate Representation) extracted from a Figma file.

Your task: evaluate the IR for structural integrity, accessibility, naming conventions, and semantic clarity. Output a validation result that tells the code generator whether it is safe to proceed.
${retryNote}
## IR to Review
\`\`\`json
${JSON.stringify(summary, null, 2)}
\`\`\`

## Validation Criteria

### ERRORS (set valid=false, score ≤ 50) — block code generation
These are hard structural faults that make code generation impossible:
- A screen with 0 elements in elementIndex AND no child structure at all
- A screen missing a componentName (cannot produce a valid file name)
- Circular component references
- A screen wider than 2000px or taller than 5000px (desktop frame accidentally included)

### WARNINGS (severity="warning", reduce score 5–10 each) — allow generation but flag
These reduce quality but generation can still proceed with fallbacks.
IMPORTANT: ALL of the following must be rated "warning", never "error":
- No color tokens defined (hardcoded colors will be used — acceptable for MVP)
- No typography tokens defined (hardcoded styles will be used — acceptable for MVP)
- No components defined despite component instances being used in screens (generator will inline styles)
- Assets referenced but no URLs resolved (images will render as placeholders)
- Screen dimensions that don't match common mobile sizes (375, 390, 414, 360px width)
- Screen or component names containing spaces or special characters

### INFO — cosmetic, no score impact
- Component atomicLevel is ambiguous
- Fewer than 3 screens in a multi-page file
- No spacing tokens defined
- No radii tokens defined

## Scoring
Start at 100. Subtract for each issue:
- error: −25
- warning: −10
- info: 0

Minimum score is 0. Set valid=true if score ≥ 60 AND no error-severity issues exist.

## Output Format
Respond with ONLY a valid JSON object matching this exact schema:

{
  "valid": true | false,
  "score": <0–100>,
  "issues": [
    {
      "severity": "error" | "warning" | "info",
      "category": "structure" | "accessibility" | "naming" | "semantics",
      "message": "<human-readable description>",
      "nodeId": "<optional — figma node id if applicable>",
      "fixSuggestion": "<optional — how to resolve>"
    }
  ]
}

If there are no issues, return "issues": [].
Do NOT include any explanation, markdown, or keys outside the schema above.`;
}

// ─── Node ─────────────────────────────────────────────────────────────────────

export async function irValidatorAgent(
  state: WorkflowState
): Promise<Partial<WorkflowState>> {
  if (!state.designIR) {
    throw new Error(
      'DesignIR not available in state. IRBuilderAgent must run before IRValidatorAgent.'
    );
  }

  const llm = createLLMClient();
  const summary = buildIRSummary(state.designIR);
  const systemPrompt = buildSystemPrompt(summary, state.retryCount);

  // Use Gemini for Flutter (better Dart widget pattern awareness in validation)
  const model =
    state.targetFramework === 'flutter'
      ? (process.env.GEMINI_MODEL ?? 'gemini-2-0-flash')
      : (process.env.OPENAI_MODEL ?? 'gpt-4o');

  const response = await llm.chat({
    model,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Validate the DesignIR for "${state.designIR.fileName}" and return your assessment.`,
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 2048,
  });

  // Strips markdown fences if proxy ignores response_format, then parses
  const rawResult = parseJsonResponse<IRValidationResult>(response.content);

  // ── Post-process: demote "optional feature absent" issues from error → warning
  // The LLM tends to classify missing tokens/components as errors even when
  // these are optional Figma features (styles vs Variables API). Since the
  // code generator handles these gracefully with fallbacks, they must not block.
  const OPTIONAL_ABSENT_RE =
    /no\s+(color|typography|spacing|radii|assets?|components?)\s.*(token|instance|url|definition|defined|are\s+defined)/i;

  let demotedCount = 0;
  const demotedIssues = rawResult.issues.map((issue) => {
    if (issue.severity === 'error' && OPTIONAL_ABSENT_RE.test(issue.message)) {
      demotedCount++;
      return { ...issue, severity: 'warning' as const };
    }
    return issue;
  });

  // Only recompute score/valid when issues were actually demoted
  let validationResult: IRValidationResult;
  if (demotedCount > 0) {
    const errorCount = demotedIssues.filter((i) => i.severity === 'error').length;
    const warningCount = demotedIssues.filter((i) => i.severity === 'warning').length;
    const recomputedScore = Math.max(0, 100 - errorCount * 25 - warningCount * 10);
    validationResult = {
      ...rawResult,
      issues: demotedIssues,
      score: recomputedScore,
      // No blocking errors → valid. Score reflects quality but does not gate generation.
      valid: errorCount === 0,
    };
  } else {
    validationResult = rawResult;
  }

  const failed = !validationResult.valid;
  const finalErrorCount = validationResult.issues.filter((i) => i.severity === 'error').length;
  const finalWarningCount = validationResult.issues.filter((i) => i.severity === 'warning').length;

  return {
    validationResult,
    retryCount: failed ? state.retryCount + 1 : state.retryCount,
    currentStep: 'IRValidatorAgent',
    logs: [
      makeLogEntry(
        validationResult.valid ? 'success' : 'warning',
        validationResult.valid
          ? `Validation passed (score: ${validationResult.score}/100)`
          : `Validation failed (score: ${validationResult.score}/100) — ${finalErrorCount} error(s), ${finalWarningCount} warning(s)`
      ),
    ],
  };
}
