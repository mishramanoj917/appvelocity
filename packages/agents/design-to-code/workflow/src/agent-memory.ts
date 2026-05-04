/**
 * AgentMemory — the growing project state the ReAct agent loop maintains.
 *
 * The orchestrator LLM never sees raw file contents — only the compact
 * summary() string (~500 tokens). Full content lives here and is passed
 * directly between tool functions.
 */

import { randomUUID } from 'node:crypto';
import type {
  FigmaFile,
  DesignIR,
  FigmaVariablesResponse,
} from '@appvelocity/agent-design-to-code-core';
import { SnapshotManager } from '@appvelocity/agent-design-to-code-core';
import type {
  VisualAnalysis,
  ExecutionPlan,
  ProjectBundle,
  CompilationResult,
  AgentError,
  LLMMessage,
  ToolCall,
  ToolResult,
} from './types.js';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Rendered geometry data exported by the Figma Plugin.
 * Provides actual post-layout bounds (text wrap, effects) for each node.
 */
export interface PluginRenderedBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Payload extracted from an appvelocity-export.zip uploaded by the user.
 * Supplements the REST API file tree with exact rendered geometry and
 * reliable asset PNG bytes (no CDN URL expiry).
 */
export interface PluginExportData {
  /** nodeId → actual rendered bounds after text wrap, effects, overflow */
  renderedBounds: Record<string, PluginRenderedBounds>;
  /** componentId → variant properties */
  variantProperties: Record<string, Record<string, string>>;
  /** nodeId → absolute path on disk where the PNG was written */
  assetPaths: Record<string, string>;
}

export interface AgentInput {
  figmaUrl: string;
  targetFramework: 'react-native' | 'flutter';
  generationMode: 'project' | 'screens';
  stateManagement: string;
  /** Auto-generated if not supplied. Used as the workspace sub-directory name. */
  sessionId?: string;
  options?: { dryRun?: boolean; verbose?: boolean; includeTests?: boolean };
  /**
   * Optional: data extracted from an appvelocity-export.zip uploaded by the user.
   * When present, rendered bounds override REST API absoluteBoundingBox for text
   * nodes and image nodes use local PNG paths instead of CDN URLs.
   */
  pluginExport?: PluginExportData;
}

export interface AgentOutput {
  success: boolean;
  zipBuffer?: Buffer;
  projectBundle?: ProjectBundle;
  errors: AgentError[];
  iterations: number;
  logs: string[];
}

// ─── AgentMemory ──────────────────────────────────────────────────────────────

export class AgentMemory {
  // Input (immutable after init)
  readonly input: AgentInput;

  // Session identity — used as workspace/{sessionId}/ directory name
  readonly sessionId: string;

  // Snapshot manager — all agents use this to read/write workspace files
  readonly snapshotManager: SnapshotManager;

  // True once figmaFile has been loaded (from snapshot or API); prevents double-fetch
  snapshotLoaded = false;

  // Accumulated project state
  figmaFile?: FigmaFile;
  variablesResponse?: FigmaVariablesResponse;
  visualAnalysis?: VisualAnalysis;
  designIR?: DesignIR;
  executionPlan?: ExecutionPlan;
  generatedFiles = new Map<string, string>(); // path → content
  projectBundle?: ProjectBundle;
  compilationResult?: CompilationResult;
  zipBuffer?: Buffer;

  // Conversation history the orchestrator uses to reason
  messages: LLMMessage[] = [];

  // Metadata
  iteration = 0;
  toolCallCounts = new Map<string, number>();
  errors: AgentError[] = [];
  logs: string[] = [];

  private constructor(input: AgentInput) {
    this.input = input;
    this.sessionId = input.sessionId ?? randomUUID();
    this.snapshotManager = new SnapshotManager();
  }

  static init(input: AgentInput): AgentMemory {
    return new AgentMemory(input);
  }

  // ─── Summary (compact state for system prompt injection) ─────────────────────

