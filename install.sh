#!/bin/bash
set -euo pipefail

# Agent Orchestrator Installer
# Usage:
#   curl -sL https://raw.githubusercontent.com/luna-matching/agent-orchestrator/main/install.sh | bash
#   curl -sL https://raw.githubusercontent.com/luna-matching/agent-orchestrator/main/install.sh | bash -s -- nexus rally builder radar
#   ./install.sh                    # Install all agents
#   ./install.sh nexus rally builder # Install specific agents

REPO="luna-matching/agent-orchestrator"
BRANCH="main"

# All 68 agents (65 simota + 3 Luna originals: ceo, analyst, auditor)
ALL_AGENTS="analyst anvil architect arena artisan atlas auditor bard bolt bridge builder canon canvas ceo cipher compete director echo experiment flow forge gateway gear grove growth guardian harvest hone horizon judge launch lens magi morph muse navigator nexus palette polyglot probe pulse quill radar rally reel researcher retain rewind ripple scaffold schema scout scribe sentinel sherpa showcase spark specter stream sweep trace triage tuner vision voice voyager warden zen"

# Default: install all if no args
AGENTS="${@:-$ALL_AGENTS}"

echo "=== Agent Orchestrator Installer ==="
echo "Source: github.com/${REPO}"
echo ""

# Create directories
mkdir -p .claude/agents
mkdir -p .claude/commands
mkdir -p .agents

# Clone to temp directory for reliable file access
TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

echo "Downloading agent definitions..."
git clone --depth 1 --branch "$BRANCH" "https://github.com/${REPO}.git" "$TMPDIR" 2>/dev/null

INSTALLED=0
SKIPPED=0

echo "[1/9] Installing agent definitions..."
for agent in $AGENTS; do
  if [ -d "$TMPDIR/agents/$agent" ]; then
    # Copy SKILL.md as flat file for Claude Code agent discovery
    cp "$TMPDIR/agents/$agent/SKILL.md" ".claude/agents/${agent}.md"
    # Copy references/ if they exist (for agents that need supplementary docs)
    if [ -d "$TMPDIR/agents/$agent/references" ]; then
      mkdir -p ".claude/agents/${agent}"
      cp -r "$TMPDIR/agents/$agent/references" ".claude/agents/${agent}/"
    fi
    INSTALLED=$((INSTALLED + 1))
    echo "  -> ${agent}"
  else
    echo "  [WARN] Agent '${agent}' not found, skipping"
    SKIPPED=$((SKIPPED + 1))
  fi
done

