/**
 * LangGraph StateGraph — DesignToCode workflow (13 nodes).
 *
 * Pipeline:
 *   inputValidator → figmaFetcher → designAnalyzer → generationPlanner
 *   → irBuilder → irValidator (↻ retry→irBuilder)
 *   → codeGenerator → projectAssembler (project mode only)
 *   → codeValidator → codeFixer (↻ retry→codeValidator)
 *   → compilationValidator → compilationFixer (↻ retry→compilationValidator)
 *   → projectZipper → END
 *
 * Non-fatal nodes:
 *   designAnalyzer — vision LLM failure sets visualAnalysis=undefined, pipeline continues
 *
 * Retry budgets:
 *   irValidator → irBuilder:                  max 2 retries
 *   codeValidator → codeFixer:                max 2 retries
 *   compilationValidator → compilationFixer:  max 3 retries
 */

import { StateGraph, Annotation, END, START } from '@langchain/langgraph';
import type { AgentError, LogEntry, WorkflowState } from './types.js';
import { inputValidator }          from './nodes/input-validator.js';
import { figmaFetcherAgent }       from './nodes/figma-fetcher.js';
import { designAnalyzerAgent }     from './nodes/design-analyzer.js';
import { generationPlannerAgent }  from './nodes/generation-planner.js';
import { irBuilderAgent }          from './nodes/ir-builder.js';
import { irValidatorAgent }        from './nodes/ir-validator.js';
import { codeGeneratorAgent }      from './nodes/code-generator.js';
import { projectAssemblerAgent }   from './nodes/project-assembler.js';
import { codeValidatorAgent }      from './nodes/code-validator.js';
import { codeFixerAgent }          from './nodes/code-fixer.js';
import { compilationValidatorAgent } from './nodes/compilation-validator.js';
import { compilationFixerAgent }   from './nodes/compilation-fixer.js';
import { projectZipperAgent }      from './nodes/project-zipper.js';

// ─── Error-boundary wrapper ───────────────────────────────────────────────────

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

// ─── State annotation ─────────────────────────────────────────────────────────

