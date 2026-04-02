# Phase 2: LangGraph Workflow Implementation

**Status:** Next to implement (after Phase 1 completion)  
**Package:** `@appvelocity/agent-design-to-code-workflow`  
**Location:** `packages/agents/design-to-code/workflow/`

## Overview

Phase 2 builds the **LangGraph multi-agent workflow** that orchestrates the DesignToCodeAgent execution. It uses the Figma API integration (Phase 1) to fetch data and will feed the IR into code generators (Phase 3).

**Key Concepts:**
- **LangGraph:** OSS framework for building stateful multi-agent workflows
- **StateGraph:** Directed graph where nodes are functions, edges are transitions
- **WorkflowState:** Shared state object passed to every node
- **Conditional Edges:** Dynamic routing based on node output (e.g., retry on validation failure)

## Workflow Nodes (6 total)

```
START
  ↓
1. InputValidator (validate Figma URL + API keys)
  ↓ [valid?]
2. PlannerAgent (LLM: analyze file structure, create ExecutionPlan)
  ↓
3. ResearcherAgent (FigmaClient: fetch file + variables)
  ↓
4. IRBuilderAgent (IRBuilder: transform data → DesignIR)
  ↓
5. CriticAgent (LLM: validate IR quality, accessibility)
  ↓ [pass?]
6. GeneratorAgent (LLM: synthesize code from IR)
  ↓
END
```

**Retry Loop:** If CriticAgent fails, return to IRBuilderAgent (max 2 retries).

## WorkflowState Schema

```typescript
import type { AgentInput, AgentOutput, AgentError } from '@appvelocity/shared-core';
import type { FigmaFile, DesignIR } from '@appvelocity/agent-design-to-code-core';

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
  designIR?: DesignIR;
  executionPlan?: ExecutionPlan;
  validationResult?: ValidationResult;

  // Output (final deliverable)
  generatedCode?: CodeBundle;

  // Error tracking
  errors: AgentError[];
  retryCount: number;

  // Progress tracking
  currentStep: string;
  logs: LogEntry[];
}

export interface ExecutionPlan {
  screens: string[];        // Node IDs to process
  components: string[];     // Component IDs to extract
  priority: 'screens-first' | 'components-first';
  estimatedDuration: number; // seconds
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  score: number;  // 0-100
}

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  category: 'structure' | 'accessibility' | 'naming' | 'semantics';
  message: string;
  nodeId?: string;
  fixSuggestion?: string;
}

export interface CodeBundle {
  framework: 'react-native' | 'flutter';
  files: CodeFile[];
  assets: AssetFile[];
  dependencies: Record<string, string>;
}

export interface CodeFile {
  path: string;       // "src/screens/HomeScreen.tsx"
  content: string;
  language: 'typescript' | 'dart';
}

export interface AssetFile {
  path: string;       // "assets/icons/arrow_right.svg"
  url: string;        // Figma CDN URL
}

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
  nodeId?: string;
}
```

## Package Structure

```
workflow/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── src/
│   ├── index.ts                  — Public API exports
│   ├── types.ts                  — WorkflowState, ExecutionPlan, etc.
│   ├── graph.ts                  — LangGraph StateGraph definition
│   ├── nodes/
│   │   ├── input-validator.ts    — Node 1
│   │   ├── planner.ts            — Node 2 (LLM)
│   │   ├── researcher.ts         — Node 3 (FigmaClient)
│   │   ├── ir-builder.ts         — Node 4 (IRBuilder)
│   │   ├── critic.ts             — Node 5 (LLM)
│   │   └── generator.ts          — Node 6 (LLM) — Phase 3
│   ├── prompts/
│   │   ├── planner.txt           — System prompt for PlannerAgent
│   │   ├── critic.txt            — System prompt for CriticAgent
│   │   └── generator.txt         — System prompt for GeneratorAgent (Phase 3)
│   └── utils/
│       ├── llm-client.ts         — Wrapper for Anthropic/OpenAI APIs
│       └── logger.ts             — Workflow-specific logging
└── tests/
    ├── fixtures/
    │   └── mock-workflow-state.ts
    ├── nodes/
    │   ├── input-validator.test.ts
    │   ├── planner.test.ts
    │   ├── researcher.test.ts
    │   ├── ir-builder.test.ts
    │   └── critic.test.ts
    └── integration/
        └── workflow.test.ts      — E2E: Figma file → DesignIR
```

## Node Implementations

### 1. InputValidator (`nodes/input-validator.ts`)

