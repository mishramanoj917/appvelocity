import { useState } from "react";

const COLORS = {
  mac: "#6366f1",
  win: "#0ea5e9",
  linux: "#22c55e",
};

const steps = {
  mac: [
    {
      id: 1,
      title: "Install Prerequisites",
      time: "~5 min",
      substeps: [
        {
          label: "Install Homebrew (macOS package manager)",
          code: `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`,
          note: "Paste this in Terminal. If you already have it, skip.",
          verify: null,
        },
        {
          label: "Install Node.js 20",
          code: `brew install node@20\necho 'export PATH="/opt/homebrew/opt/node@20/bin:$PATH"' >> ~/.zshrc\nsource ~/.zshrc`,
          note: "Node runs all the JavaScript/TypeScript code.",
          verify: "node --version",
          verifyExpect: "v20.x.x",
        },
        {
          label: "Install pnpm (fast package manager)",
          code: `npm install -g pnpm@9`,
          note: "pnpm is faster than npm and required for this monorepo.",
          verify: "pnpm --version",
          verifyExpect: "9.x.x",
        },
        {
          label: "Install Git",
          code: `brew install git`,
          note: "Probably already installed. Run the verify command to check.",
          verify: "git --version",
          verifyExpect: "git version 2.x.x",
        },
      ],
    },
    {
      id: 2,
      title: "Download the Project Files",
      time: "~2 min",
      substeps: [
        {
          label: "Choose a folder and create the project",
          code: `# Go to wherever you keep your projects\ncd ~/Documents\n\n# Create the AppVelocity folder\nmkdir appvelocity\ncd appvelocity`,
          note: "You can use any folder. ~/Documents/appvelocity is a good default.",
          verify: "pwd",
          verifyExpect: "/Users/yourname/Documents/appvelocity",
        },
        {
          label: "Copy all downloaded files into this folder",
          note: "Take the files you downloaded from this chat (appvelocity-setup folder) and copy everything inside it into ~/Documents/appvelocity/",
          code: null,
          isManual: true,
          manualSteps: [
            "Open Finder",
            "Navigate to your Downloads folder",
            "Find the 'appvelocity-setup' folder",
            "Select ALL files inside it (Cmd+A)",
            "Copy them (Cmd+C)",
            "Navigate to ~/Documents/appvelocity/",
            "Paste (Cmd+V)",
          ],
        },
        {
          label: "Verify the files are in place",
          code: `ls`,
          note: "You should see: package.json, pnpm-workspace.yaml, turbo.json, packages/, docs/, .cursor/, .vscode/",
          verify: null,
        },
      ],
    },
    {
      id: 3,
      title: "Open in Cursor",
      time: "~1 min",
      substeps: [
        {
          label: "Open Cursor IDE",
          note: "Launch Cursor from your Applications folder or Dock.",
          code: null,
          isManual: true,
          manualSteps: [
            "Open Cursor",
            "Click 'Open Folder' (or File → Open Folder)",
            "Navigate to ~/Documents/appvelocity",
            "Click 'Open'",
            "When asked 'Do you trust the authors?' → click Yes",
          ],
        },
        {
          label: "Open the built-in Terminal in Cursor",
          code: null,
          note: "This is important — all commands must run INSIDE Cursor's terminal, in the appvelocity folder.",
          isManual: true,
          manualSteps: [
            "In Cursor, press Ctrl+` (backtick) — the key above Tab",
            "OR go to View → Terminal",
            "A terminal panel opens at the bottom",
            "It should show: yourname@Mac appvelocity %",
          ],
        },
      ],
    },
    {
      id: 4,
      title: "Install Extensions",
      time: "~2 min",
      substeps: [
        {
          label: "Install recommended extensions",
          note: "Cursor will show a popup 'Do you want to install recommended extensions?' — click Yes. If you missed it:",
          code: null,
          isManual: true,
          manualSteps: [
            "Press Cmd+Shift+P to open the command palette",
            "Type: Extensions: Show Recommended",
            "Press Enter",
            "Click 'Install All' in the extensions panel",
            "Wait for all to install (~1 minute)",
          ],
        },
        {
          label: "Verify Cursor AI rules are loaded",
          note: "Cursor automatically reads the .cursor/rules file. To confirm:",
          code: null,
          isManual: true,
          manualSteps: [
            "Press Cmd+Shift+P",
            "Type: Cursor Rules",
            "You should see the AppVelocity rules listed",
            "This means Cursor AI now understands your entire codebase",
          ],
        },
      ],
    },
    {
      id: 5,
      title: "Set Up Environment Variables",
      time: "~3 min",
      substeps: [
        {
          label: "Create your .env file",
          code: `cp .env.example .env`,
          note: "This creates your local config file from the template.",
          verify: "ls -la | grep .env",
          verifyExpect: ".env and .env.example both appear",
        },
        {
          label: "Open .env and add your keys",
          note: "In Cursor's file explorer (left panel), click .env to open it. Fill in:",
          code: null,
          isManual: true,
          manualSteps: [
            "FIGMA_ACCESS_TOKEN → get from figma.com/settings → Personal Access Tokens",
            "OPENAI_API_KEY → get from platform.openai.com/api-keys",
            "  OR ANTHROPIC_API_KEY → from console.anthropic.com",
            "LLM_PROVIDER → type 'openai' or 'anthropic' (match your key)",
            "Save the file (Cmd+S)",
          ],
        },
        {
          label: "Get your Figma token (if you don't have one)",
          code: null,
          isManual: true,
          manualSteps: [
            "Go to figma.com and log in",
            "Click your avatar (top right) → Settings",
            "Scroll down to 'Personal access tokens'",
            "Click 'Generate new token'",
            "Give it a name like 'AppVelocity'",
            "Copy the token — paste it into .env as FIGMA_ACCESS_TOKEN",
          ],
        },
      ],
    },
    {
      id: 6,
      title: "Install & Build",
      time: "~3 min",
      substeps: [
        {
          label: "Install all packages",
          code: `pnpm install`,
          note: "This downloads all dependencies for the entire monorepo. Takes 1-2 minutes first time.",
          verify: null,
          waitFor: "All packages installed. Done.",
        },
        {
          label: "Build the shared core package",
          code: `pnpm build --filter=@appvelocity/shared-core`,
          note: "Shared packages must be compiled before the web app can use them.",
          verify: null,
          waitFor: "Tasks: 1 successful",
        },
      ],
    },
    {
      id: 7,
      title: "Launch the Web Dashboard",
      time: "~30 sec",
      substeps: [
        {
          label: "Start the Next.js dev server",
          code: `pnpm dev:web`,
          note: "This starts the AppVelocity web dashboard.",
          verify: null,
          waitFor: "✓ Ready on http://localhost:3000",
        },
        {
          label: "Open the dashboard in your browser",
          code: null,
          isManual: true,
          manualSteps: [
            "Open any browser (Chrome, Safari, Firefox)",
            "Go to: http://localhost:3000",
            "You should see the AppVelocity dashboard with 7 agent cards",
            "🎉 Setup complete!",
          ],
        },
      ],
    },
  ],
  win: [
    {
      id: 1,
      title: "Install Prerequisites",
      time: "~10 min",
      substeps: [
        {
          label: "Install Node.js 20",
          code: null,
          isManual: true,
          note: "Download and run the installer.",
          manualSteps: [
            "Go to: https://nodejs.org/en/download",
            "Click 'Windows Installer (.msi)' for v20 LTS",
            "Run the installer, keep all defaults",
            "Check 'Automatically install necessary tools' if shown",
            "Finish the installer, then restart your PC",
          ],
          verify: "node --version",
          verifyExpect: "v20.x.x",
        },
        {
          label: "Install pnpm",
          code: `npm install -g pnpm@9`,
          note: "Run this in PowerShell or Command Prompt AFTER Node is installed.",
          verify: "pnpm --version",
          verifyExpect: "9.x.x",
        },
        {
          label: "Install Git for Windows",
          code: null,
          isManual: true,
          note: "Git is required for version control.",
          manualSteps: [
            "Go to: https://git-scm.com/download/win",
            "Download and run the installer",
            "Keep all defaults and click Next through",
            "Finish the installer",
          ],
          verify: "git --version",
          verifyExpect: "git version 2.x.x",
        },
      ],
    },
    {
      id: 2,
      title: "Download & Place Project Files",
      time: "~2 min",
      substeps: [
        {
          label: "Create the project folder",
          code: `# Open PowerShell and run:\nmkdir C:\\Projects\\appvelocity\ncd C:\\Projects\\appvelocity`,
          note: "You can use any path. C:\\Projects\\appvelocity is recommended.",
          verify: "pwd",
          verifyExpect: "C:\\Projects\\appvelocity",
        },
        {
          label: "Copy the downloaded files into the folder",
          isManual: true,
          code: null,
          note: "Move the downloaded files into C:\\Projects\\appvelocity\\",
          manualSteps: [
            "Open File Explorer",
            "Navigate to your Downloads folder",
            "Find and open the 'appvelocity-setup' folder",
            "Select ALL files (Ctrl+A)",
            "Copy (Ctrl+C)",
            "Navigate to C:\\Projects\\appvelocity",
            "Paste (Ctrl+V)",
          ],
        },
      ],
    },
    {
      id: 3,
      title: "Open in Cursor",
      time: "~1 min",
      substeps: [
        {
          label: "Open the folder in Cursor",
          isManual: true,
          code: null,
          note: "Launch Cursor and open your project folder.",
          manualSteps: [
            "Open Cursor from the Start Menu",
            "Click File → Open Folder",
            "Navigate to C:\\Projects\\appvelocity",
            "Click 'Select Folder'",
            "When prompted 'Trust authors?' → click Yes",
          ],
        },
        {
          label: "Open the Terminal inside Cursor",
          isManual: true,
          code: null,
          note: "Use Cursor's built-in terminal for all commands.",
          manualSteps: [
            "Press Ctrl+` (backtick — key above Tab)",
            "OR go to View → Terminal",
            "The terminal opens at the bottom",
            "It should show: PS C:\\Projects\\appvelocity>",
          ],
        },
      ],
    },
    {
      id: 4,
      title: "Install Extensions",
      time: "~2 min",
      substeps: [
        {
          label: "Install recommended extensions",
          isManual: true,
          code: null,
          note: "Install all the tools that make development easier.",
          manualSteps: [
            "Press Ctrl+Shift+P",
            "Type: Extensions: Show Recommended",
            "Press Enter",
            "Click 'Install All'",
            "Wait for all extensions to install",
          ],
        },
      ],
    },
    {
      id: 5,
      title: "Environment Variables",
      time: "~3 min",
      substeps: [
        {
          label: "Create your .env file",
          code: `copy .env.example .env`,
          note: "Creates your local config file.",
          verify: "dir .env",
          verifyExpect: ".env appears in the list",
        },
        {
          label: "Edit .env with your API keys",
          isManual: true,
          code: null,
          note: "Open .env in Cursor and fill in your keys.",
          manualSteps: [
            "In the left file panel, click .env",
            "Fill in FIGMA_ACCESS_TOKEN (from figma.com/settings)",
            "Fill in OPENAI_API_KEY (from platform.openai.com)",
            "  OR ANTHROPIC_API_KEY (from console.anthropic.com)",
            "Set LLM_PROVIDER=openai or anthropic",
            "Save: Ctrl+S",
          ],
        },
      ],
    },
    {
      id: 6,
      title: "Install & Build",
      time: "~3 min",
      substeps: [
        {
          label: "Install all packages",
          code: `pnpm install`,
          note: "Downloads all dependencies. Takes 1-2 minutes.",
          waitFor: "Done",
        },
        {
          label: "Build shared packages",
          code: `pnpm build --filter=@appvelocity/shared-core`,
          note: "Compiles the shared core package.",
          waitFor: "Tasks: 1 successful",
        },
      ],
    },
    {
      id: 7,
      title: "Launch the Dashboard",
      time: "~30 sec",
      substeps: [
        {
          label: "Start the dev server",
          code: `pnpm dev:web`,
          note: "Starts the AppVelocity web dashboard.",
          waitFor: "✓ Ready on http://localhost:3000",
        },
        {
          label: "Open in browser",
          isManual: true,
          code: null,
          note: "Open the dashboard.",
          manualSteps: [
            "Open Chrome or Edge",
            "Go to: http://localhost:3000",
            "You should see AppVelocity with 7 agent cards",
            "🎉 Setup complete!",
          ],
        },
      ],
    },
  ],
};
steps.linux = steps.mac.map(s => ({
  ...s,
  substeps: s.substeps.map(ss => ({
    ...ss,
    code: ss.code
      ? ss.code.replace(/brew install node@20\necho.*\nsource.*/, "sudo apt-get install -y nodejs npm")
              .replace("brew install git", "sudo apt-get install -y git")
              .replace("~/Documents", "~/projects")
      : ss.code,
    manualSteps: ss.manualSteps
      ? ss.manualSteps.map(m =>
          m.replace("Finder", "File Manager")
           .replace("Cmd+", "Ctrl+")
           .replace("~/Documents/appvelocity", "~/projects/appvelocity")
        )
      : ss.manualSteps,
  })),
}));

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  if (!text) return null;
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className={`absolute top-2 right-2 text-xs px-2 py-1 rounded transition-all ${
        copied ? "bg-green-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
      }`}
    >
      {copied ? "✓ Copied" : "Copy"}
    </button>
  );
}

