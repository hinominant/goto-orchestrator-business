# Tool Risk Management Protocol

> 3-Hook体制によるツール実行の安全管理。

---

## 3-Hook Architecture

| Hook | Phase | Purpose |
|------|-------|---------|
| `tool-risk.js` (PreToolUse) | 実行前 | リスク評価・ブロック判定 |
| `post-tool-use.js` (PostToolUse) | 実行後 | 結果キャプチャ・ログ記録 |
| `stop-hook.js` (Stop) | 終了時 | セッションサマリ・メモリ永続化 |

---

## PreToolUse: tool-risk.js

### リスク評価
ツール実行前にリスクレベルを評価し、高リスク操作をブロックまたは警告。

### ARIS NO Gate パターン
以下のパターンを検知した場合、自動ブロック:

| Pattern | Trigger | Action |
|---------|---------|--------|
| ユーザー安全性リスク | 個人情報の外部送信、認証情報の露出 | BLOCK |
| 信頼低下リスク | 本番データの直接操作、未テストのデプロイ | BLOCK |
| コスト制御不能 | 大量API呼び出し、無制限ループ | BLOCK |
| 破壊的操作 | `rm -rf`, `DROP TABLE`, force push | WARN + 確認 |

### additionalContext
`output.additionalContext` フィールドでツール実行にコンテキストを注入:
```json
{
  "decision": "allow",
  "additionalContext": "This file is owned by teammate-backend. Respect file ownership."
}
```

---

## PostToolUse: post-tool-use.js

- ツール実行結果を `.context/tool-log.jsonl` に記録
- エラーパターンの検出と蓄積

---

## Stop: stop-hook.js

- セッション終了時にツール使用サマリを生成
- `.context/sessions/YYYY-MM-DD.jsonl` に永続化
- `.agents/PROJECT.md` Activity Log 更新

---

## インストール

```bash
install.sh --with-hooks
```

3つのhookファイルが `.claude/hooks/` にコピーされる。
