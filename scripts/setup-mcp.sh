#!/bin/bash
set -euo pipefail

echo "=== MCP Server Setup ==="
echo "Setting up recommended MCP servers for LM Orchestrator"
echo ""

# Check prerequisites
if ! command -v claude &> /dev/null; then
    echo "Error: Claude Code CLI not found. Install it first."
    exit 1
fi

if ! command -v npx &> /dev/null; then
    echo "Error: npx not found. Install Node.js 18+ first."
    exit 1
fi

echo "[1/4] Context7 - Library documentation..."
claude mcp add --scope user context7 -- npx -y @upstash/context7-mcp@latest 2>/dev/null && echo "  -> Installed" || echo "  -> Already configured or error"

echo "[2/4] Sentry - Error monitoring..."
claude mcp add --scope user --transport http sentry https://mcp.sentry.dev/mcp 2>/dev/null && echo "  -> Installed" || echo "  -> Already configured or error"

echo "[3/4] Memory - Persistent knowledge graph..."
mkdir -p ~/.claude/memory
claude mcp add --scope user memory -- npx -y @modelcontextprotocol/server-memory --memory-path ~/.claude/memory 2>/dev/null && echo "  -> Installed" || echo "  -> Already configured or error"

echo "[4/4] Playwright - Browser automation & E2E testing..."
claude mcp add --scope user playwright -- npx -y @playwright/mcp@latest 2>/dev/null && echo "  -> Installed" || echo "  -> Already configured or error"

echo ""
echo "=== Global MCP Setup Complete (4 servers) ==="
echo ""
echo "Optional: Project-specific PostgreSQL MCP"
echo "  claude mcp add postgres -- npx -y @modelcontextprotocol/server-postgres 'postgresql://user:pass@host:5432/db'"
echo ""
echo "Verify with: claude mcp list"
