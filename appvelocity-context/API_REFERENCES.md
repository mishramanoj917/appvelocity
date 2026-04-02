# API Reference — Key Interfaces

## AgentBase (from `@appvelocity/shared-core`)

```typescript
export abstract class AgentBase {
  abstract readonly name: string;
  abstract readonly version: string;
  abstract readonly description: string;
  abstract readonly capabilities: string[];

  abstract execute(input: AgentInput): Promise<AgentOutput>;
  abstract validate(input: AgentInput): ValidationResult;
  abstract estimateCost(input: AgentInput): CostEstimate;

  getHealth(): AgentHealth { ... }
}
```

## FigmaClient (from `@appvelocity/agent-design-to-code-core`)

```typescript
export class FigmaClient {
  constructor(config: FigmaClientConfig);
  async getFile(fileKey: string, force?: boolean): Promise<FigmaFile>;
  async getFileNodes(fileKey: string, nodeIds: string[]): Promise<FigmaNodesResponse>;
  async getLocalVariables(fileKey: string): Promise<FigmaVariablesResponse>;
  async getImageExports(fileKey: string, nodeIds: string[], options): Promise<FigmaImagesResponse>;
}
```

## IRBuilder (from `@appvelocity/agent-design-to-code-core`)

```typescript
export class IRBuilder {
  build(
    file: FigmaFile,
    fileKey: string,
    variablesResponse?: FigmaVariablesResponse
  ): DesignIR;
}
```

## Parsers (from `@appvelocity/agent-design-to-code-core`)

```typescript
export function parseVariables(response: FigmaVariablesResponse): DesignToken[];
export function parseComponents(file: FigmaFile): ParsedComponent[];
export function parseAutoLayout(node: FigmaNode): ParsedAutoLayout;
export function classifyNode(node: FigmaNode): NodeClassification;
export function extractScreens(file: FigmaFile): FigmaNode[];
```

See COMPLETED_WORK.md for detailed type signatures.
