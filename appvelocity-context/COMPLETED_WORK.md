# Completed Work — Phase 0 & Phase 1

This document catalogs every deliverable from Phase 0 (Foundation) and Phase 1 (Figma API Integration).

## Phase 0: Platform Foundation ✅ COMPLETE

### Monorepo Structure
- **Package Manager:** pnpm 9.1.0 with workspaces
- **Build Tool:** Turborepo 2.0 (caching, parallel builds)
- **Workspaces:**
  - `packages/shared/*` — Core, LangGraph, integrations, UI, database
  - `packages/agents/*` — All 7 agent packages
  - `packages/web` — Next.js dashboard
  - `packages/cli` — CLI tool (placeholder)

### Shared Core Package (`@appvelocity/shared-core`)
**Location:** `packages/shared/core/`

**Key Files:**
- `src/index.ts` — Public API exports
- `package.json` — Dependencies: zod, winston
- `tsconfig.json` — Strict TypeScript config

**Interfaces Exported:**
```typescript
// Core types
export interface AgentInput { action, params, context?, options? }
export interface AgentOutput { success, data?, errors?, metadata }
export interface AgentContext { userId?, projectId?, sessionId, sharedState? }
export interface ValidationResult { valid, errors?, warnings? }
export interface CostEstimate { estimatedDuration, estimatedTokens?, ... }

// Base class
export abstract class AgentBase {
  abstract readonly name: string;
  abstract readonly version: string;
  abstract execute(input: AgentInput): Promise<AgentOutput>;
  abstract validate(input: AgentInput): ValidationResult;
  abstract estimateCost(input: AgentInput): CostEstimate;
  getHealth(): AgentHealth { ... }
}

// Zod schemas
export const AgentInputSchema = z.object({ ... });
```

**Purpose:** Every agent in the platform extends `AgentBase` and conforms to these interfaces.

### Web Dashboard (`@appvelocity/web`)
**Location:** `packages/web/`

**Tech Stack:**
- Next.js 14 (App Router, Server Components)
- React 18 (Hooks, Suspense)
- Tailwind CSS 3
- TypeScript 5.4

**Key Files:**

1. **`lib/agents.config.ts`** — Single source of truth for all 7 agents
```typescript
export const AGENTS: AgentConfig[] = [
  {
    id: 'design-to-code',
    name: 'DesignToCode',
    status: 'planned', // 'active' | 'planned' | 'beta'
    category: 'generation',
    valueProposition: 'Transform Figma designs into production-ready mobile code',
    capabilities: [
      'Figma API integration',
      'React Native generation',
      'Flutter generation',
      'Design token extraction'
    ],
    inputs: [
      { name: 'figmaUrl', type: 'url', required: true, ... },
      { name: 'targetFramework', type: 'select', options: ['react-native', 'flutter'], ... }
    ]
  },
  // ... 6 more agents
];
```

2. **`lib/agent-registry.ts`** — Wires AgentConfig → live AgentBase instances
```typescript
class AgentRegistry {
  private map = new Map<string, RegistryEntry>();
  
  constructor() {
    // Pre-populate with config
    for (const agent of AGENTS) {
      this.map.set(agent.id, { ...agent, instance: undefined });
    }
    
    // Wire active agents (example for future Phase 4):
    // this.map.get('design-to-code')!.instance = new DesignToCodeAgent({ ... });
  }
  
  get(agentId: string): RegistryEntry | undefined { ... }
  list(): Array<{ id: string } & RegistryEntry> { ... }
}

export const agentRegistry = new AgentRegistry();
```

3. **`app/page.tsx`** — Dashboard home (7 agent cards)
- Fetches `AGENTS` from config
- Displays grid of AgentCard components
- Filters by status (active/planned)

4. **`app/agents/[agentId]/page.tsx`** — Agent detail + launcher
- Dynamic route for each agent
- Fetches AgentConfig by ID
- Renders AgentLauncher with dynamic form

5. **`components/agent-launcher/AgentLauncher.tsx`** — Dynamic form builder
- Reads `inputs[]` from AgentConfig
- Renders text/url/select/number inputs
- Submits to API: `POST /api/agents/[agentId]`
- Opens SSE stream: `GET /api/agents/stream/[jobId]`
- Displays real-time logs

6. **API Routes:**
- `app/api/agents/[agentId]/route.ts` — POST: Start job, return jobId
- `app/api/agents/stream/[jobId]/route.ts` — GET: SSE stream of logs
- `app/api/agents/status/[jobId]/route.ts` — GET: Job status (for polling)

