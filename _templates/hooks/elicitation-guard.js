#!/usr/bin/env node
'use strict';

/**
 * Claude Code Elicitation Hook - MCP Elicitation Injection Guard
 *
 * MCPサーバーからの Elicitation（情報要求）を監視し、
 * プロンプトインジェクション攻撃を検知・ブロックする。
 *
 * 攻撃パターン: MCPサーバーが正当な情報要求を装い、
 * 隠しコマンド実行指示を埋め込む（逆方向インジェクション）
 *
 * Install: ~/.claude/hooks/elicitation-guard.js
 * Settings: ~/.claude/settings.json の hooks.Elicitation に登録
 */

// === Injection Patterns ===

const INJECTION_PATTERNS = [
  {
    // コマンド実行指示
    test: (text) =>
      /(?:execute|run|perform)\s+(?:the\s+)?following/i.test(text) ||
      /以下(?:の(?:コマンド|手順|指示))?を実行/i.test(text),
    reason: 'Elicitation Guard: コマンド実行指示のインジェクション検出',
  },
  {
    // 外部URL へのデータ送信指示
    test: (text) =>
      /send\s+.*\s+to\s+.*(?:url|http|endpoint)/i.test(text) ||
      /(?:curl|wget|fetch|post)\s+.*https?:\/\//i.test(text) ||
      /このURL(?:に|へ).*(?:送信|投稿|送って)/i.test(text),
    reason: 'Elicitation Guard: 外部URLへのデータ送信指示を検出',
  },
  {
    // 環境変数・認証情報の漏洩指示
    test: (text) =>
      /(?:env(?:ironment)?\s+var|\.env|process\.env|os\.environ)/i.test(text) &&
      /(?:send|transmit|output|print|show|display|leak|exfil)/i.test(text),
    reason: 'Elicitation Guard: 環境変数・認証情報の漏洩指示を検出',
  },
  {
    // シークレットキーパターンの検出
    test: (text) => {
      const secretPatterns = [
        /AIza[A-Za-z0-9_\-]{20,}/,    // GCP API Key
        /sk-[A-Za-z0-9]{20,}/,         // OpenAI Key
        /ghp_[A-Za-z0-9]{36,}/,        // GitHub Token
        /AKIA[0-9A-Z]{16}/,            // AWS Access Key
        /Bearer\s+[A-Za-z0-9._\-]{20,}/, // Bearer Token
      ];
      return secretPatterns.some(p => p.test(text));
    },
    reason: 'Elicitation Guard: シークレットキーパターンを検出 — インジェクション疑い',
  },
  {
    // base64 エンコードされた隠し指示
    // HIGH-7 fix: threshold reduced from 40 to 20 chars to catch short payloads
    // (e.g. "curl http://evil.com" = 20 chars, base64 = 28 chars)
    test: (text) => {
      const b64matches = text.match(/[A-Za-z0-9+/]{20,}={0,2}/g);
      if (!b64matches) return false;
      return b64matches.some(m => {
        try {
          const decoded = Buffer.from(m, 'base64').toString('utf8');
          return /(?:curl|wget|rm\s+-rf|eval|exec|system)/i.test(decoded);
        } catch { return false; }
      });
    },
    reason: 'Elicitation Guard: base64エンコードされた隠し指示を検出',
  },
];

// === Main ===

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);

    // HIGH-6 fix: scan ALL fields in the Elicitation payload, not just
    // prompt/message/content. Malicious MCP servers embed injection in
    // title, description, properties, and other structured fields.
    // JSON.stringify covers every field including nested objects.
    const promptText = [
      data.prompt,
      data.message,
      data.content,
      data.title,
      data.description,
      // Fallback: full serialization catches any remaining fields
      JSON.stringify(data),
    ].filter(v => v != null).join(' ');

    // インジェクションパターンのチェック
    for (const pattern of INJECTION_PATTERNS) {
      try {
        if (pattern.test(promptText)) {
          process.stdout.write(JSON.stringify({
            decision: 'block',
            reason: `🚫 ${pattern.reason}\n\n` +
              `MCPサーバーからの Elicitation にインジェクション攻撃の疑いがあります。\n` +
              `このリクエストは安全のためブロックされました。\n` +
              `MCPサーバーの信頼性を確認してください。`,
          }));
          return;
        }
      } catch (_e) {
        // Pattern evaluation error, skip
      }
    }

    // 安全: 許可
    process.stdout.write(JSON.stringify({ decision: 'approve' }));

  } catch (_e) {
    // Parse error → approve to avoid blocking legitimate requests
    process.stdout.write(JSON.stringify({ decision: 'approve' }));
  }
});
