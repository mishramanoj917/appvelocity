import type { AgentStatus } from '@/lib/agents.config';

const STATUS_CONFIG: Record<
  AgentStatus,
  { label: string; className: string; dot: string }
> = {
  active: {
    label: 'Active',
    className: 'bg-green-50 text-green-700 border border-green-200',
    dot: 'bg-green-500',
  },
  beta: {
    label: 'Beta',
    className: 'bg-amber-50 text-amber-700 border border-amber-200',
    dot: 'bg-amber-500',
  },
  planned: {
    label: 'Planned',
    className: 'bg-gray-100 text-gray-500 border border-gray-200',
    dot: 'bg-gray-400',
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
