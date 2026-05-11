import Link from 'next/link';
import { AgentCard } from '@/components/agent-card/AgentCard';
import { AGENTS } from '@/lib/agents.config';

function AppVelocityLogo({ size = 24 }: { size?: number }) {
  const h = Math.round(size * 1.25);
  return (
    <svg width={size} height={h} viewBox="0 0 46 60" xmlns="http://www.w3.org/2000/svg" overflow="hidden">
      <defs><clipPath id="nc"><rect x="1155" y="105" width="45" height="58" /></clipPath></defs>
      <g transform="translate(-1154 -104)" clipPath="url(#nc)">
        <path d="M35.048 12.61C35.048 10.85 33.621 9.423 31.86 9.423H11.461C9.7 9.423 8.274 10.85 8.274 12.61v.95l2.592.001c.293-1.052 1.257-1.826 2.404-1.826h16.78c1.38 0 2.498 1.118 2.498 2.498v13.772c.9-.617 1.734-1.25 2.499-1.894V12.61Z" fill="#F15B40" transform="matrix(1 0 0 1.163 1155 105)" />
        <path d="M10.772 21.53H8.274v13.53c.778.11 1.614.167 2.498.174V21.53Z" fill="#F15B40" transform="matrix(1 0 0 1.163 1155 105)" />
        <path d="M21.3 15.308h-4.841l-.421.134-.779-.798.064-.39v-5.69l-.046-.17.022-.29.024-.022.245-.035 4.034.001c.563 0 1.018-.456 1.018-1.018V1.018C20.786.455 20.33 0 19.768 0h-4.034C15.17 0 14.716.456 14.716 1.018v4.035l.019.196-.675.624-.238-.029H7.589c-.793 0-1.436.643-1.436 1.436v5.69c0 .793.643 1.436 1.436 1.436h5.69l.264-.026.188.194.774.801-.04.218v4.843c0 .675.547 1.222 1.222 1.222H21.3c.675 0 1.221-.547 1.221-1.222v-4.843c0-.675-.546-1.222-1.221-1.222Z" fill="#F15B40" transform="matrix(1 0 0 1.163 1155 105)" />
        <path d="M32.549 39.787c0 1.379-1.118 2.497-2.497 2.497H13.27c-1.38 0-2.498-1.118-2.498-2.497v-.391c-.872.036-1.707.031-2.498-.012v7.315c0 1.76 1.427 3.187 3.188 3.187h20.4c1.76 0 3.187-1.427 3.187-3.187V31.073a34.4 34.4 0 0 1-2.5 1.534V39.79Z" fill="#082340" transform="matrix(1 0 0 1.163 1155 105)" />
        <path d="M26.062 36.727C13.924 41.69 2.401 41.597.324 36.52c-.68-1.662-.264-3.65 1.026-5.745-.343 1.14-.343 2.21.047 3.164 1.917 4.692 12.564 4.777 23.776.193 11.216-4.583 19.072-12.637 17.155-17.324-.307-.76-.847-1.4-1.583-1.916 1.92.637 3.275 1.678 3.869 3.125C46.687 23.013 38.207 31.77 26.062 36.727Z" fill="#082340" transform="matrix(1 0 0 1.163 1155 105)" />
      </g>
    </svg>
  );
}

