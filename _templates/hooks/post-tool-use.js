// PostToolUse Hook
// ツール実行結果をキャプチャし、エージェントメモリとツールログに記録する

const fs = require("fs");
const path = require("path");

function getInput() {
  return JSON.parse(fs.readFileSync("/dev/stdin", "utf8"));
}

function main() {
  const input = getInput();
  const { tool_name, tool_input, tool_output, session_id } = input;

  // ツールログに出力
  const logDir = path.join(process.cwd(), ".context");
  const logFile = path.join(logDir, "tool-log.jsonl");

  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const logEntry = {
    timestamp: new Date().toISOString(),
    session_id: session_id || "unknown",
    tool: tool_name,
    input_summary: summarizeInput(tool_name, tool_input),
    success: !tool_output?.error,
  };

  fs.appendFileSync(logFile, JSON.stringify(logEntry) + "\n");

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
