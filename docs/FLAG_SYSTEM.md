# Flag System — リアルタイムアラートシステム仕様書

> Version: 1.1.0
> Last Updated: 2026-03-20
> Status: ACTIVE

---

## 1. フラグシステム概要

フラグシステムは、Claude Code の操作中に発生するリスク・異常・注意事項をリアルタイムで検知し、ユーザーに通知するアラートシステムである。

LM-orchestrator-business の Security-First 設計思想の中核を担い、`tool-risk.js` Hook、`safety-check` スキル、`secret-scan` スキル、Guardrail L1-L4 と連携して動作する。

### フラグレベル定義

| Level | Icon | Name | Action | 対応するHook Decision |
|-------|------|------|--------|----------------------|
| RED | :red_circle: | 即座にブロック/停止 | 操作を自動ブロックし、安全な代替案を提示 | `{ decision: "block" }` |
| YELLOW | :yellow_circle: | 警告 + 確認要求 | ユーザーに影響範囲を説明し、明示的な承認を要求 | `{ decision: "ask_user" }` |
| GREEN | :green_circle: | 情報通知 / 推奨 | 操作は通過させつつ、推奨アクションを通知 | `{ additionalContext: "..." }` |

### 設計原則

1. **False negative ゼロ** — 危険な操作を見逃すよりも、過検知で止める方を選択
2. **3秒以内に判定** — フラグ評価がユーザー体験を阻害しない
3. **回復パスを必ず提示** — ブロック/警告時は「次に何をすべきか」を明示
4. **カスタマイズ可能** — プロジェクト固有のルールを追加・上書き可能

---

## 2. フラグカテゴリ

### SEC（セキュリティフラグ）

シークレット漏洩、認証情報の不正露出、機密ファイルへの不正アクセスを検知する。

| ID | Name | Level | Trigger | Action | Recovery Path |
|----|------|-------|---------|--------|---------------|
| SEC-F001 | シークレット検出 | :red_circle: RED | コード/コマンドに API キー・トークン・パスワードがハードコードされている | ブロック + 環境変数化を提案 | 1. 値を `.env` に移動 2. `process.env.XXX` で参照 3. `.gitignore` に `.env` を追加 |
| SEC-F002 | .env コミット | :red_circle: RED | `git add .env` または `git add -A` で `.env` がステージングされる | ブロック + `.gitignore` 追加を提案 | 1. `git reset HEAD .env` 2. `.gitignore` に `.env` 追加 3. `git add .gitignore` |
| SEC-F003 | 認証情報外部送信 | :red_circle: RED | `curl`/`wget` でシークレットを含むデータを外部エンドポイントに送信 | ブロック | 1. 認証情報を環境変数から読み込む 2. `--data-binary @file` でファイル経由送信 |
| SEC-F004 | シークレット stdout 出力 | :red_circle: RED | `echo`/`printf`/`cat` でシークレット環境変数を標準出力に出力 | ブロック | 1. マスキング出力 `echo "${VAR:0:4}****"` 2. ログ出力から除外 |
| SEC-F005 | 機密ファイルアクセス | :yellow_circle: YELLOW | `~/.aws/credentials`, `~/.ssh/id_rsa`, `*.pem`, `*.key` 等へのアクセス | 確認要求 + アクセス理由の表示 | 1. 必要最小限のアクセスに限定 2. 読み取り専用で操作 |
| SEC-F006 | ANTHROPIC_BASE_URL 書き換え | :red_circle: RED | ANTHROPIC_BASE_URL の環境変数変更 | ブロック + CVE-2026-21852 警告 | 1. API キーを即座に rotate 2. Claude Code を v2.0.65 以上に更新 |
| SEC-F007 | allow リストバイパス試行 | :yellow_circle: YELLOW | python3 -c / node -e / cat .env 等の検出 | 警告 + allow ルール見直しを提案 | 1. settings.json の allow ルールを精査 2. ワイルドカードを削除 |
| SEC-F008 | 依存関係の脆弱性 | :green_circle: GREEN | `npm audit`, `pip audit` で既知の脆弱性が検出された場合 | 脆弱性レポートの表示 + 更新推奨 | 1. `npm audit fix` 2. 個別パッケージの更新 |
| SEC-F009 | ネットワーク外部通信 | :yellow_circle: YELLOW | 許可リスト外のドメインへの `curl`/`wget`/`ssh` 通信 | 確認要求 + 宛先ドメインの表示 | 1. 許可リストへの追加を検討 2. 通信内容の確認 |
| SEC-F010 | 権限昇格 | :yellow_circle: YELLOW | `sudo`, `chmod 777`, `chown root` 等の権限操作 | 確認要求 + 影響範囲の表示 | 1. 最小権限原則の適用 2. `chmod 755` 等の適切な権限設定 |

