#!/usr/bin/env node
'use strict';

/**
 * Claude Code PreToolUse Hook - Tool Risk Classification + Safety Gate
 *
 * 4-Hook体制の PreToolUse フック。
 * - Safety Gate パターン検知 → 自動ブロック
 * - HIGH/MEDIUM リスク → 確認ダイアログ表示
 * - LOW リスク → サイレント通過
 * - additionalContext でファイルオーナーシップ情報を注入
 *
 * Install: ~/.claude/hooks/tool-risk.js
 * Settings: ~/.claude/settings.json の hooks.PreToolUse に登録
 */

// === Safety Gate Patterns (auto-block) ===

const SAFETY_GATE_PATTERNS = [
  {
    // ユーザー安全性: 認証情報の外部送信
    test: (cmd) =>
      /curl.*(-d|--data)/.test(cmd) &&
      /(password|secret|token|api_key|credential)/i.test(cmd),
    reason: 'Safety Gate: 認証情報の外部送信リスク',
  },
  {
    // 破壊的操作: ルートや home への rm（フラグ順序・スペースに依存しない）
    // CRIT-1: catches rm -fr /, rm --force --recursive /, rm -rf/, rm -rf -- /
    test: (cmd) => {
      if (!/\brm\b/.test(cmd)) return false;
      const hasDestructiveFlag = /(?:-[a-zA-Z]*[rf]|--force|--recursive)/i.test(cmd);
      if (!hasDestructiveFlag) return false;
      // Targets root or home: space + /, ~, -rf/ with no space, -- / separator
      return /(?:\s+[\/~]|-[a-zA-Z]*[rf][\/~]|\s+--\s+[\/~])/.test(cmd);
    },
    reason: 'Safety Gate: 破壊的操作の検出 — ルート/ホームへのrm',
  },
  {
    // 破壊的操作: DROP DATABASE, force push to main（上記rmとは別パターン）
    test: (cmd) =>
      /DROP\s+(TABLE|DATABASE)/i.test(cmd) ||
      /git\s+push\s+.*--force\s+.*main/i.test(cmd),
    reason: 'Safety Gate: 破壊的操作の検出',
  },
  {
    // コスト制御不能: 無制限ループ（多形式対応）
    // MED-3: while :, while [ 1 -eq 1 ], for ((;;)), backtick seq
    test: (cmd) =>
      /while\s+(?:true|:|\[\s*1\s*-eq\s*1\s*\]|\[\s*true\s*\])/i.test(cmd) ||
      /for\s*\(\s*\(\s*[^;]*;[^;]*;?\s*\)\s*\)/i.test(cmd) ||
      /for\s+\w+\s+in\s+[`$]\(seq\s+\d{4,}/i.test(cmd),
    reason: 'Safety Gate: 無制限ループによるコスト制御不能リスク',
  },
  {
    // シークレット漏洩: echo/printでシークレットをstdoutに出力
    test: (cmd) =>
      /(echo|printf|cat)\s+.*\$\{?([\w]*(?:SECRET|TOKEN|KEY|PASSWORD|API_KEY|PRIVATE)[\w]*)\}?/i.test(cmd),
    reason: 'Safety Gate: シークレットのstdout出力リスク',
  },
  {
    // シークレット漏洩: .envファイルをgit addしようとする（.env.* および .envrc も対象）
    // CRIT-2: catches git add .env.production, .env.local, .envrc etc.
    test: (cmd) =>
      /git\s+add\s+.*\.env/i.test(cmd),
    reason: 'Safety Gate: .envファイルのコミットリスク — シークレット漏洩の危険',
  },
  {
    // ANTHROPIC_BASE_URL 書き換えによる API キー外部送信（CVE-2026-21852）
    test: (cmd) =>
      /ANTHROPIC_BASE_URL\s*=/.test(cmd),
    reason: 'Safety Gate: ANTHROPIC_BASE_URL の変更はAPIキー窃取リスク（CVE-2026-21852）',
  },
  {
    // python3/node 経由のネットワーク通信・環境変数漏洩バイパス
    // MED-6: python3 -c printing os.environ, node -e printing process.env
    test: (cmd) =>
      /python3?\s+-c\s+['"].*(?:urllib|requests|http|socket|os\.environ|os\.getenv)/.test(cmd) ||
      /node\s+-e\s+['"].*(?:https?|fetch|axios|net\.Socket|process\.env)/.test(cmd),
    reason: 'Safety Gate: python3/node経由のネットワーク通信・環境変数漏洩バイパス試行を検出',
  },
  {
    // osascript / security コマンドによるキーチェーンアクセス（macOS）
    // HIGH-3: handles sudo prefix (sudo osascript, sudo security)
    test: (cmd) =>
      /(?:^|sudo\s+)(?:osascript|security\s+(?:find|add|delete|import|export))/i.test(cmd.trim()),
    reason: 'Safety Gate: macOSキーチェーン・GUI操作へのアクセス試行',
  },
  {
    // 生ソケット通信（nc/ncat/telnet）— フルパス・シェルラッパー対応
    // HIGH-2: handles /usr/bin/nc, bash -c "nc ...", env -i nc, etc.
    test: (cmd) =>
      /(?:^|[|;&\s`])(?:(?:\/[^\s|;&`]*\/)?)(?:nc|ncat|netcat|telnet)\s/i.test(cmd.trim()) ||
      /(?:bash|sh)\s+-c\s+['"][^'"]*\b(?:nc|ncat|netcat|telnet)\s/i.test(cmd),
    reason: 'Safety Gate: 生ソケット通信による外部接続試行',
  },
  {
    // eval 経由のリモートコード実行（HIGH-4: eval "$(curl ...)"）
    test: (cmd) =>
      /eval\s+["'`]?\$\((?:curl|wget)/.test(cmd) ||
      /eval\s+["'][^'"]*(?:curl|wget)/.test(cmd),
    reason: 'Safety Gate: eval経由のリモートコード実行リスク',
  },
  {
    // print/console.log/puts でシークレット変数を stdout に出力
    // LOW-1 fix: tightened to prevent false positives on echo "...load_dotenv...console.log..."
    test: (cmd) =>
      /(?:print|console\.log|console\.error|puts|echo|printf)\s*.*\$\{?(?:[A-Z_]*(?:SECRET|TOKEN|KEY|PASSWORD|API_KEY|PRIVATE|CREDENTIAL)[A-Z_]*)\}?/i.test(cmd) ||
      // dotenv+print pattern: only match actual inline code execution, not string literals
      (/(?:python3?\s+-c|node\s+-e)\s+['"]/.test(cmd) &&
       /(?:dotenv|load_dotenv|require\s*\(?\s*['"]dotenv['"])/.test(cmd) &&
       /(?:print|console\.log)/.test(cmd)),
    reason: 'Safety Gate: シークレット変数のstdout出力リスク（CI/CDログ漏洩の危険）',
  },
  {
    // パイプ経由のスクリプト実行（サプライチェーン攻撃）
    // curl/wget | bash/sh, bash <(curl ...), sh <(wget ...)
    test: (cmd) =>
      /(?:curl|wget)\s+.*\|\s*(?:ba)?sh\b/.test(cmd) ||
      /(?:ba)?sh\b\s+<\s*\(\s*(?:curl|wget)/.test(cmd),
    reason: 'Safety Gate: パイプ経由の外部スクリプト実行 — サプライチェーン攻撃リスク。/external-install-check を先に実行してください',
  },
];

// === Risk Classification Patterns ===

const HIGH_RISK_PATTERNS = [
  // 外部コンテンツの無検証インストール（サプライチェーン攻撃）
  /npx\s+(-y|--yes)\s+/,
  /claude\s+mcp\s+add\b/,
  // CRIT-3: bulk git staging — may silently include .env files
  /git\s+add\s+(-A|--all)\b/,
  /git\s+add\s+\.\s*$/,
  /git\s+add\s+\*\s*$/,
  /rm\s+.*(-[a-zA-Z]*f|-[a-zA-Z]*r|--force|--recursive)/,
  // MED-5 fix: --force-with-lease is safe, only flag plain --force
  /git\s+push\s+.*--force(?!-with-lease)/,
  /git\s+push\s+.*-f\b/,
  /git\s+reset\s+--hard/,
  /git\s+clean\s+-[a-zA-Z]*f/,
  /git\s+branch\s+-D/,
  /DROP\s+(TABLE|DATABASE|INDEX)/i,
  /DELETE\s+FROM/i,
  /TRUNCATE\s+TABLE/i,
  /docker\s+(rm|rmi)\s+-f/,
  // MED-2: docker system/volume prune — irreversible
  /docker\s+(?:system|volume|network|container)\s+prune/,
  /kill\s+-9/,
  // MED-4 fix: catch chmod a+rwx and 0777 in addition to 777
  /chmod\s+(?:0*777|a[+]rwx|ugo[+]rwx)/,
  /mkfs\b/,
  /dd\s+if=/,
  /shutdown/,
  /reboot/,
  />\s*\/dev\/sd/,
  // HIGH-5: .env file copy/move/encode — .env exfiltration bypass
  /(?:cp|mv|ln)\s+.*\.env\b/,
  /(?:base64|xxd|od|strings|hexdump)\s+.*\.env\b/,
  // Secret exposure: hardcoded secrets in commands
  /(?:curl|wget|http).*(?:Bearer|Basic)\s+[A-Za-z0-9_\-\.]{20,}/i,
  /ANTHROPIC_BASE_URL/,
  /enableAllProjectMcpServers/,
  /curl\s+.*-[bBdD]/,  // curl with data flags
  /wget\s+.*--post/i,
];

const MEDIUM_RISK_PATTERNS = [
  /git\s+push/,
  /git\s+commit/,
  /git\s+merge/,
  /git\s+rebase/,
  /git\s+checkout\s+\./,
  /git\s+restore\s+\./,
  /npm\s+publish/,
  /npm\s+install\s+-g/,
  /pip\s+install/,
  /docker\s+(build|run|compose)/,
  /curl\s+.*-X\s*(POST|PUT|DELETE|PATCH)/i,
  /ssh\s/,
  /scp\s/,
  /rsync\s/,
  /brew\s+(install|uninstall)/,
  /apt(-get)?\s+(install|remove)/,
];

const LOW_TOOL_NAMES = new Set([
  'Read', 'Glob', 'Grep', 'WebFetch', 'WebSearch',
  'TaskList', 'TaskGet',
]);

/**
 * ツール名と入力からリスクレベルを判定する
 * @param {string} toolName - ツール名
 * @param {object} toolInput - ツール入力
 * @returns {{ level: string, reason: string, additionalContext?: string }}
 */
function classifyRisk(toolName, toolInput) {
  // Read-only tools are always LOW
  if (LOW_TOOL_NAMES.has(toolName)) {
    return { level: 'LOW', reason: '' };
  }

  // Bash command classification
  if (toolName === 'Bash' && toolInput.command) {
    const cmd = toolInput.command;

    // 1. Safety Gate check (auto-block)
    for (const pattern of SAFETY_GATE_PATTERNS) {
      try {
        if (pattern.test(cmd)) {
          return { level: 'BLOCK', reason: pattern.reason };
        }
      } catch (_e) {
        // Pattern evaluation error, skip
      }
    }

    // 2. HIGH risk check
    for (const pattern of HIGH_RISK_PATTERNS) {
      if (pattern.test(cmd)) {
        return {
          level: 'HIGH',
          reason: '破壊的・不可逆な操作: ' + cmd.substring(0, 80),
        };
      }
    }

    // 3. MEDIUM risk check
    for (const pattern of MEDIUM_RISK_PATTERNS) {
      if (pattern.test(cmd)) {
        return {
          level: 'MEDIUM',
          reason: '外部影響・副作用のある操作: ' + cmd.substring(0, 80),
        };
      }
    }

    return { level: 'LOW', reason: '' };
  }

  // Write/Edit tools - MEDIUM + file ownership context injection
  if (['Write', 'Edit', 'NotebookEdit'].includes(toolName)) {
    const filePath = toolInput.file_path || toolInput.notebook_path || '';
    return {
      level: 'MEDIUM',
      reason: 'ファイル変更: ' + filePath,
      additionalContext: filePath
        ? `Editing ${filePath}. Ensure file ownership rules are respected per _common/PARALLEL.md.`
        : undefined,
    };
  }

  // Default: LOW
  return { level: 'LOW', reason: '' };
}

// Main
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const toolName = data.tool_name || '';
    const toolInput = data.tool_input || {};

    const { level, reason, additionalContext } = classifyRisk(toolName, toolInput);

    if (level === 'BLOCK') {
      // Safety Gate: auto-block
      process.stdout.write(JSON.stringify({
        decision: 'block',
        reason: reason,
      }));
    } else if (level === 'LOW') {
      // Silent pass-through
      const result = { decision: 'approve' };
      if (additionalContext) result.additionalContext = additionalContext;
      process.stdout.write(JSON.stringify(result));
    } else {
      // MEDIUM / HIGH: ask user
      const indicator = level === 'HIGH' ? '🔴' : '🟡';
      const result = {
        decision: 'ask_user',
        reason: indicator + ' ' + level + ' RISK: ' + reason,
      };
      if (additionalContext) result.additionalContext = additionalContext;
      process.stdout.write(JSON.stringify(result));
    }
  } catch (_e) {
    // Parse error -> approve to avoid blocking
    process.stdout.write(JSON.stringify({ decision: 'approve' }));
  }
});
