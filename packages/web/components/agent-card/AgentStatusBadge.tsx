import type { AgentStatus } from '@/lib/agents.config';

const STATUS_CONFIG: Record<
  AgentStatus,
  { label: string; className: string; dot: string }
> = {
  active: {
    label: 'Active',
    className: 'bg-green-950 text-green-400 border border-green-900',
    dot: 'bg-green-400',
  },
  beta: {
    label: 'Beta',
    className: 'bg-amber-950 text-amber-400 border border-amber-900',
    dot: 'bg-amber-400',
  },
  planned: {
    label: 'Planned',
    className: 'bg-gray-800 text-gray-400 border border-gray-700',
    dot: 'bg-gray-500',
  },
};

export function AgentStatusBadge({ status }: { status: AgentStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`av-badge ${cfg.className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}
