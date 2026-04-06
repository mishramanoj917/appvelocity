/**
 * agent-registry.ts
 *
 * Wires the static AgentConfig definitions to live AgentBase instances.
 *
 * Status mapping:
 *   'active'  → instance is available and will be constructed
 *   'planned' → no instance; API returns 503 with a helpful message
 *   'beta'    → instance available, labelled as experimental
 *
 * When you implement a new agent:
 *   1. Import the class
 *   2. Add it to LIVE_AGENTS below
 *   3. Change its status in agents.config.ts to 'active' or 'beta'
 */

import type { AgentBase } from '@appvelocity/shared-core';
import { AGENTS, type AgentStatus } from './agents.config';

// ─── Import live agent instances here as they are built ──────────────────────
import { DesignToCodeAgent } from '@appvelocity/agent-design-to-code-workflow';

interface RegistryEntry {
  name: string;
  version: string;
  description: string;
  capabilities: string[];
  plannedCapabilities?: string[];
  status: AgentStatus;
  instance?: AgentBase;
}

/** Map of agentId → registry entry */
class AgentRegistry {
  private map = new Map<string, RegistryEntry>();

  constructor() {
    // Pre-populate with all config (no instances yet for planned agents)
    for (const agent of AGENTS) {
      this.map.set(agent.id, {
        name: agent.name,
        version: '0.1.0',
        description: agent.valueProposition,
        capabilities: agent.capabilities,
        plannedCapabilities: agent.status === 'planned' ? agent.capabilities : undefined,
        status: agent.status,
        instance: undefined, // Set below for active agents
      });
    }

    // ── Wire active agent instances here ─────────────────────────────────────
    this.map.get('design-to-code')!.instance = new DesignToCodeAgent();
    // ─────────────────────────────────────────────────────────────────────────
  }

  get(agentId: string): RegistryEntry | undefined {
    return this.map.get(agentId);
  }

  list(): Array<{ id: string } & RegistryEntry> {
    return Array.from(this.map.entries()).map(([id, entry]) => ({ id, ...entry }));
  }

  listActive(): Array<{ id: string } & RegistryEntry> {
    return this.list().filter((e) => e.status === 'active' || e.status === 'beta');
  }
}

// Singleton — constructed once per server process
export const agentRegistry = new AgentRegistry();