**SSE Architecture:**
```
User clicks "Launch Agent"
  ↓
POST /api/agents/design-to-code { figmaUrl, targetFramework }
  ↓
Generate jobId (UUID), enqueue job, return { jobId }
  ↓
Frontend opens EventSource: /api/agents/stream/{jobId}
  ↓
Backend streams logs:
  event: log
  data: {"level":"info","message":"Fetching Figma file..."}
  
  event: log
  data: {"level":"success","message":"IR built successfully"}
  
  event: complete
  data: {"success":true,"output":{"files":[...]}}
```

**Future Scaling:** Replace in-memory queue with Redis streams for multi-instance deployments. Frontend code stays identical.

### IDE Configuration

1. **`.cursor/rules`** — AI assistant context (3,500+ words)
- AgentBase contract
- Monorepo patterns (pnpm workspaces, Turborepo)
- SSE streaming architecture
- Figma API gotchas
- Anti-patterns (what NOT to do)

2. **`.vscode/settings.json`** — TypeScript, Prettier, ESLint config

3. **`.vscode/extensions.json`** — 15 recommended extensions
- ESLint, Prettier, Tailwind IntelliSense, etc.

4. **`.vscode/launch.json`** — 5 debug configurations
- Web (Next.js)
- Agents (Node.js)
- CLI
- Tests (Vitest)
- Compound (Web + Agents)

### Root Configuration Files

1. **`package.json`**
```json
{
  "name": "@appvelocity/platform",
  "workspaces": [
    "packages/shared/*",
    "packages/agents/*",
    "packages/cli",
    "packages/web"
  ],
  "scripts": {
    "dev:web": "turbo run dev --filter=@appvelocity/web",
    "dev:agents": "turbo run dev --filter=@appvelocity/agent-*",
    "build": "turbo run build",
    "test": "turbo run test"
  },
  "engines": { "node": ">=18.0.0", "pnpm": ">=9.0.0" }
}
```

2. **`pnpm-workspace.yaml`**
```yaml
packages:
  - 'packages/shared/*'
  - 'packages/agents/*'
  - 'packages/cli'
  - 'packages/web'
```

3. **`turbo.json`**
```json
{
  "pipeline": {
    "build": { "outputs": ["dist/**", ".next/**"] },
    "dev": { "cache": false },
    "test": { "cache": false }
  }
}
```

4. **`.env.example`**
```bash
# Figma
FIGMA_ACCESS_TOKEN=your_token_here

# LLM Provider
LLM_PROVIDER=openai  # or 'anthropic'
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Rate Limits
FIGMA_RATE_LIMIT_PER_MINUTE=60
LLM_MAX_RETRIES=3

# Logging
LOG_LEVEL=info
NODE_ENV=development
```

5. **`docker-compose.yml`**
```yaml
services:
  web:
    build: ./packages/web
    ports: ["3000:3000"]
    env_file: .env
  
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
```

### Documentation

**`docs/LOCAL_SETUP.md`** — 10-section comprehensive guide:
1. Prerequisites (Node 20, pnpm 9, Git, Cursor)
2. Installation (`pnpm install`)
3. Environment variables (`.env` setup)
4. Project structure walkthrough
5. Development workflow (`pnpm dev:web`)
6. Architecture overview (monorepo, agents, SSE)
7. Testing (`pnpm test`)
8. Debugging (VS Code launch configs)
9. Troubleshooting (common errors)
10. Next steps (Phase 2 implementation)

### Setup Automation

**`setup.sh`** — One-shot macOS setup script
- Checks Node, pnpm, Git versions
- Copies `.env.example` → `.env`
- Runs `pnpm install`
- Builds `@appvelocity/shared-core`
- Initializes Git repo
- Prints next steps

---

## Phase 1: Figma API Integration Layer ✅ COMPLETE

### Package: `@appvelocity/agent-design-to-code-core`
**Location:** `packages/agents/design-to-code/core/`

