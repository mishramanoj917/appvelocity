import { notFound } from 'next/navigation';
import { AGENTS } from '@/lib/agents.config';
import { AgentLauncher } from '@/components/agent-launcher/AgentLauncher';
import { AgentStatusBadge } from '@/components/agent-card/AgentStatusBadge';
import Link from 'next/link';

interface Props {
  params: { agentId: string };
}

export async function generateStaticParams() {
  return AGENTS.map((a) => ({ agentId: a.id }));
}

export default function AgentPage({ params }: Props) {
  const agent = AGENTS.find((a) => a.id === params.agentId);
  if (!agent) notFound();

  return (
    <div className="min-h-full">
      {/* Header */}
      <header className="border-b border-[#e4e7ec] bg-white/90 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-4">
          <Link
            href="/"
            className="text-sm text-gray-500 hover:text-[#0f1724] transition-colors"
          >
            ← Dashboard
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-medium text-[#0f1724]">{agent.name}</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        {/* Agent header */}
        <div className="mb-8 flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-xl text-3xl"
              style={{ background: `${agent.color}15`, border: `1px solid ${agent.color}30` }}
            >
              {agent.icon}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-[#0f1724]">{agent.name}</h1>
                <AgentStatusBadge status={agent.status} />
              </div>
              <p className="mt-0.5 text-sm font-medium" style={{ color: agent.color }}>
                {agent.subtitle}
              </p>
            </div>
          </div>
        </div>

        {/* Value prop */}
        <div className="av-card mb-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Value Proposition
          </h2>
          <p className="text-gray-700">{agent.valueProposition}</p>
        </div>

        {/* Capabilities */}
        <div className="av-card mb-6">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Capabilities
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {agent.capabilities.map((cap) => (
              <li key={cap} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="mt-0.5 text-green-600">✓</span>
                {cap}
              </li>
            ))}
          </ul>
        </div>

        {/* Launcher – only available agents */}
        <AgentLauncher agent={agent} />
      </main>
    </div>
  );
}
