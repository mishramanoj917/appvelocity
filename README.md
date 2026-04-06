# AppVelocity Platform

AI-powered development velocity platform — a suite of intelligent agents that automate high-effort engineering tasks.

---

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env
# Fill in FIGMA_ACCESS_TOKEN and ANTHROPIC_API_KEY

# 3. Build all packages (dependency order matters)
pnpm -F @appvelocity/shared-core build
pnpm -F @appvelocity/agent-design-to-code-core build
pnpm -F @appvelocity/agent-design-to-code-generators build
pnpm -F @appvelocity/agent-design-to-code-workflow build

# 4. Start the web dashboard
pnpm -F @appvelocity/web dev
```

Open [http://localhost:3000](http://localhost:3000) and launch the DesignToCode agent.

---

## DesignToCode Agent — Implementation Roadmap

### Completed

| Phase | Scope | Status |
|-------|-------|--------|
| **Phase 1 — Core** | Figma API client, parsers, DesignIR types, IR builder | ✅ Done |
| **Phase 2 — Workflow** | LangGraph 6-node pipeline, LLM client (Anthropic), all node stubs | ✅ Done |
| **Phase 3 — Code Generators** | ReactNativeGenerator, FlutterGenerator, token mappers, full test suite | ✅ Done |
| **Phase 4 — Agent Adapter** | `DesignToCodeAgent` wrapping `compiledWorkflow`, registry wiring, web deps | ✅ Done |

### Remaining to reach full end-to-end functionality

#### Phase 5 — Live node implementations (LLM-powered nodes)

The following nodes have stubs that need real LLM prompt implementations:

| Node | File | What's needed |
|------|------|---------------|
| `PlannerAgent` | `workflow/src/nodes/planner.ts` | LLM call → parse JSON into `ExecutionPlan` |
| `CriticAgent` | `workflow/src/nodes/critic.ts` | LLM call → evaluate DesignIR, return `IRValidationResult` |

The `ResearcherAgent` and `IRBuilderAgent` are data-pipeline nodes (no LLM) but may need integration with the Figma variables API.

**Prerequisites:**
- `ANTHROPIC_API_KEY` set in `.env`
- `FIGMA_ACCESS_TOKEN` set in `.env` with read access to the target file

**Effort:** ~2–3 days

---

#### Phase 6 — End-to-end integration testing

Run the full workflow against a real Figma file:

```bash
# From the repo root
node -e "
const { compiledWorkflow } = require('./packages/agents/design-to-code/workflow/dist/index.js');
compiledWorkflow.invoke({
  figmaUrl: 'https://www.figma.com/file/YOUR_FILE_KEY/YourFile',
  targetFramework: 'react-native',
  options: { verbose: true },
}).then(s => console.log(JSON.stringify(s.generatedCode, null, 2)));
"
```

**Prerequisites:** Phases 1–5 complete, real credentials in `.env`.

**Effort:** 1 day (mostly debugging prompt outputs and IR edge cases)

---

#### Phase 7 — Web dashboard UI for DesignToCode

The agent is now wired into the registry (`status: 'active'`). The web dashboard needs:

1. **Agent launch form** (`packages/web/app/agents/design-to-code/page.tsx`)
   - Input fields: Figma URL, framework selector (React Native / Flutter), options checkboxes
   - POST to `/api/agents/design-to-code`

2. **Job status / streaming page** (`packages/web/app/agents/design-to-code/jobs/[jobId]/page.tsx`)
   - Poll `/api/agents/status/[jobId]` or consume SSE from `/api/agents/stream/[jobId]`
   - Display live logs, current step, progress bar

3. **Code output viewer**
   - Syntax-highlighted file explorer showing generated `.tsx` / `.dart` files
   - Download as `.zip`

**Effort:** 3–4 days

---

#### Phase 8 — Code output delivery

Once files are generated they need to be delivered to the user:

- **Option A (simplest):** Zip the `CodeBundle.files` array and stream back as a file download
- **Option B:** Push to a new GitHub repo branch via GitHub API
- **Option C:** Preview in a StackBlitz / CodeSandbox embed

**Effort:** 1–2 days for Option A

---

## Environment Variables

See [.env.example](.env.example) for the full reference. Minimum required:

```bash
FIGMA_ACCESS_TOKEN=figd_...    # Figma Personal Access Token
ANTHROPIC_API_KEY=sk-ant-...   # Anthropic API key
ANTHROPIC_MODEL=claude-sonnet-4-6
```

---

## Monorepo Structure

```
packages/
  agents/
    design-to-code/
      core/        — Figma client, parsers, DesignIR types
      generators/  — ReactNativeGenerator, FlutterGenerator
      workflow/    — LangGraph pipeline + DesignToCodeAgent adapter
  shared/
    core/          — AgentBase, shared interfaces
    ui/            — Component library
  web/             — Next.js 14 dashboard
docs/
  index.html       — Public marketing page (GitHub Pages)
```

---

## Running Tests

```bash
# All packages
pnpm test

# Individual packages
pnpm -F @appvelocity/agent-design-to-code-core test
pnpm -F @appvelocity/agent-design-to-code-generators test
pnpm -F @appvelocity/agent-design-to-code-workflow test
```