#### SEC 検出パターン（正規表現）

```regex
# SEC-F001: ハードコードされたシークレット
(?i)(api[_-]?key|api[_-]?secret|access[_-]?token|auth[_-]?token)\s*[=:]\s*['"]?[A-Za-z0-9_\-]{16,}
AKIA[0-9A-Z]{16}
(?i)(password|passwd|secret|private[_-]?key)\s*[=:]\s*['"]?[^\s'"]{8,}
(?i)(postgres|mysql|mongodb)://[^\s'"]+:[^\s'"]+@
Bearer\s+[A-Za-z0-9_\-\.]{20,}

# SEC-F002: .env コミット
git\s+add\s+.*\.env(?:\s|$)

# SEC-F003: 認証情報外部送信
curl.*(-d|--data).*(password|secret|token|api_key|credential)

# SEC-F004: シークレット stdout 出力
(echo|printf|cat)\s+.*\$\{?([\w]*(?:SECRET|TOKEN|KEY|PASSWORD|API_KEY|PRIVATE)[\w]*)\}?
```

---

### DES（破壊的操作フラグ）

ファイルシステム、データベース、Git 履歴に対する不可逆な操作を検知する。

| ID | Name | Level | Trigger | Action | Recovery Path |
|----|------|-------|---------|--------|---------------|
| DES-F001 | システム破壊 | :red_circle: RED | `rm -rf /`, `rm -rf ~`, `rm -rf /*` | ブロック（例外なし） | 操作自体を禁止。代替案なし |
| DES-F002 | DB 破壊 | :red_circle: RED | `DROP DATABASE`, `DROP TABLE`（本番環境） | ブロック | 1. `RENAME TABLE old TO old_backup` 2. バックアップ確認後に削除 |
| DES-F003 | Git 履歴破壊 | :red_circle: RED | `git push --force` to `main`/`master` | ブロック | 1. `git push --force-with-lease` を使用 2. feature ブランチで force push |
| DES-F004 | ファイル大量削除 | :yellow_circle: YELLOW | `rm -rf <directory>` （ルート/ホーム以外） | 影響範囲（ファイル数・サイズ）表示 + 確認 | 1. `mv dir dir.bak` で退避 2. 確認後に削除 3. `trash` コマンドの使用 |
| DES-F005 | Git 巻き戻し | :yellow_circle: YELLOW | `git reset --hard`, `git checkout -- .`, `git restore .` | 未コミット変更の一覧表示 + 確認 | 1. `git stash` で退避 2. reset 後に `git stash pop` で復元可能 |
| DES-F006 | 公開操作 | :yellow_circle: YELLOW | `npm publish`, `docker push`, `gh release create` | 確認要求 + 公開先の表示 | 1. `npm pack` / `npm publish --dry-run` で事前確認 2. `docker push` 前にタグ確認 |
| DES-F007 | DB データ全削除 | :yellow_circle: YELLOW | `DELETE FROM ... WHERE 1=1`, `TRUNCATE TABLE` | 対象テーブル・行数の表示 + 確認 | 1. `SELECT COUNT(*)` で影響行数確認 2. バックアップ取得後に実行 |
| DES-F008 | Git ブランチ強制削除 | :yellow_circle: YELLOW | `git branch -D`, `git clean -fd` | マージ状態の確認 + 警告 | 1. `git branch -d`（マージ済みのみ削除）を使用 2. `git stash` で退避 |
| DES-F009 | プロセス強制終了 | :yellow_circle: YELLOW | `kill -9`, `pkill -9` | 対象プロセスの確認 + 警告 | 1. まず `kill -15` (SIGTERM) で正常終了を試行 |
| DES-F010 | ディスク直接書き込み | :red_circle: RED | `dd if=`, `mkfs`, `> /dev/sd*` | ブロック | 操作の正当性を確認。通常の開発では不要 |

#### DES 検出パターン（正規表現）

