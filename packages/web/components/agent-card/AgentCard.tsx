import Link from 'next/link';
import type { AgentConfig } from '@/lib/agents.config';
import { AgentStatusBadge } from './AgentStatusBadge';

interface Props {
  agent: AgentConfig;
}

export function AgentCard({ agent }: Props) {
  const isAvailable = agent.status === 'active' || agent.status === 'beta';

  return (
    <Link
      href={`/agents/${agent.id}`}
      className={`av-card group flex flex-col gap-4 transition-all duration-200 ${
        isAvailable
          ? 'hover:border-brand-400 hover:shadow-md cursor-pointer'
          : 'cursor-default opacity-70 hover:opacity-85'
      }`}
    >
      {/* Icon + status */}
      <div className="flex items-start justify-between">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-lg text-2xl"
          style={{
            background: `${agent.color}15`,
            border: `1px solid ${agent.color}30`,
          }}
        >
          {agent.icon}
        </div>
        <AgentStatusBadge status={agent.status} />
      </div>

      {/* Name & subtitle */}
      <div>
        <h3 className="font-semibold text-[#0f1724] group-hover:text-brand-600 transition-colors">
          {agent.name}
        </h3>
        <p className="mt-0.5 text-xs" style={{ color: agent.color }}>
          {agent.subtitle}
        </p>
      </div>

      {/* Short description */}
      <p className="text-sm leading-relaxed text-gray-500 line-clamp-2">
        {agent.valueProposition}
      </p>

      {/* Capability count */}
      <div className="mt-auto flex items-center gap-1.5 text-xs text-gray-400">
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: agent.color }}
        />
        {agent.capabilities.length} capabilities
        {isAvailable && (
          <span className="ml-auto text-brand-500">
            Launch →
          </span>
        )}
      </div>
    </Link>
  );
}