export default function SetupGuide() {
  const [os, setOs] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSubsteps, setCompletedSubsteps] = useState({});

  const osSteps = os ? steps[os] : [];
  const step = osSteps[currentStep];
  const totalSubsteps = osSteps.reduce((a, s) => a + s.substeps.length, 0);
  const completedCount = Object.values(completedSubsteps).filter(Boolean).length;
  const progress = totalSubsteps ? Math.round((completedCount / totalSubsteps) * 100) : 0;

  const allSubstepsDone = step
    ? step.substeps.every((_, i) => completedSubsteps[`${currentStep}-${i}`])
    : false;

  function toggleSubstep(stepIdx, subIdx) {
    const key = `${stepIdx}-${subIdx}`;
    setCompletedSubsteps(prev => ({ ...prev, [key]: !prev[key] }));
  }

  if (!os) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="max-w-lg w-full">
          <div className="text-center mb-10">
            <div className="text-5xl mb-4">🚀</div>
            <h1 className="text-3xl font-bold text-white mb-2">AppVelocity Setup</h1>
            <p className="text-gray-400">Step-by-step guide for Cursor IDE</p>
          </div>
          <p className="text-center text-sm text-gray-500 mb-6">What OS are you on?</p>
          <div className="grid gap-4">
            {[
              { id: "mac", label: "macOS", icon: "", desc: "MacBook, iMac, Mac Mini" },
              { id: "win", label: "Windows", icon: "🪟", desc: "Windows 10 or 11" },
              { id: "linux", label: "Linux", icon: "🐧", desc: "Ubuntu, Debian, etc." },
            ].map(o => (
              <button
                key={o.id}
                onClick={() => setOs(o.id)}
                className="flex items-center gap-4 p-5 rounded-xl border border-gray-800 bg-gray-900 hover:border-indigo-600 hover:bg-gray-800 transition-all text-left group"
              >
                <span className="text-3xl">{o.icon}</span>
                <div>
                  <div className="font-semibold text-white group-hover:text-indigo-300">{o.label}</div>
                  <div className="text-xs text-gray-500">{o.desc}</div>
                </div>
                <span className="ml-auto text-gray-600 group-hover:text-indigo-400">→</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => { setOs(null); setCurrentStep(0); setCompletedSubsteps({}); }} className="text-gray-500 hover:text-gray-300 text-sm">← Back</button>
            <span className="text-white font-semibold">AppVelocity Setup</span>
            <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded">{os === "mac" ? "macOS" : os === "win" ? "Windows" : "Linux"}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-gray-500">{progress}% complete</div>
            <div className="w-32 h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 flex gap-6">
        {/* Sidebar steps */}
        <div className="w-48 shrink-0">
          <div className="space-y-1 sticky top-6">
            {osSteps.map((s, i) => {
              const done = s.substeps.every((_, si) => completedSubsteps[`${i}-${si}`]);
              const active = i === currentStep;
              return (
                <button
                  key={s.id}
                  onClick={() => setCurrentStep(i)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all flex items-center gap-2.5 ${
                    active ? "bg-indigo-950 border border-indigo-800 text-indigo-300" :
                    done ? "text-green-400 hover:bg-gray-900" :
                    "text-gray-500 hover:bg-gray-900 hover:text-gray-300"
                  }`}
                >
                  <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: active ? "#312e81" : done ? "#14532d" : "#1f2937",
                             color: active ? "#a5b4fc" : done ? "#4ade80" : "#6b7280" }}>
                    {done ? "✓" : s.id}
                  </span>
                  <span className="leading-tight">{s.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {step && (
            <div>
              {/* Step header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="text-xs text-indigo-400 font-semibold uppercase tracking-wider mb-1">
                    Step {step.id} of {osSteps.length}
                  </div>
                  <h2 className="text-xl font-bold text-white">{step.title}</h2>
                </div>
                <span className="text-xs bg-gray-800 text-gray-400 px-3 py-1 rounded-full">⏱ {step.time}</span>
              </div>

              {/* Substeps */}
              <div className="space-y-4">
                {step.substeps.map((sub, si) => {
                  const key = `${currentStep}-${si}`;
                  const done = completedSubsteps[key];
                  return (
                    <div key={si} className={`rounded-xl border transition-all ${done ? "border-green-900 bg-green-950/20" : "border-gray-800 bg-gray-900"}`}>
                      {/* Substep header */}
                      <div className="flex items-start gap-3 p-4">
                        <button
                          onClick={() => toggleSubstep(currentStep, si)}
                          className={`shrink-0 mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                            done ? "bg-green-500 border-green-500" : "border-gray-600 hover:border-indigo-500"
                          }`}
                        >
                          {done && <span className="text-white text-xs">✓</span>}
                        </button>
                        <div className="flex-1">
                          <div className={`font-medium ${done ? "text-green-400 line-through decoration-green-800" : "text-white"}`}>
                            {sub.label}
                          </div>
                          {sub.note && <p className="text-sm text-gray-400 mt-1">{sub.note}</p>}
                        </div>
                      </div>

                      {/* Code block */}
                      {sub.code && (
                        <div className="mx-4 mb-4 relative">
                          <pre className="bg-gray-950 border border-gray-800 rounded-lg p-4 text-sm font-mono text-green-300 overflow-x-auto pr-16 leading-relaxed">
                            {sub.code}
                          </pre>
                          <CopyButton text={sub.code} />
                          {sub.verify && (
                            <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                              <span className="text-yellow-500">▶</span>
                              Verify with: <code className="bg-gray-800 px-1.5 py-0.5 rounded text-yellow-300">{sub.verify}</code>
                              <span>→ expect: <code className="text-gray-300">{sub.verifyExpect}</code></span>
                            </div>
                          )}
                          {sub.waitFor && (
                            <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                              <span className="animate-pulse text-indigo-400">⏳</span>
                              Wait for: <span className="text-indigo-300 font-mono">{sub.waitFor}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Manual steps */}
                      {sub.isManual && sub.manualSteps && (
                        <div className="mx-4 mb-4">
                          <ol className="space-y-2">
                            {sub.manualSteps.map((m, mi) => (
                              <li key={mi} className="flex items-start gap-3 text-sm">
                                <span className="shrink-0 w-5 h-5 rounded-full bg-gray-800 flex items-center justify-center text-xs text-gray-400 font-mono mt-0.5">
                                  {mi + 1}
                                </span>
                                <span className={m.startsWith("🎉") ? "text-green-400 font-semibold" : "text-gray-300"}>
                                  {m}
                                </span>
                              </li>
                            ))}
                          </ol>
                          {sub.verify && (
                            <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                              <span className="text-yellow-500">▶</span>
                              Verify with: <code className="bg-gray-800 px-1.5 py-0.5 rounded text-yellow-300">{sub.verify}</code>
                              <span>→ expect: <code className="text-gray-300">{sub.verifyExpect}</code></span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between mt-8">
                <button
                  onClick={() => setCurrentStep(s => Math.max(0, s - 1))}
                  disabled={currentStep === 0}
                  className="px-4 py-2 text-sm rounded-lg border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  ← Previous
                </button>

                <div className="text-xs text-gray-600">
                  {step.substeps.filter((_, si) => completedSubsteps[`${currentStep}-${si}`]).length} / {step.substeps.length} done
                </div>

                {currentStep < osSteps.length - 1 ? (
                  <button
                    onClick={() => setCurrentStep(s => s + 1)}
                    className={`px-5 py-2 text-sm rounded-lg font-semibold transition-all ${
                      allSubstepsDone
                        ? "bg-indigo-600 hover:bg-indigo-500 text-white"
                        : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                    }`}
                  >
                    Next Step →
                  </button>
                ) : (
                  <div className="px-5 py-2 text-sm rounded-lg bg-green-700 text-white font-semibold">
                    🎉 All Done!
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