```regex
# DES-F001: システム破壊
rm\s+-rf\s+[\/~]

# DES-F002: DB 破壊
DROP\s+(TABLE|DATABASE)

# DES-F003: Git 履歴破壊
git\s+push\s+.*--force\s+.*(main|master)

# DES-F004: ファイル大量削除
rm\s+.*(-[a-zA-Z]*f|-[a-zA-Z]*r|--force|--recursive)

# DES-F005: Git 巻き戻し
git\s+reset\s+--hard
git\s+checkout\s+--\s+\.
git\s+restore\s+\.

# DES-F006: 公開操作
npm\s+publish
docker\s+push

# DES-F008: Git ブランチ強制削除
git\s+branch\s+-D
git\s+clean\s+-[a-zA-Z]*f
```

---

### COS（コスト/リソースフラグ）

計算リソース、API 呼び出しコスト、実行時間に関するリスクを検知する。

| ID | Name | Level | Trigger | Action | Recovery Path |
|----|------|-------|---------|--------|---------------|
| COS-F001 | 無制限ループ | :red_circle: RED | `while true`, `for ... in $(seq 10000+)` | ブロック | 1. ループに終了条件を追加 2. `timeout` コマンドでラップ |
| COS-F002 | 大量 API 呼び出し | :yellow_circle: YELLOW | 短時間（1分以内）に同一エンドポイントへ10回以上のリクエスト | レート警告 + 確認 | 1. バッチ API の使用 2. レート制限の確認 3. キャッシュの活用 |
| COS-F003 | 大量ファイル処理 | :yellow_circle: YELLOW | `find` + `exec` / `xargs` で1000件以上のファイル処理 | 件数表示 + 確認 | 1. `--dry-run` で事前確認 2. 範囲を限定 |
| COS-F004 | 長時間実行 | :green_circle: GREEN | コマンドが5分以上実行中 | Cloud 移行を推奨 | 1. `scripts/cloud/codespace.sh` で Codespaces 移行 2. バックグラウンド実行 |
| COS-F005 | 大容量ダウンロード | :yellow_circle: YELLOW | `curl`/`wget` で100MB以上のファイルダウンロード | サイズ表示 + 確認 | 1. ストリーミングダウンロード 2. 必要な部分のみ取得 |
| COS-F006 | LINE Push 送信 | :red_circle: RED | LINE Messaging API の push エンドポイントへの呼び出し | ブロック（従量課金） | 1. Reply API を使用 2. テスト環境での確認 |

#### COS 検出パターン（正規表現）

```regex
# COS-F001: 無制限ループ
while\s+true
for\s+.*in\s+\$\(seq\s+\d{4,}\)

# COS-F006: LINE Push 送信
curl.*api\.line\.me.*push
```

---

### QUA（品質フラグ）

コード品質、テスト、型安全性に関するリスクを検知する。

| ID | Name | Level | Trigger | Action | Recovery Path |
|----|------|-------|---------|--------|---------------|
| QUA-F001 | テストスキップ | :yellow_circle: YELLOW | テスト実行なしでコミット（`TEST_POLICY.md` 違反） | テスト実行を要求 | 1. `npm test` / `pytest` を実行 2. テストカバレッジを確認 |
| QUA-F002 | テスト大量失敗 | :yellow_circle: YELLOW | テスト失敗率が50%を超過 | Guardrail L3 発動 → 自動回復 or 待機 | 1. ロールバック 2. Sherpa による再分解 |
| QUA-F003 | 型チェック未実行 | :green_circle: GREEN | TypeScript 変更後に `tsc --noEmit` 未実行 | 型チェック実行を推奨 | 1. `npx tsc --noEmit` を実行 |
| QUA-F004 | lint 違反 | :green_circle: GREEN | lint 未実行で PR 作成 | lint 実行を推奨 | 1. `npm run lint` / `npm run lint:fix` を実行 |
| QUA-F005 | ファイルオーナーシップ違反 | :yellow_circle: YELLOW | 並列実行中に他エージェントが所有するファイルを編集 | 警告 + 操作待機 | 1. ファイルオーナーのエージェントに委譲 2. `_common/PARALLEL.md` のルールを確認 |
| QUA-F006 | Breaking Change | :yellow_circle: YELLOW | 公開 API のシグネチャ変更、export の削除 | 影響分析を要求 | 1. Architect による影響分析 2. マイグレーションガイドの作成 |
| QUA-F007 | テストなしマージ | :yellow_circle: YELLOW | テストファイルを含まない PR のマージ | テスト追加を要求 | 1. 対応するテストファイルの作成 2. `SKIP=FAIL` ポリシーの確認 |
| QUA-F008 | コミットメッセージ不備 | :green_circle: GREEN | コミットメッセージが規約に準拠していない | フォーマット例の提示 | 1. Conventional Commits 形式で再コミット |

