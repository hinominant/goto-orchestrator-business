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

// === DATA PROTECTION REMINDER ===
// additionalContext として全ツール呼び出しに注入する。
// コンテキスト圧縮後も毎回フレッシュに再注入されるため「忘れ」が起きない。
const DATA_PROTECTION_REMINDER =
  '[DATA GUARD] ⚠️ 入力禁止: 採用候補者データ・本番DB接続文字列・未公開財務情報・顧客個人情報。' +
  'データ作業前は /data-guard を実行。詳細: _common/DATA_PROTECTION.md';

// === GlassWorm / Trojan Source: Unicode不可視文字検知 (SEC-014) ===
// ゼロ幅スペース・方向制御文字などの不可視Unicode文字を検知する。
// これらは人間のコードレビューで見えないまま悪意あるコードを混入させる攻撃手法に使われる。
// Reference: https://qiita.com/sarubot/items/df077776b293163e0a42
const INVISIBLE_UNICODE_RE = /[\u200B\u200C\u200D\u200E\u200F\u2060\u2061\u2062\u2063\u2064\uFEFF\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180E\u2000-\u200A\u202A-\u202E\u2066-\u206F\u2800\u3164\uFFA0]/;

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
    // 破壊的操作: DROP DATABASE, force push to protected branches（main/master/develop/release/*）
    // HIGH-4: master/develop/release/* を追加
    test: (cmd) =>
      /DROP\s+(TABLE|DATABASE)/i.test(cmd) ||
      /git\s+push\s+.*--force.*(?:main|master|develop|release\/)/i.test(cmd) ||
      /git\s+push\s+.*(?:main|master|develop|release\/).*--force/i.test(cmd),
    reason: 'Safety Gate: 破壊的操作の検出',
  },
  {
    // コスト制御不能: 無制限ループ（多形式対応）
    // CRIT-B: backtick seq "`seq 9999`" 対応
    // HIGH-5: for((;;sleep 1)) — 第3フィールドに任意コードを許容する形に修正
    test: (cmd) =>
      /while\s+(?:true|:|\[\s*1\s*-eq\s*1\s*\]|\[\s*true\s*\])/i.test(cmd) ||
      /for\s*\(\s*\(\s*[^;]*;\s*;[^)]*\)\s*\)/i.test(cmd) ||  // 条件フィールドが空 = 無限ループ
      /for\s+\w+\s+in\s+(?:\$\(|`)seq\s+\d{4,}/i.test(cmd),
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
    // MED-5: subprocess 追加、MED-6: child_process/net.connect 追加
    // AUDIT-FIX: python3 --command 長形式、node --eval/-p も検知
    test: (cmd) =>
      /python3?\s+(?:-c|--command)\s+['"].*(?:urllib|requests|http|socket|subprocess|os\.environ|os\.getenv)/.test(cmd) ||
      /node\s+(?:-e|--eval|-p)\s+['"].*(?:https?|fetch|axios|net\.Socket|child_process|require\(\s*['"]net['"]\s*\)|net\.connect|process\.env)/.test(cmd),
    reason: 'Safety Gate: python3/node経由のネットワーク通信・環境変数漏洩バイパス試行を検出',
  },
  {
    // osascript / security コマンドによるキーチェーンアクセス（macOS）
    // CRIT-A: フルパス(/usr/bin/osascript)・シェルラッパー(bash -c "osascript ...") 対応
    // CRIT-D: dump-keychain / list-keychains / show-keychain-info などの全操作をブロック
    test: (cmd) =>
      /(?:^|[|;&\s`(]|sudo\s+)(?:(?:\/[^\s|;&`]*\/)?osascript)/i.test(cmd.trim()) ||
      /(?:bash|sh)\s+-c\s+['"][^'"]*\bosascript\b/i.test(cmd) ||
      /(?:^|[|;&\s`(]|sudo\s+)(?:(?:\/[^\s|;&`]*\/)?security)\s+(?:find|add|delete|import|export|dump|list|show)/i.test(cmd.trim()),
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
    // AUDIT-FIX: バックティック形式 eval `curl ...` も検知
    test: (cmd) =>
      /eval\s+["'`]?\$\((?:curl|wget)/.test(cmd) ||
      /eval\s+["'][^'"]*(?:curl|wget)/.test(cmd) ||
      /eval\s+`[^`]*(?:curl|wget)/i.test(cmd),
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
  {
    // 本番DB接続文字列の使用 — ローカルIP・RFC 1918プライベートIP以外の接続文字列は本番環境の可能性
    // 個人情報保護法: 本番データへのアクセスは第三者提供に該当するリスク
    // HIGH-6: RFC 1918 private IP ranges (10.x, 172.16-31.x, 192.168.x) を開発環境として許可
    test: (cmd) =>
      /(?:postgresql|mysql|mongodb|redis):\/\/[^:]+:[^@]+@(?!localhost|127\.0\.0\.1|0\.0\.0\.0|(?:10|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.)/i.test(cmd) ||
      /(?:DATABASE_URL|DB_URL|MONGO_URL|REDIS_URL)\s*=\s*['"]?(?:postgresql|mysql|mongodb|redis):\/\/[^:]+:[^@]+@(?!localhost|127\.0\.0\.1|(?:10|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.)/i.test(cmd),
    reason: 'Safety Gate: 本番DB接続文字列を検出 — 個人情報・機密データへのアクセスは入力禁止情報ポリシーに違反する可能性があります。DATA_PROTECTION.md を確認してください',
  },
  {
    // .envファイルの直接読み取り・パイプ経由エクスフィルトレーション
    // CRIT-E: cat .env | base64 などのパイプ経由漏洩
    // HIGH-2: cat .env.production など直接読み取り（deny list に加えてフックでも検知）
    test: (cmd) =>
      /\bcat\s+[^\n|;&`]*\.env\b/i.test(cmd),
    reason: 'Safety Gate: .envファイルの直接読み取りリスク — シークレット漏洩の危険。ファイル内容が必要な場合は Read ツールを使用してください',
  },
  {
    // .envファイルへの代替読み取りツールによる Safety Gate 回避防止（BYPASS-5）
    // head/tail/tac/less/more/sort + AUDIT-FIX: grep/awk/sed/vi/vim/nano/nl/wc/diff も追加
    test: (cmd) =>
      /\b(?:head|tail|tac|less|more|sort|grep|awk|sed|vi|vim|nano|nl|wc|diff)\s+[^\n|;&`]*\.env\b/i.test(cmd),
    reason: 'Safety Gate: .envファイルの読み取りリスク — シークレット漏洩の危険。ファイル内容が必要な場合は Read ツールを使用してください',
  },
  {
    // 個人情報ファイルの直接読み取り防止（PII-GUARD-1）
    // 顧客リスト、採用候補者、従業員データ等の個人情報を含む可能性が高いファイルを
    // cat/head/tail 等の Bash コマンドで読み取ることをブロックする。
    // 個人情報保護法: AI への入力は第三者提供に該当する可能性がある。
    test: (cmd) =>
      /\b(?:cat|head|tail|tac|less|more|sort|grep|awk|sed|nl|wc|diff|strings|xxd|od|hexdump)\s+[^\n|;&`]*(?:customer|候補者|applicant|candidate|employee|payroll|salary|personal|pii|顧客|従業員|給与|採用)/i.test(cmd),
    reason: 'Safety Gate: 個人情報ファイルの読み取りリスク — 顧客・候補者・従業員データは Claude Code への入力が禁止されています。マスキング後のデータを使用してください。詳細: _common/DATA_PROTECTION.md',
  },
  {
    // CSV/XLSX ファイルの Bash 読み取り警告（PII-GUARD-2）
    // CSVやExcelファイルは個人情報を含むことが多いため、Bash コマンドでの読み取りをブロック。
    // 正当なCSV読み取りは Read ツール経由（deny ルールで保護）で行う。
    test: (cmd) =>
      /\b(?:cat|head|tail|tac|less|more|sort|nl|wc)\s+[^\n|;&`]*\.(?:csv|xlsx?|tsv)\b/i.test(cmd),
    reason: 'Safety Gate: CSV/Excelファイルの読み取りリスク — これらのファイルは個人情報を含む可能性があります。/data-guard で事前チェックし、マスキング済みデータを使用してください。詳細: _common/DATA_PROTECTION.md',
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
  // AUDIT-FIX: git add -u/--update stages all tracked modified files (same risk as -A for existing files)
  /git\s+add\s+(-u|--update)\b/,
  /rm\s+.*(-[a-zA-Z]*f|-[a-zA-Z]*r|--force|--recursive)/,
  // MED-5 fix: --force-with-lease is safe, only flag plain --force
  /git\s+push\s+.*--force(?!-with-lease)/,
  /git\s+push\s+.*-f\b/,
  /git\s+reset\s+--hard/,
  // AUDIT-FIX: git checkout . / git restore . promoted from MEDIUM (same effect: discards all uncommitted changes)
  /git\s+checkout\s+\./,
  /git\s+restore\s+\./,
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
  /curl\s+.*(?:-[dD]\b|--data(?:-[a-z]+)?\b)/,  // curl with POST data flags (-b cookie is excluded)
  /wget\s+.*--post/i,
];

const MEDIUM_RISK_PATTERNS = [
  /git\s+push/,
  /git\s+commit/,
  /git\s+merge/,
  /git\s+rebase/,
  // AUDIT-FIX: promoted to HIGH (same destructive effect as git reset --hard which is HIGH)
  // /git\s+checkout\s+\./,  // moved to HIGH_RISK_PATTERNS
  // /git\s+restore\s+\./,   // moved to HIGH_RISK_PATTERNS
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

    // 0. GlassWorm/Trojan Source: 不可視Unicode文字の検知 (SEC-014)
    if (INVISIBLE_UNICODE_RE.test(cmd)) {
      return { level: 'BLOCK', reason: 'Safety Gate: 不可視Unicode文字を検出（GlassWorm/Trojan Source攻撃の可能性）— コマンドに目視不可能な制御文字が含まれています' };
    }

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

  // Write/Edit tools - GlassWorm check + MEDIUM + file ownership context injection
  if (['Write', 'Edit', 'NotebookEdit'].includes(toolName)) {
    // SEC-014: Write/Edit 内容の不可視Unicode文字チェック
    const contentToCheck = (toolInput.content || '') + (toolInput.new_string || '');
    if (INVISIBLE_UNICODE_RE.test(contentToCheck)) {
      return { level: 'BLOCK', reason: 'Safety Gate: 書き込み内容に不可視Unicode文字を検出（GlassWorm/Trojan Source攻撃の可能性）— コードに目視不可能な制御文字が含まれています' };
    }

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
      // Silent pass-through + DATA PROTECTION reminder (survives context compression)
      const result = {
        decision: 'approve',
        additionalContext: additionalContext
          ? additionalContext + '\n' + DATA_PROTECTION_REMINDER
          : DATA_PROTECTION_REMINDER,
      };
      process.stdout.write(JSON.stringify(result));
    } else {
      // MEDIUM / HIGH: ask user + DATA PROTECTION reminder
      const indicator = level === 'HIGH' ? '🔴' : '🟡';
      const result = {
        decision: 'ask_user',
        reason: indicator + ' ' + level + ' RISK: ' + reason,
        additionalContext: additionalContext
          ? additionalContext + '\n' + DATA_PROTECTION_REMINDER
          : DATA_PROTECTION_REMINDER,
      };
      process.stdout.write(JSON.stringify(result));
    }
  } catch (_e) {
    // === Fail-Open Design Rationale (X-1 / S-1) ===
    // パースエラー時は approve を返す（fail-open）。
    //
    // 根拠:
    // 1. Hook がクラッシュ（stdout なし）すると Claude Code 全体が停止し、
    //    ユーザーの作業が完全にブロックされる（可用性の喪失）
    // 2. パースエラーはフック自体のバグや stdin の不正な JSON が原因であり、
    //    攻撃者が意図的に引き起こすには Claude Code の内部プロトコルの知識が必要
    // 3. fail-open しても Layer 1（Sandbox）と Layer 2（Permissions）が
    //    独立して機能するため、壊滅的なバイパスにはならない（多層防御の原則）
    //
    // リスク受容:
    // - Hook 層（Layer 3）が一時的に無効化されるリスクを受容する
    // - Layer 1 + Layer 2 が残存するため、rm -rf /, sudo, curl 等は
    //   Permissions の deny で引き続きブロックされる
    process.stdout.write(JSON.stringify({ decision: 'approve' }));
  }
});