```typescript
import { parseFigmaUrl } from '@appvelocity/agent-design-to-code-core';
import type { WorkflowState } from '../types.js';

export async function inputValidator(state: WorkflowState): Promise<Partial<WorkflowState>> {
  const errors: AgentError[] = [];

  // Validate Figma URL
  try {
    const { fileKey } = parseFigmaUrl(state.figmaUrl);
    if (!fileKey) {
      errors.push({
        code: 'INVALID_FIGMA_URL',
        message: `Could not extract file key from URL: ${state.figmaUrl}`,
        recoverable: false,
      });
    }
  } catch (err) {
    errors.push({
      code: 'INVALID_FIGMA_URL',
      message: err.message,
      recoverable: false,
    });
  }

  // Validate API token
  if (!process.env.FIGMA_ACCESS_TOKEN) {
    errors.push({
      code: 'MISSING_FIGMA_TOKEN',
      message: 'FIGMA_ACCESS_TOKEN environment variable not set',
      recoverable: false,
    });
  }

  // Validate framework
  if (!['react-native', 'flutter'].includes(state.targetFramework)) {
    errors.push({
      code: 'INVALID_FRAMEWORK',
      message: `Unsupported framework: ${state.targetFramework}`,
      recoverable: false,
    });
  }

  return {
    errors,
    currentStep: 'InputValidator',
    logs: [
      {
        timestamp: new Date().toISOString(),
        level: errors.length > 0 ? 'error' : 'success',
        message: errors.length > 0 
          ? `Validation failed: ${errors.length} error(s)` 
          : 'Input validation passed',
      },
    ],
  };
}
```

### 2. PlannerAgent (`nodes/planner.ts`)

```typescript
import type { WorkflowState, ExecutionPlan } from '../types.js';
import { createLLMClient } from '../utils/llm-client.js';
import { parseFigmaUrl } from '@appvelocity/agent-design-to-code-core';
import fs from 'fs/promises';

const PLANNER_PROMPT = await fs.readFile('./prompts/planner.txt', 'utf-8');

export async function plannerAgent(state: WorkflowState): Promise<Partial<WorkflowState>> {
  const llm = createLLMClient();
  const { fileKey } = parseFigmaUrl(state.figmaUrl);

  const prompt = PLANNER_PROMPT
    .replace('{{FIGMA_URL}}', state.figmaUrl)
    .replace('{{FILE_KEY}}', fileKey)
    .replace('{{TARGET_FRAMEWORK}}', state.targetFramework);

  const response = await llm.chat({
    model: 'claude-sonnet-4-20250514',
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: 'Analyze the Figma file and create an execution plan.' },
    ],
    response_format: { type: 'json_object' },
  });

  const executionPlan: ExecutionPlan = JSON.parse(response.content);

  return {
    executionPlan,
    currentStep: 'PlannerAgent',
    logs: [
      {
        timestamp: new Date().toISOString(),
        level: 'success',
        message: `Plan created: ${executionPlan.screens.length} screens, ${executionPlan.components.length} components`,
      },
    ],
  };
}
```

**Planner Prompt (`prompts/planner.txt`):**
```
You are a design analysis agent. Given a Figma file URL, your job is to create an execution plan for code generation.

Figma URL: {{FIGMA_URL}}
File Key: {{FILE_KEY}}
Target Framework: {{TARGET_FRAMEWORK}}

Your output MUST be a JSON object with this structure:
{
  "screens": ["node_id_1", "node_id_2"],  // Top-level frames to convert
  "components": ["comp_id_1", "comp_id_2"],  // Reusable components to extract
  "priority": "screens-first",  // or "components-first"
  "estimatedDuration": 180  // seconds
}

Rules:
- Identify screens (large frames, typically 320x568 or larger)
- Identify reusable components (buttons, cards, etc.)
- Estimate duration: 2-3 minutes per screen, 1 minute per component
- If components are used across multiple screens, prioritize components-first

Output only valid JSON. No explanation or markdown.
```

### 3. ResearcherAgent (`nodes/researcher.ts`)