---

### CTX（コンテキストフラグ）

セッション管理、トークン予算、エージェント選択に関する注意事項を検知する。

| ID | Name | Level | Trigger | Action | Recovery Path |
|----|------|-------|---------|--------|---------------|
| CTX-F001 | コンテキスト肥大化 | :yellow_circle: YELLOW | トークン使用量が予算の80%を超過 | `SLIM_CONTEXT` 発動を推奨 | 1. 空行・連続スペース除去 2. URL 短縮 3. 重複行除去 4. 末尾トランケート |
| CTX-F002 | セッション長時間化 | :green_circle: GREEN | 60分以上の連続セッション | コンテキスト整理を推奨 | 1. `/compact` でコンテキスト圧縮 2. 新しいセッションで継続 |
| CTX-F003 | エージェント切替推奨 | :green_circle: GREEN | 現タスクに最適でないエージェントを使用中（例: builder でデバッグ） | 最適エージェントの提案 | 1. `docs/AGENT_SELECTION.md` を参照 2. 推奨エージェントに切替 |
| CTX-F004 | PROJECT.md 未更新 | :green_circle: GREEN | 重要な意思決定・進捗があったがメモリが更新されていない | メモリ更新を推奨 | 1. `.agents/PROJECT.md` の Activity Log を更新 |
| CTX-F005 | セッション復帰 | :green_circle: GREEN | 新しいセッションの開始時にコンテキストが未復元 | `CONTEXT_RECOVERY.md` プロトコルの発動 | 1. `.agents/PROJECT.md` の読み込み 2. 直近の git log 確認 |
| CTX-F006 | 重複作業検知 | :yellow_circle: YELLOW | 過去セッションで同一テーマが3回以上検討されている | 過去セッション参照を提案 | 1. 過去セッションの Decision Duplication チェック 2. 過去の結論を再利用 |

---

### ELI（Elicitation フラグ）

MCPサーバーからの情報要求（Elicitation）に隠し指示が含まれていないかを検知する。SEC-P005（MCP Elicitation インジェクション）の対策として機能する。

| ID | Name | Level | Trigger | Action | Recovery Path |
|----|------|-------|---------|--------|---------------|
| ELI-F001 | コマンド実行指示 | :red_circle: RED | "execute the following" / "以下のコマンドを実行" が Elicitation テキストに含まれる | ブロック + MCPサーバー調査を推奨 | 1. MCPサーバーのソースコードを確認 2. 侵害されたサーバーを無効化 |
| ELI-F002 | 外部URL送信指示 | :red_circle: RED | Elicitation に curl/http + send が含まれる | ブロック | 1. MCPサーバーを無効化 2. 漏洩した認証情報を rotate |
| ELI-F003 | 環境変数漏洩指示 | :red_circle: RED | process.env + output の組み合わせが Elicitation に含まれる | ブロック | 1. MCPサーバーを無効化 2. 環境変数の漏洩範囲を確認 |
| ELI-F004 | シークレットパターン検出 | :red_circle: RED | APIキー・トークンパターンが Elicitation に含まれる | ブロック + インシデント対応 | 1. 該当シークレットを即座に rotate 2. インシデント対応プロセスを開始 |
| ELI-F005 | base64 隠し指示 | :red_circle: RED | base64デコード後に危険コマンドが含まれる | ブロック | 1. MCPサーバーのコードを精査 2. サーバーを無効化 |

#### ELI 検出パターン（正規表現）

```regex
# ELI-F001: コマンド実行指示
(?i)(execute\s+the\s+following|以下のコマンドを実行|以下を実行)

# ELI-F002: 外部URL送信指示
(?i)(curl|https?://).*\b(send|transmit|post|upload)\b

# ELI-F003: 環境変数漏洩指示
(?i)process\.env.*\b(output|print|log|send)\b

# ELI-F004: シークレットパターン
(sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{36}|AKIA[0-9A-Z]{16}|xoxb-[0-9]+-[a-zA-Z0-9]+)

# ELI-F005: base64 隠し指示
(?i)base64.*decode.*(curl|exec|eval|sh\s+-c)
```