function SectionTag({ children, color = 'brand' }: { children: React.ReactNode; color?: 'brand' | 'green' | 'violet' | 'blue' | 'navy' }) {
  const colors = {
    brand: 'border-brand-200 bg-brand-50 text-brand-600',
    green: 'border-green-200 bg-green-50 text-green-700',
    violet: 'border-violet-200 bg-violet-50 text-violet-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    navy: 'border-white/20 bg-white/10 text-white/70',
  };
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1 text-[11px] font-bold uppercase tracking-widest ${colors[color]}`}>
      {children}
    </div>
  );
}

function AgentFlowDiagram() {
  const navy = '#082340';
  const arr = 'url(#arr)';
  return (
    <svg viewBox="0 0 700 490" className="w-full max-w-[680px] mx-auto" style={{ fontFamily: 'system-ui,sans-serif' }}>
      <defs>
        <marker id="arr" markerWidth="9" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0,9 3,0 6" fill={navy} />
        </marker>
      </defs>

      {/* Orchestrator */}
      <rect x="180" y="18" width="290" height="72" rx="10" fill="white" stroke={navy} strokeWidth="2" />
      <text x="325" y="47" textAnchor="middle" fontSize="15" fontWeight="700" fill={navy}>OrchestratorAgent</text>
      <text x="325" y="70" textAnchor="middle" fontSize="12" fill={navy} opacity="0.65">(Lifecycle + Decisioning)</text>

      {/* Orchestrator to 3 agents */}
      <line x1="245" y1="90" x2="106" y2="156" stroke={navy} strokeWidth="1.5" markerEnd={arr} />
      <line x1="325" y1="90" x2="323" y2="156" stroke={navy} strokeWidth="1.5" markerEnd={arr} />
      <line x1="405" y1="90" x2="545" y2="156" stroke={navy} strokeWidth="1.5" markerEnd={arr} />

      {/* Ingestion Agent */}
      <rect x="20" y="156" width="168" height="72" rx="10" fill="white" stroke={navy} strokeWidth="2" />
      <text x="104" y="186" textAnchor="middle" fontSize="14" fontWeight="700" fill={navy}>Ingestion</text>
      <text x="104" y="208" textAnchor="middle" fontSize="14" fontWeight="700" fill={navy}>Agent</text>

      {/* Ground Truth Agent */}
      <rect x="232" y="156" width="183" height="72" rx="10" fill="white" stroke={navy} strokeWidth="2" />
      <text x="323" y="186" textAnchor="middle" fontSize="14" fontWeight="700" fill={navy}>Ground Truth</text>
      <text x="323" y="208" textAnchor="middle" fontSize="14" fontWeight="700" fill={navy}>Agent</text>

      {/* Coding Agent */}
      <rect x="461" y="156" width="168" height="72" rx="10" fill="white" stroke={navy} strokeWidth="2" />
      <text x="545" y="186" textAnchor="middle" fontSize="14" fontWeight="700" fill={navy}>Coding</text>
      <text x="545" y="208" textAnchor="middle" fontSize="14" fontWeight="700" fill={navy}>Agent</text>

      {/* Horizontal handoff arrows */}
      <line x1="188" y1="192" x2="230" y2="192" stroke={navy} strokeWidth="1.5" markerEnd={arr} />
      <line x1="415" y1="192" x2="459" y2="192" stroke={navy} strokeWidth="1.5" markerEnd={arr} />

      {/* Ingestion down to figma_snapshot */}
      <line x1="104" y1="228" x2="104" y2="268" stroke={navy} strokeWidth="1.5" markerEnd={arr} />
      <text x="104" y="286" textAnchor="middle" fontSize="11" fontFamily="monospace" fill={navy}>figma_snapshot</text>

      {/* Ground Truth down through ground_truth.json to Validation */}
      <line x1="323" y1="228" x2="323" y2="267" stroke={navy} strokeWidth="1.5" markerEnd={arr} />
      <text x="323" y="284" textAnchor="middle" fontSize="11" fontFamily="monospace" fill={navy}>ground_truth.json</text>
      <line x1="323" y1="295" x2="307" y2="338" stroke={navy} strokeWidth="1.5" markerEnd={arr} />

      {/* Coding: L-path to Validation with Generated Code label */}
      <path d="M 545 228 L 545 374 L 397 374" stroke={navy} strokeWidth="1.5" fill="none" markerEnd={arr} />
      <rect x="480" y="254" width="130" height="22" rx="4" fill="white" />
      <text x="545" y="270" textAnchor="middle" fontSize="11" fill={navy}>Generated Code</text>

      {/* Validation Agent */}
      <rect x="218" y="338" width="178" height="72" rx="10" fill="white" stroke={navy} strokeWidth="2" />
      <text x="307" y="368" textAnchor="middle" fontSize="14" fontWeight="700" fill={navy}>Validation</text>
      <text x="307" y="390" textAnchor="middle" fontSize="14" fontWeight="700" fill={navy}>Agent</text>

      {/* Validation down to Visual QA Agent */}
      <line x1="307" y1="410" x2="307" y2="450" stroke={navy} strokeWidth="1.5" markerEnd={arr} />
      <text x="307" y="468" textAnchor="middle" fontSize="13" fontWeight="600" fill={navy}>Visual QA Agent</text>
    </svg>
  );
}

export default function DashboardPage() {
  return (
    <div className="min-h-full">
      {/* NAV */}
      <header className="sticky top-0 z-50 border-b border-[#e4e7ec] bg-white/92 backdrop-blur shadow-sm">
        <div className="mx-auto flex h-16 max-w-[1160px] items-center gap-8 px-7">
          <div className="flex items-center gap-2.5">
            <AppVelocityLogo size={22} />
            <span className="text-base font-extrabold tracking-tight text-[#082340]">AppVelocity</span>
          </div>
          <nav className="ml-5 hidden items-center gap-7 md:flex">
            {(['#how', '#architecture', '#capabilities', '#technology', '#roadmap'] as const).map((href, i) => (
              <a key={href} href={href} className="text-sm font-medium text-[#475467] transition-colors hover:text-[#0f1724]">
                {['How it works', 'Architecture', 'Capabilities', 'Technology', 'Roadmap'][i]}
              </a>
            ))}
          </nav>
          <Link
            href="/agents/design-to-code"
            className="ml-auto rounded-lg bg-brand-500 px-5 py-2 text-[13px] font-bold text-white transition-all hover:bg-brand-600 hover:-translate-y-px"
          >
            Try DesignToCode →
          </Link>
        </div>
      </header>

      {/* HERO */}
      <section id="hero" className="bg-[#f4f5f7] px-7 pb-12 pt-24">
        <div className="mx-auto max-w-[1160px]">
          <div
            className="relative overflow-hidden rounded-2xl p-14 shadow-2xl"
            style={{ background: 'linear-gradient(130deg,#3b1a8c 0%,#6d28d9 32%,#b45309 68%,#f15b40 100%)' }}
          >
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage: 'linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px)',
                backgroundSize: '40px 40px',
              }}
            />

            <div className="relative z-10 grid grid-cols-1 gap-10 md:grid-cols-[1fr_280px] md:items-center">
              <div>
                <div className="mb-3.5 flex items-center gap-3">
                  <span className="text-[15px] font-extrabold text-white/95">AppVelocity</span>
                  <span className="rounded-full border border-white/28 bg-white/15 px-3 py-0.5 text-[11px] font-bold text-white/85">Accelerator</span>
                </div>
                <p className="mb-5 text-[13px] text-white/55">Industry Accelerator · Mobile SDLC</p>
                <h1 className="mb-5 text-4xl font-black leading-tight tracking-tight text-white md:text-5xl" style={{ letterSpacing: '-0.04em' }}>
                  AI-Powered Accelerator<br />
                  for the <span className="text-[#ffd0c0]">Mobile SDLC</span>
                </h1>
                <p className="max-w-lg text-base leading-relaxed text-white/65">
                  AppVelocity converts Figma designs into production-ready React Native and Flutter
                  projects using a 6-agent pipeline. Each agent owns one focused stage: ingestion,
                  analysis, code generation, validation, and visual QA. They work in sequence to
                  deliver a compilable ZIP you can open right away.
                </p>
                <div className="mt-8 flex flex-wrap gap-3.5">
                  <a
                    href="#capabilities"
                    className="rounded-xl border border-white/35 bg-white/15 px-7 py-3 text-[15px] font-bold text-white backdrop-blur transition-all hover:bg-white/25 hover:-translate-y-px"
                  >
                    See What It Can Do
                  </a>
                  <a
                    href="#architecture"
                    className="rounded-xl border border-white/20 px-6 py-3 text-[15px] font-semibold text-white/75 transition-all hover:border-white/45 hover:text-white hover:-translate-y-px"
                  >
                    See the Architecture
                  </a>
                </div>
              </div>

              <div className="hidden md:flex justify-end items-start gap-3.5 pt-3">
                <div className="flex w-[120px] flex-col gap-2 rounded-[20px] border border-white/20 bg-white/9 p-[18px]">
                  {[['accent','w-[70%]'],['','w-full'],['clr-b','w-[80%]'],['','w-[55%]'],['clr-g','w-[70%]'],['','w-full'],['clr-o','w-[60%]'],['','w-[80%]'],['clr-b','w-[55%]'],['','w-[70%]']].map(([c,w],i)=>(
                    <div key={i} className={`h-[7px] rounded-full ${w}`} style={{background: c==='accent'?'rgba(255,255,255,.5)':c==='clr-b'?'rgba(99,179,237,.6)':c==='clr-g'?'rgba(104,211,145,.6)':c==='clr-o'?'rgba(251,191,36,.6)':'rgba(255,255,255,.15)'}} />
                  ))}
                </div>
                <div className="mt-7 flex w-[120px] flex-col gap-2 rounded-[20px] border border-white/20 bg-white/9 p-[18px]">
                  {[['accent','w-[80%]'],['','w-[55%]'],['clr-g','w-full'],['','w-[70%]'],['clr-o','w-[80%]'],['','w-[55%]'],['clr-b','w-[70%]'],['','w-full']].map(([c,w],i)=>(
                    <div key={i} className={`h-[7px] rounded-full ${w}`} style={{background: c==='accent'?'rgba(255,255,255,.5)':c==='clr-b'?'rgba(99,179,237,.6)':c==='clr-g'?'rgba(104,211,145,.6)':c==='clr-o'?'rgba(251,191,36,.6)':'rgba(255,255,255,.15)'}} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 6-agent pipeline strip */}
          <div className="mt-6 overflow-hidden rounded-2xl border border-[#e4e7ec] bg-white shadow-md">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e4e7ec] bg-[#f4f5f7] px-5 py-3">
              <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">6-Agent Pipeline: Sequential Specialization at Every Stage</span>
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-[11px] text-gray-500">6 agents · 13 tools</span>
                <span className="rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-[11px] font-bold text-brand-600">Design to Code · Live</span>
              </div>
            </div>
            <div className="overflow-x-auto bg-[#edf0f6] p-6">
              <div className="flex min-w-[800px] items-start gap-2">
                {[
                  { icon:'🎯', name:'Orchestrator', detail:'Session lifecycle · retry policy', tools:[], accent:'border-gray-300', accentTop:'bg-gray-400' },
                  { icon:'📥', name:'Figma Ingestion', detail:'Snapshot-first · 1 API call', tools:['fetch_figma'], accent:'border-blue-300', accentTop:'bg-blue-400' },
                  { icon:'🗺️', name:'Ground Truth', detail:'IR build · vision analysis', tools:['analyze_design','build_ir'], accent:'border-violet-300', accentTop:'bg-violet-500' },
                  { icon:'⚡', name:'Coding', detail:'ReAct loop · generation', tools:['plan_generation','generate_all_components','generate_component','assemble_project','create_zip'], accent:'border-brand-300', accentTop:'bg-brand-500' },
                  { icon:'🛡️', name:'Validation', detail:'Gates 1/3/5/6 · QA checks', tools:['validate_file','repair_file','run_workspace_check','run_compilation_check'], accent:'border-green-300', accentTop:'bg-green-500' },
                  { icon:'👁️', name:'Visual QA', detail:'Pixel · token · LLM judge', tools:['run_visual_qa'], accent:'border-cyan-300', accentTop:'bg-cyan-500' },
                ].map((agent, ai) => (
                  <div key={agent.name} className="flex items-start gap-2">
                    <div className={`min-w-[130px] overflow-hidden rounded-xl border-2 bg-white shadow-sm ${agent.accent}`}>
                      <div className={`h-[3px] ${agent.accentTop}`} />
                      <div className="p-3.5">
                        <div className="mb-1.5 flex items-center gap-2">
                          <span className="text-lg">{agent.icon}</span>
                          <span className="font-mono text-[11px] font-bold text-[#0f1724]">{agent.name}</span>
                        </div>
                        <div className="mb-2.5 text-[10px] leading-tight text-gray-400">{agent.detail}</div>
                        {agent.tools.length > 0 && (
                          <div className="flex flex-col gap-1">
                            {agent.tools.map(t => (
                              <span key={t} className="rounded bg-[#f4f5f7] px-1.5 py-0.5 font-mono text-[9px] text-gray-500">{t}</span>
                            ))}
                          </div>
                        )}
                        {agent.tools.length === 0 && (
                          <span className="text-[9px] italic text-gray-300">no tools · coordinates flow</span>
                        )}
                      </div>
                    </div>
                    {ai < 5 && (
                      <div className="mt-8 flex-shrink-0 text-gray-300 font-mono text-sm">→</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2.5 border-t border-[#e4e7ec] bg-[#f4f5f7] px-5 py-3">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" />
              <span className="font-mono text-[11px] text-gray-500">Each agent passes structured output to the next · The Coding agent runs an internal ReAct loop · Visual QA validates fidelity before ZIP delivery</span>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="py-20">
        <div className="mx-auto max-w-[1160px] px-7">
          <SectionTag>How It Works</SectionTag>
          <h2 className="mb-3 mt-4 text-3xl font-black tracking-tight text-[#0f1724] md:text-4xl" style={{ letterSpacing: '-0.03em' }}>
            Six specialized agents. One coordinated pipeline.
          </h2>
          <p className="max-w-xl text-base leading-relaxed text-[#475467]">
            AppVelocity replaces rigid, single-LLM generation scripts with a purpose-built multi-agent
            pipeline. Each agent owns exactly one stage and passes structured output to the next.
            This keeps failures isolated, repairs targeted, and every stage independently optimized.
          </p>

          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {[
              { num:'1', title:'Ingest and Analyze', grad:'from-blue-500 to-violet-600', desc:'The Figma Ingestion agent fetches the full document tree using a snapshot-first strategy that minimizes API calls. The Ground Truth agent then runs a vision pass over exported screens and builds a platform-neutral Design IR, which is the single source of truth consumed by all downstream agents.' },
              { num:'2', title:'Generate and Assemble', grad:'from-brand-500 to-amber-500', desc:'The Coding agent runs a ReAct loop for up to 30 iterations. It plans the navigation graph, generates all screens and components in parallel, and runs Gate 1 and Gate 3 checks after each batch. If Gate 5 detects syntax errors, the LLM repair tool fires automatically before the project is assembled.' },
              { num:'3', title:'Validate and Ship', grad:'from-green-500 to-cyan-500', desc:'The Validation agent runs Gate 6, which is a full tsc or flutter analyze compilation pass. If it fails, one automatic LLM fix is applied before the result is reported. The Visual QA agent then checks every generated screen against the Figma ground truth for structural, token, and pixel fidelity before the ZIP is created.' },
            ].map((card, i) => (
              <div key={i} className="relative overflow-hidden rounded-2xl border border-[#e4e7ec] bg-white p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md">
                <div className={`absolute left-0 right-0 top-0 h-[3px] bg-gradient-to-r ${card.grad}`} />
                <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${card.grad} text-sm font-extrabold text-white`}>{card.num}</div>
                <h3 className="mb-2.5 text-[17px] font-extrabold text-[#0f1724]">{card.title}</h3>
                <p className="text-sm leading-relaxed text-[#475467]">{card.desc}</p>
              </div>
            ))}
          </div>

          {/* Coding agent ReAct detail */}
          <div className="mt-6 flex flex-wrap items-center gap-10 rounded-2xl border border-[#e4e7ec] bg-white p-10 shadow-sm">
            <div className="min-w-[260px] flex-1">
              <SectionTag>Coding Agent: Under the Hood</SectionTag>
              <h3 className="mb-2.5 mt-4 text-xl font-extrabold text-[#0f1724]">Internal ReAct Generation Loop</h3>
              <p className="mb-4 text-sm leading-relaxed text-[#475467]">
                Inside the Coding agent, an LLM runs a <strong>ReAct (Reason + Act)</strong> loop
                for up to 30 iterations. It generates screens in parallel batches, observes validation
                results, and calls targeted repair tools before moving to the next stage. Full file
                content never reaches the LLM. Only compact summaries flow through the context window,
                keeping every iteration fast and cost-efficient.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-violet-300 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">30 max iterations</span>
                <span className="rounded-full border border-blue-300 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">Parallel generation</span>
                <span className="rounded-full border border-green-300 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">Self-healing output</span>
              </div>
            </div>
            <div
              className="min-w-[280px] flex-shrink-0 rounded-xl p-6 font-mono text-xs leading-8"
              style={{ background: '#082340', color: 'rgba(255,255,255,.45)' }}
            >
              <span style={{ color: 'rgba(255,255,255,.25)' }}>{'// coding-agent.ts'}</span><br />
              <span style={{ color: '#c792ea' }}>for</span> i = <span style={{ color: '#f78c6c' }}>1</span>..<span style={{ color: '#f78c6c' }}>30</span>:<br />
              &nbsp;&nbsp;prompt = <span style={{ color: '#c3e88d' }}>buildPrompt</span>(ir, memory)<br />
              &nbsp;&nbsp;call = <span style={{ color: '#c3e88d' }}>llm.chat</span>(prompt, tools)<br />
              &nbsp;&nbsp;result = <span style={{ color: '#c3e88d' }}>dispatch</span>(call)<br />
              &nbsp;&nbsp;memory.<span style={{ color: '#c3e88d' }}>observe</span>(result)<br />
              &nbsp;&nbsp;<span style={{ color: '#c792ea' }}>if</span> zipBuffer: <span style={{ color: '#c792ea' }}>break</span><br />
              <span style={{ color: '#c3e88d' }}>return</span> output
            </div>
          </div>
        </div>
      </section>

      {/* MULTI-AGENT ARCHITECTURE: DIAGRAM */}
      <section id="architecture" className="border-y border-[#e4e7ec] bg-white py-20">
        <div className="mx-auto max-w-[1160px] px-7">
          <SectionTag color="violet">Multi-Agent Architecture</SectionTag>
          <h2 className="mb-3 mt-4 text-3xl font-black tracking-tight text-[#0f1724] md:text-4xl" style={{ letterSpacing: '-0.03em' }}>
            6 agents. 13 tools. One pipeline.
          </h2>
          <p className="max-w-xl text-base leading-relaxed text-[#475467]">
            Each agent is a self-contained unit with its own LLM, tools, and defined responsibilities.
            Agents pass structured data to each other, never raw files. This keeps failures localized
            and every stage independently upgradeable.
          </p>

          {/* Flow diagram */}
          <div className="mt-10 overflow-hidden rounded-2xl border border-[#e4e7ec] bg-white p-8 shadow-md">
            <AgentFlowDiagram />
          </div>

          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon:'🎯', id:'Orchestrator', badge:'Coordinator',
                badgeColor:'bg-gray-100 text-gray-600 border-gray-200',
                accent:'border-l-gray-400',
                inputs:'Figma URL, Framework, Token',
                outputs:'Structured agent pipeline',
                tools:[],
                desc:'Manages the overall session lifecycle: validates inputs, sequences the agent pipeline, handles the retry policy, and streams real-time progress to the browser via SSE. It coordinates the other five agents without calling any tools directly.',
              },
              {
                icon:'📥', id:'Figma Ingestion', badge:'Stage 1',
                badgeColor:'bg-blue-50 text-blue-700 border-blue-200',
                accent:'border-l-blue-400',
                inputs:'Figma URL, Access token',
                outputs:'Raw Figma JSON, screen PNGs',
                tools:['fetch_figma'],
                desc:'Fetches the complete Figma document tree, including all frames, components, variables, and design tokens using a snapshot-first strategy that makes a single API call. Exports all top-level screens as PNG images for the vision pass in the next stage.',
              },
              {
                icon:'🗺️', id:'Ground Truth', badge:'Stage 2',
                badgeColor:'bg-violet-50 text-violet-700 border-violet-200',
                accent:'border-l-violet-400',
                inputs:'Raw Figma JSON, screen PNGs',
                outputs:'Platform-neutral Design IR',
                tools:['analyze_design','build_ir'],
                desc:'Runs a multi-modal LLM vision pass over exported screen images to detect spacing systems, icon families, font usage, and layout patterns. Then transforms the raw Figma JSON into a typed Design IR, which is the canonical representation consumed by all downstream agents.',
              },
              {
                icon:'⚡', id:'Coding', badge:'Stage 3: ReAct',
                badgeColor:'bg-brand-50 text-brand-600 border-brand-200',
                accent:'border-l-brand-500',
                inputs:'Design IR',
                outputs:'Generated source files',
                tools:['plan_generation','generate_all_components','generate_component','assemble_project','create_zip'],
                desc:'The generation engine. Plans the navigation graph and component dependency order from the IR, then generates all screens in parallel batches. Runs an internal ReAct loop for up to 30 iterations, assembling the project scaffold, running syntax checks, and triggering targeted repairs before delivery.',
              },
              {
                icon:'🛡️', id:'Validation', badge:'Stage 4',
                badgeColor:'bg-green-50 text-green-700 border-green-200',
                accent:'border-l-green-500',
                inputs:'Generated source files',
                outputs:'Validated, compiled project',
                tools:['validate_file','repair_file','run_workspace_check','run_compilation_check'],
                desc:'Runs four quality gates in sequence: Gate 1 (Babel AST or dart analyze pre-write check), Gate 3 (incremental tsc or dart workspace compile), Gate 5 (LLM repair loop for failing files), and Gate 6 (full npx tsc --noEmit or flutter analyze with one auto-fix pass). Only a project that passes Gate 6 advances to Visual QA.',
              },
              {
                icon:'👁️', id:'Visual QA', badge:'Stage 5',
                badgeColor:'bg-cyan-50 text-cyan-700 border-cyan-200',
                accent:'border-l-cyan-500',
                inputs:'Compiled project, Figma IR',
                outputs:'QA report, final ZIP',
                tools:['run_visual_qa'],
                desc:'Compares generated screens against the Figma ground truth using structural checks (component hierarchy), token checks (colors, typography, and spacing match named constants), and an LLM judge pass for layout fidelity. Produces a QA report alongside the final ZIP archive.',
              },
            ].map(a => (
              <div key={a.id} className={`rounded-2xl border border-[#e4e7ec] bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md border-l-4 ${a.accent}`}>
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">{a.icon}</span>
                    <span className="text-[15px] font-extrabold text-[#0f1724]">{a.id}</span>
                  </div>
                  <span className={`flex-shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${a.badgeColor}`}>{a.badge}</span>
                </div>
                <p className="mb-4 text-sm leading-relaxed text-[#475467]">{a.desc}</p>
                <div className="space-y-2 border-t border-[#f4f5f7] pt-3">
                  <div className="flex gap-2 text-[11px]">
                    <span className="w-14 flex-shrink-0 font-semibold text-gray-400">IN</span>
                    <span className="text-gray-500">{a.inputs}</span>
                  </div>
                  <div className="flex gap-2 text-[11px]">
                    <span className="w-14 flex-shrink-0 font-semibold text-gray-400">OUT</span>
                    <span className="text-gray-500">{a.outputs}</span>
                  </div>
                  {a.tools.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {a.tools.map(t => (
                        <span key={t} className="rounded bg-[#f4f5f7] px-2 py-0.5 font-mono text-[9px] text-gray-400">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MULTI-AGENT WORKFLOW */}
      <section id="workflow" className="py-20">
        <div className="mx-auto max-w-[1160px] px-7">
          <SectionTag color="brand">Multi-Agent Workflow</SectionTag>
          <h2 className="mb-3 mt-4 text-3xl font-black tracking-tight text-[#0f1724] md:text-4xl" style={{ letterSpacing: '-0.03em' }}>
            From Figma URL to compiled ZIP in one run.
          </h2>
          <p className="max-w-xl text-base leading-relaxed text-[#475467]">
            Each agent takes structured input from the previous stage, does one focused job, and
            produces a well-defined output. The Orchestrator monitors the whole pipeline and handles
            retries without needing to re-run earlier stages.
          </p>

          <div className="mt-12 space-y-0">
            {[
              {
                step:'01', icon:'🎯', agent:'Orchestrator', time:'~1s',
                color:'#6b7280', light:'#f9fafb', border:'#e5e7eb',
                action:'Receives the Figma URL, framework selection, and Figma access token from the web form. Validates all inputs, initializes the SSE stream to the browser, and begins sequencing the agents.',
                output:'Session context passed to Stage 1',
              },
              {
                step:'02', icon:'📥', agent:'Figma Ingestion', time:'~3-8s',
                color:'#2e90fa', light:'#eff8ff', border:'#b2ddff',
                action:'Calls fetch_figma with the Figma access token. Fetches the complete document using snapshot mode, which makes one API call for the full tree, exports all top-level frames as PNG images, and caches the response for 5 minutes.',
                output:'Raw Figma JSON and screen PNGs passed to Stage 2',
              },
              {
                step:'03', icon:'🗺️', agent:'Ground Truth', time:'~15-30s',
                color:'#7f56d9', light:'#f9f5ff', border:'#d9d6fe',
                action:'Runs analyze_design: sends screen PNGs to a vision LLM to extract spacing rhythms, icon families, and typographic scales. Then runs build_ir: transforms the Figma JSON and vision output into a platform-neutral Design IR covering all screens, tokens, navigation, and component variants.',
                output:'Typed Design IR passed to Stage 3',
              },
              {
                step:'04', icon:'⚡', agent:'Coding', time:'~2-5 min',
                color:'#f15b40', light:'#fff4f1', border:'#fecdb8',
                action:'Starts the ReAct loop. Calls plan_generation to build a navigation graph and dependency order. Calls generate_all_components to produce all screens and shared components in parallel. Runs Gate 1 and Gate 3 checks. If failures are found, repair_file is called immediately. Assembles the project scaffold with assemble_project and calls create_zip when compilation passes.',
                output:'Assembled source project passed to Stage 4',
              },
              {
                step:'05', icon:'🛡️', agent:'Validation', time:'~30-90s',
                color:'#12b76a', light:'#ecfdf3', border:'#a6f4c5',
                action:'Runs Gate 6: executes the full compiler (npx tsc --noEmit for React Native, flutter analyze for Flutter) in an isolated temp directory. If errors remain after the Coding agent has attempted self-repair, one additional LLM fix pass is applied. Only a clean compilation passes this gate.',
                output:'Validated, compilable project passed to Stage 5',
              },
              {
                step:'06', icon:'👁️', agent:'Visual QA', time:'~20-40s',
                color:'#0ba5ec', light:'#f0f9ff', border:'#b9e6fe',
                action:'Runs run_visual_qa: checks each generated screen against the Figma IR for structural match (component hierarchy depth, flex direction, padding), token match (every color and font resolves to a named theme constant), and runs an LLM judge for overall layout fidelity. Produces a per-screen QA report bundled into the final ZIP.',
                output:'QA report and final ZIP delivered to browser',
              },
            ].map((s, i) => (
              <div key={s.step} className="flex gap-0">
                <div className="hidden w-[110px] flex-shrink-0 pt-6 sm:block">
                  <div className="text-right">
                    <span className="font-mono text-[11px] font-bold" style={{ color: s.color }}>{s.step}</span>
                    <div className="mt-0.5 text-[10px] text-gray-400">{s.time}</div>
                  </div>
                </div>
                <div className={`relative flex-1 border-l-2 pb-8 pl-8 ${i === 5 ? 'border-transparent' : 'border-[#e4e7ec]'}`}
                  style={{ borderLeftColor: i < 5 ? undefined : 'transparent' }}
                >
                  <span
                    className="absolute -left-[9px] top-5 flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 border-white text-[9px] shadow-sm"
                    style={{ background: s.color }}
                  >
                    {s.icon.slice(0,2)}
                  </span>
                  <div className="rounded-2xl border p-5 shadow-sm" style={{ background: s.light, borderColor: s.border }}>
                    <div className="mb-1 flex items-center gap-2.5">
                      <span className="text-lg">{s.icon}</span>
                      <span className="text-[15px] font-extrabold text-[#0f1724]">{s.agent}</span>
                    </div>
                    <p className="mb-2.5 text-sm leading-relaxed text-[#475467]">{s.action}</p>
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="font-semibold" style={{ color: s.color }}>OUTPUT:</span>
                      <span className="text-gray-500">{s.output}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Key features callout */}
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              { icon:'🔌', title:'Figma Plugin ZIP', desc:'Install the AppVelocity Figma plugin and export a ZIP directly from your design file. The plugin captures variable bindings, component variants, and responsive constraints that the REST API alone cannot represent, enabling pixel-perfect output.', color:'border-violet-200 bg-violet-50' },
              { icon:'💻', title:'VS Code-Style Code Viewer', desc:'Every generated project opens in an in-browser code viewer styled after VS Code\'s Explorer. Browse the full file tree, switch between files, and copy or download individual files or the entire ZIP, all from within the results page.', color:'border-blue-200 bg-blue-50' },
              { icon:'🗂️', title:'Project History', desc:'Every generated project is saved to disk automatically. The History tab lists all past runs with framework, date, and file count. Expand the file tree, re-download the ZIP, or delete projects you no longer need, all without re-running the agent.', color:'border-green-200 bg-green-50' },
            ].map(f => (
              <div key={f.title} className={`rounded-2xl border p-6 ${f.color}`}>
                <div className="mb-2 text-2xl">{f.icon}</div>
                <div className="mb-2 text-[15px] font-extrabold text-[#0f1724]">{f.title}</div>
                <div className="text-sm leading-relaxed text-[#475467]">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SDLC COVERAGE */}
      <section id="sdlc" className="py-20" style={{ background: '#082340' }}>
        <div className="mx-auto max-w-[1160px] px-7">
          <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
            <div>
              <SectionTag color="navy">Full SDLC Coverage</SectionTag>
              <h2 className="mb-3 mt-4 text-3xl font-black text-white md:text-4xl" style={{ letterSpacing: '-0.03em' }}>
                From design brief<br />to App Store submission
              </h2>
              <p className="mb-10 max-w-md text-base leading-relaxed text-white/60">
                AppVelocity is built to cover every phase of the mobile development lifecycle,
                not just one slice of it. Each capability is a native part of the single tool,
                not a bolt-on integration.
              </p>

              <div className="divide-y divide-white/7">
                {[
                  { icon:'🎨', name:'Design to Code', desc:'Parse Figma, extract design tokens, and generate React Native or Flutter screens with a complete project scaffold, delivered by the 6-agent pipeline.', live:true, accent:'rgba(241,91,64,.15)', accentBorder:'rgba(241,91,64,.35)', color:'#f15b40' },
                  { icon:'♿', name:'Accessibility', desc:'WCAG AA/AAA validation on every generated screen: color contrast, labels, focus order, and screen reader support.', live:false, accent:'rgba(18,183,106,.12)', accentBorder:'rgba(18,183,106,.30)', color:'#12b76a' },
                  { icon:'🛡️', name:'Security', desc:'OWASP Mobile Top 10 scanning: hardcoded secrets, insecure storage, and injection vectors caught before review.', live:false, accent:'rgba(239,68,68,.12)', accentBorder:'rgba(239,68,68,.30)', color:'#f87171' },
                  { icon:'⚡', name:'Performance', desc:'60fps tuning, bundle analysis, list virtualization, and image lazy loading, automatically applied during code generation.', live:false, accent:'rgba(247,144,9,.12)', accentBorder:'rgba(247,144,9,.30)', color:'#f79009' },
                  { icon:'🧪', name:'Test Intelligence', desc:'Unit tests, Detox E2E flows, and visual regression baselines generated alongside every screen.', live:false, accent:'rgba(127,86,217,.12)', accentBorder:'rgba(127,86,217,.30)', color:'#7f56d9' },
                  { icon:'🚀', name:'DevOps and Compliance', desc:'CI/CD pipelines, Fastlane lanes, and GDPR/HIPAA scaffolding, all delivered from the first commit rather than bolted on at the end of a sprint.', live:false, accent:'rgba(11,165,236,.12)', accentBorder:'rgba(11,165,236,.30)', color:'#0ba5ec' },
                ].map(p => (
                  <div key={p.name} className="flex gap-5 py-5">
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border text-xl" style={{ background: p.accent, borderColor: p.accentBorder, color: p.color }}>
                      {p.icon}
                    </div>
                    <div>
                      <div className="mb-1 text-[15px] font-bold text-white">{p.name}</div>
                      <div className="mb-1.5 text-sm leading-relaxed text-white/50">{p.desc}</div>
                      {p.live ? (
                        <span className="inline-block rounded-full border border-green-500/35 bg-green-500/18 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-green-400">Live Now</span>
                      ) : (
                        <span className="inline-block rounded-full border border-white/15 bg-white/8 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/45">Coming Soon</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 6-agent pipeline summary */}
            <div className="rounded-2xl border border-white/10 bg-white/4 p-8">
              <div className="mb-6 text-[11px] font-bold uppercase tracking-widest text-white/30">Design to Code · 6-Agent Pipeline</div>
              <div className="space-y-3">
                {[
                  { icon:'🎯', name:'Orchestrator', tools:'coordinates pipeline', color:'rgba(255,255,255,.3)', border:'rgba(255,255,255,.1)' },
                  { icon:'📥', name:'Figma Ingestion', tools:'fetch_figma', color:'rgba(46,144,250,.6)', border:'rgba(46,144,250,.2)' },
                  { icon:'🗺️', name:'Ground Truth', tools:'analyze_design · build_ir', color:'rgba(127,86,217,.6)', border:'rgba(127,86,217,.2)' },
                  { icon:'⚡', name:'Coding', tools:'plan · generate · assemble · zip', color:'rgba(241,91,64,.7)', border:'rgba(241,91,64,.2)' },
                  { icon:'🛡️', name:'Validation', tools:'gate 1 · gate 3 · gate 5 · gate 6', color:'rgba(18,183,106,.6)', border:'rgba(18,183,106,.2)' },
                  { icon:'👁️', name:'Visual QA', tools:'run_visual_qa', color:'rgba(11,165,236,.6)', border:'rgba(11,165,236,.2)' },
                ].map((a, ai) => (
                  <div key={a.name}>
                    <div className="flex items-center gap-3 rounded-xl border px-4 py-3" style={{ background: 'rgba(255,255,255,.04)', borderColor: a.border }}>
                      <span className="text-xl">{a.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-bold text-white">{a.name}</div>
                        <div className="font-mono text-[10px] truncate" style={{ color: a.color }}>{a.tools}</div>
                      </div>
                    </div>
                    {ai < 5 && (
                      <div className="ml-6 h-3 w-px" style={{ background: 'rgba(255,255,255,.1)' }} />
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-5 border-t border-white/7 pt-4 text-center text-[11px] text-white/30">
                13 tools across 6 agents · Coding agent runs an internal ReAct loop
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CAPABILITIES */}
      <section id="capabilities" className="py-20">
        <div className="mx-auto max-w-[1160px] px-7">
          <SectionTag color="green">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
            Live Capability
          </SectionTag>
          <h2 className="mb-3 mt-4 text-3xl font-black tracking-tight text-[#0f1724] md:text-4xl" style={{ letterSpacing: '-0.03em' }}>
            Design to Code, Fully Automated
          </h2>
          <p className="max-w-xl text-base leading-relaxed text-[#475467]">
            The first capability in AppVelocity converts a Figma file into a structured React Native
            or Flutter project automatically, in minutes.
          </p>

          <div className="mt-9 overflow-hidden rounded-2xl border border-[#e4e7ec] bg-white shadow-md">
            <div className="h-1 bg-gradient-to-r from-brand-500 via-[#ff8c42] to-amber-400" />
            <div className="grid gap-14 p-12 lg:grid-cols-[1fr_380px] lg:items-start">
              <div className="space-y-5">
                {[
                  { icon:'🔗', title:'One Input. Complete Project.', desc:'Paste a Figma URL, select your framework, and provide your Figma access token. AppVelocity reads every layer, extracts design tokens, plans the navigation structure, generates all screens and shared components, assembles the project scaffold, validates the output, and delivers a downloadable ZIP ready to open in your IDE.' },
                  { icon:'🤖', title:'6-Agent Pipeline, Not a Script', desc:'Six purpose-built agents work in sequence: Figma Ingestion, Ground Truth, Coding, Validation, and Visual QA. Each agent has a defined input/output contract so failures stay isolated. The Coding agent runs an internal ReAct loop. If Gate 1 syntax validation fails on a screen, repair fires immediately without re-running earlier stages.' },
                  { icon:'🎯', title:'Design-System Fidelity', desc:'Colors, typography, spacing, corner radii, and component variants are extracted directly from Figma variables and written as typed named constants in a theme file, never as hardcoded values. Your design system is the source of truth, and Visual QA enforces that every generated constant traces back to a Figma token.' },
                  { icon:'✅', title:'Multi-Gate Quality Assurance', desc:'Four quality gates run automatically: Gate 1 (Babel AST or dart analyze pre-write static check), Gate 3 (incremental tsc or dart workspace compile), Gate 5 (LLM repair loop for failing files), and Gate 6 (full compilation with one auto-fix pass). Every gate runs before the ZIP is created.' },
                  { icon:'📱', title:'Two Frameworks. One Tool.', desc:'React Native (TypeScript with Zustand, Redux, or Jotai on Expo SDK 55 and React Native 0.83) and Flutter (Dart with Riverpod, BLoC, or Provider on Flutter 3.41.5) are both fully supported today. The platform-neutral Design IR means adding a new target framework is a self-contained change.' },
                  { icon:'🔌', title:'Figma Plugin ZIP Export', desc:'Run the AppVelocity Figma plugin and upload the exported ZIP for pixel-perfect output. The plugin captures exact design data including variable bindings, component variants, and responsive constraints that the REST API alone cannot fully represent.' },
                  { icon:'🗂️', title:'Project History', desc:'Every generated project is saved to disk and accessible from the History tab. Browse past projects with an expandable file tree, download the ZIP again at any time, or delete projects you no longer need, all without re-running the agent.' },
                ].map(f => (
                  <div key={f.title} className="flex gap-3.5">
                    <div className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-lg border border-brand-200 bg-brand-50 text-[15px]">{f.icon}</div>
                    <div>
                      <div className="mb-1 text-[15px] font-bold text-[#0f1724]">{f.title}</div>
                      <div className="text-sm leading-relaxed text-[#475467]">{f.desc}</div>
                    </div>
                  </div>
                ))}
                <div className="flex flex-wrap gap-2 pt-2">
                  <span className="rounded-full border border-indigo-300 bg-[#eef0ff] px-3 py-1 text-xs font-semibold text-[#082340]">🤖 Multi-Agent Pipeline</span>
                  <span className="rounded-full border border-violet-300 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">Claude Sonnet</span>
                  <span className="rounded-full border border-blue-300 bg-[#eaf2ff] px-3 py-1 text-xs font-semibold text-blue-700">Gemini 2.0 Flash</span>
                  <span className="rounded-full border border-brand-300 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-600">Figma API</span>
                </div>
              </div>

              {/* Stats panel */}
              <div className="rounded-2xl p-7" style={{ background: '#082340' }}>
                <div className="mb-4 text-[10px] font-extrabold uppercase tracking-widest text-white/30">Impact at a Glance</div>
                <div className="divide-y divide-white/7">
                  {[
                    { ic:'⚡', bg:'rgba(241,91,64,.2)', val:'6 Agents', valColor:'#ff8c60', lbl:'Dedicated agents, each owning one focused pipeline stage' },
                    { ic:'🎯', bg:'rgba(18,183,106,.2)', val:'Token-based', valColor:'#4ade80', lbl:'Design values from Figma variables mapped to typed constants in code' },
                    { ic:'🔄', bg:'rgba(46,144,250,.2)', val:'30', valColor:'#7dd3fc', lbl:'Max iterations inside the Coding agent\'s ReAct generation loop' },
                    { ic:'🛠️', bg:'rgba(245,158,11,.2)', val:'13', valColor:'#fbbf24', lbl:'Specialized tools across the 6-agent pipeline' },
                  ].map(s => (
                    <div key={s.val} className="flex items-center gap-4 py-3.5">
                      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-xl" style={{ background: s.bg }}>{s.ic}</div>
                      <div>
                        <div className="text-2xl font-black" style={{ color: s.valColor, letterSpacing: '-0.02em' }}>{s.val}</div>
                        <div className="mt-0.5 text-[12px] leading-snug text-white/45">{s.lbl}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 13 TOOLS GRID */}
      <section className="pb-20">
        <div className="mx-auto max-w-[1160px] px-7">
          <SectionTag color="blue">Tool Registry</SectionTag>
          <h2 className="mb-3 mt-4 text-3xl font-black tracking-tight text-[#0f1724] md:text-4xl" style={{ letterSpacing: '-0.03em' }}>
            13 Specialized Tools. 6 Dedicated Agents.
          </h2>
          <p className="max-w-xl text-base leading-relaxed text-[#475467]">
            Every tool is a focused wrapper around well-tested logic. Each agent owns the tools for
            its stage with no shared pool. The Coding agent&apos;s internal ReAct loop decides which
            generation and repair tools to call, in what order, based on what it observes.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {TOOL_DATA.map(t => (
              <div key={t.key} className="group relative overflow-hidden rounded-2xl border border-[#e4e7ec] bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md">
                <div className={`absolute left-0 right-0 top-0 h-[2px] bg-gradient-to-r ${t.stripe}`} />
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg border text-sm" style={{ background: t.icBg, borderColor: t.icBorder, color: t.icColor }}>{t.icon}</div>
                <div className="mb-1 text-[14px] font-bold text-[#0f1724]">{t.name}</div>
                <div className="mb-1.5 font-mono text-[11px] text-gray-400">{t.key}</div>
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: t.agentColor }}>{t.agent}</div>
                <div className="text-xs leading-relaxed text-[#475467]">{t.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TECHNOLOGY STACK */}
      <section id="technology" className="border-y border-[#e4e7ec] bg-white py-20">
        <div className="mx-auto max-w-[1160px] px-7">
          <SectionTag color="violet">Technology</SectionTag>
          <h2 className="mb-3 mt-4 text-3xl font-black tracking-tight text-[#0f1724] md:text-4xl" style={{ letterSpacing: '-0.03em' }}>
            Built on the best AI stack
          </h2>
          <p className="max-w-xl text-base leading-relaxed text-[#475467]">
            AppVelocity assigns the right model to each agent stage: specialized LLMs for vision
            analysis and code generation, deterministic compilers for validation, and a purpose-built
            pipeline for orchestration.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { logo:'✦', name:'Claude Sonnet', role:'Code Generation · React Native', desc:'Primary worker LLM for generating TypeScript and React Native code. Produces strict TypeScript, StyleSheet.create patterns, and framework-idiomatic component structures from the Design IR. Used inside the Coding agent\'s ReAct generation loop.' },
              { logo:'◆', name:'Gemini 2.0 Flash', role:'Code Generation · Flutter', desc:'Worker LLM for Flutter and Dart generation and refinement. Enforces const constructors, null safety, named parameters, and proper widget lifecycle patterns automatically across every generated Dart file.' },
              { logo:'🎨', name:'Figma REST API', role:'Design Data Source', desc:'Official Figma API for complete document tree retrieval, design variable extraction, and PNG screen export. Includes rate limiting, exponential backoff, and a 5-minute LRU cache. Supports both direct URL input and Figma Plugin ZIP upload.' },
              { logo:'🧠', name:'Multi-Modal LLM', role:'Vision Analysis · Ground Truth Agent', desc:'A vision-capable LLM processes exported screen PNGs during the Ground Truth stage to detect spacing rhythms, icon families, font usage, and layout patterns, producing richer IR metadata than the Figma JSON alone provides.' },
              { logo:'⚡', name:'Next.js with SSE', role:'Web Platform · Real-time Streaming', desc:'The 6-agent pipeline runs asynchronously on the server. Real-time progress streams to the browser via Server-Sent Events as each agent and tool call completes. No polling. No page refreshes. The VS Code-style Code Viewer and Project History are built into the same Next.js app.' },
              { logo:'🔬', name:'Babel AST + tsc + dart', role:'Deterministic Validation · Gate Agent', desc:'Quality gates use real compilers and parsers, not heuristics. Babel parses TypeScript for syntax errors. tsc validates type correctness. dart analyze and flutter analyze enforce Dart compilation correctness. Expo SDK 55 · React Native 0.83 · Flutter 3.41.5' },
            ].map(s => (
              <div key={s.name} className="rounded-2xl border border-[#e4e7ec] p-7 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                <span className="mb-3.5 block text-3xl">{s.logo}</span>
                <div className="mb-1 text-[15px] font-extrabold text-[#0f1724]">{s.name}</div>
                <div className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">{s.role}</div>
                <div className="text-sm leading-relaxed text-[#475467]">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ROADMAP */}
      <section id="roadmap" className="py-20">
        <div className="mx-auto max-w-[1160px] px-7">
          <SectionTag>Roadmap</SectionTag>
          <h2 className="mb-3 mt-4 text-3xl font-black tracking-tight text-[#0f1724] md:text-4xl" style={{ letterSpacing: '-0.03em' }}>
            One tool. Growing with every sprint.
          </h2>
          <p className="max-w-xl text-base leading-relaxed text-[#475467]">
            AppVelocity is designed to expand by adding new capabilities to the multi-agent pipeline,
            not by shipping separate products. Each new capability becomes a new agent cluster the
            Orchestrator can route to.
          </p>

          <div className="mt-12 flex flex-col">
            {ROADMAP.map((phase) => (
              <div key={phase.phase} className="flex gap-0">
                <div className="hidden w-[140px] flex-shrink-0 items-end justify-end gap-0 pr-8 pt-6 sm:flex sm:flex-col">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400 text-right">{phase.phase}</span>
                  <span className="mt-0.5 text-[11px] text-gray-400 text-right">{phase.period}</span>
                </div>
                <div className={`relative flex-1 border-l-2 pb-10 pl-8 ${phase.live ? 'border-green-400' : phase.next ? 'border-brand-400' : 'border-[#e4e7ec]'}`}>
                  <span
                    className={`absolute -left-[7px] top-6 h-3 w-3 rounded-full border-2 ${
                      phase.live ? 'border-green-400 bg-green-400 shadow-[0_0_0_4px_#ecfdf3]'
                      : phase.next ? 'border-brand-500 bg-brand-500 shadow-[0_0_0_4px_#fff4f1]'
                      : 'border-[#e4e7ec] bg-white'
                    }`}
                  />
                  <div className="pt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {phase.cards.map(c => (
                      <div key={c.name} className={`relative overflow-hidden rounded-xl border p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${c.live ? 'border-green-200 bg-green-50' : 'border-[#e4e7ec] bg-white'}`}>
                        <div className="absolute left-0 right-0 top-0 h-[2px]" style={{ background: c.accent }} />
                        <div className="mb-2 flex items-center gap-2.5">
                          <span className="text-xl">{c.icon}</span>
                          <span className="text-[14px] font-extrabold text-[#0f1724]">{c.name}</span>
                        </div>
                        <div className="mb-2 text-xs leading-relaxed text-[#475467]">{c.desc}</div>
                        {c.live ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-green-600">
                            <span className="h-1 w-1 animate-pulse rounded-full bg-green-500" />
                            Live
                          </span>
                        ) : (
                          <span className="inline-block rounded-full border border-[#e4e7ec] bg-gray-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Planned</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AGENTS GRID */}
      <section className="border-t border-[#e4e7ec] bg-white py-20">
        <div className="mx-auto max-w-[1160px] px-7">
          <h2 className="mb-8 text-xs font-bold uppercase tracking-widest text-gray-400">Available Agents</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {AGENTS.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-10" style={{ background: '#040d18' }}>
        <div className="mx-auto max-w-[1160px] px-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2.5" style={{ color: 'rgba(255,255,255,.7)' }}>
              <AppVelocityLogo size={18} />
              <span className="text-[15px] font-extrabold">AppVelocity</span>
            </div>
            <div className="flex gap-6">
              {['#how','#architecture','#capabilities','#technology','#roadmap'].map((href,i)=>(
                <a key={href} href={href} className="text-[13px] text-white/30 transition-colors hover:text-white/70">
                  {['How It Works','Architecture','Capabilities','Technology','Roadmap'][i]}
                </a>
              ))}
            </div>
          </div>
          <div className="mt-7 border-t pt-5 text-center text-[12px]" style={{ borderColor: 'rgba(255,255,255,.07)', color: 'rgba(255,255,255,.25)' }}>
            © 2026 AppVelocity · AI Accelerator for Mobile SDLC · Phase 1: Design to Code is Live · 6-Agent Pipeline
          </div>
        </div>
      </footer>
    </div>
  );
}

const TOOL_DATA = [
  { icon:'📥', name:'Fetch Figma', key:'fetch_figma', agent:'Figma Ingestion', agentColor:'#2e90fa', desc:'Retrieves the complete Figma document tree and design variable definitions using snapshot mode, making just one API call for the full design tree. Always the first tool called. Supports both REST API and Plugin ZIP inputs.', stripe:'from-blue-400 to-cyan-400', icBg:'#eff8ff', icBorder:'#b2ddff', icColor:'#2e90fa' },
  { icon:'👁️', name:'Vision Analysis', key:'analyze_design', agent:'Ground Truth', agentColor:'#7f56d9', desc:'Exports screens as PNG images and runs a multi-modal LLM vision pass to detect spacing systems, icon families, image assets, and font usage. Non-fatal, it enriches the IR with visual context that the Figma JSON alone does not capture.', stripe:'from-violet-500 to-blue-400', icBg:'#f9f5ff', icBorder:'#d9d6fe', icColor:'#7f56d9' },
  { icon:'🔀', name:'Build IR', key:'build_ir', agent:'Ground Truth', agentColor:'#7f56d9', desc:'Transforms raw Figma JSON into a platform-neutral Design IR covering all screens, components, flex rules, design tokens, and accessibility metadata. This is the canonical output consumed by all downstream agents.', stripe:'from-amber-400 to-brand-500', icBg:'#fffaeb', icBorder:'#fef0c7', icColor:'#f79009' },
  { icon:'🧭', name:'Plan Generation', key:'plan_generation', agent:'Coding', agentColor:'#f15b40', desc:'Analyzes the IR and produces a structured execution plan: project name, entry screen, screen list, navigation graph, and component dependency order. This shapes the entire generation sequence.', stripe:'from-violet-500 to-rose-400', icBg:'#f9f5ff', icBorder:'#d9d6fe', icColor:'#7f56d9' },
  { icon:'⚙️', name:'Generate All', key:'generate_all_components', agent:'Coding', agentColor:'#f15b40', desc:'Runs parallel code generation across all screens and components in the execution plan. Automatically runs Gate 1 (Babel or dart AST) and Gate 3 (workspace compile) checks after each generation batch.', stripe:'from-brand-500 to-amber-400', icBg:'#fff4f1', icBorder:'#fecdb8', icColor:'#f15b40' },
  { icon:'🔧', name:'Generate One', key:'generate_component', agent:'Coding', agentColor:'#f15b40', desc:'Generates or regenerates a single named screen or component. Used inside the ReAct loop when one file needs to be rebuilt after a repair without rerunning the full generation batch.', stripe:'from-brand-500 to-orange-400', icBg:'#fff4f1', icBorder:'#fecdb8', icColor:'#f15b40' },
  { icon:'✅', name:'Validate File', key:'validate_file', agent:'Validation', agentColor:'#12b76a', desc:'Gate 1: runs Babel AST parsing and structural checks on a specific generated file before it is written to disk. Returns pass or fail with line-level error attribution for targeted repair.', stripe:'from-green-400 to-cyan-400', icBg:'#ecfdf3', icBorder:'#a6f4c5', icColor:'#12b76a' },
  { icon:'🩹', name:'Repair File', key:'repair_file', agent:'Validation', agentColor:'#12b76a', desc:'Gate 5: sends a failing file alongside its specific errors to a worker LLM for a targeted, contextual fix. Always saves the best version seen across repair attempts, not just the last one.', stripe:'from-amber-400 to-rose-400', icBg:'#fffaeb', icBorder:'#fef0c7', icColor:'#f79009' },
  { icon:'🔍', name:'Workspace Check', key:'run_workspace_check', agent:'Validation', agentColor:'#12b76a', desc:'Gate 3: writes all generated files to a temp workspace and runs tsc --noResolve or dart analyze incrementally. Returns errors grouped by file for targeted, parallel repair calls.', stripe:'from-cyan-400 to-blue-400', icBg:'#f0f9ff', icBorder:'#b9e6fe', icColor:'#0ba5ec' },
  { icon:'🏗️', name:'Assemble Project', key:'assemble_project', agent:'Coding', agentColor:'#f15b40', desc:'Generates the full project scaffold (entry point, router, state management setup, package.json or pubspec.yaml) and merges it with all generated screens and shared components into a single output tree.', stripe:'from-indigo-400 to-violet-500', icBg:'#eef0ff', icBorder:'#c7d2fe', icColor:'#082340' },
  { icon:'🏁', name:'Compile Check', key:'run_compilation_check', agent:'Validation', agentColor:'#12b76a', desc:'Gate 6: runs the full compiler (npx tsc --noEmit or flutter analyze) on the assembled project in a temp directory. Automatically applies one LLM fix pass on failure before reporting the result.', stripe:'from-green-400 to-blue-400', icBg:'#ecfdf3', icBorder:'#a6f4c5', icColor:'#12b76a' },
  { icon:'📦', name:'Create ZIP', key:'create_zip', agent:'Coding', agentColor:'#f15b40', desc:'Packages the complete project into a downloadable ZIP archive and signals the pipeline to stop. Called by the Coding agent after compilation passes or after the max-retry limit is reached.', stripe:'from-brand-500 to-green-400', icBg:'#fff4f1', icBorder:'#fecdb8', icColor:'#f15b40' },
  { icon:'🔎', name:'Visual QA', key:'run_visual_qa', agent:'Visual QA', agentColor:'#0ba5ec', desc:'Compares generated screens against the Figma ground truth using structural checks (component hierarchy), token checks (colors and typography map to named constants), and an LLM judge pass for overall layout fidelity.', stripe:'from-cyan-400 to-sky-400', icBg:'#f0f9ff', icBorder:'#b9e6fe', icColor:'#0ba5ec' },
];

const ROADMAP = [
  {
    phase: 'Phase 1', period: 'Live Now', live: true, next: false,
    cards: [
      { icon:'🎨', name:'Design to Code', desc:'Full Figma-to-mobile-project pipeline. React Native and Flutter. 6-agent architecture with 13 specialized tools. Multi-gate QA. Visual QA. Plugin ZIP support. Project History.', live: true, accent:'#12b76a' },
    ],
  },
  {
    phase: 'Phase 2', period: 'Next Up', live: false, next: true,
    cards: [
      { icon:'♿', name:'Accessibility Intelligence', desc:'WCAG AA/AAA validation on every generated screen. Color contrast, screen reader labels, and focus order are checked and flagged before delivery.', live: false, accent:'#12b76a' },
      { icon:'🛡️', name:'Security Shield', desc:'OWASP Mobile Top 10 scanning integrated into the generation loop. Hardcoded secrets, insecure storage, and injection patterns caught automatically.', live: false, accent:'#f63d68' },
    ],
  },
  {
    phase: 'Phase 3', period: 'Q3 2026', live: false, next: false,
    cards: [
      { icon:'⚡', name:'Performance Optimizer', desc:'60fps tuning, bundle tree-shaking, list virtualization, and image lazy loading applied automatically to generated code. Re-render hotspots identified and memoized.', live: false, accent:'#f79009' },
      { icon:'🧪', name:'Test Intelligence', desc:'Jest unit tests, Detox E2E scenarios, and visual regression baselines generated in the same run as the screens they cover. Coverage grows with the codebase, automatically.', live: false, accent:'#7f56d9' },
    ],
  },
  {
    phase: 'Phase 4', period: 'Q4 2026', live: false, next: false,
    cards: [
      { icon:'🚀', name:'DevOps Accelerator', desc:'GitHub Actions and Bitrise CI/CD pipelines, Fastlane lanes for App Store and Play Store, and Swagger/OpenAPI docs, all generated alongside the project code.', live: false, accent:'#0ba5ec' },
      { icon:'📋', name:'Compliance Guard', desc:'GDPR consent flows, HIPAA PHI handling patterns, and PCI DSS secure payment integrations scaffolded into the project from the first line of code, not bolted on at the end.', live: false, accent:'#f63d68' },
      { icon:'📱', name:'Native Platform Targets', desc:'Native Android (Kotlin with Compose) and iOS (Swift with SwiftUI) added as new code-generation plugins. The platform-neutral Design IR makes adding new targets a self-contained change.', live: false, accent:'#0f3d6e' },
    ],
  },
];
