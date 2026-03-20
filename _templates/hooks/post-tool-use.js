// PostToolUse Hook
// ツール実行結果をキャプチャし、エージェントメモリとツールログに記録する

const fs = require("fs");
const path = require("path");

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

  const logEntry = {
    timestamp: new Date().toISOString(),
    session_id: session_id || "unknown",
    tool: tool_name,
    input_summary: summarizeInput(tool_name, tool_input),
    success: !tool_output?.error,
  };

  // MED-7 fix: wrap filesystem ops in try/catch — crash on unwritable log
  // would emit no stdout (exit 1), potentially stalling the hook framework.
  try {
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    fs.appendFileSync(logFile, JSON.stringify(logEntry) + "\n");
  } catch (_writeErr) {
    // Log write failure is non-critical — continue without blocking
  }

  // 結果を返す（ブロックしない）
  console.log(JSON.stringify({ continue: true }));
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

main();
