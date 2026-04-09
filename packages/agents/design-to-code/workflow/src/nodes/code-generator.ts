/**
 * Node 6 — CodeGeneratorAgent
 * Converts the validated DesignIR into a framework-specific CodeBundle
 * by delegating to ReactNativeGenerator or FlutterGenerator.
 */

import { ReactNativeGenerator, FlutterGenerator } from '@appvelocity/agent-design-to-code-generators';
import type { GenerationScope } from '@appvelocity/agent-design-to-code-generators';
import { makeLogEntry } from '../utils/logger.js';
import type { WorkflowState } from '../types.js';

export async function codeGeneratorAgent(
  state: WorkflowState
): Promise<Partial<WorkflowState>> {
  if (!state.designIR) {
    throw new Error(
      'DesignIR not available in state. IRBuilderAgent must run before CodeGeneratorAgent.'
    );
  }
  if (!state.executionPlan) {
    throw new Error(
      'ExecutionPlan not available in state. GenerationPlannerAgent must run before CodeGeneratorAgent.'
    );
  }

  // Convert ExecutionPlan → GenerationScope (framework-agnostic subset)
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
      `Generated ${result.stats.fileCount} files — ${result.stats.screenCount} screen(s), ${result.stats.componentCount} component(s), ${result.stats.assetCount} asset(s)`
    ),
    ...result.warnings.map((w) => makeLogEntry('warning', w)),
  ];

  return {
    generatedCode: result.bundle,
    currentStep: 'CodeGeneratorAgent',
    logs,
  };
}
