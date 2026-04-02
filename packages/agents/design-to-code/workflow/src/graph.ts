/**
 * LangGraph StateGraph definition for the DesignToCode workflow.
 *
 * Nodes: inputValidator → planner → researcher → irBuilder → critic → generator
 * Retry loop: critic → irBuilder (max 2 retries on validation failure)
 */

import { StateGraph, Annotation, END, START } from '@langchain/langgraph';
import type { AgentError, LogEntry, WorkflowState } from './types.js';
import { inputValidator } from './nodes/input-validator.js';
import { plannerAgent } from './nodes/planner.js';
import { researcherAgent } from './nodes/researcher.js';
import { irBuilderAgent } from './nodes/ir-builder.js';
import { criticAgent } from './nodes/critic.js';
import { generatorAgent } from './nodes/generator.js';

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
  // Append reducers so each node contributes new entries without overwriting
  errors: Annotation<AgentError[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
  retryCount: Annotation<number>({
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
  .addNode('inputValidator', inputValidator)
  .addNode('planner', plannerAgent)
  .addNode('researcher', researcherAgent)
  .addNode('irBuilder', irBuilderAgent)
  .addNode('critic', criticAgent)
  .addNode('generator', generatorAgent)
  .addEdge(START, 'inputValidator')
  .addConditionalEdges('inputValidator', (state) =>
    state.errors.length > 0 ? END : 'planner'
  )
  .addEdge('planner', 'researcher')
  .addEdge('researcher', 'irBuilder')
  .addEdge('irBuilder', 'critic')
  .addConditionalEdges('critic', (state) => {
    if (!state.validationResult?.valid && state.retryCount < 2) {
      return 'irBuilder'; // retry
    }
    return state.validationResult?.valid ? 'generator' : END;
  })
  .addEdge('generator', END)
  .compile();
