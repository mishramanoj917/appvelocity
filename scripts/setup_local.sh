#!/usr/bin/env bash
set -euo pipefail

echo "=== AppVelocity local setup ==="

# Node version
NODE_VER=$(node -e "process.exit(parseInt(process.version.slice(1)) >= 18 ? 0 : 1)" 2>/dev/null \
  && echo "ok" || echo "fail")
if [[ "$NODE_VER" == "fail" ]]; then
  echo "ERROR: Node.js >= 18 required. Install from https://nodejs.org/"
  exit 1
fi
echo "✓ Node $(node -v)"

# pnpm
if ! command -v pnpm &>/dev/null; then
  echo "ERROR: pnpm not found. Install: npm install -g pnpm"
  exit 1
fi
PNPM_VER=$(pnpm -v | cut -d. -f1)
if [[ "$PNPM_VER" -lt 9 ]]; then
  echo "ERROR: pnpm >= 9 required."
  exit 1
fi
echo "✓ pnpm $(pnpm -v)"

# Flutter (optional)
if command -v flutter &>/dev/null; then
  echo "✓ Flutter $(flutter --version --machine 2>/dev/null | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("frameworkVersion",""))' 2>/dev/null || echo 'detected')"
else
  echo "⚠  Flutter not found — Flutter Gate 3 compile will be skipped (install from https://flutter.dev)"
fi

# React Native CLI (optional)
if command -v npx &>/dev/null && npx react-native --version &>/dev/null 2>&1; then
  echo "✓ React Native CLI available"
else
  echo "⚠  React Native CLI not found — RN Gate 3 compile will use tsc only"
fi

# Workspace directory
mkdir -p workspace
echo "✓ workspace/ directory ready"

# .env setup
if [[ ! -f .env ]]; then
  cp .env.example .env 2>/dev/null || cat > .env << 'EOF'
FIGMA_ACCESS_TOKEN=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
LLM_PROVIDER=openai
REDIS_ENABLED=false
WORKSPACE_DIR=./workspace
EOF
  echo "✓ .env created — fill in FIGMA_ACCESS_TOKEN and OPENAI_API_KEY"
else
  echo "✓ .env already exists"
fi

# Install dependencies
echo "Installing dependencies..."
pnpm install

echo ""
echo "=== Setup complete. Run: pnpm dev ==="
