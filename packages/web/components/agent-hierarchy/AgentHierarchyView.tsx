'use client';

/**
 * AgentHierarchyView
 *
 * Renders a hierarchical tree of agent → tool invocations from a list of
 * pipeline step strings (e.g. "fetch_figma [iter 1]").
 *
 * Props:
 *   steps      — ordered step strings from job.steps or derived from callTimeline
 *   isLive     — when true, the last active tool shows a pulse animation
 *   standalone — when true (default), wraps content in an av-card with heading
 */

import { PIPELINE, TOOL_TO_AGENT, TOOL_LABEL, parseStep } from '@/lib/pipeline-config';

interface Props {
  steps: string[];
  isLive?: boolean;
  /** When false, renders content only — no av-card wrapper or section heading */
  standalone?: boolean;
}

interface AgentGroup {
  agentId:   string;
  toolCalls: { tool: string; count: number }[];
}

function buildGroups(steps: string[]): AgentGroup[] {
  const agentOrder: string[] = [];
  const toolCountMap: Record<string, Record<string, number>> = {};

  for (const s of steps) {
    const { tool } = parseStep(s);
    const agentId  = TOOL_TO_AGENT[tool];
    if (!agentId) continue;

    if (!toolCountMap[agentId]) {
      toolCountMap[agentId] = {};
      agentOrder.push(agentId);
    }
    toolCountMap[agentId]![tool] = (toolCountMap[agentId]![tool] ?? 0) + 1;
  }

  return agentOrder.map((agentId) => ({
    agentId,
    toolCalls: Object.entries(toolCountMap[agentId] ?? {}).map(([tool, count]) => ({
      tool,
      count,
    })),
  }));
}

function HierarchyTree({ steps, isLive }: { steps: string[]; isLive?: boolean }) {
  const groups      = buildGroups(steps);
  const lastStep    = steps[steps.length - 1];
  const lastTool    = lastStep ? parseStep(lastStep).tool : '';
  const activeAgentId = lastTool ? (TOOL_TO_AGENT[lastTool] ?? null) : null;

  const activeIdx   = groups.findIndex((g) => g.agentId === activeAgentId);
  const doneAgentIds = new Set(
    groups.slice(0, activeIdx < 0 ? groups.length : activeIdx).map((g) => g.agentId)
  );

  return (
    <div className="space-y-0">
      {PIPELINE.map((agent, pIdx) => {
        const group    = groups.find((g) => g.agentId === agent.id);
        const isActive = agent.id === activeAgentId;
        const isDone   = doneAgentIds.has(agent.id) || (!isLive && group !== undefined && !isActive);
        const isIdle   = !group && !isActive;
        const isLast   = pIdx === PIPELINE.length - 1;

        const dotColor = isActive
          ? 'bg-brand-500 animate-pulse'
          : isDone
          ? 'bg-green-500'
          : 'bg-gray-300';

        const labelColor = isActive
          ? 'text-[#0f1724] font-semibold'
          : isDone
          ? 'text-green-700'
          : 'text-gray-400';

        return (
          <div key={agent.id}>
            {/* Agent row */}
            <div className="flex items-center gap-2 py-1.5">
              <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${dotColor}`} />
              <span className="text-base leading-none">{agent.icon}</span>
              <span className={`text-sm font-medium ${labelColor}`}>{agent.label}</span>
              {isDone && (
                <span className="ml-auto text-xs font-medium text-green-600">✓</span>
              )}
              {isActive && isLive && (
                <span className="ml-auto flex items-center gap-1.5 text-xs font-medium text-brand-500">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" />
                  running
                </span>
              )}
              {isIdle && (
                <span className="ml-auto text-xs text-gray-400">idle</span>
              )}
            </div>

            {/* Tool rows with vertical connector */}
            {group && group.toolCalls.length > 0 && (
              <div className="ml-[3px] border-l-2 border-gray-200 pb-2 pl-4">
                {group.toolCalls.map((tc, ti) => {
                  const isLastTool    = ti === group.toolCalls.length - 1;
                  const isCurrentTool = isLive && tc.tool === lastTool;
                  const connector     = isLastTool ? '└─' : '├─';
                  const label         = TOOL_LABEL[tc.tool] ?? tc.tool.replace(/_/g, ' ');

                  return (
                    <div key={tc.tool} className="flex items-center gap-1.5 py-0.5">
                      <span className="flex-shrink-0 font-mono text-xs text-gray-400">
                        {connector}
                      </span>
                      <span
                        className={`text-sm ${
                          isCurrentTool
                            ? 'text-brand-500'
                            : isDone || (!isLive && isActive)
                            ? 'text-gray-600'
                            : 'text-gray-500'
                        }`}
                      >
                        {label}
                      </span>
                      <span className="text-xs text-gray-400">×{tc.count}</span>
                      {isCurrentTool && isLive && (
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Downward connector arrow between agent groups */}
            {!isLast && !isIdle && group && (
              <div className="ml-[3px] border-l-2 border-gray-200 py-0.5 pl-4">
                <span className="text-xs text-gray-400">↓</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function AgentHierarchyView({ steps, isLive, standalone = true }: Props) {
  if (steps.length === 0) return null;

  if (!standalone) {
    return <HierarchyTree steps={steps} isLive={isLive} />;
  }

  return (
    <div className="av-card mt-6">
      <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
        Agent Execution Flow
      </h3>
      <HierarchyTree steps={steps} isLive={isLive} />
    </div>
  );
}