echo "[2/9] Installing custom commands..."
COMMANDS_INSTALLED=0
for cmd_file in "$TMPDIR"/commands/*.md; do
  if [ -f "$cmd_file" ]; then
    cp "$cmd_file" ".claude/commands/"
    cmd_name=$(basename "$cmd_file" .md)
    COMMANDS_INSTALLED=$((COMMANDS_INSTALLED + 1))
    echo "  -> ${cmd_name}"
  fi
done

echo "[3/9] Downloading framework protocol..."
cp "$TMPDIR/_templates/CLAUDE_PROJECT.md" ".claude/agents/_framework.md"

echo "[4/9] Setting up shared knowledge..."
if [ ! -f ".agents/PROJECT.md" ]; then
  cp "$TMPDIR/_templates/PROJECT.md" ".agents/PROJECT.md"
  echo "  -> Created .agents/PROJECT.md"
else
  echo "  -> .agents/PROJECT.md already exists, skipping"
fi

echo "[5/9] Setting up business context..."
if [ ! -f ".agents/LUNA_CONTEXT.md" ]; then
  cp "$TMPDIR/_templates/LUNA_CONTEXT.md" ".agents/LUNA_CONTEXT.md"
  echo "  -> Created .agents/LUNA_CONTEXT.md (customize for your project)"
else
  echo "  -> .agents/LUNA_CONTEXT.md already exists, skipping"
fi

echo "[6/9] Checking CLAUDE.md..."
if [ -f "CLAUDE.md" ]; then
  if grep -q "Agent Orchestrator" CLAUDE.md 2>/dev/null; then
    echo "  -> CLAUDE.md already has framework reference, skipping"
  else
    cat >> CLAUDE.md << 'FRAMEWORK_EOF'

## Agent Team Framework

This project uses [Agent Orchestrator](https://github.com/luna-matching/agent-orchestrator).
Agent definitions are in `.claude/agents/`. Framework protocol is in `.claude/agents/_framework.md`.

### Key Rules
- Hub-spoke pattern: all communication through orchestrator (Nexus/Rally)
- CEO handles business decisions before technical execution
- File ownership is law in parallel execution
- Guardrails L1-L4 for safe autonomous execution
- All outputs in Japanese
- Conventional Commits, no agent names in commits/PRs

### Business Context
- `.agents/LUNA_CONTEXT.md` - Business context for CEO decisions
- `.agents/PROJECT.md` - Shared knowledge across agents
FRAMEWORK_EOF
    echo "  -> Appended framework reference to CLAUDE.md"
  fi
else
  cat > CLAUDE.md << 'FRAMEWORK_EOF'
# Project Instructions

## Agent Team Framework

This project uses [Agent Orchestrator](https://github.com/luna-matching/agent-orchestrator).
Agent definitions are in `.claude/agents/`. Framework protocol is in `.claude/agents/_framework.md`.

### Key Rules
- Hub-spoke pattern: all communication through orchestrator (Nexus/Rally)
- CEO handles business decisions before technical execution
- File ownership is law in parallel execution
- Guardrails L1-L4 for safe autonomous execution
- All outputs in Japanese
- Conventional Commits, no agent names in commits/PRs

### Business Context
- `.agents/LUNA_CONTEXT.md` - Business context for CEO decisions
- `.agents/PROJECT.md` - Shared knowledge across agents
FRAMEWORK_EOF
  echo "  -> Created CLAUDE.md with framework reference"
fi

echo "[7/9] Installing skills..."
mkdir -p .claude/skills
SKILLS_INSTALLED=0
for skill_file in "$TMPDIR"/skills/*.md; do
  if [ -f "$skill_file" ]; then
    cp "$skill_file" ".claude/skills/"
    skill_name=$(basename "$skill_file" .md)
    SKILLS_INSTALLED=$((SKILLS_INSTALLED + 1))
    echo "  -> ${skill_name}"
  fi
done

echo "[8/9] Setting up agent memory directories..."
mkdir -p .agents/memory

echo "[9/9] Installing hooks (if --with-hooks)..."
if [[ "${1:-}" == "--with-hooks" ]] || [[ "${*}" == *"--with-hooks"* ]]; then
  mkdir -p .claude/hooks
  for hook_file in "$TMPDIR"/_templates/hooks/*.js; do
    if [ -f "$hook_file" ]; then
      cp "$hook_file" ".claude/hooks/"
      hook_name=$(basename "$hook_file")
      echo "  -> ${hook_name}"
    fi
  done
  if [ -f "$TMPDIR/_templates/settings.json" ]; then
    cp "$TMPDIR/_templates/settings.json" ".claude/settings.json"
    echo "  -> settings.json"
  fi
  echo "  Hooks installed. Configure in .claude/settings.json"
else
  echo "  Skipped (use --with-hooks to install)"
fi

echo ""
echo "=== Installation complete ==="
echo "  Installed: ${INSTALLED} agents"
echo "  Installed: ${COMMANDS_INSTALLED} custom commands"
echo "  Installed: ${SKILLS_INSTALLED} skills"
[ "$SKIPPED" -gt 0 ] && echo "  Skipped: ${SKIPPED} agents"
echo ""
echo "Installed agents:"
for f in .claude/agents/*.md; do
  name=$(basename "$f" .md)
  [ "$name" != "_framework" ] && echo "  - $name"
done
echo ""
echo "Installed commands:"
for f in .claude/commands/*.md; do
  if [ -f "$f" ]; then
    name=$(basename "$f" .md)
    echo "  - /$name"
  fi
done
echo ""
echo "Next steps:"
echo "  1. Customize .agents/LUNA_CONTEXT.md for your project"
echo "  2. Review .agents/PROJECT.md for shared knowledge"
echo "  3. Customize CLAUDE.md for your project"
echo ""
echo "Usage (agents):"
echo "  /ceo この機能の優先度を判断して"
echo "  /nexus ログイン機能を実装したい"
echo "  /analyst ユーザー離脱率を分析して"
echo "  /rally フロントエンドとバックエンドを並列実装して"
echo ""
echo "Usage (commands):"
echo "  /superpowers 認証システムをリファクタリングして"
echo "  /frontend-design ダッシュボードのUIを設計して"
echo "  /code-simplifier 直近の変更をクリーンアップして"
echo "  /playground マークダウンエディタを作って"
echo "  /chrome このページのデータを収集して"
echo "  /pr-review #123"
