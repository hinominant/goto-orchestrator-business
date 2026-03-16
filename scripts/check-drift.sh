#!/bin/bash
set -euo pipefail

# Agent SKILL.md Drift Detection
# Usage: scripts/check-drift.sh [agent_name]
# Checks that SKILL.md files conform to the base template structure.

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AGENTS_DIR="$REPO_ROOT/agents"
ERRORS=0

# Required frontmatter fields
REQUIRED_FM_FIELDS=("name" "description")

# Required sections in SKILL.md
REQUIRED_SECTIONS=(
  "# "               # Top-level heading (agent name)
  "## Process"        # Process section
  "## Boundaries"     # Boundaries section
  "## INTERACTION_TRIGGERS"  # Interaction triggers
  "## AUTORUN Support"       # AUTORUN support
  "## Output Language"       # Output language
)

check_agent() {
  local agent_name="$1"
  local skill_file="$AGENTS_DIR/$agent_name/SKILL.md"
  local agent_errors=0

  if [ ! -f "$skill_file" ]; then
    echo "  [ERROR] $agent_name: SKILL.md not found"
    return 1
  fi

  # Check frontmatter exists (handle CRLF)
  if ! head -1 "$skill_file" | tr -d '\r' | grep -q "^---$"; then
    echo "  [ERROR] $agent_name: Missing frontmatter"
    agent_errors=$((agent_errors + 1))
  fi

  # Check required frontmatter fields
  for field in "${REQUIRED_FM_FIELDS[@]}"; do
    if ! grep -q "^${field}:" "$skill_file"; then
      echo "  [ERROR] $agent_name: Missing required field '$field'"
      agent_errors=$((agent_errors + 1))
    fi
  done

  # Check YAML validity of frontmatter (basic check)
  local in_frontmatter=false
  local fm_closed=false
  local line_num=0
  while IFS= read -r line; do
    line="${line%$'\r'}"  # Strip trailing CR
    line_num=$((line_num + 1))
    if [ "$line_num" -eq 1 ] && [ "$line" = "---" ]; then
      in_frontmatter=true
      continue
    fi
    if $in_frontmatter && [ "$line" = "---" ]; then
      fm_closed=true
      break
    fi
  done < "$skill_file"

  if $in_frontmatter && ! $fm_closed; then
    echo "  [ERROR] $agent_name: Frontmatter not closed"
    agent_errors=$((agent_errors + 1))
  fi

  # Check required sections
  for section in "${REQUIRED_SECTIONS[@]}"; do
    if ! grep -q "$section" "$skill_file"; then
      echo "  [WARN] $agent_name: Missing section '$section'"
    fi
  done

  if [ "$agent_errors" -gt 0 ]; then
    return 1
  fi

  echo "  [OK] $agent_name"
  return 0
}

echo "=== Agent SKILL.md Drift Detection ==="
echo ""

if [ $# -gt 0 ]; then
  # Check specific agents
  for agent in "$@"; do
    check_agent "$agent" || ERRORS=$((ERRORS + 1))
  done
else
  # Check all agents
  for agent_dir in "$AGENTS_DIR"/*/; do
    agent_name=$(basename "$agent_dir")
    [ "$agent_name" = "_base.tmpl" ] && continue
    check_agent "$agent_name" || ERRORS=$((ERRORS + 1))
  done
fi

echo ""
if [ "$ERRORS" -gt 0 ]; then
  echo "=== FAILED: $ERRORS agent(s) with errors ==="
  exit 1
else
  echo "=== PASSED: All agents conform to template ==="
  exit 0
fi