### File Structure (16 files)
```
core/
├── src/
│   ├── figma/
│   │   ├── types.ts       (243 lines) — Full Figma API types
│   │   ├── client.ts      (289 lines) — HTTP client with retry/cache
│   │   └── parsers.ts     (416 lines) — Extract tokens, components, layout
│   ├── ir/
│   │   ├── types.ts       (199 lines) — Platform-agnostic IR schema
│   │   └── builder.ts     (333 lines) — FigmaFile → DesignIR transform
│   ├── utils/
│   │   ├── color.ts       (42 lines)  — RGBA ↔ hex conversion
│   │   ├── logger.ts      (26 lines)  — Winston structured logging
│   │   └── url-parser.ts  (48 lines)  — Parse Figma URLs
│   └── index.ts           (45 lines)  — Public API exports
├── tests/
│   ├── fixtures/
│   │   └── figma-mocks.ts (165 lines) — Realistic test data
│   ├── figma/
│   │   ├── client.test.ts  (147 lines) — 10 tests
│   │   └── parsers.test.ts (221 lines) — 17 tests
│   └── ir/
│       └── builder.test.ts (264 lines) — 14 tests
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

**Total:** ~2,400 LOC (source + tests)  
**Test Coverage:** 85%+ (41 tests passing)

### Key Classes & Functions

#### 1. FigmaClient (`src/figma/client.ts`)
```typescript
export class FigmaClient {
  constructor(config: FigmaClientConfig) {
    // Axios with auth header
    // axios-retry (exponential backoff, 3 retries)
    // p-queue (60 req/min rate limiting)
    // LRU cache (5min TTL, 100 items)
  }
  
  async getFile(fileKey: string, force?: boolean): Promise<FigmaFile>
  async getFileNodes(fileKey: string, nodeIds: string[]): Promise<FigmaNodesResponse>
  async getLocalVariables(fileKey: string): Promise<FigmaVariablesResponse>
  async getComponents(fileKey: string): Promise<FigmaComponentsResponse>
  async getImageExports(fileKey: string, nodeIds: string[], options): Promise<FigmaImagesResponse>
  
  clearCache(): void
  get queueSize(): number
}
```

**Error Classes:**
- `FigmaApiError` — Base error with statusCode + endpoint
- `FigmaAuthError` — 403 (bad token)
- `FigmaRateLimitError` — 429 (includes retryAfterMs)

**Features:**
- Automatic retry on network errors and 429 (rate limit)
- LRU cache with TTL (default 5min)
- Rate limiting via p-queue (default 60 req/min)
- Structured logging (Winston)

#### 2. Figma Parsers (`src/figma/parsers.ts`)

**Functions:**
```typescript
export function parseVariables(response: FigmaVariablesResponse): DesignToken[]
  // Extracts all design tokens (colors, spacing, typography)
  // Resolves alias chains (token → token → value)
  // Returns one token per variable per mode

export function parseComponents(file: FigmaFile): ParsedComponent[]
  // Walks node tree, finds COMPONENT and COMPONENT_SET nodes
  // Extracts variant properties from slash notation ("Button/Primary/Large")
  // Classifies atomic level (atom, molecule, organism, template, screen)

export function parseAutoLayout(node: FigmaNode): ParsedAutoLayout
  // Converts Figma auto-layout → flex model
  // Maps HORIZONTAL/VERTICAL → row/column
  // Extracts padding, gap, alignment

export function classifyNode(node: FigmaNode): NodeClassification
  // Heuristics: name, type, size, depth
  // Returns: screen, organism, molecule, atom, icon, image, text, shape

export function extractScreens(file: FigmaFile): FigmaNode[]
  // Returns top-level FRAME nodes on CANVAS pages

export function resolveAlias(aliasId: string, variableMap: Map<string, FigmaVariable>): FigmaVariableValue
  // Follows alias chains with depth guard (max 10)
```

**Output Types:**
```typescript
export interface DesignToken {
  id: string;
  name: string;        // "Colors/Primary/500"
  path: string;        // "colors.primary.500"
  type: TokenType;     // 'color' | 'typography' | 'spacing' | 'radius' | 'shadow'
  value: string | number;
  resolvedValue?: string;  // "#6366f1" for colors
  isAlias: boolean;
  aliasId?: string;
}

export interface ParsedComponent {
  id: string;
  name: string;
  componentSetName?: string;  // "Button" from "Button/Primary/Large"
  variants: Record<string, string>;
  atomicLevel: 'atom' | 'molecule' | 'organism' | 'template' | 'screen';
  node: FigmaNode;
}

export interface ParsedAutoLayout {
  direction: 'row' | 'column' | 'none';
  mainAxisAlignment: 'start' | 'center' | 'end' | 'space-between';
  crossAxisAlignment: 'start' | 'center' | 'end' | 'stretch';
  gap: number;
  padding: { top, right, bottom, left };
  wrap: boolean;
}
```

#### 3. IR Types (`src/ir/types.ts`)

**Top-Level Schema:**
```typescript
export interface DesignIR {
  fileKey: string;
  fileName: string;
  lastModified: string;         // ISO timestamp
  tokens: IRTokenSet;           // Design tokens grouped by type
  screens: IRScreen[];          // All parsed screens
  components: IRComponent[];    // Reusable component definitions
  assets: IRAsset[];            // Icons, images
  meta: IRMeta;                 // Build metadata
}

