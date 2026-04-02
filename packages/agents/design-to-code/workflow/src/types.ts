/**
 * WorkflowState and supporting types for the DesignToCode LangGraph workflow.
 */

import type { AgentError } from '@appvelocity/shared-core';
import type { FigmaFile, DesignIR, FigmaVariablesResponse } from '@appvelocity/agent-design-to-code-core';

export type { AgentError };

// ─── Core workflow state ──────────────────────────────────────────────────────

export interface WorkflowState {
  // Input (from user)
  figmaUrl: string;
  targetFramework: 'react-native' | 'flutter';
  options: {
    dryRun?: boolean;
    verbose?: boolean;
    includeTests?: boolean;
  };

  // Intermediate data (populated by nodes)
  figmaFile?: FigmaFile;
  variablesResponse?: FigmaVariablesResponse;
  designIR?: DesignIR;
  executionPlan?: ExecutionPlan;
  validationResult?: IRValidationResult;

  // Output (final deliverable)
  generatedCode?: CodeBundle;

  // Error tracking
  errors: AgentError[];
  retryCount: number;

  // Progress tracking
  currentStep: string;
  logs: LogEntry[];
}

// ─── Execution plan ───────────────────────────────────────────────────────────

export interface ExecutionPlan {
  screens: string[];
  components: string[];
  priority: 'screens-first' | 'components-first';
  estimatedDuration: number;
}

// ─── IR validation ────────────────────────────────────────────────────────────

export interface IRValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  score: number;
}

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  category: 'structure' | 'accessibility' | 'naming' | 'semantics';
  message: string;
  nodeId?: string;
  fixSuggestion?: string;
}

// ─── Code generation output ───────────────────────────────────────────────────

export interface CodeBundle {
  framework: 'react-native' | 'flutter';
  files: CodeFile[];
  assets: AssetFile[];
  dependencies: Record<string, string>;
}

export interface CodeFile {
  path: string;
  content: string;
  language: 'typescript' | 'dart';
}

export interface AssetFile {
  path: string;
  url: string;
}

// ─── Logging ─────────────────────────────────────────────────────────────────

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
  nodeId?: string;
}

// ─── LLM client interface ─────────────────────────────────────────────────────

export interface LLMMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LLMChatOptions {
  model: string;
  messages: LLMMessage[];
  system?: string;
  response_format?: { type: 'json_object' | 'text' };
  max_tokens?: number;
}

export interface LLMResponse {
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface LLMClient {
  chat(options: LLMChatOptions): Promise<LLMResponse>;
}
