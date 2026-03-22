## プラン・導入前提

### Q: 個人プランで業務利用してもいいか

A: **禁止です。** 個人プラン（claude.ai 無料・Pro）は業務利用禁止です。

理由:
- 個人プランではデータが学習に使われる可能性がある
- IPO審査・コンプライアンス審査で問題になる
- 個人情報保護法上の「第三者提供」管理が不十分になる

業務利用は必ず **Claude.ai for Work（Team プラン以上）** を使用してください。
Team / Enterprise プランでは入力データが学習に使用されません。

---

# よくある質問（FAQ）

## セッション管理

### Q: コンテキストが切れて、エージェントが前の作業を忘れた

A: コンテキスト圧縮が発生しています。Claude Code は自動で復帰を試みますが、以下を確認してください:

1. `.agents/PROJECT.md` の Activity Log に前の作業が記録されているか
2. `git log` で直近のコミットを確認
3. 必要なら手動で状況を伝え直す

### Q: エージェントが勝手にコミットした

A: Permissions 設定（`.claude/settings.json`）で `git commit` を deny リストに入れることで防止できます。
または、CLAUDE.md に「コミットはユーザーの明示的な指示があるまで行わない」と記載してください。

## セキュリティ

### Q: シークレットキーが漏洩しないか

A: 複数のレイヤーで保護されています:

1. **Tool Risk Hooks**: `install.sh --with-hooks` で導入される PreToolUse Hook が、ツール実行前にリスクを4段階（BLOCK/HIGH/MEDIUM/LOW）で分類。BLOCK は即時拒否、HIGH は確認ダイアログ
2. **Secret Detection**: `.env`, `.env.production`, `.env.local`, `.envrc` 等、全 `.env` 変種の `git add` を Safety Gate でブロック
3. **Exfiltration Prevention**: `cp .env /tmp/`, `base64 .env`, `xxd .env` 等のエンコーディング経由の漏洩も HIGH リスクに分類
4. **Permissions 設定**: `settings.json` で許可するコマンドをホワイトリスト管理。想定外のコマンド実行を防止
5. エージェントは認証情報をコード内にハードコードしないよう訓練されています

### Q: エージェントが本番環境に影響を与えないか心配

A: 以下のガードレールが設定されています:
- `.claude/settings.json` の deny リストで危険なコマンドをブロック（`rm -rf`、`sudo`、`git push --force` 等）
- PROJECT_CONTEXT.md で本番 DB は READ ONLY のみと明記可能
- ガードレール L4（critical_security）で即時停止
- Tool Risk Hooks で破壊的操作を事前検出

### Q: API キーやパスワードが漏れないか

A: `.claude/settings.json` で `.env` ファイルの `git add` を deny しています。
加えて、`--with-hooks` オプションで導入される PostToolUse Hook がツール実行後のログを記録し、意図しない情報流出を検出できます。

### Q: Hooks（フック）とは何か

A: LM Orchestrator が提供する4-Hook体制（4つのフック）:

| Hook | タイミング | 役割 |
|------|-----------|------|
| PreToolUse (tool-risk.js) | ツール実行前 | リスク分類（BLOCK/HIGH/MEDIUM/LOW）と確認 |
| PostToolUse (post-tool-use.js) | ツール実行後 | 実行ログの記録（`.context/tool-log.jsonl`） |
| Elicitation (elicitation-guard.js) | MCPリクエスト時 | インジェクション攻撃の検知・ブロック |
| Stop (stop-hook.js) | セッション終了時 | セッションサマリの出力 |

`install.sh --with-hooks` で有効化されます。セキュリティ重視のプロジェクトでは導入を強く推奨します。

### Q: BLOCK と HIGH の違いは何か

A:
- **BLOCK**: ユーザーに確認なく即座に実行を拒否する。`rm -fr /`, `.env` の git add, `curl | bash` 等、被害が壊滅的または回復不能な操作が対象
- **HIGH**: 確認ダイアログを表示し、ユーザーが明示的に承認した場合のみ実行される。`git push --force`, `DROP TABLE`, `docker system prune` 等が対象

