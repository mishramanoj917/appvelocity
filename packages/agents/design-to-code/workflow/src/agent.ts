/**
 * DesignToCodeAgent — AgentBase adapter
 *
 * Wraps the LangGraph compiledWorkflow so it can be registered in the
 * AgentRegistry and invoked via the web dashboard API.
 *
 * Expected input.params:
 *   figmaUrl        string   — Figma file/frame URL
 *   targetFramework string   — 'react-native' | 'flutter'
 *
 * Optional input.options:
 *   dryRun          boolean
 *   verbose         boolean
 *   includeTests    boolean  (passed through as params.includeTests)
 */

import {
  AgentBase,
  type AgentInput,
  type AgentOutput,
  type ValidationResult,
  type CostEstimate,
} from '@appvelocity/shared-core';
import { compiledWorkflow } from './graph.js';
import type { WorkflowState } from './types.js';

export class DesignToCodeAgent extends AgentBase {
  readonly name = 'DesignToCodeAgent';
  readonly version = '0.1.0';
  readonly description =
    'Converts a Figma design URL into production-ready React Native or Flutter code via an 8-node LangGraph pipeline.';
  readonly capabilities = [
    'Figma → DesignIR extraction',
    'React Native code generation',
    'Flutter code generation',
    'Design token extraction',
    'Component hierarchy analysis',
    'Syntax validation and auto-fix (prettier / dart format)',
  ];

  async execute(input: AgentInput): Promise<AgentOutput> {
    const startTime = Date.now();

    const figmaUrl = input.params['figmaUrl'] as string | undefined;
    const targetFramework = (input.params['targetFramework'] as string | undefined) ?? 'react-native';

    if (!figmaUrl) {
      return this.buildOutput(false, null, startTime, [
        { code: 'MISSING_PARAM', message: 'figmaUrl is required', recoverable: false },
      ]);
    }

    const initialState: Partial<WorkflowState> = {
      figmaUrl,
      targetFramework: targetFramework as WorkflowState['targetFramework'],
      options: {
        dryRun: input.options?.dryRun,
        verbose: input.options?.verbose,
        includeTests: input.params['includeTests'] as boolean | undefined,
      },
    };

    try {
      const finalState = await compiledWorkflow.invoke(initialState);

      const hasErrors = finalState.errors && finalState.errors.length > 0;
      return this.buildOutput(!hasErrors, finalState, startTime,
        hasErrors ? finalState.errors : undefined
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.buildOutput(false, null, startTime, [
        { code: 'WORKFLOW_ERROR', message, recoverable: false },
      ]);
    }
  }

  validate(input: AgentInput): ValidationResult {
    const errors: string[] = [];
    if (!input.params['figmaUrl']) {
      errors.push('figmaUrl is required');
    }
    const fw = input.params['targetFramework'];
    if (fw && fw !== 'react-native' && fw !== 'flutter') {
      errors.push("targetFramework must be 'react-native' or 'flutter'");
    }
    return { valid: errors.length === 0, errors: errors.length ? errors : undefined };
  }

  estimateCost(_input: AgentInput): CostEstimate {
    return {
      estimatedDuration: 90,   // ~90 seconds for a typical run
      estimatedTokens: 15000,  // 3 LLM calls (generationPlanner, irValidator, codeGenerator)
      estimatedCost: 0.15,
      confidence: 'low',
    };
  }

}
