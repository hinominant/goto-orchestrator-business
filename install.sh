#!/bin/bash
set -euo pipefail

# Goto Orchestrator Installer
# Usage:
#   curl -sL https://raw.githubusercontent.com/hinominant/goto-orchestrator/main/install.sh | bash -s -- --with-hooks
#   curl -sL https://raw.githubusercontent.com/hinominant/goto-orchestrator/main/install.sh | bash -s -- --with-hooks nexus rally builder radar
#   ./install.sh --with-hooks             # Install all agents + hooks (recommended)
#   ./install.sh                           # Install all agents
#   ./install.sh nexus rally builder       # Install specific agents
#   ./install.sh --with-mcp               # Install agents + setup MCP servers
#   ./install.sh --with-permissions        # Install agents + safe permission defaults
#   ./install.sh --with-hooks             # Install agents + tool risk hooks (4-Hook体制) ★推奨

REPO="hinominant/goto-orchestrator"
BRANCH="main"

# All 73 agents
ALL_AGENTS="advocate analyst anvil architect arena artisan atlas auditor bard bolt bridge builder canon canvas cipher compete compliance comptroller counsel datashield director echo experiment flow forge gateway gear grove growth guardian harvest hone horizon judge launch lens magi morph muse navigator nexus palette polyglot privacy probe pulse quill radar rally reel researcher retain rewind ripple scaffold schema scout scribe sentinel sherpa showcase spark specter stream sweep trace triage tuner vision voice voyager warden zen"

# Parse flags
WITH_MCP=false
WITH_PERMISSIONS=false
WITH_HOOKS=false
AGENT_ARGS=()
for arg in "$@"; do
  case "$arg" in
    --with-mcp) WITH_MCP=true ;;
    --with-permissions) WITH_PERMISSIONS=true ;;
    --with-hooks) WITH_HOOKS=true ;;
    *) AGENT_ARGS+=("$arg") ;;
  esac
done

# Default: install all if no agent args
AGENTS="${AGENT_ARGS[*]:-$ALL_AGENTS}"

echo "=== Goto Orchestrator Installer ==="
echo "Source: github.com/${REPO}"
echo ""
if [ "$WITH_HOOKS" = true ]; then
  echo "🔒 Security hooks enabled (recommended)"
else
  echo "💡 Tip: --with-hooks を付けると Tool Risk Hooks が有効になります（初心者推奨）"
fi
echo ""

# Create directories
mkdir -p .claude/agents
mkdir -p .claude/commands
mkdir -p .claude/skills
mkdir -p .agents
mkdir -p .agents/memory

# Clone to temp directory for reliable file access
CLONE_DIR=$(mktemp -d)
trap "rm -rf $CLONE_DIR" EXIT

echo "Downloading agent definitions..."
if ! git clone --depth 1 --branch "$BRANCH" "https://github.com/${REPO}.git" "$CLONE_DIR" 2>&1; then
  echo "Error: Failed to download goto-orchestrator. Check your internet connection and try again."
  exit 1
fi

INSTALLED=0
SKIPPED=0

echo "[1/12] Installing agent definitions..."
for agent in $AGENTS; do
  if [ -d "$CLONE_DIR/agents/$agent" ]; then
    # Copy SKILL.md as flat file for Claude Code agent discovery
    cp "$CLONE_DIR/agents/$agent/SKILL.md" ".claude/agents/${agent}.md"
    # Copy references/ if they exist (for agents that need supplementary docs)
    if [ -d "$CLONE_DIR/agents/$agent/references" ]; then
      rm -rf ".claude/agents/${agent}/references"
      mkdir -p ".claude/agents/${agent}"
      cp -r "$CLONE_DIR/agents/$agent/references" ".claude/agents/${agent}/"
    fi
    INSTALLED=$((INSTALLED + 1))
    echo "  -> ${agent}"
  else
    echo "  [WARN] Agent '${agent}' not found, skipping"
    SKIPPED=$((SKIPPED + 1))
  fi
done