```
BLOCK → 実行不可（ユーザー承認不可）
HIGH  → 確認ダイアログ → ユーザーが「yes」で実行 / 「no」でキャンセル
```

### Q: git add -A や git add . でも .env がコミットされないか心配

A: `git add -A` と `git add .` は **HIGH リスク**に分類され、確認ダイアログが表示されます。エージェントがこれらのコマンドを実行しようとすると「大量ステージング（.env が含まれる可能性）」という警告が出ます。

さらに、`git add .env`, `git add .env.production`, `git add .envrc` 等の特定 `.env` ファイルの直接ステージングは **BLOCK**（即時拒否）されます。

### Q: git push --force-with-lease は安全か

A: はい。`git push --force-with-lease` は HIGH リスクリストから**除外されています**（通常の `--force` とは別扱い）。

`--force-with-lease` は「リモートに自分が知らないコミットがあれば自動的に失敗する」という安全機構を持ちます。`--force` で発生するチームメンバーの作業上書きを防止できるため、`--force` の安全な代替手段として推奨されます。

### Q: MCPサーバーのプロンプトインジェクションを検知できるか

A: `elicitation-guard.js` が Elicitation ペイロードの**全フィールド**をスキャンします。`title`, `description`, `properties` 等の UI フィールドに注入されたコマンドも検知します（`prompt`/`message`/`content` だけでなく `JSON.stringify(data)` 全体をスキャン）。

検知パターン:
- "execute the following" / "以下のコマンドを実行"
- curl/wget への外部送信指示
- process.env / os.environ + print の組み合わせ
- AWS/GitHub/GCP API キーパターン
- base64 エンコードされた隠し指示（閾値 20 文字、短いペイロードも検知）

### Q: .env の内容が base64/xxd/cp で迂回されないか

A: 以下の操作を HIGH リスクに分類して確認ダイアログを表示します:

- `cp .env /tmp/leaked` — .env のコピー
- `mv .env /tmp/leaked` — .env の移動
- `base64 .env` — エンコード経由の読み取り
- `xxd .env`, `od .env`, `strings .env` — バイナリ/16進ダンプ

これらの操作には確認ダイアログが表示され、エージェントが自動実行することを防止します。`less .env` や `head .env` 等はフックではカバーされず、settings.json の `Read(.env)` deny ルールで対応します。

### Q: フックがクラッシュした場合どうなるか

A: 各フックはクラッシュ耐性を持つよう設計されています:

- **PreToolUse (tool-risk.js)**: JSON パースエラー → `approve`（ブロックせず通過）で可用性を確保
- **PostToolUse (post-tool-use.js)**: ログファイルへの書き込みに失敗（権限エラー等）→ try/catch で吸収し `continue: true` を返して実行を継続
- **Elicitation (elicitation-guard.js)**: パースエラー → `approve`（正当なリクエストをブロックしない）

ただし、PreToolUse の Safety Gate パターンは JSON パースに成功した場合に評価されるため、JSONが壊れた入力では Safety Gate は機能しません（この場合 `approve` になります）。

## エージェント選択

### Q: どのエージェントを使えばいいかわからない

A: [エージェント選択ガイド](./AGENT_SELECTION.md) を参照してください。
迷ったら `/nexus` に任せると、タスクに応じて最適なチェーンを自動選択します。

### Q: エージェントの出力が期待と違う

A: 以下を試してください:
1. タスクの説明をより具体的にする
2. 期待する出力形式を明示する
3. CLAUDE.md にプロジェクト固有のルールを追記する

## コスト・パフォーマンス

### Q: どれくらいのコストがかかる？

A: Claude Code の利用料金は Anthropic のプラン（Max $100/200）に含まれます。
追加コストが発生するのは:
- GitHub Codespaces を使用する場合（$0.18〜0.72/時間）
- 外部 API を利用するエージェント

### Q: エージェントの処理が遅い

A: 以下を確認してください:
1. 不要に大きなモデルを使っていないか（Haiku で十分なタスクに Opus を使っていないか）
2. 並列実行（Rally）で分散できないか
3. Cloud 実行（Codespaces）でオフロードできないか
