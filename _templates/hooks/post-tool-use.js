// PostToolUse Hook
// ツール実行結果をキャプチャし、エージェントメモリとツールログに記録する
// J-SOX 対応: ハッシュチェーンによる改ざん防止、ログローテーション

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function getInput() {
  try {
    return JSON.parse(fs.readFileSync("/dev/stdin", "utf8"));
  } catch (_e) {
    return null;
  }
}

function main() {
  const input = getInput();
  if (!input) {
    // Parse error → continue to avoid blocking
    console.log(JSON.stringify({ continue: true }));
    return;
  }
  const { tool_name, tool_input, tool_output, session_id } = input;

  // ツールログに出力
  const logDir = path.join(process.cwd(), ".context");
  const logFile = path.join(logDir, "tool-log.jsonl");

  // --- ハッシュチェーンによる改ざん防止 (O-1 fix) ---
  // 前エントリのハッシュ値を次エントリに含めることで、改ざんを検知可能にする
  let prevHash = '0000000000000000000000000000000000000000000000000000000000000000';
  try {
    if (fs.existsSync(logFile)) {
      const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n');
      if (lines.length > 0 && lines[lines.length - 1]) {
        const lastEntry = JSON.parse(lines[lines.length - 1]);
        prevHash = lastEntry._hash || prevHash;
      }
    } else {
      // ローテーション後: チェーンファイルから前ハッシュを引き継ぐ（証跡連続性の維持）
      const chainFile = path.join(logDir, '.hash-chain-prev');
      if (fs.existsSync(chainFile)) {
        prevHash = fs.readFileSync(chainFile, 'utf8').trim() || prevHash;
      }
    }
  } catch (_e) { /* first entry or corrupted — start fresh chain */ }

  const logEntry = {
    timestamp: new Date().toISOString(),
    session_id: session_id || "unknown",
    // J-SOX: operator identity and project context for 7-year audit trail
    operator: process.env.USER || process.env.USERNAME || "unknown",
    project: path.basename(process.cwd()),
    // O-3 fix: environment identification for 4W1H completeness
    environment: process.env.NODE_ENV || process.env.ENVIRONMENT || "development",
    tool: tool_name,
    input_summary: summarizeInput(tool_name, tool_input),
    success: !tool_output?.error,
    _prev_hash: prevHash,
  };

  // Calculate hash of this entry (excluding _hash field itself)
  logEntry._hash = crypto.createHash('sha256').update(JSON.stringify(logEntry)).digest('hex');

  // MED-7 fix: wrap filesystem ops in try/catch — crash on unwritable log
  // would emit no stdout (exit 1), potentially stalling the hook framework.
  try {
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    // --- ログローテーション (O-2 fix) ---
    // 保存期間ポリシー: アクティブログは最大5MB、超過時は日付付きでアーカイブ
    // アーカイブログは最低1年間、推奨3年以上保存（削除は手動または外部ツールで管理）
    const MAX_LOG_BYTES = 5 * 1024 * 1024; // 5MB
    try {
      const stats = fs.statSync(logFile);
      if (stats.size > MAX_LOG_BYTES) {
        const archiveName = `tool-log.${new Date().toISOString().slice(0, 10)}.jsonl`;
        const archivePath = path.join(logDir, archiveName);
        // ハッシュチェーン連結: アーカイブの最終ハッシュを引き継ぎファイルに保存
        // 新しいログファイルの初回エントリはこのハッシュから連結される
        const chainFile = path.join(logDir, '.hash-chain-prev');
        fs.writeFileSync(chainFile, prevHash);
        fs.renameSync(logFile, archivePath);
      }
    } catch (_statErr) { /* file doesn't exist yet */ }

    fs.appendFileSync(logFile, JSON.stringify(logEntry) + "\n");
  } catch (_writeErr) {
    // Log write failure is non-critical — continue without blocking
  }

  // --- PII 出力検知（PII-GUARD-3: 出力防御） ---
  // ツール出力に個人情報パターンが含まれている場合、additionalContext で警告を注入する。
  // 個人情報がAIのコンテキストに混入した可能性を利用者に即時通知する。
  const outputText = typeof tool_output === 'string' ? tool_output : JSON.stringify(tool_output || '');
  const PII_WARNING = detectPII(outputText);

  if (PII_WARNING) {
    console.log(JSON.stringify({
      continue: true,
      additionalContext: PII_WARNING,
    }));
  } else {
    // 結果を返す（ブロックしない）
    console.log(JSON.stringify({ continue: true }));
  }
}

function summarizeInput(toolName, input) {
  if (!input) return "";
  switch (toolName) {
    case "Read":
      return input.file_path || "";
    case "Edit":
      return input.file_path || "";
    case "Write":
      return input.file_path || "";
    case "Bash":
      return (input.command || "").substring(0, 100);
    case "Grep":
      return input.pattern || "";
    case "Glob":
      return input.pattern || "";
    default:
      return JSON.stringify(input).substring(0, 100);
  }
}

/**
 * PII（個人情報）パターン検知 — ツール出力に個人情報が含まれていないかチェック
 * 検知した場合は警告メッセージを返す。検知しなかった場合は null を返す。
 *
 * 注意: 誤検知を最小化するため、複数パターンの同時検出（AND条件）を採用。
 * 単一の電話番号やメールアドレスだけでは警告しない（コード内のサンプル等に対応）。
 * 複数種類のPIIが同時に出力された場合に警告する。
 */
function detectPII(text) {
  if (!text || text.length < 50) return null;

  // 検査対象を先頭20KBに限定（パフォーマンス保護）
  const sample = text.substring(0, 20480);

  const patterns = {
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    jpPhone: /0[0-9]{1,4}-[0-9]{1,4}-[0-9]{3,4}/g,
    intlPhone: /\+\d{1,3}[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g,
    myNumber: /\d{4}\s?\d{4}\s?\d{4}/g,
    creditCard: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    jpAddress: /[都道府県].{1,4}[市区町村郡].{1,10}[0-9０-９]+/g,
  };

  let detectedTypes = 0;
  const detectedNames = [];

  for (const [name, regex] of Object.entries(patterns)) {
    const matches = sample.match(regex);
    // 3件以上のマッチで「データセット」と判断（単発のサンプルコードは除外）
    if (matches && matches.length >= 3) {
      detectedTypes++;
      detectedNames.push(name);
    }
  }

  // 2種類以上のPIIパターンが検出された場合、または1種類でも大量（10件以上）検出された場合
  if (detectedTypes >= 2) {
    return `⚠️ PII検出警告: ツール出力に個人情報パターンを検出しました（${detectedNames.join(', ')}）。` +
      'この出力にはマスキングが必要な個人情報が含まれている可能性があります。' +
      '個人情報を含むデータは Claude Code への入力が禁止されています。' +
      '詳細: _common/DATA_PROTECTION.md';
  }

  // 単一種類でも大量検出
  for (const [name, regex] of Object.entries(patterns)) {
    const matches = sample.match(regex);
    if (matches && matches.length >= 10) {
      return `⚠️ PII検出警告: ツール出力に大量の個人情報パターンを検出しました（${name}: ${matches.length}件）。` +
        'この出力にはマスキングが必要な個人情報が含まれている可能性があります。' +
        '詳細: _common/DATA_PROTECTION.md';
    }
  }

  return null;
}

main();