```typescript
import { FigmaClient, parseFigmaUrl } from '@appvelocity/agent-design-to-code-core';
import type { WorkflowState } from '../types.js';

export async function researcherAgent(state: WorkflowState): Promise<Partial<WorkflowState>> {
  const client = new FigmaClient({
    accessToken: process.env.FIGMA_ACCESS_TOKEN!,
    rateLimitPerMinute: 60,
  });

  const { fileKey } = parseFigmaUrl(state.figmaUrl);

  // Fetch file + variables in parallel
  const [figmaFile, variablesResponse] = await Promise.all([
    client.getFile(fileKey),
    client.getLocalVariables(fileKey).catch(() => undefined),  // Optional
  ]);

  return {
    figmaFile,
    currentStep: 'ResearcherAgent',
    logs: [
      {
        timestamp: new Date().toISOString(),
        level: 'success',
        message: `Fetched Figma file: ${figmaFile.name} (${figmaFile.document.children?.length} pages)`,
      },
      variablesResponse && {
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Found ${Object.keys(variablesResponse.meta.variables).length} design tokens`,
      },
    ].filter(Boolean),
  };
}
```

### 4. IRBuilderAgent (`nodes/ir-builder.ts`)

```typescript
import { IRBuilder } from '@appvelocity/agent-design-to-code-core';
import type { WorkflowState } from '../types.js';

export async function irBuilderAgent(state: WorkflowState): Promise<Partial<WorkflowState>> {
  if (!state.figmaFile) {
    throw new Error('FigmaFile not available in state (ResearcherAgent should populate this)');
  }

  const { fileKey } = parseFigmaUrl(state.figmaUrl);
  const builder = new IRBuilder();

  const designIR = builder.build(
    state.figmaFile,
    fileKey,
    state.variablesResponse  // Optional
  );

  return {
    designIR,
    currentStep: 'IRBuilderAgent',
    logs: [
      {
        timestamp: new Date().toISOString(),
        level: 'success',
        message: `IR built: ${designIR.screens.length} screens, ${designIR.components.length} components, ${designIR.tokens.raw.length} tokens`,
      },
    ],
  };
}
```

### 5. CriticAgent (`nodes/critic.ts`)

```typescript
import type { WorkflowState, ValidationResult, ValidationIssue } from '../types.js';
import { createLLMClient } from '../utils/llm-client.js';
import fs from 'fs/promises';

const CRITIC_PROMPT = await fs.readFile('./prompts/critic.txt', 'utf-8');

export async function criticAgent(state: WorkflowState): Promise<Partial<WorkflowState>> {
  if (!state.designIR) {
    throw new Error('DesignIR not available in state');
  }

  const llm = createLLMClient();
  const irSummary = JSON.stringify({
    screens: state.designIR.screens.map(s => ({
      id: s.id,
      name: s.name,
      elementCount: Object.keys(s.elementIndex).length,
    })),
    tokenCount: state.designIR.tokens.raw.length,
  }, null, 2);

  const prompt = CRITIC_PROMPT.replace('{{IR_SUMMARY}}', irSummary);

  const response = await llm.chat({
    model: 'claude-sonnet-4-20250514',
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: 'Validate the IR structure and identify any issues.' },
    ],
    response_format: { type: 'json_object' },
  });

  const validationResult: ValidationResult = JSON.parse(response.content);

  return {
    validationResult,
    currentStep: 'CriticAgent',
    logs: [
      {
        timestamp: new Date().toISOString(),
        level: validationResult.valid ? 'success' : 'warning',
        message: validationResult.valid 
          ? `Validation passed (score: ${validationResult.score}/100)` 
          : `Validation failed: ${validationResult.issues.filter(i => i.severity === 'error').length} error(s)`,
      },
    ],
  };
}
```

**Critic Prompt (`prompts/critic.txt`):**
```
You are a design quality validation agent. Your job is to review an intermediate representation (IR) and identify structural, accessibility, and semantic issues.

IR Summary:
{{IR_SUMMARY}}

Your output MUST be a JSON object:
{
  "valid": true,  // false if any errors found
  "score": 85,    // 0-100 quality score
  "issues": [
    {
      "severity": "error" | "warning" | "info",
      "category": "structure" | "accessibility" | "naming" | "semantics",
      "message": "Description of the issue",
      "nodeId": "element_id_if_applicable",
      "fixSuggestion": "How to fix it"
    }
  ]
}

Check for:
- Missing alt text on images
- Text contrast issues (color token analysis)
- Inconsistent naming conventions (e.g., "btn" vs "button")
- Missing semantic structure (e.g., flat hierarchy with no grouping)
- Overly deep nesting (>5 levels)

Output only valid JSON. No explanation.
```

### 6. GeneratorAgent (`nodes/generator.ts`)

```typescript
// Phase 3 implementation — stub for now
export async function generatorAgent(state: WorkflowState): Promise<Partial<WorkflowState>> {
  return {
    currentStep: 'GeneratorAgent',
    logs: [
      {
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'GeneratorAgent not yet implemented (Phase 3)',
      },
    ],
  };
}
```

## Graph Definition (`graph.ts`)

```typescript
import { StateGraph, END } from '@langchain/langgraph';
import type { WorkflowState } from './types.js';
import { inputValidator } from './nodes/input-validator.js';
import { plannerAgent } from './nodes/planner.js';
import { researcherAgent } from './nodes/researcher.js';
import { irBuilderAgent } from './nodes/ir-builder.js';
import { criticAgent } from './nodes/critic.js';
import { generatorAgent } from './nodes/generator.js';