echo "[2/12] Installing custom commands..."
COMMANDS_INSTALLED=0
for cmd_file in "$CLONE_DIR"/commands/*.md; do
  if [ -f "$cmd_file" ]; then
    cp "$cmd_file" ".claude/commands/"
    cmd_name=$(basename "$cmd_file" .md)
    COMMANDS_INSTALLED=$((COMMANDS_INSTALLED + 1))
    echo "  -> ${cmd_name}"
  fi
done

echo "[3/12] Downloading framework protocol..."
cp "$CLONE_DIR/_templates/CLAUDE_PROJECT.md" ".claude/agents/_framework.md"

echo "[4/12] Installing common protocols (_common/)..."
mkdir -p .claude/agents
PROTOCOLS_INSTALLED=0
for proto_file in "$CLONE_DIR"/_common/*.md; do
  if [ -f "$proto_file" ]; then
    proto_name=$(basename "$proto_file")
    cp "$proto_file" ".claude/agents/_protocol_${proto_name}"
    PROTOCOLS_INSTALLED=$((PROTOCOLS_INSTALLED + 1))
    echo "  -> _protocol_${proto_name}"
  fi
done
echo "  Installed: ${PROTOCOLS_INSTALLED} common protocols"

echo "[5/12] Installing skills..."
SKILLS_INSTALLED=0
for skill_file in "$CLONE_DIR"/skills/*.md; do
  if [ -f "$skill_file" ]; then
    cp "$skill_file" ".claude/skills/"
    skill_name=$(basename "$skill_file" .md)
    SKILLS_INSTALLED=$((SKILLS_INSTALLED + 1))
    echo "  -> ${skill_name}"
  fi
done

echo "[6/12] Setting up shared knowledge..."
if [ ! -f ".agents/PROJECT.md" ]; then
  cp "$CLONE_DIR/_templates/PROJECT.md" ".agents/PROJECT.md"
  echo "  -> Created .agents/PROJECT.md"
else
  echo "  -> .agents/PROJECT.md already exists, skipping"
fi

echo "[7/12] Setting up project context..."
if [ ! -f ".agents/PROJECT_CONTEXT.md" ]; then
  if [ -f "$CLONE_DIR/_templates/PROJECT_CONTEXT.md" ]; then
    cp "$CLONE_DIR/_templates/PROJECT_CONTEXT.md" ".agents/PROJECT_CONTEXT.md"
  else
    cat > ".agents/PROJECT_CONTEXT.md" << 'CONTEXT_EOF'
# Project Context

プロジェクトのビジネス文脈をここに記載してください。エージェントがビジネス判断の参考にします。

## プロジェクト概要

- **プロジェクト名**: (記入してください)
- **目的**: (記入してください)
- **ターゲットユーザー**: (記入してください)

## ビジネス目標

- (記入してください)

## 技術的制約

- (記入してください)

## 重要なドメイン知識

- (記入してください)
CONTEXT_EOF
  fi
  echo "  -> Created .agents/PROJECT_CONTEXT.md (customize for your project)"
else
  echo "  -> .agents/PROJECT_CONTEXT.md already exists, skipping"
fi

echo "[8/12] Copying MCP scripts and templates..."
mkdir -p .claude/scripts
if [ -f "$CLONE_DIR/scripts/setup-mcp.sh" ]; then
  cp "$CLONE_DIR/scripts/setup-mcp.sh" ".claude/scripts/setup-mcp.sh"
  chmod +x ".claude/scripts/setup-mcp.sh"
  echo "  -> Copied scripts/setup-mcp.sh"
else
  echo "  [WARN] scripts/setup-mcp.sh not found in repo, skipping"
fi
if [ -f "$CLONE_DIR/_templates/mcp-settings.json" ]; then
  cp "$CLONE_DIR/_templates/mcp-settings.json" ".claude/mcp-settings.template.json"
  echo "  -> Copied mcp-settings.template.json"
else
  echo "  [WARN] _templates/mcp-settings.json not found in repo, skipping"
fi
# Cloud scripts
if [ -d "$CLONE_DIR/scripts/cloud" ]; then
  mkdir -p .claude/scripts/cloud
  for f in cloud.sh codespace.sh ec2.sh setup-billing-alert.sh .env.example; do
    if [ -f "$CLONE_DIR/scripts/cloud/$f" ]; then
      cp "$CLONE_DIR/scripts/cloud/$f" ".claude/scripts/cloud/$f"
      [[ "$f" == *.sh ]] && chmod +x ".claude/scripts/cloud/$f"
    fi
  done
  echo "  -> Copied cloud execution scripts"
fi
# devcontainer template
if [ -f "$CLONE_DIR/_templates/devcontainer.json" ]; then
  mkdir -p .devcontainer
  cp "$CLONE_DIR/_templates/devcontainer.json" ".devcontainer/devcontainer.json"
  [ -f "$CLONE_DIR/_templates/post-create.sh" ] && cp "$CLONE_DIR/_templates/post-create.sh" ".devcontainer/post-create.sh"
  echo "  -> Copied devcontainer template"
fi

echo "[9/12] Checking CLAUDE.md..."
if [ -f "CLAUDE.md" ]; then
  if grep -q "Goto Orchestrator" CLAUDE.md 2>/dev/null; then
    echo "  -> CLAUDE.md already has framework reference, skipping"
  else
    cat >> CLAUDE.md << 'FRAMEWORK_EOF'

## Agent Team Framework

This project uses [Goto Orchestrator](https://github.com/hinominant/goto-orchestrator).
Agent definitions are in `.claude/agents/`. Framework protocol is in `.claude/agents/_framework.md`.

### Key Rules
- Security-first: Tool Risk Hooks で危険な操作を事前警告
- Hub-spoke pattern: all communication through orchestrator (Nexus/Rally)
- File ownership is law in parallel execution
- Guardrails L1-L4 for safe autonomous execution
- All outputs in Japanese
- Conventional Commits, no agent names in commits/PRs

### Project Context
- `.agents/PROJECT_CONTEXT.md` - Project business context
- `.agents/PROJECT.md` - Shared knowledge across agents
FRAMEWORK_EOF
    echo "  -> Appended framework reference to CLAUDE.md"
  fi
else
  cat > CLAUDE.md << 'FRAMEWORK_EOF'
# Project Instructions

## Agent Team Framework

This project uses [Goto Orchestrator](https://github.com/hinominant/goto-orchestrator).
Agent definitions are in `.claude/agents/`. Framework protocol is in `.claude/agents/_framework.md`.

### Key Rules
- Security-first: Tool Risk Hooks で危険な操作を事前警告
- Hub-spoke pattern: all communication through orchestrator (Nexus/Rally)
- File ownership is law in parallel execution
- Guardrails L1-L4 for safe autonomous execution
- All outputs in Japanese
- Conventional Commits, no agent names in commits/PRs

### Project Context
- `.agents/PROJECT_CONTEXT.md` - Project business context
- `.agents/PROJECT.md` - Shared knowledge across agents
FRAMEWORK_EOF
  echo "  -> Created CLAUDE.md with framework reference"
fi

echo "[10/12] MCP setup..."
if [ "$WITH_MCP" = true ]; then
  if [ -f ".claude/scripts/setup-mcp.sh" ]; then
    echo "  -> Running MCP setup (--with-mcp flag detected)..."
    bash ".claude/scripts/setup-mcp.sh"
  else
    echo "  [WARN] .claude/scripts/setup-mcp.sh not found, skipping MCP setup"
  fi
else
  echo "  -> Skipped (use --with-mcp to auto-setup)"
fi

echo "[11/12] Permissions setup..."
if [ "$WITH_PERMISSIONS" = true ]; then
  # --with-permissions implies hooks must also be installed, since settings.json
  # references hook files. Auto-enable hooks to prevent broken install.
  if [ "$WITH_HOOKS" != true ]; then
    echo "  [NOTE] --with-permissions requires hooks. Enabling --with-hooks automatically."
    WITH_HOOKS=true
  fi
  if [ -f "$CLONE_DIR/_templates/settings.json" ]; then
    if [ ! -f ".claude/settings.json" ]; then
      cp "$CLONE_DIR/_templates/settings.json" ".claude/settings.json"
      echo "  -> Created .claude/settings.json (project permissions + hooks)"
    else
      echo "  -> .claude/settings.json already exists, skipping"
    fi
    if [ -f "$CLONE_DIR/_templates/settings.local.example.json" ]; then
      cp "$CLONE_DIR/_templates/settings.local.example.json" ".claude/settings.local.example.json"
      echo "  -> Copied settings.local.example.json"
    fi
  else
    echo "  [WARN] _templates/settings.json not found, skipping"
  fi
else
  echo "  -> Skipped (use --with-permissions to install safe defaults)"
fi

echo "[12/12] Hooks setup (4-Hook体制)..."
if [ "$WITH_HOOKS" = true ]; then
  # Check Node.js is installed (hooks require it)
  if ! command -v node >/dev/null 2>&1; then
    echo "  [ERROR] Node.js is required for hooks but not found."
    echo "  Install Node.js 18+ from https://nodejs.org/ and re-run with --with-hooks."
    echo "  Skipping hook installation."
  else
    NODE_VER=$(node --version 2>/dev/null | sed 's/v//')
    echo "  Node.js ${NODE_VER} detected"

    # Install hooks to project-local location only
    # The project .claude/settings.json already wires hooks from .claude/hooks/
    mkdir -p .claude/hooks
    for hook_file in "$CLONE_DIR"/_templates/hooks/*.js; do
      if [ -f "$hook_file" ]; then
        hook_name=$(basename "$hook_file")
        cp "$hook_file" ".claude/hooks/"
        echo "  -> ${hook_name}"
      fi
    done

    # Also install to global location for cross-project use
    HOOKS_DIR="$HOME/.claude/hooks"
    mkdir -p "$HOOKS_DIR"
    for hook_file in "$CLONE_DIR"/_templates/hooks/*.js; do
      if [ -f "$hook_file" ]; then
        hook_name=$(basename "$hook_file")
        cp "$hook_file" "$HOOKS_DIR/"
        chmod +x "$HOOKS_DIR/$hook_name"
      fi
    done

    # Copy settings.json with hook configuration if not exists
    if [ -f "$CLONE_DIR/_templates/settings.json" ]; then
      if [ ! -f ".claude/settings.json" ]; then
        cp "$CLONE_DIR/_templates/settings.json" ".claude/settings.json"
        echo "  -> settings.json (permissions + hooks config)"
      else
        echo "  -> .claude/settings.json already exists"
      fi
    fi

    # Install git pre-commit hook (quality gate enforcement)
    # This physically blocks git commit if tests fail — cannot be bypassed by AI
    if [ -f "$CLONE_DIR/_templates/hooks/pre-commit" ]; then
      if [ -d ".git" ]; then
        mkdir -p .git/hooks
        cp "$CLONE_DIR/_templates/hooks/pre-commit" ".git/hooks/pre-commit"
        chmod +x ".git/hooks/pre-commit"
        echo "  -> pre-commit (git hook: テスト失敗時はコミット物理ブロック)"
      else
        echo "  [WARN] .git not found — pre-commit hook skipped (run inside a git repo)"
      fi
    fi

    echo "  Hooks installed (4-Hook体制: PreToolUse + PostToolUse + Elicitation + Stop)"
    echo "  + git pre-commit hook (テスト未通過でコミット物理ブロック)"
    echo "  Hooks location: .claude/hooks/ (project) + ~/.claude/hooks/ (global)"
    echo "  [NOTE] Project hooks (.claude/settings.json) are active for this project."
    echo "  To activate hooks globally across ALL projects, add the hooks config to"
    echo "  ~/.claude/settings.json (see docs/QUICKSTART.md for the exact JSON)."
    echo "  Do NOT add global hooks if project hooks are already active — that would"
    echo "  cause double execution (each tool call runs hooks twice)."
  fi
else
  echo "  -> Skipped"
  echo "  ★ 推奨: --with-hooks を付けると Tool Risk Hooks（4-Hook体制）が有効になります"
  echo "    破壊的操作の事前警告・シークレット保護など、安全にClaude Codeを使えます"
fi

echo ""
echo "=== Installation complete ==="
echo "  Installed: ${INSTALLED} agents"
echo "  Installed: ${COMMANDS_INSTALLED} custom commands"
echo "  Installed: ${SKILLS_INSTALLED} skills"
echo "  Installed: ${PROTOCOLS_INSTALLED} common protocols"
[ "$SKIPPED" -gt 0 ] && echo "  Skipped: ${SKIPPED} agents"
echo ""
echo "Installed agents:"
for f in .claude/agents/*.md; do
  name=$(basename "$f" .md)
  [ "$name" != "_framework" ] && [[ "$name" != _protocol_* ]] && echo "  - $name"
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
echo "  1. Customize .agents/PROJECT_CONTEXT.md for your project"
echo "  2. Review .agents/PROJECT.md for shared knowledge"
echo "  3. Customize CLAUDE.md for your project"
if [ "$WITH_HOOKS" != true ]; then
  echo "  4. ★ Run './install.sh --with-hooks' for tool risk classification (recommended)"
fi
echo ""
echo "Usage (agents):"
echo "  /nexus ログイン機能を実装したい"
echo "  /analyst ユーザー離脱率を分析して"
echo "  /rally フロントエンドとバックエンドを並列実装して"
echo "  /sentinel セキュリティチェックして"
echo ""
echo "Usage (commands):"
echo "  /superpowers 認証システムをリファクタリングして"
echo "  /frontend-design ダッシュボードのUIを設計して"
echo "  /code-simplifier 直近の変更をクリーンアップして"
echo "  /playground マークダウンエディタを作って"
echo "  /chrome このページのデータを収集して"
echo "  /pr-review #123"
echo ""
echo "MCP Integration:"
echo "  # Global MCP setup (recommended)"
echo "  bash .claude/scripts/setup-mcp.sh"
echo ""
echo "  # Project-specific PostgreSQL MCP"
echo "  claude mcp add postgres -- npx -y @modelcontextprotocol/server-postgres 'postgresql://user:pass@host:5432/db'"
echo ""
echo "Hooks:"
echo "  ./install.sh --with-hooks    # Install 4-Hook体制 (tool-risk + post-tool-use + elicitation-guard + stop-hook)"
echo ""
echo "Cloud Execution (Codespaces推奨):"
echo "  # Setup"
echo "  cp .claude/scripts/cloud/.env.example .claude/scripts/cloud/.env"
echo "  # デフォルトはCodespaces。EC2を使う場合のみ CLOUD_PROVIDER=ec2 に変更"
echo "  # Usage:"
echo "  bash .claude/scripts/cloud/cloud.sh start --repo OWNER/REPO"
echo "  bash .claude/scripts/cloud/cloud.sh run \"npm run build\""
echo "  bash .claude/scripts/cloud/cloud.sh status"
echo ""
