# AppVelocity Platform — Project Overview

## Vision

**AppVelocity is an AI-powered mobile development acceleration platform that transforms Figma designs into production-ready mobile code in minutes, not weeks.**

The flagship agent, **DesignToCodeAgent**, automatically generates pixel-perfect React Native and Flutter code directly from Figma files, maintaining 100% design fidelity while enforcing accessibility and security best practices.

## Business Case

### The Problem
- **Manual Implementation:** Developers spend 2-3 weeks per screen translating static Figma mockups into code
- **Design Drift:** Back-and-forth iterations between designers and developers cause inconsistencies
- **Repetitive Work:** 70% of mobile UI code is boilerplate (layouts, styling, navigation)
- **Accessibility Gaps:** Manual implementation often skips WCAG compliance

### The Solution
- **90% Faster:** Automated pipeline reduces 2-3 weeks to 2-3 hours per screen
- **100% Fidelity:** Direct Figma API integration eliminates interpretation errors
- **Built-in Quality:** Accessibility, security, and performance checks are automatic
- **Multi-Framework:** Generate both React Native and Flutter from a single design

### ROI
- **Cost Reduction:** $50K-100K saved per project (assuming 20 screens)
- **Time to Market:** Ship 3x faster than traditional development
- **Quality Improvement:** Zero accessibility defects, consistent component usage
- **Developer Satisfaction:** Engineers focus on business logic, not pixel pushing

## Technical Architecture

### Multi-Agent System (7 Specialized Agents)

1. **DesignToCodeAgent** (Phase 0-4) — Figma → Code transformation
2. **AccessAgent** (Planned) — WCAG AA/AAA compliance validation
3. **ShieldAgent** (Planned) — Security hardening (XSS, injection prevention)
4. **PerfectAgent** (Planned) — Performance optimization (bundle size, lazy loading)
5. **TestIQAgent** (Planned) — Automated test generation (unit, integration, E2E)
6. **ComplianceAgent** (Planned) — Regulatory compliance (GDPR, HIPAA, PCI DSS)
7. **DevBoostAgent** (Planned) — Developer experience (docs, CI/CD setup)

### DesignToCodeAgent Workflow (LangGraph)

```
Figma URL → InputValidator → PlannerAgent (LLM) → ResearcherAgent → IRBuilderAgent → 
CriticAgent (LLM) → GeneratorAgent (LLM) → Production Code
```

**Key Innovation:** Platform-agnostic Intermediate Representation (IR)
- Figma data is parsed once into IR
- Multiple generators (React Native, Flutter, SwiftUI, Jetpack Compose) consume the same IR
- Add new frameworks without touching Figma integration

### Technology Stack

- **Frontend:** Next.js 14, React 18, Tailwind CSS, TypeScript 5.4
- **Backend:** Next.js API Routes, Server-Sent Events (SSE) for streaming
- **Orchestration:** LangGraph OSS (multi-agent workflow)
- **LLMs:** Claude Sonnet 4 (primary), GPT-4o (fallback)
- **APIs:** Figma REST API, Anthropic API, OpenAI API
- **Infrastructure:** pnpm workspaces, Turborepo, Vitest, Winston logging
- **Deployment:** Docker, Vercel (web), AWS Lambda (agents)

### Data Flow

```
Stage 1: Raw Figma Data (FigmaFile, FigmaNode, FigmaVariable)
   ↓ [Parsers: parseVariables, parseComponents, parseAutoLayout]
Stage 2: Intermediate Representation (DesignIR, IRElement, IRTokenSet)
   ↓ [Generators: RNComponentGen, FlutterWidgetGen]
Stage 3: Production Code (React Native .tsx, Flutter .dart)
```

## Project Structure (Monorepo)

```
appvelocity-platform/
├── packages/
│   ├── shared/
│   │   ├── core/           ← AgentBase interface, types
│   │   ├── langgraph/      ← Workflow orchestration utilities
│   │   ├── integrations/   ← Figma, GitHub, LLM clients
│   │   ├── ui/             ← Shared React components
│   │   └── database/       ← DB adapters (future)
│   ├── agents/
│   │   └── design-to-code/
│   │       ├── core/       ← Phase 1: Figma API + IR builder (DONE)
│   │       ├── workflow/   ← Phase 2: LangGraph nodes (NEXT)
│   │       └── generators/ ← Phase 3: RN/Flutter templates (PLANNED)
│   ├── web/                ← Next.js dashboard (DONE)
│   └── cli/                ← CLI tool (future)
├── docs/                   ← Architecture docs, API references
├── .cursor/rules           ← AI assistant context
└── architecture-diagrams/  ← 6 SVG diagrams for sales/marketing
```

## Development Phases

