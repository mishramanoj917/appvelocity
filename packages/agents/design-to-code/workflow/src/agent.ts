/**
 * DesignToCodeAgent — AgentBase adapter for the ReAct agent loop.
 *
 * Replaces the LangGraph compiledWorkflow with runAgentLoop — a true
 * LLM-orchestrated ReAct loop where the LLM dynamically picks tools.
 *
 * Expected input.params:
 *   figmaUrl        string   — Figma file/frame URL
 *   targetFramework string   — 'react-native' | 'flutter'
 *   generationMode  string   — 'project' | 'screens'
 *   stateManagement string   — 'zustand'|'redux'|'jotai'|'riverpod'|'bloc'|'provider'|'none'
 */

import {
  AgentBase,
  type AgentInput,
  type AgentOutput,
  type ValidationResult,
  type CostEstimate,
} from '@appvelocity/shared-core';
import { runAgentLoop }  from './agent-loop.js';
import type { AgentInput as LoopInput } from './agent-memory.js';

export class DesignToCodeAgent extends AgentBase {
  readonly name = 'DesignToCodeAgent';
  readonly version = '0.2.0';
  readonly description =
    'Converts a Figma design URL into production-ready React Native or Flutter code via an LLM-orchestrated ReAct agent loop.';
  readonly capabilities = [
    'Figma → DesignIR extraction',
    'LLM-orchestrated code generation with dynamic tool selection',
    'React Native code generation',
    'Flutter code generation',
    'Design token extraction',
    'Multi-gate syntax and compilation validation',
    'Targeted repair loop with regression guard',
    'ZIP project delivery',
  ];

  async execute(input: AgentInput): Promise<AgentOutput> {
    const startTime = Date.now();

    const figmaUrl        = input.params['figmaUrl'] as string | undefined;
    const targetFramework = (input.params['targetFramework'] as string | undefined) ?? 'react-native';
    const generationMode  = (input.params['generationMode']  as string | undefined) ?? 'project';
    const stateManagement = (input.params['stateManagement'] as string | undefined) ?? 'none';

    if (!figmaUrl) {
      return this.buildOutput(false, null, startTime, [
        { code: 'MISSING_PARAM', message: 'figmaUrl is required', recoverable: false },
      ]);
    }

    const loopInput: LoopInput = {
      figmaUrl,
      targetFramework: targetFramework as LoopInput['targetFramework'],
      generationMode:  generationMode  as LoopInput['generationMode'],
      stateManagement,
      options: {
        dryRun:       input.options?.dryRun,
        verbose:      input.options?.verbose,
        includeTests: input.params['includeTests'] as boolean | undefined,
      },
    };

    const onStep = input.context?.onStep;

    try {
      const result = await runAgentLoop(loopInput, {
        onStep: (toolName, iteration) => onStep?.(`${toolName} [iter ${iteration}]`),
      });

      return this.buildOutput(
        result.success,
        {
          zipBuffer:     result.zipBuffer,
          projectBundle: result.projectBundle,
          iterations:    result.iterations,
          logs:          result.logs,
        },
        startTime,
        result.errors.length > 0 ? result.errors : undefined
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.buildOutput(false, null, startTime, [
        { code: 'AGENT_LOOP_ERROR', message, recoverable: false },
      ]);
    }
  }

  validate(input: AgentInput): ValidationResult {
    const errors: string[] = [];
    if (!input.params['figmaUrl']) errors.push('figmaUrl is required');
    const fw = input.params['targetFramework'];
    if (fw && fw !== 'react-native' && fw !== 'flutter') {
      errors.push("targetFramework must be 'react-native' or 'flutter'");
    }
    const gm = input.params['generationMode'];
    if (gm && gm !== 'project' && gm !== 'screens') {
      errors.push("generationMode must be 'project' or 'screens'");
    }
    return { valid: errors.length === 0, errors: errors.length ? errors : undefined };
  }

  estimateCost(_input: AgentInput): CostEstimate {
    return {
      estimatedDuration: 120,   // ~2 min for typical run (up to 30 iterations)
      estimatedTokens:   40000, // orchestrator reasoning + tool calls + code generation
      estimatedCost:     0.40,
      confidence:        'low',
    };
  }
}