const workflow = new StateGraph<WorkflowState>({
  channels: {
    figmaUrl: null,
    targetFramework: null,
    options: null,
    figmaFile: null,
    designIR: null,
    executionPlan: null,
    validationResult: null,
    generatedCode: null,
    errors: null,
    retryCount: null,
    currentStep: null,
    logs: null,
  },
});

// Add nodes
workflow.addNode('inputValidator', inputValidator);
workflow.addNode('planner', plannerAgent);
workflow.addNode('researcher', researcherAgent);
workflow.addNode('irBuilder', irBuilderAgent);
workflow.addNode('critic', criticAgent);
workflow.addNode('generator', generatorAgent);

// Set entry point
workflow.setEntryPoint('inputValidator');

// Add edges
workflow.addConditionalEdges(
  'inputValidator',
  (state) => (state.errors.length > 0 ? END : 'planner'),
  {
    [END]: END,
    planner: 'planner',
  }
);

workflow.addEdge('planner', 'researcher');
workflow.addEdge('researcher', 'irBuilder');
workflow.addEdge('irBuilder', 'critic');

workflow.addConditionalEdges(
  'critic',
  (state) => {
    if (!state.validationResult?.valid && state.retryCount < 2) {
      return 'irBuilder';  // Retry
    }
    return state.validationResult?.valid ? 'generator' : END;
  },
  {
    irBuilder: 'irBuilder',
    generator: 'generator',
    [END]: END,
  }
);

workflow.addEdge('generator', END);

export const compiledWorkflow = workflow.compile();
```

## Execution

```typescript
import { compiledWorkflow } from './graph.js';
import type { WorkflowState } from './types.js';

const initialState: WorkflowState = {
  figmaUrl: 'https://figma.com/file/abc123/MyApp',
  targetFramework: 'react-native',
  options: { verbose: true },
  errors: [],
  retryCount: 0,
  currentStep: '',
  logs: [],
};

const result = await compiledWorkflow.invoke(initialState);

if (result.errors.length > 0) {
  console.error('Workflow failed:', result.errors);
} else {
  console.log('Success! Generated code:', result.generatedCode?.files.length, 'files');
}
```

## Testing Strategy

### Unit Tests (per node)
- **inputValidator.test.ts:** Valid/invalid URLs, missing tokens
- **planner.test.ts:** Mock LLM responses, validate ExecutionPlan schema
- **researcher.test.ts:** Mock FigmaClient, verify parallel fetches
- **ir-builder.test.ts:** Mock FigmaFile, verify DesignIR structure
- **critic.test.ts:** Mock LLM responses, validate ValidationResult

### Integration Tests
- **workflow.test.ts:** E2E with real Figma file (or comprehensive fixture)
- Verify state transitions (inputValidator → planner → ... → END)
- Test retry loop (inject failing validation, ensure max 2 retries)
- Test early exit (inject invalid input, ensure workflow stops at inputValidator)

## Dependencies (`package.json`)

```json
{
  "name": "@appvelocity/agent-design-to-code-workflow",
  "version": "0.1.0",
  "dependencies": {
    "@appvelocity/shared-core": "workspace:*",
    "@appvelocity/agent-design-to-code-core": "workspace:*",
    "@langchain/langgraph": "^0.2.0",
    "@langchain/anthropic": "^0.3.0",
    "@langchain/openai": "^0.3.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^1.6.0",
    "@types/node": "^20.14.0"
  }
}
```

## Success Criteria

- [ ] All 5 nodes implemented and tested (InputValidator, Planner, Researcher, IRBuilder, Critic)
- [ ] LangGraph workflow compiles and executes
- [ ] State transitions work (conditional edges route correctly)
- [ ] Retry loop triggers on validation failure (max 2 retries)
- [ ] Early exit on invalid input
- [ ] Integration test passes: Figma file → DesignIR
- [ ] 15+ unit tests passing
- [ ] Ready to integrate with Phase 3 (Generator)

---

**Start Here:** Implement `inputValidator` first (simplest), then `researcher` (uses Phase 1 code), then `irBuilder` (orchestrates Phase 1), then `planner` + `critic` (LLM integration).