### Phase 0: Foundation ✅ COMPLETE
- Monorepo structure (pnpm workspaces + Turborepo)
- Shared core package (`@appvelocity/shared-core`)
- Web dashboard (Next.js 14 + SSE streaming)
- IDE configuration (.cursor/rules, .vscode/*)
- Docker Compose setup

### Phase 1: Figma API Integration Layer ✅ COMPLETE
- **FigmaClient:** Production HTTP client (rate limiting, retry, LRU cache)
- **Parsers:** Extract tokens, components, auto-layout from Figma data
- **IR Types:** Platform-agnostic schema (DesignIR, IRElement, IRTokenSet)
- **IRBuilder:** Transforms FigmaFile → DesignIR
- **Tests:** 41 passing tests, 85%+ coverage
- **Lines of Code:** ~1,400 LOC across 16 files

### Phase 2: LangGraph Workflow 🔄 NEXT
- Define WorkflowState schema (shared across all nodes)
- Implement 6 agent nodes:
  1. InputValidator
  2. PlannerAgent (LLM: analyze design, create execution plan)
  3. ResearcherAgent (fetch Figma data via FigmaClient)
  4. IRBuilderAgent (orchestrate IRBuilder)
  5. CriticAgent (LLM: validate IR quality, accessibility)
  6. GeneratorAgent (LLM: synthesize code from IR)
- Decision routing (conditional edges based on validation results)
- Error handling & retry loops (max 2 retries on critic failures)
- Integration tests (E2E: Figma file → DesignIR)

### Phase 3: Code Generators 📋 PLANNED
- React Native generator (components, StyleSheet, navigation)
- Flutter generator (widgets, themes, routes)
- Template system (Handlebars or EJS)
- Golden file snapshot tests

### Phase 4: Integration 📋 PLANNED
- Wire DesignToCodeAgent to web dashboard
- Job queue system (Redis streams for production)
- Asset management (download icons/images from Figma CDN)
- Real-time progress updates via SSE

## Key Design Decisions

### 1. Why LangGraph?
- **State Management:** Persistent WorkflowState across all nodes
- **Conditional Routing:** Dynamic decision points (e.g., retry on critic failure)
- **Checkpointing:** Resume workflows after errors
- **Open Source:** No vendor lock-in, full control

### 2. Why IR (Intermediate Representation)?
- **Framework Agnostic:** Parse Figma once, generate multiple outputs
- **Testability:** Validate IR independently before code generation
- **Extensibility:** Add new frameworks (SwiftUI, Jetpack Compose) without changing parsers

### 3. Why Multi-Agent Architecture?
- **Separation of Concerns:** Each agent has a single responsibility
- **Reusability:** AccessAgent can validate any code, not just DesignToCode output
- **Scalability:** Agents run independently, can be deployed separately

### 4. Why SSE (Server-Sent Events)?
- **Real-time Streaming:** Users see progress logs as they happen
- **Simpler than WebSockets:** HTTP-based, works through firewalls/proxies
- **Scalable:** Upgrade to Redis pub/sub for multi-instance deployments

## Target Users

### Primary
- **Mobile Development Teams** (5-50 engineers) at product companies
- **Digital Agencies** building apps for clients
- **Startups** with limited engineering resources

### Use Cases
1. **Rapid Prototyping:** Convert Figma mockups to functional MVP in days
2. **Design System Migration:** Bulk-convert legacy screens to new design tokens
3. **Cross-Platform Development:** Maintain iOS + Android codebases from single Figma source
4. **Outsourcing QA:** Agencies use DesignToCodeAgent, then customize generated code

## Success Metrics

### Technical
- **Code Quality:** 85%+ test coverage, zero accessibility violations
- **Performance:** <3 minutes per screen (Figma → code)
- **Accuracy:** 95%+ design fidelity (measured by visual diff)

### Business
- **Adoption:** 100 active users within 6 months
- **Revenue:** $50K MRR by end of year
- **Customer Satisfaction:** NPS > 50

### Engineering
- **Test Coverage:** 85%+ across all packages
- **Build Time:** <2 minutes for full platform build
- **Uptime:** 99.9% SLA for production API

## Competitive Landscape

### Existing Solutions
1. **Anima (anima.app):** Figma → React, but no multi-agent orchestration, limited customization
2. **Builder.io:** Visual editor → code, but requires learning their platform
3. **Framer:** Design → React, but locked to their hosting
4. **Figma Dev Mode:** Shows CSS snippets, but no full component generation

### AppVelocity Differentiators
- **Multi-Framework:** React Native + Flutter (others focus on web)
- **AI-Powered:** LLM agents understand design intent, not just pixels
- **Enterprise-Ready:** Accessibility, security, compliance built-in
- **Open Architecture:** Self-hostable, extensible, no vendor lock-in

## Roadmap (Next 12 Months)

### Q1 2026 ✅ DONE
- Phase 0: Foundation
- Phase 1: Figma API integration
- Architecture diagrams for sales/marketing

### Q2 2026 🔄 IN PROGRESS
- Phase 2: LangGraph workflow
- Phase 3: React Native generator
- Phase 4: Web dashboard integration
- Beta launch (10 design partners)

### Q3 2026 📋 PLANNED
- Flutter generator
- AccessAgent (accessibility)
- TestIQAgent (test generation)
- Public launch

### Q4 2026 📋 PLANNED
- ShieldAgent, PerfectAgent, ComplianceAgent
- Enterprise features (SSO, RBAC, audit logs)
- On-premise deployment option
- Scale to 100 active customers

## Team & Roles

### Current (Solo Developer + AI)
- **Developer:** Implements all phases
- **Claude (AI):** Pair programming, code review, architecture guidance

### Future Hires (as revenue scales)
- **Frontend Engineer:** Web dashboard, component library
- **Backend Engineer:** API optimization, infrastructure
- **DevOps Engineer:** Deployment, monitoring, scaling
- **Designer:** Brand, marketing site, demo content

## Contact & Links

- **Project Repository:** (Private monorepo)
- **Documentation:** `/docs` folder in monorepo
- **Architecture Diagrams:** `/architecture-diagrams` (6 SVG files)
- **Demo:** http://localhost:3000 (after running `pnpm dev:web`)

---

**Last Updated:** March 24, 2026 (Phase 1 complete, Phase 2 starting)