export interface IRTokenSet {
  colors: Record<string, IRColorToken>;
  typography: Record<string, IRTypographyToken>;
  spacing: Record<string, number>;
  radii: Record<string, number>;
  shadows: Record<string, IRShadowToken>;
  raw: DesignToken[];  // Original parsed tokens
}

export interface IRScreen {
  id: string;
  name: string;
  componentName: string;  // "HomeScreen" (PascalCase)
  width: number;
  height: number;
  root: IRElement;        // Root element tree
  elementIndex: Record<string, IRElement>;  // Flat map for quick lookup
}

export interface IRElement {
  id: string;
  type: IRElementType;  // 'view' | 'text' | 'image' | 'icon' | 'component-instance'
  name: string;
  classification: NodeClassification;
  layout: IRLayout;
  style: IRStyle;
  text?: IRTextContent;
  image?: IRImageContent;
  componentRef?: string;
  children: IRElement[];
}
```

**Why IR?**
- **Platform-Agnostic:** No React Native or Flutter specifics
- **Testable:** Validate structure independently before code generation
- **Extensible:** Add SwiftUI, Jetpack Compose generators without changing parsers

#### 4. IRBuilder (`src/ir/builder.ts`)

```typescript
export class IRBuilder {
  build(
    file: FigmaFile,
    fileKey: string,
    variablesResponse?: FigmaVariablesResponse
  ): DesignIR {
    // 1. Parse design tokens
    const rawTokens = variablesResponse ? parseVariables(variablesResponse) : [];
    const tokens = this.buildTokenSet(rawTokens);
    
    // 2. Extract and build screens
    const screenNodes = extractScreens(file);
    const screens = screenNodes.map(n => this.buildScreen(n));
    
    // 3. Parse and build components
    const parsedComponents = parseComponents(file);
    const components = parsedComponents
      .filter(c => c.atomicLevel !== 'screen')
      .map(c => this.buildComponent(c.node, c));
    
    // 4. Collect assets (icons, images)
    const assets: IRAsset[] = [];  // Populated during element walking
    
    // 5. Build metadata
    const meta: IRMeta = { ... };
    
    return { fileKey, fileName: file.name, tokens, screens, components, assets, meta };
  }
  
  private buildScreen(node: FigmaNode): IRScreen { ... }
  private buildComponent(node: FigmaNode, parsed): IRComponent { ... }
  private buildElement(node: FigmaNode, index): IRElement { ... }
  private buildLayout(node: FigmaNode): IRLayout { ... }
  private buildStyle(node: FigmaNode): IRStyle { ... }
}
```

**Process:**
1. Parse tokens (colors, spacing, typography)
2. Identify screens (top-level frames)
3. Build element trees (recursive walk)
4. Extract auto-layout → flex model
5. Extract fills/strokes/effects → styles
6. Map TEXT nodes → IRTextContent
7. Map VECTOR/image nodes → IRImageContent

### Utilities

**`utils/color.ts`**
```typescript
export function figmaColorToHex(color: FigmaColor): string
  // { r: 0.3, g: 0.4, b: 0.9, a: 1 } → "#6366f1"
  // { r: 0, g: 0, b: 0, a: 0.5 } → "#00000080"

export function figmaColorToRgba(color: FigmaColor): string
  // { r: 1, g: 0, b: 0, a: 0.5 } → "rgba(255, 0, 0, 0.500)"

export function isTransparent(color: FigmaColor): boolean
  // Returns true if alpha === 0

export function mixColors(a: FigmaColor, b: FigmaColor, ratio: number): FigmaColor
  // Linear interpolation between two colors
```

**`utils/logger.ts`**
```typescript
export const logger: winston.Logger  // Global logger
export function createLogger(module: string): winston.Logger
  // Returns child logger with module scope
  // Example: createLogger('FigmaClient') → logs tagged with { module: 'FigmaClient' }
```

**`utils/url-parser.ts`**
```typescript
export function parseFigmaUrl(url: string): ParsedFigmaUrl
  // Handles: https://www.figma.com/file/KEY/Name?node-id=...
  //          https://figma.com/design/KEY/Name
  //          Bare file key: "aBcDeF1234567890"
  // Returns: { fileKey, fileName?, nodeId? }