export const WorkflowAnnotation = Annotation.Root({
  figmaUrl:             Annotation<string>(),
  targetFramework:      Annotation<WorkflowState['targetFramework']>(),
  generationMode:       Annotation<WorkflowState['generationMode']>(),
  stateManagement:      Annotation<string>(),
  options:              Annotation<WorkflowState['options']>(),
  figmaFile:            Annotation<WorkflowState['figmaFile']>(),
  variablesResponse:    Annotation<WorkflowState['variablesResponse']>(),
  visualAnalysis:       Annotation<WorkflowState['visualAnalysis']>(),
  designIR:             Annotation<WorkflowState['designIR']>(),
  executionPlan:        Annotation<WorkflowState['executionPlan']>(),
  validationResult:     Annotation<WorkflowState['validationResult']>(),
  generatedCode:        Annotation<WorkflowState['generatedCode']>(),
  projectBundle:        Annotation<WorkflowState['projectBundle']>(),
  codeValidationResult: Annotation<WorkflowState['codeValidationResult']>(),
  compilationResult:    Annotation<WorkflowState['compilationResult']>(),
  zipBuffer:            Annotation<WorkflowState['zipBuffer']>(),
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
  compilationRetryCount: Annotation<number>({
    reducer: (_, update) => update,
    default: () => 0,
  }),
  currentStep: Annotation<string>(),
  logs: Annotation<LogEntry[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
});

// ─── Helper: has fatal errors ─────────────────────────────────────────────────

const hasFatalErrors = (state: WorkflowState) => state.errors.length > 0;

// ─── Graph ────────────────────────────────────────────────────────────────────

export const compiledWorkflow = new StateGraph(WorkflowAnnotation)
  // ── Nodes ────────────────────────────────────────────────────────────────────
  .addNode('inputValidator',        withErrorBoundary('inputValidator',        inputValidator))
  .addNode('figmaFetcher',          withErrorBoundary('figmaFetcher',          figmaFetcherAgent))
  .addNode('designAnalyzer',        withErrorBoundary('designAnalyzer',        designAnalyzerAgent))
  .addNode('generationPlanner',     withErrorBoundary('generationPlanner',     generationPlannerAgent))
  .addNode('irBuilder',             withErrorBoundary('irBuilder',             irBuilderAgent))
  .addNode('irValidator',           withErrorBoundary('irValidator',           irValidatorAgent))
  .addNode('codeGenerator',         withErrorBoundary('codeGenerator',         codeGeneratorAgent))
  .addNode('projectAssembler',      withErrorBoundary('projectAssembler',      projectAssemblerAgent))
  .addNode('codeValidator',         withErrorBoundary('codeValidator',         codeValidatorAgent))
  .addNode('codeFixer',             withErrorBoundary('codeFixer',             codeFixerAgent))
  .addNode('compilationValidator',  withErrorBoundary('compilationValidator',  compilationValidatorAgent))
  .addNode('compilationFixer',      withErrorBoundary('compilationFixer',      compilationFixerAgent))
  .addNode('projectZipper',         withErrorBoundary('projectZipper',         projectZipperAgent))

  // ── Edges ─────────────────────────────────────────────────────────────────────
  .addEdge(START, 'inputValidator')

  // inputValidator → figmaFetcher (or END on error)
  .addConditionalEdges('inputValidator', (s) => hasFatalErrors(s) ? END : 'figmaFetcher')

  // figmaFetcher → designAnalyzer (always — designAnalyzer is non-fatal)
  .addConditionalEdges('figmaFetcher', (s) => hasFatalErrors(s) ? END : 'designAnalyzer')

  // designAnalyzer → generationPlanner (even if vision failed — visualAnalysis may be undefined)
  .addEdge('designAnalyzer', 'generationPlanner')

  // generationPlanner → irBuilder (or END)
  .addConditionalEdges('generationPlanner', (s) => hasFatalErrors(s) ? END : 'irBuilder')

  // irBuilder → irValidator (or END)
  .addConditionalEdges('irBuilder', (s) => hasFatalErrors(s) ? END : 'irValidator')

  // irValidator → irBuilder (retry) or codeGenerator
  .addConditionalEdges('irValidator', (s) => {
    if (hasFatalErrors(s)) return END;
    if (!s.validationResult?.valid && s.retryCount < 2) return 'irBuilder';
    return 'codeGenerator';
  })

  // codeGenerator → projectAssembler (project mode) OR codeValidator (screens mode)
  .addConditionalEdges('codeGenerator', (s) => {
    if (hasFatalErrors(s)) return END;
    return s.generationMode === 'project' ? 'projectAssembler' : 'codeValidator';
  })

  // projectAssembler → codeValidator (or END)
  .addConditionalEdges('projectAssembler', (s) => hasFatalErrors(s) ? END : 'codeValidator')

  // codeValidator → codeFixer (fixable issues) or compilationValidator
  .addConditionalEdges('codeValidator', (s) => {
    if (hasFatalErrors(s)) return END;
    const cv = s.codeValidationResult;
    if (cv && cv.fixableIssues.length > 0 && s.codeValidationRetryCount < 2) return 'codeFixer';
    return 'compilationValidator';
  })

  // codeFixer always loops back to codeValidator
  .addEdge('codeFixer', 'codeValidator')

  // compilationValidator → compilationFixer (errors + budget) or projectZipper
  .addConditionalEdges('compilationValidator', (s) => {
    if (hasFatalErrors(s)) return END;
    const cr = s.compilationResult;
    if (cr && !cr.success && cr.errors.length > 0 && (cr.retryCount ?? 0) < 3) {
      return 'compilationFixer';
    }
    return 'projectZipper';
  })

  // compilationFixer loops back to compilationValidator
  .addEdge('compilationFixer', 'compilationValidator')

  // projectZipper → END
  .addEdge('projectZipper', END)

  .compile();
