/**
 * Node 6 — CodeGeneratorAgent
 * Converts the validated DesignIR into a framework-specific CodeBundle
 * by delegating to ReactNativeGenerator or FlutterGenerator.
 *
 * Flutter enhancement: after template generation, each .dart source file is
 * sent to Gemini for idiomatic refinement (const usage, null-safety, widget
 * structure). Falls back to template output if Gemini is unavailable.
 */

import { ReactNativeGenerator, FlutterGenerator } from '@appvelocity/agent-design-to-code-generators';
import type { GenerationScope, CodeFile } from '@appvelocity/agent-design-to-code-generators';
import { createLLMClient } from '../utils/llm-client.js';
import { makeLogEntry } from '../utils/logger.js';
import type { WorkflowState } from '../types.js';

// ─── Gemini enhancement for Flutter ──────────────────────────────────────────

/**
 * Sends each generated Dart source file to Gemini for improvement.
 * Processes up to 6 files to stay within token/latency budgets.
 * Returns the full file list with improved files merged in.
 */
async function enhanceFlutterWithGemini(
  files: CodeFile[],
  model: string,
  logs: ReturnType<typeof makeLogEntry>[],
): Promise<CodeFile[]> {
  const llm = createLLMClient();

  // Only refine actual Dart source files — skip assets, README, .gitkeep
  const dartSources = files.filter(
    (f) => f.path.endsWith('.dart') && !f.path.includes('assets'),
  );

  if (dartSources.length === 0) return files;

  const toEnhance = dartSources.slice(0, 6); // cap to avoid long tail latency
  const result = [...files];
  let enhanced = 0;

  for (const file of toEnhance) {
    try {
      const response = await llm.chat({
        model,
        system: `You are a senior Flutter/Dart engineer. Refactor the following auto-generated Dart file
to production quality. Apply these improvements:
- Use const constructors wherever possible
- Ensure null-safety (no ! unless provably non-null)
- Prefer named parameters for widget constructors
- Replace magic numbers/strings with named values
- Use proper Flutter widget lifecycle patterns
- Fix any obvious structural issues

Return ONLY the raw Dart source code. No markdown fences, no explanation.`,
        messages: [{ role: 'user', content: `// File: ${file.path}\n\n${file.content}` }],
        max_tokens: 4096,
      });

      const improved = response.content.trim();
      if (improved.length > 50) {
        // sanity check — don't replace with empty or error text
        const idx = result.findIndex((f) => f.path === file.path);
        if (idx >= 0) result[idx] = { ...file, content: improved };
        enhanced++;
      }
    } catch (err) {
      logs.push(makeLogEntry('warning', `Gemini enhancement skipped for ${file.path}: ${String(err)}`));
    }
  }

  if (enhanced > 0) {
    logs.push(makeLogEntry('success', `Gemini enhanced ${enhanced} Flutter source file(s)`));
  }

  return result;
}

// ─── Node ─────────────────────────────────────────────────────────────────────

export async function codeGeneratorAgent(
  state: WorkflowState,
): Promise<Partial<WorkflowState>> {
  if (!state.designIR) {
    throw new Error(
      'DesignIR not available in state. IRBuilderAgent must run before CodeGeneratorAgent.',
    );
  }
  if (!state.executionPlan) {
    throw new Error(
      'ExecutionPlan not available in state. GenerationPlannerAgent must run before CodeGeneratorAgent.',
    );
  }

  const scope: GenerationScope = {
    screens:    state.executionPlan.screens,
    components: state.executionPlan.components,
    priority:   state.executionPlan.priority,
  };

  const generator =
    state.targetFramework === 'react-native'
      ? new ReactNativeGenerator()
      : new FlutterGenerator();

  const result = generator.generate(state.designIR, scope, {
    includeTests: state.options.includeTests,
  });

  const logs = [
    makeLogEntry(
      'success',
      `Generated ${result.stats.fileCount} files — ${result.stats.screenCount} screen(s), ${result.stats.componentCount} component(s), ${result.stats.assetCount} asset(s)`,
    ),
    ...result.warnings.map((w) => makeLogEntry('warning', w)),
  ];

  // Flutter: send generated Dart files through Gemini for idiomatic refinement
  if (state.targetFramework === 'flutter') {
    const model = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';
    logs.push(makeLogEntry('info', `Sending Flutter files to Gemini (${model}) for enhancement…`));
    result.bundle.files = await enhanceFlutterWithGemini(result.bundle.files, model, logs);
  }

  return {
    generatedCode: result.bundle,
    currentStep: 'CodeGeneratorAgent',
    logs,
  };
}