---

## 3. フラグ通知フォーマット

### RED FLAG フォーマット

```
:red_circle: [SEC-F001] シークレット検出
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
検出: API キーがソースコード内にハードコードされています
場所: src/config.ts:15
パターン: AKIA[0-9A-Z]{16} にマッチ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
対応:
  1. API キーを .env に移動
  2. process.env.API_KEY で参照
  3. .env が .gitignore に含まれていることを確認
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
この操作はブロックされました。
```

### YELLOW FLAG フォーマット

```
:yellow_circle: [DES-F005] Git 巻き戻し
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
検出: git reset --hard が実行されようとしています
影響: 以下の未コミット変更が失われます
  - src/app.ts (modified)
  - src/utils/helper.ts (modified)
  - tests/app.test.ts (new file)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
安全な代替案:
  → git stash で変更を退避してから reset
  → git stash pop で必要に応じて復元可能
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
続行しますか？ [y/N]
```

### GREEN FLAG フォーマット

```
:green_circle: [QUA-F003] 型チェック未実行
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
推奨: TypeScript ファイルが変更されました。
      型チェックの実行を推奨します。
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
コマンド: npx tsc --noEmit
```

---

## 4. フラグ検知アーキテクチャ

```
ユーザー操作 / エージェント操作
         |
         v
    +-------------------+
    |   Flag Engine      | <-- フラグルール評価エンジン
    |                    |
    | +---------------+  |
    | | SEC rules     |  | <-- セキュリティルール (secret-scan連携)
    | +---------------+  |
    | | DES rules     |  | <-- 破壊的操作ルール (safety-check連携)
    | +---------------+  |
    | | COS rules     |  | <-- コスト/リソースルール
    | +---------------+  |
    | | QUA rules     |  | <-- 品質ルール (TEST_POLICY連携)
    | +---------------+  |
    | | CTX rules     |  | <-- コンテキストルール (SLIM_CONTEXT連携)
    | +---------------+  |
    | | ELI rules     |  | <-- Elicitation インジェクション検知
    | +---------------+  |
    +--------+-----------+
             |
             v
    +-------------------+
    |  Action            |
    |  Dispatcher        |
    |                    |
    |  BLOCK      ------> 操作ブロック + 回復パス提示
    |  WARN+ASK   ------> 警告 + 確認ダイアログ
    |  INFORM     ------> 情報通知（操作は通過）
    |  AUTO_FIX   ------> 自動修復トリガー
    +--------+-----------+
             |
             v
    +-------------------+
    |  Flag Logger       |
    |                    |
    |  .context/         |
    |    flags.jsonl     | <-- フラグ発火履歴
    |    retros/         | <-- /retro コマンド連携
    +-------------------+
```

### データフロー詳細

```
1. PreToolUse Phase (tool-risk.js)
   Input: { tool_name, tool_input }
   |
   +--> Safety Gate 評価 (BLOCK patterns)
   |      Match? --> { decision: "block", reason: "SEC-F0xx / DES-F0xx" }
   |
   +--> HIGH Risk 評価
   |      Match? --> { decision: "ask_user", reason: "🔴 RED FLAG: ..." }
   |
   +--> MEDIUM Risk 評価
   |      Match? --> { decision: "ask_user", reason: "🟡 YELLOW FLAG: ..." }
   |
   +--> LOW Risk
          --> { decision: "approve" }

2. PostToolUse Phase (post-tool-use.js)
   Input: { tool_name, tool_input, tool_output }
   |
   +--> GREEN FLAG 評価 (QUA / CTX ルール)
   |      Match? --> { additionalContext: "🟢 推奨: ..." }
   |
   +--> フラグ履歴記録 --> .context/flags.jsonl

3. Stop Phase (stop-hook.js)
   +--> セッション内フラグサマリ生成
   +--> 頻発フラグの傾向分析
```

---

## 5. フラグと Hook の対応

### Hook Phase マッピング

| Flag Level | Hook Phase | Hook Response | tool-risk.js 対応 |
|-----------|------------|---------------|-------------------|
| :red_circle: RED (BLOCK) | PreToolUse | `{ decision: "block", reason: "..." }` | `SAFETY_GATE_PATTERNS` |
| :red_circle: RED (ASK) | PreToolUse | `{ decision: "ask_user", reason: "🔴 ..." }` | `HIGH_RISK_PATTERNS` |
| :yellow_circle: YELLOW | PreToolUse | `{ decision: "ask_user", reason: "🟡 ..." }` | `MEDIUM_RISK_PATTERNS` |
| :green_circle: GREEN | PostToolUse | `{ additionalContext: "推奨: ..." }` | post-tool-use.js |

