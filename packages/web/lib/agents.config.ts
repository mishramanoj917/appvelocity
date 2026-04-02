/**
 * agents.config.ts
 *
 * Single source of truth for every agent in AppVelocity.
 * The web UI, CLI, registry, and documentation all derive from this file.
 *
 * Adding a new agent:
 *   1. Add an entry here
 *   2. Create packages/agents/<id>/  (implement AgentBase)
 *   3. Register the instance in lib/agent-registry.ts
 *   Done – no other changes needed.
 */

export type AgentStatus = 'active' | 'planned' | 'beta';

export interface AgentConfig {
  /** Unique slug used in routes: /agents/[id], /api/agents/[id] */
  id: string;
  /** Display name */
  name: string;
  /** Short subtitle shown on the card */
  subtitle: string;
  /** Full value proposition sentence */
  valueProposition: string;
  /** Emoji icon */
  icon: string;
  /** Tailwind-compatible hex colour for accent */
  color: string;
  /** 'active' = live, 'beta' = limited, 'planned' = coming soon */
  status: AgentStatus;
  /** List of capability strings shown in the UI */
  capabilities: string[];
  /** Actions this agent accepts when status === 'active' */
  actions?: AgentAction[];
  /** Link to the agent's internal documentation */
  docsHref?: string;
}

export interface AgentAction {
  /** Sent as { action } in the POST body */
  id: string;
  /** Human label in the launcher UI */
  label: string;
  /** Description of what this action does */
  description: string;
  /** Parameter fields to render as form inputs */
  params: ActionParam[];
}

