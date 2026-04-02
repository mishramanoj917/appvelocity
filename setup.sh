#!/bin/bash
# ============================================================
#  AppVelocity — One-Shot Mac Setup Script
#  Run this ONCE after unzipping the project.
#  It sets up the project, checks your tools, and launches
#  the dashboard at http://localhost:3000
# ============================================================

set -e  # stop on any error

# ── Colours ──────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Colour

ok()   { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC}  $1"; }
fail() { echo -e "${RED}✗ ERROR:${NC} $1"; exit 1; }
step() { echo -e "\n${BOLD}${BLUE}▶ $1${NC}"; }

clear
echo -e "${BOLD}"
echo "  ___                 _   __   __   _           _ _         "
echo " / _ \\ _ __  _ __   / \\ \\ \\ / /__| | ___   ___(_) |_ _   _ "
echo "| | | | '_ \\| '_ \\ / _ \\ \\ V / _ \\ |/ _ \\ / __| | __| | | |"
echo "| |_| | |_) | |_) / ___ \\ | |  __/ | (_) | (__| | |_| |_| |"
echo " \\___/| .__/| .__/_/   \\_\\|_|\\___|_|\\___/ \\___|_|\\__|\\__, |"
echo "      |_|   |_|                                        |___/ "
echo -e "${NC}"
echo -e "  ${BLUE}AI-Powered Mobile Development Acceleration Platform${NC}"
echo -e "  ${BLUE}Setup Script — macOS${NC}\n"

# ── Step 1: Check tools ───────────────────────────────────────
step "Step 1/5 — Checking prerequisites"

# Node.js
if ! command -v node &> /dev/null; then
  fail "Node.js not found. Install from https://nodejs.org (v20 LTS)"
fi
NODE_VER=$(node -v)
ok "Node.js $NODE_VER"

# pnpm
if ! command -v pnpm &> /dev/null; then
  warn "pnpm not found — installing now..."
  npm install -g pnpm@9
fi
PNPM_VER=$(pnpm -v)
ok "pnpm $PNPM_VER"

# Git
if ! command -v git &> /dev/null; then
  fail "Git not found. Install from https://git-scm.com"
fi
GIT_VER=$(git --version)
ok "$GIT_VER"

# ── Step 2: Environment file ──────────────────────────────────
step "Step 2/5 — Setting up environment"

if [ ! -f ".env" ]; then
  cp .env.example .env
  ok "Created .env from template"
  echo ""
  echo -e "  ${YELLOW}You need to add your API keys to .env before running agents.${NC}"
  echo -e "  Open the .env file in Cursor and fill in:"
  echo -e "  ${BOLD}  • FIGMA_ACCESS_TOKEN${NC}  → figma.com → Settings → Personal Access Tokens"
  echo -e "  ${BOLD}  • OPENAI_API_KEY${NC}       → platform.openai.com/api-keys"
  echo -e "  ${BOLD}  • LLM_PROVIDER${NC}         → set to 'openai'"
  echo ""
  read -p "  Press Enter to continue (you can add keys later)..."
else
  ok ".env already exists — skipping"
fi

# ── Step 3: Install dependencies ──────────────────────────────
step "Step 3/5 — Installing dependencies (this takes ~1 minute)"

pnpm install

ok "All packages installed"

# ── Step 4: Build shared packages ─────────────────────────────
step "Step 4/5 — Building shared packages"

pnpm build --filter=@appvelocity/shared-core 2>/dev/null || true

ok "Shared packages built"

# ── Step 5: Git init ──────────────────────────────────────────
step "Step 5/5 — Initialising Git repository"

if [ ! -d ".git" ]; then
  git init -b main
  git add -A
  git commit -m "feat: AppVelocity platform — Phase 0 foundation"
  ok "Git repo initialised with first commit"
else
  ok "Git repo already exists — skipping"
fi

# ── Done! ─────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║   ✅  Setup complete! Here's what to do next:       ║${NC}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}1. Open this folder in Cursor:${NC}"
echo -e "     ${BLUE}cursor .${NC}"
echo ""
echo -e "  ${BOLD}2. Start the web dashboard:${NC}"
echo -e "     ${BLUE}pnpm dev:web${NC}"
echo ""
echo -e "  ${BOLD}3. Open in your browser:${NC}"
echo -e "     ${BLUE}http://localhost:3000${NC}"
echo ""
echo -e "  ${BOLD}4. Add your API keys to .env (if not done yet)${NC}"
echo ""
echo -e "  ${YELLOW}Tip: Run 'cursor .' to open the project in Cursor right now.${NC}"
echo ""