### Guardrail Level マッピング

| Flag Category | Guardrail Level | 自動回復 |
|--------------|-----------------|---------|
| SEC-F001~F004, SEC-F006, ELI-F001~F005 | L4 (ABORT) | なし — 即時停止 |
| SEC-F005, SEC-F007, SEC-F009, SEC-F010 | L3 (PAUSE) | ユーザー確認待ち |
| DES-F001~F003 | L4 (ABORT) | なし — 即時停止 |
| DES-F004~F009 | L3 (PAUSE) | ユーザー確認待ち |
| QUA-F001~F002 | L2 (CHECKPOINT) | Builder 修正 -> 再テスト (最大3回) |
| QUA-F003~F004 | L1 (MONITORING) | ログのみ |
| CTX-F001 | L2 (CHECKPOINT) | SLIM_CONTEXT 自動発動 |
| CTX-F002~F005 | L1 (MONITORING) | ログのみ |

---

## 6. フラグの実装ポイント

### 6.1 tool-risk.js との連動

`_templates/hooks/tool-risk.js` の `SAFETY_GATE_PATTERNS`, `HIGH_RISK_PATTERNS`, `MEDIUM_RISK_PATTERNS` と各フラグ ID の対応:

```javascript
// SEC-F001: シークレット検出
// → HIGH_RISK_PATTERNS: /(?:curl|wget|http).*(?:Bearer|Basic)\s+[A-Za-z0-9_\-\.]{20,}/i

// SEC-F002: .env コミット
// → SAFETY_GATE_PATTERNS: /git\s+add\s+.*\.env(?:\s|$)/i

// SEC-F003: 認証情報外部送信
// → SAFETY_GATE_PATTERNS: /curl.*(-d|--data)/.test(cmd) && /(password|secret|token|api_key|credential)/i

// SEC-F004: シークレット stdout 出力
// → SAFETY_GATE_PATTERNS: /(echo|printf|cat)\s+.*\$\{?([\w]*(?:SECRET|TOKEN|KEY|PASSWORD|API_KEY|PRIVATE)[\w]*)\}?/i

// DES-F001: システム破壊
// → SAFETY_GATE_PATTERNS: /rm\s+-rf\s+[\/~]/

// DES-F002: DB 破壊
// → SAFETY_GATE_PATTERNS: /DROP\s+(TABLE|DATABASE)/i

// DES-F003: Git 履歴破壊
// → SAFETY_GATE_PATTERNS: /git\s+push\s+.*--force\s+.*main/i

// COS-F001: 無制限ループ
// → SAFETY_GATE_PATTERNS: /while\s+true|for\s+.*in\s+\$\(seq\s+\d{4,})/i
```

### 6.2 settings.json との連動

`_templates/settings.json` の `deny` ルールと RED FLAG の対応:

```json
{
  "permissions": {
    "deny": [
      "rm -rf /",
      "rm -rf ~",
      "DROP DATABASE",
      "git push --force origin main",
      "git push --force origin master"
    ]
  }
}
```

### 6.3 フラグ履歴の記録形式

`.context/flags.jsonl` に以下の形式で記録:

```jsonl
{"ts":"2026-03-19T10:30:00Z","id":"SEC-F001","level":"RED","trigger":"hardcoded API key in src/config.ts:15","action":"BLOCK","session":"abc123"}
{"ts":"2026-03-19T10:35:00Z","id":"DES-F005","level":"YELLOW","trigger":"git reset --hard","action":"ASK_USER","response":"approved","session":"abc123"}
{"ts":"2026-03-19T10:40:00Z","id":"QUA-F003","level":"GREEN","trigger":"TypeScript files modified without tsc","action":"INFORM","session":"abc123"}
```

### 6.4 スキルとの連携

| スキル | 連携フラグ | 連携方法 |
|-------|----------|---------|
| `secret-scan` | SEC-F001~F004, ELI-F004 | シークレット検出パターンの共有 |
| `safety-check` | DES-F001~F010 | リスク分類ロジックの共有 |
| `test-coverage` | QUA-F001~F002 | テストカバレッジ閾値の参照 |
| `spec-compliance` | QUA-F006 | Breaking Change 検出 |

