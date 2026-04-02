# AppVelocity DesignToCodeAgent — Claude Code Context Document

This document provides complete context for continuing development in Claude Code.
Last updated: March 24, 2026 (after Phase 1 completion)

## Quick Start for Claude Code

```bash
# 1. Open the project in Claude Code
claude-code open ~/appvelocity-platform

# 2. Install dependencies
pnpm install

# 3. Run Phase 1 tests to verify everything works
pnpm --filter @appvelocity/agent-design-to-code-core test

# 4. Start the web dashboard
pnpm dev:web
# Open http://localhost:3000

# 5. Continue with Phase 2 implementation
# See PHASE_2_IMPLEMENTATION.md
```

## Context Files in This Package

1. **PROJECT_OVERVIEW.md** - High-level vision, business case, architecture
2. **COMPLETED_WORK.md** - Detailed Phase 0 & Phase 1 deliverables
3. **PHASE_2_IMPLEMENTATION.md** - Complete Phase 2 spec (LangGraph workflow)
4. **CODEBASE_MAP.md** - Directory structure, key files, import patterns
5. **CONVENTIONS.md** - Code style, naming, testing standards
6. **API_REFERENCES.md** - Key interfaces, types, and public APIs
7. **TROUBLESHOOTING.md** - Common issues and solutions

## Current Status

- ✅ **Phase 0 Complete:** Platform foundation (monorepo, web dashboard, shared core)
- ✅ **Phase 1 Complete:** Figma API integration layer (client, parsers, IR builder)
- 🔄 **Phase 2 Next:** LangGraph workflow orchestration (6 agent nodes)
- 📋 **Phase 3 Planned:** Code generators (React Native, Flutter)
- 📋 **Phase 4 Planned:** Integration with web dashboard

## Key Commands Reference

```bash
# Development
pnpm dev:web                          # Start web dashboard
pnpm dev:agents                       # Start all agent packages in watch mode
pnpm --filter <package-name> dev      # Start specific package

# Building
pnpm build                            # Build all packages
pnpm build --filter=@appvelocity/shared-core
pnpm build --filter=@appvelocity/agent-design-to-code-core

# Testing
pnpm test                             # Run all tests
pnpm --filter @appvelocity/agent-design-to-code-core test
pnpm --filter @appvelocity/agent-design-to-code-core test:coverage

# Code Quality
pnpm lint                             # Lint all packages
pnpm format                           # Format with Prettier
pnpm type-check                       # TypeScript type checking
```

## Important: This Project Uses pnpm Workspaces

- **Never use npm or yarn** — always use `pnpm`
- Packages reference each other via `workspace:*` protocol
- Run commands from root using `pnpm --filter <package-name> <command>`
- Turborepo caches builds across packages

## Next Steps for Development

1. Read **PHASE_2_IMPLEMENTATION.md** thoroughly
2. Study the AgentBase interface in `packages/shared/core/src/index.ts`
3. Look at Phase 1 code structure in `packages/agents/design-to-code/core/src/`
4. Start implementing PlannerAgent in `packages/agents/design-to-code/workflow/src/nodes/planner.ts`

## Where to Get Help

- **Architecture diagrams:** See `/architecture-diagrams/` folder (6 SVG files)
- **API documentation:** See API_REFERENCES.md in this folder
- **Code conventions:** See CONVENTIONS.md
- **Troubleshooting:** See TROUBLESHOOTING.md

---

**Ready to build Phase 2? Let's go! 🚀**
