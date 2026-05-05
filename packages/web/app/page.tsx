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

export default function DashboardPage() {
  return (
    <div className="min-h-full">
      {/* ── NAV ── */}
      <header className="sticky top-0 z-50 border-b border-[#e4e7ec] bg-white/92 backdrop-blur shadow-sm">
        <div className="mx-auto flex h-16 max-w-[1160px] items-center gap-8 px-7">
          <div className="flex items-center gap-2.5">
            <AppVelocityLogo size={22} />
            <span className="text-base font-extrabold tracking-tight text-[#082340]">AppVelocity</span>
          </div>
          <nav className="ml-5 hidden items-center gap-7 md:flex">
            {(['#how', '#capabilities', '#technology', '#roadmap'] as const).map((href, i) => (
              <a key={href} href={href} className="text-sm font-medium text-[#475467] transition-colors hover:text-[#0f1724]">
                {['How it works', 'Capabilities', 'Technology', 'Roadmap'][i]}
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

      {/* ── HERO ── */}
      <section id="hero" className="bg-[#f4f5f7] px-7 pb-12 pt-24">
        <div className="mx-auto max-w-[1160px]">
          <div
            className="relative overflow-hidden rounded-2xl p-14 shadow-2xl"
            style={{ background: 'linear-gradient(130deg,#3b1a8c 0%,#6d28d9 32%,#b45309 68%,#f15b40 100%)' }}
          >
            {/* Grid overlay */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage: 'linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px)',
                backgroundSize: '40px 40px',
              }}
            />

            <div className="relative z-10 grid grid-cols-1 gap-10 md:grid-cols-[1fr_280px] md:items-center">
              {/* Left */}
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
                  AppVelocity is a single, unified AI tool built to accelerate mobile development.
                  Starting with Figma-to-code generation via a 6-agent pipeline, with more lifecycle
                  capabilities planned ahead.
                </p>
                <div className="mt-8 flex flex-wrap gap-3.5">
                  <a
                    href="#capabilities"
                    className="rounded-xl border border-white/35 bg-white/15 px-7 py-3 text-[15px] font-bold text-white backdrop-blur transition-all hover:bg-white/25 hover:-translate-y-px"
                  >
                    See What It Can Do
                  </a>
                  <a
                    href="#how"
                    className="rounded-xl border border-white/20 px-6 py-3 text-[15px] font-semibold text-white/75 transition-all hover:border-white/45 hover:text-white hover:-translate-y-px"
                  >
                    How It Works
                  </a>
                </div>
              </div>

              {/* Right: phone mockup */}
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

          {/* Agent loop diagram */}
          <div className="mt-6 overflow-hidden rounded-2xl border border-[#e4e7ec] bg-white shadow-md">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e4e7ec] bg-[#f4f5f7] px-5 py-3">
              <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Live Agent Loop — LLM orchestrator picks tools dynamically</span>
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-[11px] text-gray-500">up to 30 iterations</span>
                <span className="rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-[11px] font-bold text-brand-600">ReAct · Active</span>
              </div>
            </div>
            <div className="overflow-x-auto bg-[#edf0f6] p-6">
              <div className="flex min-w-[700px] flex-col gap-4">
                {/* Main flow row */}
                <div className="flex items-center gap-3">
                  {[
                    { icon:'⚡', name:'Figma Input', sub:'Design trigger', accent:'border-violet-400' },
                    { icon:'→', name:'', sub:'', accent:'', arrow:true },
                    { icon:'🧠', name:'LLM Orchestrator', sub:'Think · Act · Observe', accent:'border-brand-400', main:true },
                    { icon:'→', name:'', sub:'', accent:'', arrow:true },
                    { icon:'⚖️', name:'Router', sub:'done?', accent:'border-amber-400' },
                    { icon:'→', name:'', sub:'', accent:'', arrow:true },
                    { icon:'📦', name:'ZIP Output', sub:'Delivered', accent:'border-green-400' },
                  ].map((n,i) => n.arrow ? (
                    <span key={i} className="text-gray-400 font-mono">──&gt;</span>
                  ) : (
                    <div key={i} className={`flex flex-col items-center justify-center gap-0.5 rounded-xl border-2 bg-white px-4 py-3 text-center shadow-sm ${n.accent} ${n.main ? 'min-w-[160px] border-t-4 border-t-brand-500' : 'min-w-[120px]'}`}>
                      <span className={n.main ? 'text-2xl' : 'text-xl'}>{n.icon}</span>
                      <span className="font-mono text-[11px] font-bold text-[#0f1724]">{n.name}</span>
                      <span className="text-[10px] text-gray-400">{n.sub}</span>
                    </div>
                  ))}
                </div>
                {/* Tools grid */}
                <div className="mt-1 grid grid-cols-6 gap-2">
                  {[
                    {icon:'🖼️',name:'fetch_figma'},{icon:'👁️',name:'analyze_design'},{icon:'🔀',name:'build_ir'},
                    {icon:'📋',name:'plan_generation'},{icon:'⚙️',name:'generate_all'},{icon:'🔧',name:'generate_one'},
                    {icon:'✅',name:'validate_file'},{icon:'🩹',name:'repair_file'},{icon:'🔍',name:'workspace_check'},
                    {icon:'🏗️',name:'assemble_project'},{icon:'🏁',name:'compile_check'},{icon:'📦',name:'create_zip'},
                  ].map(t => (
                    <div key={t.name} className="flex flex-col items-center gap-1 rounded-lg border border-[#dde2ea] bg-white px-2 py-2 text-center shadow-sm">
                      <span className="text-base">{t.icon}</span>
                      <span className="font-mono text-[9px] text-gray-500">{t.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2.5 border-t border-[#e4e7ec] bg-[#f4f5f7] px-5 py-3">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" />
              <span className="font-mono text-[11px] text-gray-500">Tool results return as observations · LLM adapts strategy each iteration</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" className="py-20">
        <div className="mx-auto max-w-[1160px] px-7">
          <SectionTag>How It Works</SectionTag>
          <h2 className="mb-3 mt-4 text-3xl font-black tracking-tight text-[#0f1724] md:text-4xl" style={{ letterSpacing: '-0.03em' }}>
            One orchestrator. Infinite flexibility.
          </h2>
          <p className="max-w-xl text-base leading-relaxed text-[#475467]">
            AppVelocity replaces rigid, fixed pipelines with a true AI reasoning loop. The orchestrator
            LLM thinks, acts, observes the result, and decides what to do next, adapting as it goes.
          </p>

          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {[
              { num:'1', title:'Reason', grad:'from-blue-500 to-violet-600', desc:'Each iteration, the orchestrator LLM reads a compact snapshot of the current project state (what has been done, what failed, what is left) and decides which capability to invoke next. No predetermined sequence.' },
              { num:'2', title:'Act', grad:'from-brand-500 to-amber-500', desc:'The orchestrator calls one of AppVelocity\'s specialized tools — fetch design data, generate code, validate output, repair errors. Each tool does one thing extremely well and returns a concise result.' },
              { num:'3', title:'Observe & Adapt', grad:'from-green-500 to-cyan-500', desc:'The tool result is fed back to the orchestrator as an observation. It adapts by re-generating a failing screen, running a targeted repair, or taking an entirely different path to reach a working, compilable project.' },
            ].map((card, i) => (
              <div key={i} className="relative overflow-hidden rounded-2xl border border-[#e4e7ec] bg-white p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md">
                <div className={`absolute left-0 right-0 top-0 h-[3px] bg-gradient-to-r ${card.grad}`} />
                <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${card.grad} text-sm font-extrabold text-white`}>{card.num}</div>
                <h3 className="mb-2.5 text-[17px] font-extrabold text-[#0f1724]">{card.title}</h3>
                <p className="text-sm leading-relaxed text-[#475467]">{card.desc}</p>
              </div>
            ))}
          </div>

          {/* ReAct detail card */}
          <div className="mt-6 flex flex-wrap items-center gap-10 rounded-2xl border border-[#e4e7ec] bg-white p-10 shadow-sm">
            <div className="min-w-[260px] flex-1">
              <SectionTag>Under the Hood</SectionTag>
              <h3 className="mb-2.5 mt-4 text-xl font-extrabold text-[#0f1724]">ReAct Agent Loop</h3>
              <p className="mb-4 text-sm leading-relaxed text-[#475467]">
                The core of AppVelocity is a <strong>ReAct (Reason + Act)</strong> while-loop.
                The orchestrator runs up to 30 iterations. It has access to 12 specialized tools.
                Full file content never touches the LLM. Only compact summaries flow through the
                context window, keeping every iteration fast and cost-efficient.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-violet-300 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">30 max iterations</span>
                <span className="rounded-full border border-blue-300 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">12 specialized tools</span>
                <span className="rounded-full border border-green-300 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">Self-healing output</span>
              </div>
            </div>
            <div
              className="min-w-[280px] flex-shrink-0 rounded-xl p-6 font-mono text-xs leading-8"
              style={{ background: '#082340', color: 'rgba(255,255,255,.45)' }}
            >
              <span style={{ color: 'rgba(255,255,255,.25)' }}>{'// agent-loop.ts'}</span><br />
              <span style={{ color: '#c792ea' }}>for</span> i = <span style={{ color: '#f78c6c' }}>1</span>..<span style={{ color: '#f78c6c' }}>30</span>:<br />
              &nbsp;&nbsp;prompt = <span style={{ color: '#c3e88d' }}>buildPrompt</span>(memory)<br />
              &nbsp;&nbsp;call = <span style={{ color: '#c3e88d' }}>llm.chat</span>(prompt, tools)<br />
              &nbsp;&nbsp;result = <span style={{ color: '#c3e88d' }}>dispatch</span>(call)<br />
              &nbsp;&nbsp;memory.<span style={{ color: '#c3e88d' }}>observe</span>(result)<br />
              &nbsp;&nbsp;<span style={{ color: '#c792ea' }}>if</span> zipBuffer: <span style={{ color: '#c792ea' }}>break</span><br />
              <span style={{ color: '#c3e88d' }}>return</span> output
            </div>
          </div>
        </div>
      </section>

      {/* ── SDLC COVERAGE (dark navy) ── */}
      <section id="sdlc" className="py-20" style={{ background: '#082340' }}>
        <div className="mx-auto max-w-[1160px] px-7">
          <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
            {/* Left */}
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
                  { icon:'🎨', name:'Design → Code', desc:'Parse Figma, extract design tokens, generate React Native or Flutter screens with a full project scaffold.', live:true, accent:'rgba(241,91,64,.15)', accentBorder:'rgba(241,91,64,.35)', color:'#f15b40' },
                  { icon:'♿', name:'Accessibility', desc:'WCAG AA/AAA validation on every generated screen: color contrast, labels, focus order, screen reader support.', live:false, accent:'rgba(18,183,106,.12)', accentBorder:'rgba(18,183,106,.30)', color:'#12b76a' },
                  { icon:'🛡️', name:'Security', desc:'OWASP Mobile Top 10 scanning: hardcoded secrets, insecure storage, injection vectors caught before review.', live:false, accent:'rgba(239,68,68,.12)', accentBorder:'rgba(239,68,68,.30)', color:'#f87171' },
                  { icon:'⚡', name:'Performance', desc:'60fps tuning, bundle analysis, list virtualisation, image lazy loading, automatically considered during code generation.', live:false, accent:'rgba(247,144,9,.12)', accentBorder:'rgba(247,144,9,.30)', color:'#f79009' },
                  { icon:'🧪', name:'Test Intelligence', desc:'Unit tests, Detox E2E flows, and visual regression baselines generated alongside every screen.', live:false, accent:'rgba(127,86,217,.12)', accentBorder:'rgba(127,86,217,.30)', color:'#7f56d9' },
                  { icon:'🚀', name:'DevOps & Compliance', desc:'CI/CD pipelines, Fastlane lanes, GDPR/HIPAA scaffolding — delivered with the first commit, not at the end of a sprint.', live:false, accent:'rgba(11,165,236,.12)', accentBorder:'rgba(11,165,236,.30)', color:'#0ba5ec' },
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

            {/* Right: loop diagram */}
            <div className="rounded-2xl border border-white/10 bg-white/4 p-8">
              <div className="mb-6 text-[11px] font-bold uppercase tracking-widest text-white/30">Orchestrator: live tool selection</div>
              <div className="mx-auto mb-6 flex h-22 w-22 items-center justify-center rounded-full border-2 border-brand-500/40 text-center text-[11px] font-extrabold leading-tight text-white"
                style={{
                  background: 'linear-gradient(135deg,rgba(241,91,64,.3),rgba(127,86,217,.3))',
                  boxShadow: '0 0 32px rgba(241,91,64,.2)',
                  width: 88, height: 88,
                  flexShrink: 0,
                  margin: '0 auto 24px',
                  display: 'flex',
                }}
              >
                <span>GPT-4o<br />Orchestrator<br /><span className="text-[9px] opacity-60">ReAct Loop</span></span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {['Fetch Figma','Vision Analyse','Build IR','Plan','Generate All','Validate','Repair','Workspace Check','Assemble','Compile','Create ZIP','Generate One'].map(t => (
                  <div key={t} className="rounded-lg border border-white/8 bg-white/5 px-2.5 py-2 text-center text-[11px] font-semibold leading-tight text-white/50">{t}</div>
                ))}
              </div>
              <div className="mt-5 border-t border-white/7 pt-4 text-center text-[11px] text-white/30">
                Tool results return as observations · LLM adapts strategy each iteration
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CAPABILITIES (DesignToCode) ── */}
      <section id="capabilities" className="py-20">
        <div className="mx-auto max-w-[1160px] px-7">
          <SectionTag color="green">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
            Live Capability
          </SectionTag>
          <h2 className="mb-3 mt-4 text-3xl font-black tracking-tight text-[#0f1724] md:text-4xl" style={{ letterSpacing: '-0.03em' }}>
            Design → Code, Fully Automated
          </h2>
          <p className="max-w-xl text-base leading-relaxed text-[#475467]">
            The first capability in AppVelocity is design-to-code generation: converting a Figma file into
            a structured React Native or Flutter project, automatically.
          </p>

          <div className="mt-9 overflow-hidden rounded-2xl border border-[#e4e7ec] bg-white shadow-md">
            <div className="h-1 bg-gradient-to-r from-brand-500 via-[#ff8c42] to-amber-400" />
            <div className="grid gap-14 p-12 lg:grid-cols-[1fr_380px] lg:items-start">
              {/* Features */}
              <div className="space-y-5">
                {[
                  { icon:'🔗', title:'One Input. Complete Project.', desc:'Paste a Figma URL and select your framework. AppVelocity reads every layer, extracts design tokens, plans the navigation structure, generates all screens and shared components, assembles the project scaffold, validates the output, and delivers a downloadable ZIP ready to open.' },
                  { icon:'🧠', title:'LLM Orchestration, Not a Script', desc:'The orchestrator LLM dynamically decides the generation sequence every iteration. If Gate 1 syntax validation fails on a screen, the agent calls repair_file immediately, not after everything else finishes. Self-healing is built into every run.' },
                  { icon:'🎯', title:'Design-System Fidelity', desc:'Colors, typography, spacing, corner radii, and component variants are extracted directly from Figma variables and written as typed named constants in a theme file, not hardcoded values. Your design system is the source of truth.' },
                  { icon:'✅', title:'Multi-Gate Quality Assurance', desc:'Five quality gates run automatically: Babel AST parse (Gate 1), IR structural validation (Gate 2), workspace tsc / dart analyze (Gate 3), LLM repair loop (Gate 5), and full compilation check with one auto-fix pass (Gate 6). Quality is checked at multiple stages before the ZIP is created.' },
                  { icon:'📦', title:'Two Frameworks. One Tool.', desc:'React Native (TypeScript + Zustand / Redux / Jotai) and Flutter (Dart + Riverpod / BLoC / Provider) are fully supported today. Native Android and iOS targets are on the roadmap. The platform-neutral Design IR makes new targets a plugin addition.' },
                  { icon:'🔌', title:'Plugin ZIP Export', desc:'Run the AppVelocity Figma plugin and upload the exported ZIP for pixel-perfect output. The plugin captures exact design data — variable bindings, component variants, and responsive constraints — that the REST API alone cannot fully represent.' },
                  { icon:'🗂️', title:'Project History', desc:'Every generated project is saved to disk and accessible from the History tab. Browse past projects with an expandable file tree, download the ZIP again at any time, or delete projects you no longer need — all without re-running the agent.' },
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
                  <span className="rounded-full border border-indigo-300 bg-[#eef0ff] px-3 py-1 text-xs font-semibold text-[#082340]">🤖 GPT-4o Orchestrator</span>
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
                    { ic:'⚡', bg:'rgba(241,91,64,.2)', val:'Faster', valColor:'#ff8c60', lbl:'Time to first reviewable build, compared to building screens manually' },
                    { ic:'🎯', bg:'rgba(18,183,106,.2)', val:'Token-based', valColor:'#4ade80', lbl:'Design values from Figma variables mapped to typed constants in code' },
                    { ic:'🔄', bg:'rgba(46,144,250,.2)', val:'30', valColor:'#7dd3fc', lbl:'Max agent iterations, with self-correction at each step' },
                    { ic:'🛠️', bg:'rgba(245,158,11,.2)', val:'12', valColor:'#fbbf24', lbl:'Specialized tools the orchestrator can call dynamically' },
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

      {/* ── 12 TOOLS GRID ── */}
      <section className="pb-20">
        <div className="mx-auto max-w-[1160px] px-7">
          <SectionTag color="blue">Tool Registry</SectionTag>
          <h2 className="mb-3 mt-4 text-3xl font-black tracking-tight text-[#0f1724] md:text-4xl" style={{ letterSpacing: '-0.03em' }}>
            12 Specialized Tools. One Orchestrator.
          </h2>
          <p className="max-w-xl text-base leading-relaxed text-[#475467]">
            Every tool is a thin, focused wrapper around battle-tested logic. The orchestrator LLM picks
            which ones to call, in what order, based on what it observes, not a predetermined sequence.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {TOOL_DATA.map(t => (
              <div key={t.key} className="group relative overflow-hidden rounded-2xl border border-[#e4e7ec] bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md">
                <div className={`absolute left-0 right-0 top-0 h-[2px] bg-gradient-to-r ${t.stripe}`} />
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg border text-sm" style={{ background: t.icBg, borderColor: t.icBorder, color: t.icColor }}>{t.icon}</div>
                <div className="mb-1 text-[14px] font-bold text-[#0f1724]">{t.name}</div>
                <div className="mb-2 font-mono text-[11px] text-gray-400">{t.key}</div>
                <div className="text-xs leading-relaxed text-[#475467]">{t.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TECHNOLOGY STACK ── */}
      <section id="technology" className="border-y border-[#e4e7ec] bg-white py-20">
        <div className="mx-auto max-w-[1160px] px-7">
          <SectionTag color="violet">Technology</SectionTag>
          <h2 className="mb-3 mt-4 text-3xl font-black tracking-tight text-[#0f1724] md:text-4xl" style={{ letterSpacing: '-0.03em' }}>
            Built on the best AI stack
          </h2>
          <p className="max-w-xl text-base leading-relaxed text-[#475467]">
            AppVelocity uses the right model for each job: a powerful orchestrator for dynamic reasoning,
            specialized models for code generation, and deterministic tools for validation.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { logo:'🧠', name:'GPT-4o', role:'Orchestrator LLM', desc:'Drives the ReAct loop. Reads the current project state summary, reasons about what tool to invoke next, and adapts its strategy based on tool observations. Sees only compact summaries, never raw file content.' },
              { logo:'✦', name:'Claude Sonnet', role:'Code Generation · React Native', desc:'Primary Worker LLM for generating TypeScript and React Native code. Produces strict TypeScript, StyleSheet.create patterns, and framework-idiomatic component structures from the Design IR.' },
              { logo:'◆', name:'Gemini 2.0 Flash', role:'Code Generation · Flutter', desc:'Worker LLM for Flutter/Dart generation and refinement. Enforces const constructors, null safety, named parameters, and proper widget lifecycle patterns automatically across every generated Dart file.' },
              { logo:'🎨', name:'Figma REST API', role:'Design Data Source', desc:'Official Figma API for complete document tree retrieval, design variable extraction, and PNG screen export. Includes rate limiting, exponential backoff, and a 5-minute LRU cache for reliability.' },
              { logo:'⚡', name:'Next.js + SSE', role:'Web Platform', desc:'The agent runs asynchronously on the server. Real-time progress streams to the browser via Server-Sent Events as each tool call happens. No polling. No page refreshes.' },
              { logo:'🔬', name:'Babel AST + tsc + dart', role:'Deterministic Validation', desc:'Quality gates use real compilers and parsers, not heuristics. Babel parses TypeScript for syntax errors. tsc validates type correctness. dart analyze and flutter analyze enforce Dart compilation correctness. Expo SDK 55 · React Native 0.83 · Flutter 3.41.5' },
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

      {/* ── ROADMAP ── */}
      <section id="roadmap" className="py-20">
        <div className="mx-auto max-w-[1160px] px-7">
          <SectionTag>Roadmap</SectionTag>
          <h2 className="mb-3 mt-4 text-3xl font-black tracking-tight text-[#0f1724] md:text-4xl" style={{ letterSpacing: '-0.03em' }}>
            One tool. Growing with every sprint.
          </h2>
          <p className="max-w-xl text-base leading-relaxed text-[#475467]">
            AppVelocity is designed to expand by adding more capabilities to the single orchestrator,
            not by adding more separate products. Each new capability becomes a new set of tools the
            same orchestrator can call.
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
                        <div className={`absolute left-0 right-0 top-0 h-[2px]`} style={{ background: c.accent }} />
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

      {/* ── AGENTS GRID ── */}
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

      {/* ── FOOTER ── */}
      <footer className="py-10" style={{ background: '#040d18' }}>
        <div className="mx-auto max-w-[1160px] px-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2.5" style={{ color: 'rgba(255,255,255,.7)' }}>
              <AppVelocityLogo size={18} />
              <span className="text-[15px] font-extrabold">AppVelocity</span>
            </div>
            <div className="flex gap-6">
              {['#how','#capabilities','#technology','#roadmap'].map((href,i)=>(
                <a key={href} href={href} className="text-[13px] text-white/30 transition-colors hover:text-white/70">
                  {['How It Works','Capabilities','Technology','Roadmap'][i]}
                </a>
              ))}
            </div>
          </div>
          <div className="mt-7 border-t pt-5 text-center text-[12px]" style={{ borderColor: 'rgba(255,255,255,.07)', color: 'rgba(255,255,255,.25)' }}>
            © 2026 AppVelocity · AI Accelerator for Mobile SDLC · Phase 1 — Design→Code is Live
          </div>
        </div>
      </footer>
    </div>
  );
}

const TOOL_DATA = [
  { icon:'📥', name:'Fetch Figma', key:'fetch_figma', desc:'Retrieves the complete Figma document tree and design variable definitions via the Figma REST API. Always the first tool called.', stripe:'from-blue-400 to-cyan-400', icBg:'#eff8ff', icBorder:'#b2ddff', icColor:'#2e90fa' },
  { icon:'👁️', name:'Vision Analysis', key:'analyze_design', desc:'Exports screens as PNG images and runs a Worker LLM vision pass to detect spacing systems, icon families, image assets, and font usage. Non-fatal.', stripe:'from-violet-500 to-blue-400', icBg:'#f9f5ff', icBorder:'#d9d6fe', icColor:'#7f56d9' },
  { icon:'🔀', name:'Build IR', key:'build_ir', desc:'Transforms raw Figma JSON into a platform-neutral Design IR covering all screens, components, flex rules, design tokens, and accessibility metadata.', stripe:'from-amber-400 to-brand-500', icBg:'#fffaeb', icBorder:'#fef0c7', icColor:'#f79009' },
  { icon:'🧭', name:'Plan Generation', key:'plan_generation', desc:'Analyses the IR and produces a structured execution plan: project name, entry screen, screen list, navigation graph, and component dependency order.', stripe:'from-violet-500 to-rose-400', icBg:'#f9f5ff', icBorder:'#d9d6fe', icColor:'#7f56d9' },
  { icon:'⚙️', name:'Generate All', key:'generate_all_components', desc:'Runs parallel code generation across all screens and components in the execution plan. Auto-runs Gate 1 and Gate 3 checks after generation.', stripe:'from-brand-500 to-amber-400', icBg:'#fff4f1', icBorder:'#fecdb8', icColor:'#f15b40' },
  { icon:'🔧', name:'Generate One', key:'generate_component', desc:'Generates or regenerates a single named screen or component. Used by the orchestrator when one file needs to be rebuilt without rerunning everything.', stripe:'from-brand-500 to-orange-400', icBg:'#fff4f1', icBorder:'#fecdb8', icColor:'#f15b40' },
  { icon:'✅', name:'Validate File', key:'validate_file', desc:'Gate 1: runs Babel AST parsing and structural checks on a specific generated file. Returns pass/fail with line-level error attribution.', stripe:'from-green-400 to-cyan-400', icBg:'#ecfdf3', icBorder:'#a6f4c5', icColor:'#12b76a' },
  { icon:'🩹', name:'Repair File', key:'repair_file', desc:'Gate 5: sends a failing file alongside its specific errors to a Worker LLM for a targeted, contextual fix rather than generic reformatting. Always saves the best version.', stripe:'from-amber-400 to-rose-400', icBg:'#fffaeb', icBorder:'#fef0c7', icColor:'#f79009' },
  { icon:'🔍', name:'Workspace Check', key:'run_workspace_check', desc:'Gate 3: writes all generated files to a temp workspace and runs tsc --noResolve or dart analyze. Returns errors grouped by file for targeted repair.', stripe:'from-cyan-400 to-blue-400', icBg:'#f0f9ff', icBorder:'#b9e6fe', icColor:'#0ba5ec' },
  { icon:'🏗️', name:'Assemble Project', key:'assemble_project', desc:'Generates the full project scaffold (entry point, router, state management setup, package.json / pubspec.yaml) and merges it with all generated screens.', stripe:'from-indigo-400 to-violet-500', icBg:'#eef0ff', icBorder:'#c7d2fe', icColor:'#082340' },
  { icon:'🏁', name:'Compile Check', key:'run_compilation_check', desc:'Runs the full compiler (npx tsc --noEmit or flutter analyze) on the assembled project in a temp directory. Automatically applies one LLM fix pass on failure.', stripe:'from-green-400 to-blue-400', icBg:'#ecfdf3', icBorder:'#a6f4c5', icColor:'#12b76a' },
  { icon:'📦', name:'Create ZIP', key:'create_zip', desc:'Packages the complete project into a downloadable ZIP archive and signals the orchestrator to stop. Called after compilation passes or after the max-retry limit.', stripe:'from-brand-500 to-green-400', icBg:'#fff4f1', icBorder:'#fecdb8', icColor:'#f15b40' },
];

const ROADMAP = [
  {
    phase: 'Phase 1', period: 'Live Now', live: true, next: false,
    cards: [
      { icon:'🎨', name:'Design → Code', desc:'Full Figma-to-mobile-project pipeline. React Native and Flutter. 12-tool ReAct orchestrator. Self-healing output with 5 quality gates.', live: true, accent:'#12b76a' },
    ],
  },
  {
    phase: 'Phase 2', period: 'Next Up', live: false, next: true,
    cards: [
      { icon:'♿', name:'Accessibility Intelligence', desc:'WCAG AA/AAA validation on every generated screen. Color contrast, screen reader labels, focus order, checked and flagged before delivery.', live: false, accent:'#12b76a' },
      { icon:'🛡️', name:'Security Shield', desc:'OWASP Mobile Top 10 scanning integrated into the generation loop. Hardcoded secrets, insecure storage, and injection patterns caught automatically.', live: false, accent:'#f63d68' },
    ],
  },
  {
    phase: 'Phase 3', period: 'Q3 2026', live: false, next: false,
    cards: [
      { icon:'⚡', name:'Performance Optimizer', desc:'60fps tuning, bundle tree-shaking, list virtualisation, and image lazy loading applied automatically to generated code. Re-render hotspots identified and memoized.', live: false, accent:'#f79009' },
      { icon:'🧪', name:'Test Intelligence', desc:'Jest unit tests, Detox E2E scenarios, and visual regression baselines generated in the same run as the screens they cover. Coverage grows with the codebase, automatically.', live: false, accent:'#7f56d9' },
    ],
  },
  {
    phase: 'Phase 4', period: 'Q4 2026', live: false, next: false,
    cards: [
      { icon:'🚀', name:'DevOps Accelerator', desc:'GitHub Actions and Bitrise CI/CD pipelines, Fastlane lanes for App Store and Play Store, and Swagger/OpenAPI docs, all generated alongside the project code.', live: false, accent:'#0ba5ec' },
      { icon:'📋', name:'Compliance Guard', desc:'GDPR consent flows, HIPAA PHI handling patterns, and PCI DSS secure payment integrations scaffolded into the project from the first line of code, not bolted on at the end.', live: false, accent:'#f63d68' },
      { icon:'📱', name:'Native Platform Targets', desc:'Native Android (Kotlin/Compose) and iOS (Swift/SwiftUI) added as new code-generation plugins. The platform-neutral Design IR makes adding targets a self-contained change.', live: false, accent:'#0f3d6e' },
    ],
  },
];
