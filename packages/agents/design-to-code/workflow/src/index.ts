/**
 * @appvelocity/agent-design-to-code-workflow
 * Phase 3: LLM-orchestrated ReAct agent loop
 */

export { DesignToCodeAgent } from './agent.js';
export { runAgentLoop }      from './agent-loop.js';
export { AgentMemory }       from './agent-memory.js';
export type { AgentInput, AgentOutput } from './agent-memory.js';

export type {
  WorkflowState,
  ExecutionPlan,
  IRValidationResult,
  ValidationIssue,
  CodeIssue,
  CodeValidationResult,
  CodeBundle,
  CodeFile,
  AssetFile,
  LogEntry,
  LLMClient,
  LLMChatOptions,
  LLMResponse,
} from './types.js';

export { createLLMClient, setLLMClient } from './utils/llm-client.js';

export { analyzeDesignQuality } from './nodes/quality-analyzer.js';
export { runDesignAudit, FigmaAuthError, FigmaApiError, InvalidFigmaUrlError } from './nodes/quality-audit.js';
export type { DesignQualityReport, DesignIssue, QualitySuggestion, IssueCategory } from './types.js';

export { inputValidator } from './nodes/input-validator.js';
export { generationPlannerAgent } from './nodes/generation-planner.js';
export { figmaFetcherAgent } from './nodes/figma-fetcher.js';
export { irBuilderAgent } from './nodes/ir-builder.js';
export { irValidatorAgent } from './nodes/ir-validator.js';
export { codeGeneratorAgent } from './nodes/code-generator.js';
export { codeValidatorAgent } from './nodes/code-validator.js';
export { codeFixerAgent } from './nodes/code-fixer.js';