---

## 7. フラグのカスタマイズ

### 7.1 プロジェクト固有フラグの追加

`.agents/PROJECT.md` に `custom_flags` セクションを追加:

```yaml
# Custom Flags
custom_flags:
  - id: PROJ-F001
    name: "本番DB直接接続"
    level: RED
    trigger: "DATABASE_URL に production ホストが含まれる"
    action: "ブロック + ステージング環境の使用を提案"
    recovery: "DATABASE_URL を staging に変更"

  - id: PROJ-F002
    name: "LINE Push 送信"
    level: RED
    trigger: "LINE Messaging API の push エンドポイント呼び出し"
    action: "ブロック（従量課金保護）"
    recovery: "Reply API を使用 / テスト環境での確認"
```

### 7.2 フラグレベルの変更

プロジェクトの要件に応じてフラグレベルをオーバーライド可能:

```yaml
# Flag Level Overrides
flag_overrides:
  DES-F006:
    level: RED       # npm publish を YELLOW -> RED に昇格
    reason: "本プロジェクトは公開パッケージのため、公開操作は必ずブロック"

  QUA-F003:
    level: YELLOW    # 型チェックを GREEN -> YELLOW に昇格
    reason: "TypeScript strict モードを使用。型エラーは品質ブロッカー"
```

### 7.3 特定フラグの無効化

信頼できる環境・ワークフローでは特定フラグを無効化可能:

```yaml
# Flag Suppressions
flag_suppressions:
  - id: SEC-F009         # ネットワーク外部通信の警告を抑制
    reason: "CI/CD環境では外部通信が必須"
    scope: "CI only"     # CI環境のみ抑制

  - id: CTX-F002         # セッション長時間化の通知を抑制
    reason: "大規模リファクタリング中は長時間セッションが前提"
    expires: "2026-04-01" # 有効期限付き
```

> **注意**: RED FLAG の無効化は非推奨。SEC-F001~F004, DES-F001~F003 の無効化は原則禁止。

---

## 8. フラグ統計・振り返り

### 8.1 /retro コマンドとの連携

`/retro` 実行時に `.context/flags.jsonl` からフラグ統計を自動生成:

```json
{
  "flag_summary": {
    "period": "2026-03-13 ~ 2026-03-19",
    "total_flags": 42,
    "by_level": {
      "RED": 3,
      "YELLOW": 15,
      "GREEN": 24
    },
    "by_category": {
      "SEC": 5,
      "DES": 8,
      "COS": 2,
      "QUA": 18,
      "CTX": 9
    },
    "top_flags": [
      { "id": "QUA-F003", "count": 12, "trend": "stable" },
      { "id": "CTX-F002", "count": 8, "trend": "increasing" },
      { "id": "SEC-F005", "count": 3, "trend": "decreasing" }
    ],
    "blocked_operations": 3,
    "user_overrides": 7,
    "auto_recoveries": 5
  }
}
```

### 8.2 頻発フラグの分析

同一フラグが1週間に5回以上発火した場合、以下のアクションを自動提案:

| 頻発パターン | 提案アクション |
|------------|--------------|
| SEC-F001 が頻発 | `secret-scan` スキルの定期実行をワークフローに追加 |
| DES-F005 が頻発 | `git stash` のエイリアス設定を推奨 |
| QUA-F001 が頻発 | pre-commit hook にテスト実行を追加 |
| QUA-F003 が頻発 | `tsc --noEmit` を pre-commit hook に追加 |
| CTX-F001 が頻発 | SLIM_CONTEXT の自動発動閾値を70%に引き下げ |
| CTX-F002 が頻発 | セッション分割の習慣化を推奨 |

### 8.3 フラグ統計フィードバック

フラグ統計は継続的改善のためにフィードバック:

- **成功パターン**: フラグが発火し、ユーザーが操作を中止した = 正しい検知
- **失敗パターン**: フラグが発火したが、ユーザーが常にオーバーライドする = 過検知の可能性
- **盲点パターン**: フラグが発火せず問題が発生した = 検知ルールの追加が必要

```
フラグ発火 → ユーザー応答 → パターン蓄積
    |              |              |
    v              v              v
flags.jsonl    response      パターン辞書
                tracking     (success/failure
                             pattern dictionary)
```

---

## 9. フラグ一覧（クイックリファレンス）

