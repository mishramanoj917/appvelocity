# 🖥️ AppVelocity — Local IDE Setup Guide
### For Cursor and VS Code

---

## ⚡ TL;DR (5-minute setup)

```bash
# 1. Prerequisites check
node --version   # must be ≥ 18
pnpm --version   # must be ≥ 9  (npm i -g pnpm@9 if missing)

# 2. Clone
git clone https://github.com/yourusername/appvelocity.git
cd appvelocity

# 3. Install all packages
pnpm install

# 4. Environment
cp .env.example .env
# → Open .env and add your API keys (see Section 3 below)

# 5. Build shared packages first
pnpm build --filter=@appvelocity/shared-core

# 6. Launch the web dashboard
pnpm dev:web
# → Open http://localhost:3000
```

---

## 📋 Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Clone & Install](#2-clone--install)
3. [Environment Variables](#3-environment-variables)
4. [IDE Setup — Cursor](#4-ide-setup--cursor)
5. [IDE Setup — VS Code](#5-ide-setup--vs-code)
6. [Running the Project](#6-running-the-project)
7. [Project Structure Quick-Map](#7-project-structure-quick-map)
8. [Development Workflow](#8-development-workflow)
9. [Architecture: Web ↔ Agents](#9-architecture-web--agents)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | ≥ 18.0.0 | https://nodejs.org or `nvm install 20` |
| pnpm | ≥ 9.0.0 | `npm install -g pnpm@9` |
| Git | Any | https://git-scm.com |
| Figma Token | — | https://figma.com/developers/api#access-tokens |
| OpenAI or Anthropic key | — | platform.openai.com or console.anthropic.com |

### Quick version check
```bash
node --version    # → v20.x.x
pnpm --version    # → 9.x.x
git --version     # → git version 2.x.x
```

---

## 2. Clone & Install

```bash
# Clone
git clone https://github.com/yourusername/appvelocity.git
cd appvelocity

# Install ALL workspace packages in one command
pnpm install

# Build shared packages (needed before anything else can import them)
pnpm build --filter=@appvelocity/shared-core
pnpm build --filter=@appvelocity/shared-langgraph
```

> **Why two build steps?**  
> TypeScript monorepos require shared packages to be compiled before dependent
> packages can resolve their types. Turbo handles this automatically with `pnpm build`,
> but for the first run it's clearest to do it explicitly.

---

## 3. Environment Variables

```bash
cp .env.example .env
```

Open `.env` and fill in:

```bash
# ── Required ──────────────────────────────────────────────────────────────────

# Figma (needed for DesignToCodeAgent)
FIGMA_ACCESS_TOKEN=figd_xxxxxxxxxxxxxxxxxxxx

# LLM — choose ONE provider
LLM_PROVIDER=openai            # or: anthropic
OPENAI_API_KEY=sk-proj-...     # if LLM_PROVIDER=openai
ANTHROPIC_API_KEY=sk-ant-...   # if LLM_PROVIDER=anthropic

# ── Optional ──────────────────────────────────────────────────────────────────

# Redis (caching — fallback to in-memory if not set)
REDIS_URL=redis://localhost:6379
REDIS_ENABLED=false

# Logging
LOG_LEVEL=info                 # debug | info | warn | error
DEBUG=appvelocity:*            # detailed debug output

# Web app
NEXT_PUBLIC_API_URL=http://localhost:3000

# Rate limiting
FIGMA_RATE_LIMIT_PER_MINUTE=60
```

### Getting a Figma token
1. Log into figma.com
2. Click your avatar → **Settings**
3. Scroll to **Personal Access Tokens**
4. Click **Generate new token** → copy it

---

## 4. IDE Setup — Cursor

Cursor already reads `.cursor/rules` from the repo root, so most configuration
is automatic once you open the folder.

### Step-by-step

```
1. Open Cursor
2. File → Open Folder → select the appvelocity/ directory
3. Cursor will detect .cursor/rules and load AI context automatically
4. When prompted "Install recommended extensions?" → click Yes
5. Open the integrated terminal (Ctrl+` / Cmd+`)
```

### What `.cursor/rules` gives you
- Cursor AI understands the **AgentBase contract** and won't suggest deviations
- Knows all **import paths** (`@appvelocity/shared-core` not `../../shared/core`)
- Understands the **Next.js + SSE streaming** architecture
- Knows which agents are **planned vs active**
- Has the **Figma API endpoints** baked in for autocomplete context

### Recommended Cursor AI settings
Open **Cursor Settings → Features**:

| Setting | Value | Reason |
|---------|-------|--------|
| Context | Codebase | Enables whole-monorepo awareness |
| Model | claude-3-5-sonnet / gpt-4o | Strong reasoning for agent work |
| Always include | `.cursor/rules` | Ensures rules are always in context |

### Cursor Composer (multi-file editing)
Use **Cmd+I / Ctrl+I** to open Composer. Useful prompts:

```
"Implement Phase 1 of DesignToCodeAgent: build the Figma API client
in packages/agents/design-to-code/core/src/figma/client.ts.
Follow the AgentBase contract. Use axios with p-queue rate limiting."

"Add a new 'inspect' action to the DesignToCodeAgent launcher form."

"Wire the DesignToCodeAgent instance in lib/agent-registry.ts
using the constructor signature from @appvelocity/agent-design-to-code."
```

---

## 5. IDE Setup — VS Code

```
1. Open VS Code
2. File → Open Folder → select appvelocity/
3. When prompted "Install recommended extensions?" → Yes
   (or: Cmd+Shift+P → "Extensions: Show Recommended Extensions")
4. Open the integrated terminal: Ctrl+` / Cmd+`
```

### Key extensions (auto-installed from .vscode/extensions.json)

| Extension | Purpose |
|-----------|---------|
| **ESLint** | Live linting with TypeScript rules |
| **Prettier** | Auto-format on save |
| **Tailwind CSS IntelliSense** | Class name autocomplete |
| **Vitest Explorer** | Run/debug tests inline |
| **GitLens** | Git blame and history |
| **Error Lens** | Inline error display |
| **GitHub Copilot** | AI code completion |

### Debugging from VS Code

Press **F5** or go to **Run → Start Debugging** and choose a configuration:

| Configuration | What it does |
|--------------|-------------|
| `🌐 Web: Next.js Dev Server` | Starts the dashboard with debugger attached |
| `🎨 Agent: DesignToCodeAgent` | Starts the agent in watch mode |
| `🧪 Tests: Current File` | Runs Vitest on the file you have open |
| `🧪 Tests: All Packages` | Runs full test suite |
| `🚀 Full Dev (Web + DesignAgent)` | **Recommended**: starts everything |

### Setting breakpoints
Click the gutter (left of line numbers) in any `.ts` / `.tsx` file.
The debugger stops at that line regardless of whether it's in the web app,
an agent, or shared code.

---

## 6. Running the Project

### All at once (recommended during development)
```bash
pnpm dev
# Starts all packages in watch mode (Turbo coordinates dependency order)
# Web:  http://localhost:3000
# CLI:  watch mode (rebuilds on change)
```

### Web dashboard only
```bash
pnpm dev:web
# or
cd packages/web && pnpm dev
```

### Specific agent only
```bash
pnpm agent:design dev
# or
cd packages/agents/design-to-code && pnpm dev
```

### Build for production
```bash
pnpm build          # build everything in dependency order
pnpm build:web      # web only
```

### Tests
```bash
pnpm test           # all packages
pnpm test --filter=@appvelocity/agent-design-to-code   # one package
cd packages/agents/design-to-code && pnpm test:watch   # TDD mode
```

### Lint & format
```bash
pnpm lint           # ESLint across all packages
pnpm format         # Prettier across all packages
pnpm type-check     # tsc --noEmit across all packages
```

---

## 7. Project Structure Quick-Map

```
appvelocity/
│
├── .cursor/rules              ← Cursor AI context (read this!)
├── .vscode/                   ← VS Code settings, launch configs, extensions
├── .env.example               ← Copy to .env and fill in keys
│
├── packages/
│   ├── shared/
│   │   ├── core/              ← AgentBase interface, shared types, logger
│   │   │   └── src/index.ts   ← Start here to understand the platform contract
│   │   └── langgraph/         ← LangGraph workflow layer (Phase 3)
│   │
│   ├── agents/
│   │   └── design-to-code/    ← THE active agent (Phase 0 complete)
│   │       ├── core/          ← Phase 1: Figma API client + IR builder
│   │       ├── workflow/      ← Phase 3: LangGraph planner/researcher/critic
│   │       └── generators/    ← Phase 4: RN + Flutter code generators
│   │
│   ├── cli/
│   │   └── src/cli.ts         ← Unified CLI entry point
│   │
│   └── web/                   ← Next.js 14 dashboard
│       ├── app/
│       │   ├── page.tsx       ← Dashboard (all 7 agent cards)
│       │   ├── agents/[agentId]/page.tsx  ← Agent detail + launcher
│       │   └── api/agents/
│       │       ├── [agentId]/route.ts     ← POST: launch job
│       │       ├── status/[jobId]/route.ts ← GET: poll status
│       │       └── stream/[jobId]/route.ts ← GET: SSE stream
│       ├── components/
│       │   ├── agent-card/    ← AgentCard + AgentStatusBadge
│       │   └── agent-launcher/ ← Dynamic form + SSE consumer
│       └── lib/
│           ├── agents.config.ts   ← SINGLE SOURCE OF TRUTH for all 7 agents
│           └── agent-registry.ts  ← Wires config → live instances
```

---

## 8. Development Workflow

### Phase 1 work: Figma API client

```bash
# Navigate to the right package
cd packages/agents/design-to-code/core

# Start watch mode
pnpm dev

# Files to create (in order):
# 1. src/figma/types.ts      ← Figma API response types (Zod schemas)
# 2. src/figma/client.ts     ← FigmaAPIClient class
# 3. src/figma/parsers.ts    ← parseVariables(), parseComponents(), etc.
# 4. src/ir/types.ts         ← DesignIR interface
# 5. src/ir/builder.ts       ← IRBuilder class
# 6. tests/figma.test.ts     ← Unit tests
```

### After implementing an agent method, test it in the web UI:

1. Wire the instance in `packages/web/lib/agent-registry.ts`
2. Start `pnpm dev:web`
3. Open http://localhost:3000
4. Click **DesignToCodeAgent** → **Launch** tab
5. Fill in a Figma URL and click **Run**
6. Watch the SSE stream in the Output section

### Making the agent "active" in the UI

In `packages/web/lib/agent-registry.ts`, uncomment and fill in:
```typescript
this.map.get('design-to-code')!.instance = new DesignToCodeAgent({
  figmaToken: process.env.FIGMA_ACCESS_TOKEN!,
  llmConfig: {
    provider: process.env.LLM_PROVIDER as 'openai' | 'anthropic',
    apiKey: process.env.OPENAI_API_KEY ?? process.env.ANTHROPIC_API_KEY!,
  },
});
```
And change status to `'active'` in `agents.config.ts`.

---

## 9. Architecture: Web ↔ Agents

Understanding this flow prevents confusion:

```
Browser (React)
  │
  │  1. User clicks "Run Generate"
  │
  ▼
POST /api/agents/design-to-code
  {action: "generate", params: {figmaUrl, framework}}
  │
  │  2. API route validates input, creates a job
  │
  ▼
agentRegistry.get('design-to-code').instance.execute(input)
  │  ← This is the actual AgentBase.execute() call
  │  ← Runs async; tracked by jobStore
  │
  │  3. API returns immediately: {jobId, streamUrl}
  │
  ▼
Browser opens EventSource(streamUrl)
  │
  ▼
GET /api/agents/stream/{jobId}
  │  ← Polls jobStore every 500ms
  │  ← Emits SSE events: 'log', 'progress', 'complete', 'error'
  │
  ▼
Browser renders logs in real-time, shows result when done
```

### Key design decisions

**Why SSE instead of WebSockets?**  
SSE is uni-directional (server → client) which is all we need for agent output.
It works through proxies, is resumable, and is built into the browser.

**Why in-memory jobStore?**  
Good enough for local dev. In production, replace with Redis pub/sub — the
interface is the same, just swap the `jobStore` implementation.

**Why not call the agent directly from a Server Component?**  
Agents are long-running (minutes). Server Components have response timeouts.
The job queue pattern decouples execution from the HTTP lifecycle.

---

## 10. Troubleshooting

### `Module not found: @appvelocity/shared-core`
```bash
# Shared packages must be built before they can be imported
pnpm build --filter=@appvelocity/shared-core
# Then restart your dev server
```

### TypeScript errors after a `git pull`
```bash
pnpm install       # get any new dependencies
pnpm build         # rebuild compiled packages
# Restart TS server in VS Code: Cmd+Shift+P → "TypeScript: Restart TS Server"
```

### `pnpm install` fails with lockfile errors
```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Next.js can't find a workspace package
Check `next.config.js` → `transpilePackages` array. Add the package name if missing.

### Port 3000 already in use
```bash
# Find and kill the process
lsof -ti:3000 | xargs kill -9
# Or change the port
pnpm dev:web -- --port 3001
```

### Figma API returns 403
- Check `FIGMA_ACCESS_TOKEN` is set in `.env`
- Verify the token has access to the file (you must be a viewer or editor)
- Figma tokens expire if unused — regenerate at figma.com/settings

### LLM API errors
- Verify API key is correct and has credits
- Check `LLM_PROVIDER` matches the key you're using
- For Anthropic, ensure model string is exact: `claude-3-5-sonnet-20240620`

### Redis connection refused
Set `REDIS_ENABLED=false` in `.env` — the system falls back to in-memory caching.

---

## 📞 Quick Reference Card

```bash
# Setup
pnpm install                              # install all packages
cp .env.example .env                      # create env file
pnpm build --filter=@appvelocity/shared-* # build shared packages

# Daily dev
pnpm dev                                  # watch all packages
pnpm dev:web                              # web only (port 3000)
pnpm agent:design dev                     # design agent only

# Quality
pnpm test                                 # all tests
pnpm lint                                 # all linting
pnpm type-check                           # all type checks
pnpm format                               # prettier

# Clean start
pnpm clean                                # remove all dist/ and .next/
pnpm install && pnpm build                # fresh build

# Useful filters
pnpm --filter @appvelocity/web dev        # web only
pnpm --filter @appvelocity/shared-core build  # one package
```

---

## ✅ Setup Checklist

- [ ] Node.js ≥ 18 installed
- [ ] pnpm ≥ 9 installed
- [ ] Repo cloned
- [ ] `pnpm install` completed without errors
- [ ] `.env` created with API keys
- [ ] `pnpm build --filter=@appvelocity/shared-core` succeeded
- [ ] `pnpm dev:web` started successfully
- [ ] http://localhost:3000 shows the AppVelocity dashboard
- [ ] All 7 agent cards visible
- [ ] IDE opened (Cursor or VS Code)
- [ ] Recommended extensions installed

---

**You're ready to build! Start with Phase 1: Figma API Integration in `packages/agents/design-to-code/core/`.** 🚀
