// PreToolUse Hook: Tool Risk Assessment
// ツール実行前にリスクを評価し、高リスク操作をブロックまたは警告する

const fs = require("fs");

function getInput() {
  return JSON.parse(fs.readFileSync("/dev/stdin", "utf8"));
}

function main() {
  const input = getInput();
  const { tool_name, tool_input } = input;

  const risk = assessRisk(tool_name, tool_input);

  if (risk.level === "BLOCK") {
    console.log(
      JSON.stringify({
        decision: "block",
        reason: risk.reason,
      })
    );
    return;
  }

  const result = { decision: "allow" };

  // additionalContext でツール実行にコンテキストを注入
  if (risk.additionalContext) {
    result.additionalContext = risk.additionalContext;
  }

  console.log(JSON.stringify(result));
}

function assessRisk(toolName, input) {
  // ARIS NO Gate パターン
  const noGatePatterns = [
    {
      // ユーザー安全性: 個人情報の外部送信
      test: () =>
        toolName === "Bash" &&
        input?.command &&
        /curl.*(-d|--data)/.test(input.command) &&
        /(password|secret|token|api_key|credential)/i.test(input.command),
      reason: "NO Gate: 認証情報の外部送信リスク",
      level: "BLOCK",
    },
    {
      // 破壊的操作
      test: () =>
        toolName === "Bash" &&
        input?.command &&
        /(rm\s+-rf\s+[\/~]|DROP\s+(TABLE|DATABASE)|git\s+push\s+.*--force\s+.*main)/i.test(
          input.command
        ),
      reason: "NO Gate: 破壊的操作の検出",
      level: "BLOCK",
    },
    {
      // コスト制御不能: 大量API呼び出し
      test: () =>
        toolName === "Bash" &&
        input?.command &&
        /(while\s+true|for\s+.*in\s+\$\(seq\s+\d{4,})/i.test(input.command),
      reason: "NO Gate: 無制限ループによるコスト制御不能リスク",
      level: "BLOCK",
    },
  ];

  for (const pattern of noGatePatterns) {
    try {
      if (pattern.test()) {
        return { level: pattern.level, reason: pattern.reason };
      }
    } catch {
      // Pattern evaluation error, skip
    }
  }

  // File ownership context injection
  if (
    (toolName === "Edit" || toolName === "Write") &&
    input?.file_path
  ) {
    return {
      level: "ALLOW",
      additionalContext: `Editing ${input.file_path}. Ensure file ownership rules are respected per _common/PARALLEL.md.`,
    };
  }

  return { level: "ALLOW" };
}

main();