### RED FLAG（即座にブロック）

| ID | Name | Category |
|----|------|----------|
| SEC-F001 | シークレット検出 | セキュリティ |
| SEC-F002 | .env コミット | セキュリティ |
| SEC-F003 | 認証情報外部送信 | セキュリティ |
| SEC-F004 | シークレット stdout 出力 | セキュリティ |
| SEC-F006 | ANTHROPIC_BASE_URL 書き換え | セキュリティ |
| DES-F001 | システム破壊 | 破壊的操作 |
| DES-F002 | DB 破壊 | 破壊的操作 |
| DES-F003 | Git 履歴破壊 | 破壊的操作 |
| DES-F010 | ディスク直接書き込み | 破壊的操作 |
| COS-F001 | 無制限ループ | コスト/リソース |
| COS-F006 | LINE Push 送信 | コスト/リソース |
| ELI-F001 | コマンド実行指示 | Elicitation |
| ELI-F002 | 外部URL送信指示 | Elicitation |
| ELI-F003 | 環境変数漏洩指示 | Elicitation |
| ELI-F004 | シークレットパターン検出 | Elicitation |
| ELI-F005 | base64 隠し指示 | Elicitation |

### YELLOW FLAG（警告 + 確認要求）

| ID | Name | Category |
|----|------|----------|
| SEC-F005 | 機密ファイルアクセス | セキュリティ |
| SEC-F007 | allow リストバイパス試行 | セキュリティ |
| SEC-F009 | ネットワーク外部通信 | セキュリティ |
| SEC-F010 | 権限昇格 | セキュリティ |
| DES-F004 | ファイル大量削除 | 破壊的操作 |
| DES-F005 | Git 巻き戻し | 破壊的操作 |
| DES-F006 | 公開操作 | 破壊的操作 |
| DES-F007 | DB データ全削除 | 破壊的操作 |
| DES-F008 | Git ブランチ強制削除 | 破壊的操作 |
| DES-F009 | プロセス強制終了 | 破壊的操作 |
| COS-F002 | 大量 API 呼び出し | コスト/リソース |
| COS-F003 | 大量ファイル処理 | コスト/リソース |
| COS-F005 | 大容量ダウンロード | コスト/リソース |
| QUA-F001 | テストスキップ | 品質 |
| QUA-F002 | テスト大量失敗 | 品質 |
| QUA-F005 | ファイルオーナーシップ違反 | 品質 |
| QUA-F006 | Breaking Change | 品質 |
| QUA-F007 | テストなしマージ | 品質 |
| CTX-F001 | コンテキスト肥大化 | コンテキスト |
| CTX-F006 | 重複作業検知 | コンテキスト |

### GREEN FLAG（情報通知 / 推奨）

| ID | Name | Category |
|----|------|----------|
| SEC-F008 | 依存関係の脆弱性 | セキュリティ |
| COS-F004 | 長時間実行 | コスト/リソース |
| QUA-F003 | 型チェック未実行 | 品質 |
| QUA-F004 | lint 違反 | 品質 |
| QUA-F008 | コミットメッセージ不備 | 品質 |
| CTX-F002 | セッション長時間化 | コンテキスト |
| CTX-F003 | エージェント切替推奨 | コンテキスト |
| CTX-F004 | PROJECT.md 未更新 | コンテキスト |
| CTX-F005 | セッション復帰 | コンテキスト |

---

## 10. 運用ガイドライン

### フラグレベル昇格基準

以下の条件を満たした場合、フラグレベルを自動昇格:

| 条件 | 昇格 |
|------|------|
| GREEN フラグが1週間に10回以上発火 | GREEN -> YELLOW |
| YELLOW フラグのユーザーオーバーライド率が90%以上 | レベル維持（過検知の調査） |
| RED フラグがバイパスされた（設定変更による） | インシデントログに自動記録 |

### フラグレベル降格基準

| 条件 | 降格 |
|------|------|
| YELLOW フラグが30日間発火ゼロ | YELLOW -> GREEN (候補) |
| GREEN フラグのアクション実行率が10%未満 | 無効化候補として提案 |

### 禁止事項

1. **RED FLAG の一括無効化は禁止** — 個別に正当な理由が必要
2. **SEC カテゴリのフラグを自動承認で降格させない** — 必ず手動レビュー
3. **フラグ履歴の削除は禁止** — 監査証跡として保持
