/**
 * LangGraph StateGraph definition for the DesignToCode workflow.
 *
 * Nodes: inputValidator → figmaFetcher → generationPlanner → irBuilder → irValidator → codeGenerator → codeValidator → codeFixer → END
 *
 * Retry loops:
 *   irValidator  → irBuilder     (max 2 retries on IR validation failure)
 *   codeValidator → codeFixer    (max 2 retries when fixable code issues are found)
 *
 * Node ordering rationale:
 *   figmaFetcher runs BEFORE generationPlanner so that generationPlannerAgent has the actual
 *   FigmaFile structure (pages, screens, component IDs) to reason over.
 *   codeValidator runs AFTER codeGenerator to ensure deterministic syntax / lint checks
 *   before the bundle is returned to the caller.
 */

import { StateGraph, Annotation, END, START } from '@langchain/langgraph';
import type { AgentError, LogEntry, WorkflowState } from './types.js';
import { inputValidator } from './nodes/input-validator.js';
import { generationPlannerAgent } from './nodes/generation-planner.js';
import { figmaFetcherAgent } from './nodes/figma-fetcher.js';
import { irBuilderAgent } from './nodes/ir-builder.js';
import { irValidatorAgent } from './nodes/ir-validator.js';
import { codeGeneratorAgent } from './nodes/code-generator.js';
import { codeValidatorAgent } from './nodes/code-validator.js';
import { codeFixerAgent } from './nodes/code-fixer.js';

// ─── Error-boundary wrapper ───────────────────────────────────────────────────
// Catches any node-level exception and injects it into state.errors so the
// graph can terminate gracefully instead of crashing the caller.

type NodeFn = (state: WorkflowState) => Promise<Partial<WorkflowState>>;

function withErrorBoundary(nodeName: string, fn: NodeFn): NodeFn {
  return async (state: WorkflowState): Promise<Partial<WorkflowState>> => {
    try {
      return await fn(state);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const error: AgentError = {
        code: `${nodeName.toUpperCase()}_ERROR`,
        message,
        recoverable: false,
        details: err instanceof Error ? { stack: err.stack } : undefined,
      };
      return {
        errors: [error],
        currentStep: nodeName,
        logs: [
          {
            level: 'error',
            message: `[${nodeName}] ${message}`,
            timestamp: new Date().toISOString(),
          } as LogEntry,
        ],
      };
    }
  };
}

// ─── State annotation (append reducers for arrays) ────────────────────────────

export const WorkflowAnnotation = Annotation.Root({
  figmaUrl: Annotation<string>(),
  targetFramework: Annotation<WorkflowState['targetFramework']>(),
  options: Annotation<WorkflowState['options']>(),
  figmaFile: Annotation<WorkflowState['figmaFile']>(),
  variablesResponse: Annotation<WorkflowState['variablesResponse']>(),
  designIR: Annotation<WorkflowState['designIR']>(),
  executionPlan: Annotation<WorkflowState['executionPlan']>(),
  validationResult: Annotation<WorkflowState['validationResult']>(),
  generatedCode: Annotation<WorkflowState['generatedCode']>(),
  codeValidationResult: Annotation<WorkflowState['codeValidationResult']>(),
  // Append reducers so each node contributes new entries without overwriting
  errors: Annotation<AgentError[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
  retryCount: Annotation<number>({
    reducer: (_, update) => update,
    default: () => 0,
  }),
  codeValidationRetryCount: Annotation<number>({
    reducer: (_, update) => update,
    default: () => 0,
  }),
  currentStep: Annotation<string>(),
  logs: Annotation<LogEntry[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
});

// ─── Graph definition (method-chaining preserves node name types) ─────────────

export const compiledWorkflow = new StateGraph(WorkflowAnnotation)
  .addNode('inputValidator',    withErrorBoundary('inputValidator',    inputValidator))
  .addNode('figmaFetcher',      withErrorBoundary('figmaFetcher',      figmaFetcherAgent))
  .addNode('generationPlanner', withErrorBoundary('generationPlanner', generationPlannerAgent))
  .addNode('irBuilder',         withErrorBoundary('irBuilder',         irBuilderAgent))
  .addNode('irValidator',       withErrorBoundary('irValidator',       irValidatorAgent))
  .addNode('codeGenerator',     withErrorBoundary('codeGenerator',     codeGeneratorAgent))
  .addNode('codeValidator',     withErrorBoundary('codeValidator',     codeValidatorAgent))
  .addNode('codeFixer',         withErrorBoundary('codeFixer',         codeFixerAgent))
  .addEdge(START, 'inputValidator')
  // After inputValidator: bail on errors, else fetch Figma data first
  .addConditionalEdges('inputValidator', (state) =>
    state.errors.length > 0 ? END : 'figmaFetcher'
  )
  // figmaFetcher → generationPlanner (planner now has figmaFile to reason over)
  .addConditionalEdges('figmaFetcher', (state) =>
    state.errors.length > 0 ? END : 'generationPlanner'
  )
  .addConditionalEdges('generationPlanner', (state) =>
    state.errors.length > 0 ? END : 'irBuilder'
  )
  .addConditionalEdges('irBuilder', (state) =>
    state.errors.length > 0 ? END : 'irValidator'
  )
  .addConditionalEdges('irValidator', (state) => {
    if (state.errors.length > 0) return END;
    if (!state.validationResult?.valid && state.retryCount < 2) {
      return 'irBuilder'; // retry
    }
    // Always proceed to code generation after retries — even when the IR has
    // quality issues.  The code generator handles imperfect IRs gracefully (per-screen
    // try/catch) and always emits token files.  Silently routing to END here is what
    // produced the "No files were generated" empty-bundle message.
    return 'codeGenerator';
  })
  // codeGenerator → codeValidator (always validate before returning to caller)
  .addConditionalEdges('codeGenerator', (state) =>
    state.errors.length > 0 ? END : 'codeValidator'
  )
  // codeValidator → codeFixer when fixable issues remain and budget allows; else END
  .addConditionalEdges('codeValidator', (state) => {
    if (state.errors.length > 0) return END;
    const cv = state.codeValidationResult;
    if (cv && cv.fixableIssues.length > 0 && state.codeValidationRetryCount < 2) {
      return 'codeFixer';
    }
    return END;
  })
  // codeFixer always loops back to re-validate the fixed bundle
  .addEdge('codeFixer', 'codeValidator')
  .compile();
