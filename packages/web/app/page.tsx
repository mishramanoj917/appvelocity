import { AgentCard } from '@/components/agent-card/AgentCard';
import { AGENTS } from '@/lib/agents.config';

export default function DashboardPage() {
  return (
    <div className="min-h-full">
      {/* Top nav */}
      <header className="sticky top-0 z-10 border-b border-gray-800 bg-gray-950/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold tracking-tight text-brand-400">
              AppVelocity
            </span>
            <span className="rounded-md bg-brand-900 px-2 py-0.5 text-xs font-medium text-brand-300">
              v0.1.0
            </span>
          </div>
          <nav className="flex items-center gap-6 text-sm text-gray-400">
            <a href="#" className="hover:text-gray-100 transition-colors">
              Docs
            </a>
            <a href="#" className="hover:text-gray-100 transition-colors">
              Settings
            </a>
            <a
              href="https://github.com/yourusername/appvelocity"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-100 transition-colors"
            >
              GitHub
            </a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-gray-800 bg-gradient-to-b from-brand-950/40 to-transparent px-6 py-14">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            AI Mobile Development Platform
          </h1>
          <p className="mt-3 max-w-2xl text-gray-400">
            Seven specialized agents accelerating every aspect of your mobile
            app — from design to deployment, security to compliance.
          </p>

          <div className="mt-6 flex flex-wrap gap-4 text-sm">
            <Stat label="Agents" value="7" />
            <Stat label="Frameworks" value="4" />
            <Stat label="Status" value="Phase 0 ✓" highlight />
          </div>
        </div>
      </section>

      {/* Agent Grid */}
      <main className="mx-auto max-w-7xl px-6 py-10">
        <h2 className="mb-6 text-sm font-semibold uppercase tracking-widest text-gray-500">
          Agents
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {AGENTS.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      </main>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-4 py-2 ${
        highlight
          ? 'border-brand-700 bg-brand-950 text-brand-300'
          : 'border-gray-800 bg-gray-900 text-gray-300'
      }`}
    >
      <span className="text-xs text-gray-500">{label}: </span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
