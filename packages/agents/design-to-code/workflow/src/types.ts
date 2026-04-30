/**
 * WorkflowState and supporting types for the DesignToCode LangGraph workflow.
 */

import type { AgentError } from '@appvelocity/shared-core';
import type { FigmaFile, DesignIR, FigmaVariablesResponse } from '@appvelocity/agent-design-to-code-core';
import type { CodeBundle } from '@appvelocity/agent-design-to-code-generators';

export type { AgentError };

// ─── Core workflow state ──────────────────────────────────────────────────────

export interface WorkflowState {
  // Input (from user)
  figmaUrl: string;
  targetFramework: 'react-native' | 'flutter';
  generationMode: 'project' | 'screens';
  stateManagement: string; // e.g. 'riverpod'|'bloc'|'provider'|'zustand'|'redux'|'jotai'|'none'
  options: {
    dryRun?: boolean;
    verbose?: boolean;
    includeTests?: boolean;
  };

  // Intermediate data (populated by nodes)
  figmaFile?: FigmaFile;
  variablesResponse?: FigmaVariablesResponse;
  visualAnalysis?: VisualAnalysis;  // from designAnalyzer
  designIR?: DesignIR;
  executionPlan?: ExecutionPlan;
  validationResult?: IRValidationResult;

  // Output (screen/component files — legacy; full project uses projectBundle)
  generatedCode?: CodeBundle;

  // Full project bundle (populated by projectAssembler)
  projectBundle?: ProjectBundle;

  // Code validation (populated by codeValidator / codeFixer)
  codeValidationResult?: CodeValidationResult;

  // Compilation validation (populated by compilationValidator / compilationFixer)
  compilationResult?: CompilationResult;

  // Final ZIP bytes (populated by projectZipper)
  zipBuffer?: Buffer;

  // Error tracking
  errors: AgentError[];
  retryCount: number;
  codeValidationRetryCount: number;
  compilationRetryCount: number;

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
  projectName: string;
  navigationFlow: NavigationEdge[];
  entryScreen: string;
}

export interface NavigationEdge {
  from: string;
  to: string;
  trigger: string; // e.g. 'onLoad', 'onLogin', 'onItemTap', 'onBack'
}

// ─── Visual analysis (from designAnalyzer / Vision-Parser step) ───────────────

export interface VisualAnalysis {
  spacingUnit: number;        // detected grid (4 or 8 pt)
  layoutHints: LayoutHint[];  // per-node direction overrides from vision LLM
  iconNodeIds: string[];      // confirmed icon nodes (exported as SVG)
  imageNodeIds: string[];     // confirmed image nodes (exported as PNG)
  fontFamilies: string[];     // detected font names
  colorPalette: string[];     // hex values seen in the design
  /** Figma CDN export URLs for icon nodes: nodeId → CDN URL (SVG) */
  iconUrls?: Record<string, string>;
  /** Figma CDN export URLs for image nodes: nodeId → CDN URL (PNG 2x) */
  imageUrls?: Record<string, string>;
}

export interface LayoutHint {
  nodeId: string;
  direction: 'row' | 'column';
  scrollable: boolean;
}

// ─── Project bundle (full project output from projectAssembler) ───────────────

export interface ProjectBundle {
  projectName: string;
  framework: 'flutter' | 'react-native';
  files: ProjectFile[];
  assets: ProjectAsset[];
  dependencies: Record<string, string>;
}

export interface ProjectFile {
  path: string;
  content: string;
  language: 'dart' | 'typescript' | 'javascript' | 'yaml' | 'json' | 'text';
}

export interface ProjectAsset {
  path: string;
  url?: string;        // CDN URL to download at build time
  content?: string;    // base64-encoded bytes for binary assets
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

// ─── Code validation ──────────────────────────────────────────────────────────

export interface CodeIssue {
  severity: 'error' | 'warning';
  type: 'syntax' | 'lint' | 'format' | 'import';
  file: string;
  line?: number;
  column?: number;
  message: string;
  fixable: boolean;
  rule?: string;
}

export interface CodeValidationResult {
  valid: boolean;
  fixableIssues: CodeIssue[];
  criticalIssues: CodeIssue[];
  framework: 'react-native' | 'flutter';
  checkedFiles: number;
}

// ─── Compilation validation ───────────────────────────────────────────────────

export interface CompilationResult {
  success: boolean;
  errors: CompileError[];
  warnings: CompileWarning[];
  tool: 'flutter-analyze' | 'tsc';
  retryCount: number;
}

export interface CompileError {
  file: string;
  line: number;
  col: number;
  message: string;
  code?: string;
}

export interface CompileWarning {
  file: string;
  line: number;
  message: string;
}

// ─── Code generation output (canonical definitions live in generators package) ─

export type { CodeBundle, CodeFile, AssetFile } from '@appvelocity/agent-design-to-code-generators';

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
  content: string | LLMContentPart[];
}

export interface LLMContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

export interface LLMChatOptions {
  model: string;
  messages: LLMMessage[];
  system?: string;
  response_format?: { type: 'json_object' | 'text' };
  max_tokens?: number;
  tools?: ToolDefinition[];
  tool_choice?: 'auto' | 'none';
}

export interface LLMResponse {
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  toolCalls?: ToolCall[];
  finishReason?: 'stop' | 'tool_calls' | 'length';
}

export interface LLMClient {
  chat(options: LLMChatOptions): Promise<LLMResponse>;
}

// ─── Tool calling types (OpenAI function calling format) ──────────────────────

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>; // JSON Schema object
  };
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface ToolResult {
  success: boolean;
  summary: string;        // ≤200 tokens — what the orchestrator sees
  error?: string;         // present when success=false
}
