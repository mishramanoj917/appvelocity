#!/usr/bin/env bash
set -euo pipefail

echo "=== AppVelocity Docker setup ==="

if ! command -v docker &>/dev/null; then
  echo "ERROR: Docker not found."
  exit 1
fi

# Build all images
echo "Building Docker images..."
docker compose build web redis
docker compose --profile compilers build flutter-compiler rn-compiler visual-qa

# Start Redis
echo "Starting Redis..."
docker compose up -d redis
sleep 3
docker compose exec redis redis-cli ping | grep -q PONG && echo "✓ Redis healthy"

# Verify Flutter
echo "Verifying Flutter container..."
docker compose --profile compilers run --rm flutter-compiler flutter --version | head -1

# Verify React Native
echo "Verifying React Native container..."
docker compose --profile compilers run --rm rn-compiler npx react-native --version

# Verify Visual QA service
echo "Starting Visual QA service..."
docker compose --profile compilers up -d visual-qa
sleep 2
curl -sf http://localhost:5001/health | python3 -c "import sys,json; d=json.load(sys.stdin); print('✓ Visual QA health:', d)" || echo "⚠  Visual QA not responding"

mkdir -p workspace
echo "✓ workspace/ directory ready"

echo ""
echo "=== Docker setup complete ==="
echo "  Start all services: docker compose --profile compilers up -d"
echo "  Start web only:     docker compose up -d"
