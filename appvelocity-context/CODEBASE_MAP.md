# Codebase Map — File Locations & Import Patterns

Quick reference for navigating the AppVelocity monorepo.

## Root Structure

```
appvelocity-platform/
├── packages/              ← All code lives here
├── docs/                  ← Architecture docs, setup guides
├── architecture-diagrams/ ← 6 SVG diagrams for marketing
├── .cursor/rules          ← AI assistant context (3,500+ words)
├── .vscode/               ← VS Code settings, launch configs
├── package.json           ← Root package, defines workspaces
├── pnpm-workspace.yaml    ← Workspace paths
├── turbo.json             ← Build pipeline config
├── .env.example           ← Environment variables template
├── docker-compose.yml     ← Web + Redis services
└── setup.sh               ← One-shot setup script (macOS)
```

## Packages Directory

```
packages/
├── shared/
│   ├── core/           @appvelocity/shared-core
│   ├── langgraph/      @appvelocity/shared-langgraph (planned)
│   ├── integrations/   @appvelocity/shared-integrations (planned)
│   ├── ui/             @appvelocity/shared-ui (planned)
│   └── database/       @appvelocity/shared-database (planned)
├── agents/
│   ├── design-to-code/
│   │   ├── core/       @appvelocity/agent-design-to-code-core ✅
│   │   ├── workflow/   @appvelocity/agent-design-to-code-workflow (next)
│   │   └── generators/ @appvelocity/agent-design-to-code-generators (planned)
│   ├── access/         @appvelocity/agent-access (planned)
│   ├── shield/         @appvelocity/agent-shield (planned)
│   ├── testiq/         @appvelocity/agent-testiq (planned)
│   ├── perfect/        @appvelocity/agent-perfect (planned)
│   ├── compliance/     @appvelocity/agent-compliance (planned)
│   └── devboost/       @appvelocity/agent-devboost (planned)
├── web/                @appvelocity/web ✅
└── cli/                @appvelocity/cli (planned)
```

## Key Files by Function

### Shared Core (`packages/shared/core/`)
| File | Purpose | Exports |
|------|---------|---------|
| `src/index.ts` | Public API | `AgentBase`, `AgentInput`, `AgentOutput`, types |
| `package.json` | Dependencies | zod, winston |
| `tsconfig.json` | TS config | Extends root, strict mode |

### DesignToCode Core (`packages/agents/design-to-code/core/`)
| File | Purpose | Key Exports |
|------|---------|-------------|
| `src/index.ts` | Public API | All exports below |
| `src/figma/types.ts` | Figma API types | `FigmaFile`, `FigmaNode`, `FigmaVariable` |
| `src/figma/client.ts` | HTTP client | `FigmaClient`, `FigmaApiError` |
| `src/figma/parsers.ts` | Data extractors | `parseVariables`, `parseComponents`, `parseAutoLayout` |
| `src/ir/types.ts` | IR schema | `DesignIR`, `IRElement`, `IRTokenSet` |
| `src/ir/builder.ts` | IR builder | `IRBuilder` class |
| `src/utils/color.ts` | Color utils | `figmaColorToHex`, `figmaColorToRgba` |
| `src/utils/logger.ts` | Logging | `createLogger(module)` |
| `src/utils/url-parser.ts` | URL parsing | `parseFigmaUrl`, `normaliseNodeId` |

### Web Dashboard (`packages/web/`)
| File | Purpose | Key Content |
|------|---------|-------------|
| `lib/agents.config.ts` | Agent definitions | `AGENTS` array (7 agents) |
| `lib/agent-registry.ts` | Agent instances | `agentRegistry` singleton |
| `app/page.tsx` | Dashboard home | Grid of 7 agent cards |
| `app/agents/[agentId]/page.tsx` | Agent detail | Launcher + docs |
| `app/api/agents/[agentId]/route.ts` | Start job | POST: returns jobId |
| `app/api/agents/stream/[jobId]/route.ts` | SSE stream | GET: streams logs |
| `components/agent-launcher/AgentLauncher.tsx` | Form builder | Dynamic inputs + SSE |
| `components/agent-card/AgentCard.tsx` | Card component | Displays agent summary |
| `app/layout.tsx` | Root layout | Metadata, Tailwind setup |
| `app/globals.css` | Global styles | Tailwind directives |
| `tailwind.config.js` | Tailwind config | Colors, fonts |
| `next.config.js` | Next.js config | React strict mode |