  summary(): string {
    const lines: string[] = [`PROJECT STATE (session: ${this.sessionId.slice(0, 8)}):`];

    // Figma
    if (this.figmaFile) {
      const screens = this.designIR?.screens?.length ?? '?';
      const comps   = this.designIR?.components?.length ?? '?';
      lines.push(`- Figma: fetched (${screens} screens, ${comps} components)`);
    } else {
      lines.push('- Figma: NOT fetched');
    }

    // Visual analysis
    if (this.visualAnalysis) {
      lines.push(
        `- Visual analysis: done (spacing=${this.visualAnalysis.spacingUnit}pt, ` +
        `icons=${this.visualAnalysis.iconNodeIds.length}, ` +
        `images=${this.visualAnalysis.imageNodeIds.length})`
      );
    } else if (this.figmaFile) {
      lines.push('- Visual analysis: skipped or failed');
    }

    // IR
    if (this.designIR) {
      lines.push(`- Design IR: built (screens: [${this.designIR.screens.map(s => s.componentName).join(', ')}])`);
    } else if (this.figmaFile) {
      lines.push('- Design IR: NOT built');
    }

    // Execution plan
    if (this.executionPlan) {
      lines.push(`- Plan: "${this.executionPlan.projectName}", entry="${this.executionPlan.entryScreen}"`);
    } else if (this.designIR) {
      lines.push('- Plan: NOT created');
    }

    // Generated files
    const totalExpected = (this.executionPlan?.screens?.length ?? 0) +
                          (this.executionPlan?.components?.length ?? 0);
    const generated = this.generatedFiles.size;
    if (generated > 0) {
      const names = [...this.generatedFiles.keys()].slice(0, 5).map(p => p.split('/').pop()).join(', ');
      const more  = generated > 5 ? ` +${generated - 5} more` : '';
      lines.push(`- Generated files: ${generated}/${totalExpected || '?'} (${names}${more})`);
    } else if (this.executionPlan) {
      lines.push('- Generated files: 0 — not started');
    }

    // Project bundle (assembled)
    if (this.projectBundle) {
      lines.push(`- Project bundle: assembled (${this.projectBundle.files.length} files)`);
    } else if (generated > 0) {
      lines.push('- Project bundle: NOT assembled');
    }

    // Compilation
    if (this.compilationResult) {
      if (this.compilationResult.success) {
        lines.push('- Compilation: PASSED');
      } else {
        const summary = this.compilationResult.errors
          .slice(0, 3)
          .map(e => `${e.file}:${e.line}: ${e.message.slice(0, 60)}`)
          .join('; ');
        lines.push(`- Compilation: FAILED (${this.compilationResult.errors.length} errors) — ${summary}`);
      }
    } else if (this.projectBundle) {
      lines.push('- Compilation: NOT checked');
    }

    // ZIP
    if (this.zipBuffer) {
      lines.push(`- ZIP: created (${Math.round(this.zipBuffer.length / 1024)} KB)`);
    } else if (this.projectBundle) {
      lines.push('- ZIP: NOT created');
    }

    // Errors
    if (this.errors.length > 0) {
      lines.push(`- Errors: ${this.errors.length} (last: ${this.errors.at(-1)?.message?.slice(0, 80)})`);
    }

    lines.push(`- Iteration: ${this.iteration}`);
    return lines.join('\n');
  }

  // ─── Record a tool call + result into conversation history ───────────────────

  addObservation(toolCall: ToolCall, result: ToolResult): void {
    // Track how many times this tool has been called
    const count = (this.toolCallCounts.get(toolCall.function.name) ?? 0) + 1;
    this.toolCallCounts.set(toolCall.function.name, count);

    // Append as user message (observation) to conversation
    const observation =
      `Tool: ${toolCall.function.name}\n` +
      `Args: ${toolCall.function.arguments}\n` +
      `Result: ${result.success ? 'OK' : 'ERROR'} — ${result.summary}` +
      (result.error ? `\nError detail: ${result.error}` : '');

    this.messages.push({ role: 'user', content: observation });
    this.logs.push(`[iter ${this.iteration}] ${toolCall.function.name}: ${result.summary}`);
  }

  addAssistantMessage(content: string): void {
    this.messages.push({ role: 'assistant', content });
  }

  // ─── Guard: has this tool been called too many times? ────────────────────────

  isOverLimit(toolName: string, limit = 5): boolean {
    return (this.toolCallCounts.get(toolName) ?? 0) >= limit;
  }

  // ─── Final output ─────────────────────────────────────────────────────────────

  finalOutput(): AgentOutput {
    return {
      success: !!this.zipBuffer && this.errors.length === 0,
      zipBuffer: this.zipBuffer,
      projectBundle: this.projectBundle,
      errors: this.errors,
      iterations: this.iteration,
      logs: this.logs,
    };
  }
}