export interface ActionParam {
  key: string;
  label: string;
  type: 'text' | 'url' | 'select' | 'number' | 'boolean';
  placeholder?: string;
  required?: boolean;
  options?: { label: string; value: string }[];
  defaultValue?: string | number | boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent definitions
// ─────────────────────────────────────────────────────────────────────────────

export const AGENTS: AgentConfig[] = [
  // ── 1 ──────────────────────────────────────────────────────────────────────
  {
    id: 'design-to-code',
    name: 'DesignToCodeAgent',
    subtitle: 'Figma → Production Mobile Code',
    valueProposition:
      'Transforms Figma designs into production-ready, framework-specific mobile code using an agentic Plan → Research → Execute → Reflect → Generate workflow.',
    icon: '🎨',
    color: '#6366f1',
    status: 'active',
    capabilities: [
      'Full design system extraction (tokens, components, screens)',
      'React Native code generation',
      'Flutter code generation',
      'SwiftUI code generation (coming)',
      'Jetpack Compose code generation (coming)',
      'Auto-layout → Flexbox mapping',
      'Light / dark mode theme generation',
      'LangGraph agentic workflow with reflection',
    ],
    actions: [
      {
        id: 'generate',
        label: 'Generate Code',
        description: 'Extract and convert a full Figma file into mobile code',
        params: [
          {
            key: 'figmaUrl',
            label: 'Figma File URL',
            type: 'url',
            placeholder: 'https://www.figma.com/file/...',
            required: true,
          },
          {
            key: 'framework',
            label: 'Target Framework',
            type: 'select',
            required: true,
            options: [
              { label: 'React Native', value: 'react-native' },
              { label: 'Flutter', value: 'flutter' },
            ],
            defaultValue: 'react-native',
          },
          {
            key: 'outputDir',
            label: 'Output Directory',
            type: 'text',
            placeholder: './output',
            defaultValue: './output',
          },
        ],
      },
      {
        id: 'inspect',
        label: 'Inspect & Export IR',
        description: 'Analyse the Figma file and export the Intermediate Representation as JSON',
        params: [
          {
            key: 'figmaUrl',
            label: 'Figma File URL',
            type: 'url',
            placeholder: 'https://www.figma.com/file/...',
            required: true,
          },
        ],
      },
    ],
    docsHref: '/docs/agents/design-to-code',
  },

  // ── 2 ──────────────────────────────────────────────────────────────────────
  {
    id: 'access',
    name: 'AccessAgent',
    subtitle: 'Mobile Accessibility Intelligence Suite',
    valueProposition:
      'Automated accessibility compliance scanning, remediation suggestions, and continuous monitoring — ensuring WCAG 2.1/2.2, ADA, and regional accessibility standards compliance.',
    icon: '♿',
    color: '#22c55e',
    status: 'planned',
    capabilities: [
      'WCAG 2.1/2.2 Level AA/AAA automated scanning',
      'ADA compliance validation',
      'EN 301 549 / Section 508 checks',
      'TalkBack & VoiceOver compatibility testing',
      'Color contrast and font size validation',
      'Touch target size verification (44×44 pt)',
      'Automated remediation suggestions with code patches',
      'CI/CD integration for continuous monitoring',
    ],
    docsHref: '/docs/agents/access',
  },

  // ── 3 ──────────────────────────────────────────────────────────────────────
  {
    id: 'shield',
    name: 'ShieldAgent',
    subtitle: 'Mobile Security & Vulnerability Accelerator',
    valueProposition:
      'AI-powered security scanning, penetration testing, code vulnerability detection, and automated remediation for mobile applications.',
    icon: '🛡️',
    color: '#ef4444',
    status: 'planned',
    capabilities: [
      'Static Application Security Testing (SAST)',
      'Dynamic Application Security Testing (DAST)',
      'OWASP Mobile Top 10 vulnerability scanning',
      'Dependency & third-party SDK analysis',
      'API security testing and validation',
      'Certificate pinning verification',
      'Keychain / KeyStore secure storage analysis',
      'Automated security patch generation',
      'MASVS compliance checks',
    ],
    docsHref: '/docs/agents/shield',
  },

  // ── 4 ──────────────────────────────────────────────────────────────────────
  {
    id: 'perfect',
    name: 'PerfectAgent',
    subtitle: 'Intelligent Performance Optimization Engine',
    valueProposition:
      'Real-time performance monitoring, predictive analytics, automated optimization, and user experience scoring.',
    icon: '⚡',
    color: '#f59e0b',
    status: 'planned',
    capabilities: [
      'Real-time profiling (CPU, memory, battery)',
      'App startup time optimization',
      'Frame rate & jank detection (60 / 120 fps)',
      'Memory leak detection and prevention',
      'Network request optimization',
      'Image and asset optimization',
      'Predictive performance analytics',
      'UX scoring and cross-device benchmarking',
    ],
    docsHref: '/docs/agents/perfect',
  },

  // ── 5 ──────────────────────────────────────────────────────────────────────
  {
    id: 'testiq',
    name: 'TestIQAgent',
    subtitle: 'Mobile Testing Automation Suite',
    valueProposition:
      'AI-driven test generation, self-healing tests, visual regression testing, and cross-device compatibility validation.',
    icon: '🧪',
    color: '#8b5cf6',
    status: 'planned',
    capabilities: [
      'AI-driven unit test generation',
      'Integration and E2E test creation (Detox, Appium)',
      'Visual regression testing across devices',
      'Self-healing tests (auto-fix on UI changes)',
      'Cross-device compatibility validation',
      'Test data synthesis and generation',
      'Flaky test detection and fixing',
      'Device farm integration',
    ],
    docsHref: '/docs/agents/testiq',
  },

  // ── 6 ──────────────────────────────────────────────────────────────────────
  {
    id: 'devboost',
    name: 'DevBoostAgent',
    subtitle: 'Mobile Development Productivity Accelerator',
    valueProposition:
      'AI-powered code generation, architecture recommendations, technical debt analysis, and developer productivity insights.',
    icon: '🚀',
    color: '#06b6d4',
    status: 'planned',
    capabilities: [
      'Boilerplate code generation (screens, components, services)',
      'Architecture recommendations (MVVM, Clean Architecture)',
      'API client generation from OpenAPI / Swagger',
      'State management setup (Redux, MobX, Provider, Riverpod)',
      'Navigation structure generation',
      'Technical debt identification and scoring',
      'Code complexity analysis',
      'CI/CD pipeline generation',
    ],
    docsHref: '/docs/agents/devboost',
  },

  // ── 7 ──────────────────────────────────────────────────────────────────────
  {
    id: 'compliance',
    name: 'ComplianceAgent',
    subtitle: 'Compliance & Privacy Guardian',
    valueProposition:
      'Automated privacy law compliance (GDPR, CCPA, PIPEDA), data flow mapping, consent management, and regulatory reporting.',
    icon: '📋',
    color: '#ec4899',
    status: 'planned',
    capabilities: [
      'GDPR compliance checking and validation',
      'CCPA compliance (California)',
      'PIPEDA compliance (Canada)',
      'Data flow mapping and visualisation',
      'PII detection and classification',
      'Consent management implementation',
      'Privacy policy generation',
      'App Store privacy label generation',
      'Third-party SDK privacy analysis',
    ],
    docsHref: '/docs/agents/compliance',
  },
];

/** Convenience lookup by id */
export const AGENT_MAP = new Map(AGENTS.map((a) => [a.id, a]));
