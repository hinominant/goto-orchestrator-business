// Stop Hook
// セッション終了時にサマリをエージェントメモリに書き込み、Activity Log を更新する

const fs = require("fs");
const path = require("path");

function getInput() {
  return JSON.parse(fs.readFileSync("/dev/stdin", "utf8"));
}

function main() {
  const input = getInput();
  const { session_id, stop_reason } = input;

  // ツールログからセッションサマリを生成
  const logFile = path.join(process.cwd(), ".context", "tool-log.jsonl");

  if (fs.existsSync(logFile)) {
    const lines = fs.readFileSync(logFile, "utf8").trim().split("\n");
    const sessionLogs = lines
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter((l) => l && l.session_id === session_id);

    if (sessionLogs.length > 0) {
      const summary = {
        session_id,
        stop_reason,
        timestamp: new Date().toISOString(),
        tool_count: sessionLogs.length,
        tools_used: [...new Set(sessionLogs.map((l) => l.tool))],
        errors: sessionLogs.filter((l) => !l.success).length,
      };

      // セッションサマリを記録
      const summaryDir = path.join(process.cwd(), ".context", "sessions");
      if (!fs.existsSync(summaryDir)) {
        fs.mkdirSync(summaryDir, { recursive: true });
      }
      const summaryFile = path.join(
        summaryDir,
        `${new Date().toISOString().split("T")[0]}.jsonl`
      );
      fs.appendFileSync(summaryFile, JSON.stringify(summary) + "\n");
    }
  }

  console.log(JSON.stringify({ continue: true }));
}

main();