## Import Patterns

### Within a Package
```typescript
// Relative imports
import { parseVariables } from './parsers.js';
import type { FigmaFile } from '../types.js';
```

### Across Packages (Workspace Dependencies)
```typescript
// From shared core
import { AgentBase, AgentInput, AgentOutput } from '@appvelocity/shared-core';

// From design-to-code core
import { 
  FigmaClient, 
  IRBuilder, 
  parseFigmaUrl 
} from '@appvelocity/agent-design-to-code-core';
```

### External Libraries
```typescript
// HTTP client
import axios from 'axios';
import axiosRetry from 'axios-retry';

// Rate limiting
import PQueue from 'p-queue';

// Caching
import { LRUCache } from 'lru-cache';

// Logging
import winston from 'winston';

// Validation
import { z } from 'zod';

// LangGraph (Phase 2)
import { StateGraph, END } from '@langchain/langgraph';
import { ChatAnthropic } from '@langchain/anthropic';
```

## File Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| TypeScript source | `kebab-case.ts` | `url-parser.ts` |
| React components | `PascalCase.tsx` | `AgentCard.tsx` |
| Test files | `*.test.ts` | `client.test.ts` |
| Config files | `kebab-case.json` | `tsconfig.json` |
| Markdown docs | `SCREAMING_SNAKE_CASE.md` | `README.md` |

## Build Outputs

| Package | Output Dir | Entry Point |
|---------|------------|-------------|
| `@appvelocity/shared-core` | `dist/` | `dist/index.js` |
| `@appvelocity/agent-design-to-code-core` | `dist/` | `dist/index.js` |
| `@appvelocity/web` | `.next/` | `.next/server/app/page.js` |

## Environment Variables

```bash
# .env (create from .env.example)
FIGMA_ACCESS_TOKEN=figd_...         # Required for Figma API
LLM_PROVIDER=openai                 # 'openai' or 'anthropic'
OPENAI_API_KEY=sk-...               # If LLM_PROVIDER=openai
ANTHROPIC_API_KEY=sk-ant-...        # If LLM_PROVIDER=anthropic
FIGMA_RATE_LIMIT_PER_MINUTE=60      # Default: 60
LOG_LEVEL=info                      # debug | info | warn | error
NODE_ENV=development                # development | production
```

## Common Tasks → File Locations

| Task | File to Edit |
|------|--------------|
| Add new agent | `packages/web/lib/agents.config.ts` (add to `AGENTS` array) |
| Wire agent instance | `packages/web/lib/agent-registry.ts` (constructor) |
| Add shared type | `packages/shared/core/src/index.ts` |
| Add Figma type | `packages/agents/design-to-code/core/src/figma/types.ts` |
| Add IR type | `packages/agents/design-to-code/core/src/ir/types.ts` |
| Add parser function | `packages/agents/design-to-code/core/src/figma/parsers.ts` |
| Add utility | `packages/agents/design-to-code/core/src/utils/` |
| Add API route | `packages/web/app/api/` |
| Add React component | `packages/web/components/` |
| Add test | `packages/<package>/tests/` |
| Update docs | `docs/` or `README.md` in relevant package |

## Quick File Finder

```bash
# Find all TypeScript source files
find packages -name "*.ts" -not -path "*/node_modules/*" -not -path "*/dist/*"

# Find all test files
find packages -name "*.test.ts"

# Find all React components
find packages/web -name "*.tsx"

# Find all config files
find . -name "*.config.*" -maxdepth 3
```

## Git Workflow

```bash
# Typical commit cycle
git add packages/agents/design-to-code/workflow/src/nodes/planner.ts
git commit -m "feat(workflow): implement PlannerAgent with LLM integration"

# Run tests before pushing
pnpm test

# Build all packages before deployment
pnpm build
```

## Monorepo Navigation Tips

1. **Use pnpm filters:** `pnpm --filter <package-name> <command>`
2. **Turborepo caches builds:** Second build is instant if nothing changed
3. **Workspace dependencies always up-to-date:** Changes propagate automatically
4. **Import from published API:** Never import from `src/` across packages
5. **Check package.json exports:** Only exported paths are public