export function normaliseNodeId(nodeId: string): string
  // "0-1" → "0:1" (Figma uses colons in API, dashes in URLs)
```

### Tests (41 total, 85%+ coverage)

**`tests/figma/client.test.ts`** (10 tests)
- Fetches file, caches result, bypasses cache with force=true
- Throws FigmaAuthError on 403
- Throws FigmaApiError on 404
- Fetches variables, caches response
- Constructs correct query strings for getFileNodes
- Returns image URLs for exports
- Never caches image exports
- Clears cache correctly

**`tests/figma/parsers.test.ts`** (17 tests)
- parseVariables: Returns one token per variable per mode
- parseVariables: Marks alias tokens correctly
- parseVariables: Resolves colors to hex
- parseVariables: Assigns correct type (color, spacing, typography)
- parseVariables: Normalizes path to dot notation
- parseComponents: Finds all COMPONENT nodes
- parseComponents: Extracts variant properties
- parseComponents: Assigns atomic levels
- parseAutoLayout: Returns direction='none' for non-auto-layout
- parseAutoLayout: Maps HORIZONTAL → row, VERTICAL → column
- parseAutoLayout: Defaults padding to 0
- classifyNode: TEXT → text, VECTOR+icon → icon, large FRAME → screen
- extractScreens: Returns only top-level FRAME nodes
- resolveAlias: Follows alias chains, returns fallback on missing target

**`tests/ir/builder.test.ts`** (14 tests)
- Builds DesignIR with all top-level fields
- Extracts one screen with correct dimensions
- Generates PascalCase componentName
- Builds element index for quick lookup
- Maps TEXT node → text element with content
- Maps INSTANCE → component-instance
- Extracts backgroundColor from fill
- Extracts drop shadow from effects
- Includes design tokens when variables provided
- Reports accurate stats in meta
- parseFigmaUrl: Parses standard /file/ and /design/ URLs
- parseFigmaUrl: Accepts bare file key
- Color utilities: figmaColorToHex, figmaColorToRgba, isTransparent, mixColors

### Public API (`src/index.ts`)

**Exported:**
```typescript
// Types
export * from './figma/types.js';
export * from './ir/types.js';
export type { DesignToken, ParsedComponent, ... } from './figma/parsers.js';

// Classes
export { FigmaClient, FigmaApiError, FigmaAuthError, FigmaRateLimitError } from './figma/client.js';
export { IRBuilder } from './ir/builder.js';

// Functions
export { parseVariables, parseComponents, parseAutoLayout, ... } from './figma/parsers.js';
export { parseFigmaUrl, normaliseNodeId } from './utils/url-parser.js';
export { figmaColorToHex, figmaColorToRgba, isTransparent } from './utils/color.js';
export { createLogger } from './utils/logger.js';
```

**Usage Example (Phase 2 will do this):**
```typescript
import { 
  FigmaClient, 
  IRBuilder, 
  parseFigmaUrl 
} from '@appvelocity/agent-design-to-code-core';

const client = new FigmaClient({ accessToken: process.env.FIGMA_ACCESS_TOKEN! });
const { fileKey } = parseFigmaUrl('https://figma.com/file/abc123/MyApp');
const file = await client.getFile(fileKey);
const variables = await client.getLocalVariables(fileKey);
const ir = new IRBuilder().build(file, fileKey, variables);
// → ir.screens[0].root is the element tree ready for code generation
```

---

## What's Ready for Phase 2

### Available Now
1. ✅ **FigmaClient** — Can fetch any Figma file, variables, components, images
2. ✅ **Parsers** — Can extract tokens, components, auto-layout from raw Figma data
3. ✅ **IRBuilder** — Can transform FigmaFile → DesignIR
4. ✅ **Web Dashboard** — Can launch agents, stream logs via SSE
5. ✅ **Test Infrastructure** — Vitest configured, 41 tests passing

### Next Steps (Phase 2)
1. Create `packages/agents/design-to-code/workflow/` package
2. Define `WorkflowState` interface (shared across all nodes)
3. Implement 6 LangGraph nodes (InputValidator, Planner, Researcher, IRBuilder, Critic, Generator)
4. Wire nodes together with conditional edges
5. Write integration tests (Figma file → DesignIR)

See **PHASE_2_IMPLEMENTATION.md** for detailed spec.

---

**Last Updated:** March 24, 2026
