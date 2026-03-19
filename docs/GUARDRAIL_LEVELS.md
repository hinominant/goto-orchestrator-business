# ガードレールレベル仕様書

> **Version**: 1.0.0
> **Status**: Stable
> **Last Updated**: 2026-03-19
> **Scope**: goto-orchestrator 全エージェント共通

---

## 1. ガードレールシステム概要

ガードレールは、エージェントの自律実行中に品質と安全性を担保する **4段階の安全機構** である。

各レベルは独立して機能し、下位レベルで対処できない問題は上位レベルにエスカレーションされる。L4（即時停止）はいかなるモード・設定でも回避不可であり、これがシステム全体の安全保証の最終砦となる。

### 設計原則

| 原則 | 説明 |
|------|------|
| **Defense in Depth** | 単一レベルの突破がシステム全体の安全を脅かさない多層防御 |
| **Fail Safe** | 判定不能時は上位レベル（より安全な方向）にフォールバック |
| **Least Privilege** | 各レベルで許可される操作は必要最小限 |
| **Audit Trail** | 全ガードレール発動はログに記録。事後検証を可能にする |
| **No Silent Failure** | ガードレール自体の障害も検知・記録する |

### レベル一覧

| Level | 名称 | 対応リスク | ユーザー介入 |
|-------|------|-----------|-------------|
| **L1** | 自動回復（Auto-Recovery） | LOW | 不要 |
| **L2** | 確認要求（Confirmation Required） | MEDIUM | 必要 |
| **L3** | エスカレーション（Escalation） | HIGH | 必要（理由付き） |
| **L4** | 即時停止（Immediate Stop） | CRITICAL | N/A（ブロック） |

---

## 2. ガードレールレベル仕様

### 2.1 L1: 自動回復（Auto-Recovery）

**目的**: 軽微なエラーからの自動回復。人間の介入なしに問題を解消し、タスク実行を継続する。

**対象トリガー**:

| トリガー | 検知条件 | 修復アクション |
|---------|---------|--------------|
| lint エラー | eslint/prettier 警告・エラー | `eslint --fix` / `prettier --write` |
| import 未解決 | TypeScript / Python import エラー | パッケージ install / パス修正 |
| flaky テスト | 同一テストが成功・失敗を繰り返す | リトライ実行（最大3回） |
| フォーマット違反 | コードフォーマッタ差分あり | フォーマッタ自動実行 |
| 型エラー（軽微） | 未使用変数、暗黙の any | 自動修正可能なもののみ |
| ロックファイル不整合 | lock ファイルと node_modules の差分 | `npm ci` / `yarn install --frozen-lockfile` |

**動作シーケンス**:

```
1. エラー検知（PostToolUse hook / テスト実行結果）
2. エラー分類（L1 対象か判定）
3. 修復アクション実行
4. 検証（再実行で成功を確認）
5. ログ記録（.context/guardrail-log.jsonl）
6. 成功 → タスク継続 / 失敗 → リトライ or エスカレーション
```

**パラメータ**:

| Parameter | Value | 説明 |
|-----------|-------|------|
| max_retry | 3 | 同一エラーの最大リトライ回数 |
| retry_interval_sec | 5 | リトライ間隔（指数バックオフなし） |
| timeout_sec | 30 | 1回の修復アクションのタイムアウト |
| user_confirmation | 不要 | 自動実行 |
| log_level | INFO | 情報レベルで記録 |
| escalation_target | L2 | リトライ上限超過時の遷移先 |

**L2 へのエスカレーション条件**:

- 3回リトライしても修復不能
- 修復アクション自体がエラーを返す
- タイムアウト（30秒）超過
- 修復により新たなエラーが発生（修復ループ検知）

---

### 2.2 L2: 確認要求（Confirmation Required）

**目的**: 中程度のリスクがある操作について、ユーザーに影響範囲を説明し、実行可否の確認を得る。

**対象トリガー**:

| トリガー | 検知条件 | 表示内容 |
|---------|---------|---------|
| ファイル変更（5ファイル以上） | Edit/Write 対象が閾値超過 | 変更ファイル一覧と影響範囲 |
| git push | `git push` コマンド検知 | push 先ブランチと含まれるコミット |
| パッケージインストール | `npm install` / `pip install` 等 | パッケージ名・バージョン・依存関係の変化 |
| 外部 API 呼び出し（POST/PUT/DELETE） | HTTP メソッドとエンドポイント | リクエスト内容と想定される副作用 |
| DB マイグレーション実行 | migration コマンド検知 | スキーマ変更内容と影響テーブル |
| 設定ファイル変更 | `*.config.*`, `*.json`, `*.yaml` 等 | 変更前後の diff |

**動作シーケンス**:

```
1. リスク検知（PreToolUse hook → MEDIUM risk 判定）
2. 影響範囲の分析
3. 確認メッセージ表示:
   - 実行しようとしている操作
   - 影響を受けるファイル/サービス
   - ロールバック可能性
4. ユーザーの応答を待つ
   - 承認 → 実行 → 結果検証
   - 拒否 → 代替案を提示
```

**確認メッセージフォーマット**:

```
⚠️ [L2] 確認が必要な操作

操作: {operation_description}
影響範囲: {affected_scope}
ロールバック: {rollback_possibility}

続行しますか？ [y/N]
```

**パラメータ**:

| Parameter | Value | 説明 |
|-----------|-------|------|
| max_retry | 1 | 実行失敗時の再試行（ユーザー承認後） |
| timeout_sec | 120 | ユーザー応答の待機タイムアウト |
| user_confirmation | 必要 | 明示的な承認が必要 |
| log_level | WARN | 警告レベルで記録 |
| escalation_target | L3 | 実行失敗時の遷移先 |

**対応 Hook**: `PreToolUse` (MEDIUM risk)

**L3 へのエスカレーション条件**:

- 承認後の実行が失敗
- 影響範囲が想定を超えた（例: 変更ファイル数が当初説明の2倍以上）
- ユーザーがエスカレーションを明示的に要求

---

### 2.3 L3: エスカレーション（Escalation）

**目的**: 高リスク操作に対して、詳細な影響分析と安全な代替案を提示し、理由付きの明示的承認を得る。

**対象トリガー**:

| トリガー | 検知条件 | 要求される承認内容 |
|---------|---------|------------------|
| `git push --force` | コマンドに `--force` / `-f` フラグ | 上書き対象のコミット一覧と理由 |
| `rm -rf` (ディレクトリ) | ディレクトリ全体の削除 | 削除対象のファイルツリーと復旧手段 |
| `DROP TABLE` / `DROP DATABASE` | SQL DDL 検知 | 影響テーブルとデータ量 |
| 本番環境操作 | production/prod 環境への操作 | 操作内容と切り戻し手順 |
| 大規模変更（20ファイル以上） | 変更ファイル数が閾値超過 | 変更概要とテスト結果 |
| 破壊的マイグレーション | カラム削除、テーブル名変更等 | マイグレーション計画と影響範囲 |
| 権限変更 | chmod, chown 等 | 変更前後の権限と影響 |
| セキュリティ設定変更 | CORS, CSP, 認証設定等 | 変更理由とリスク評価 |

**動作シーケンス**:

```
1. リスク検知（PreToolUse hook → HIGH risk 判定）
2. 詳細な影響分析の実施:
   - 直接的影響の列挙
   - 間接的影響（依存先）の分析
   - 最悪ケースのシナリオ
3. 安全な代替案の提示（可能な場合）
4. エスカレーションメッセージ表示:
   - 操作の詳細説明
   - 影響分析結果
   - 代替案
   - ロールバック手順
5. 理由付きの明示的承認を要求
   - 承認（理由記載）→ 慎重に実行 → 承認ログ記録
   - 拒否 → 作業中断 → 方針見直し
```

**エスカレーションメッセージフォーマット**:

```
🚨 [L3] 高リスク操作のエスカレーション

操作: {operation_description}
リスクレベル: HIGH

【影響分析】
- 直接影響: {direct_impact}
- 間接影響: {indirect_impact}
- 最悪ケース: {worst_case_scenario}

【代替案】
1. {alternative_1}
2. {alternative_2}

【ロールバック手順】
{rollback_procedure}

続行するには理由を記載してください:
>
```

**パラメータ**:

| Parameter | Value | 説明 |
|-----------|-------|------|
| max_retry | 0 | 再試行なし（失敗時は停止） |
| timeout_sec | 300 | ユーザー応答の待機タイムアウト |
| user_confirmation | 必要（理由付き） | 理由が空の場合は拒否扱い |
| log_level | ERROR | エラーレベルで記録 |
| escalation_target | 停止 | 失敗時はタスク中断 |

**対応 Hook**: `PreToolUse` (HIGH risk)

**承認ログ記録**:

L3 の承認は全て監査ログに理由付きで記録される。事後監査で「なぜその破壊的操作が承認されたか」を追跡可能にする。

---

### 2.4 L4: 即時停止（Immediate Stop）

**目的**: 致命的リスクを即座にブロックする。いかなるモード・設定でも回避不可。

**対象トリガー**:

| トリガー | 検知パターン | ブロック理由 |
|---------|------------|------------|
| システム全体削除 | `rm -rf /`, `rm -rf ~`, `rm -rf /*` | ファイルシステム全損リスク |
| シークレット外部送信 | API キー・トークンを curl/fetch で外部送信 | 認証情報漏洩 |
| `.env` コミット | `git add .env`, `git add *.env*` | シークレットのバージョン管理混入 |
| 無制限ループ | `while true` + 外部 API 呼び出し | コスト暴走・API Ban リスク |
| 認証情報のログ出力 | `console.log(password)`, `print(api_key)` | 認証情報の標準出力露出 |
| `dd` コマンド（デバイスへの書き込み） | `dd if=* of=/dev/*` | ストレージ破壊リスク |
| fork bomb | `:(){ :\|:& };:` 等のパターン | システムリソース枯渇 |
| 全テーブル DROP | `DROP DATABASE` (本番) | データ全損リスク |
| SSH 秘密鍵の外部送信 | `~/.ssh/id_*` を含む外部通信 | 秘密鍵漏洩 |

**動作シーケンス**:

```
1. パターン検知（PreToolUse hook → BLOCK 判定）
2. 即座にブロック（操作は一切実行されない）
3. ブロック理由の表示
4. 復旧ガイダンスの提示
5. 監査ログ記録（CRITICAL レベル）
```

**ブロックメッセージフォーマット**:

```
🛑 [L4] 即時停止 — 操作がブロックされました

操作: {blocked_operation}
理由: {block_reason}
分類: {safety_category}

【復旧ガイダンス】
{recovery_guidance}

この操作はいかなるモードでも実行できません。
安全な代替手段を検討してください。
```

**パラメータ**:

| Parameter | Value | 説明 |
|-----------|-------|------|
| max_retry | 0 | リトライ不可 |
| timeout_sec | 0 | 即時ブロック（遅延なし） |
| user_confirmation | N/A | 確認プロセスなし（無条件ブロック） |
| log_level | CRITICAL | 最高レベルで記録 |
| escalation_target | 即時停止 | これ以上のエスカレーションなし |

**対応 Hook**: `PreToolUse` (BLOCK)

**二重防御メカニズム**:

L4 は以下の2つの独立したメカニズムで防御される:

1. **deny ルール**（settings.json）: ツールレベルでの実行拒否
2. **Safety Gate**（tool-risk.js）: パターンマッチによる動的ブロック

いずれか一方が突破されても、もう一方で捕捉される。両方が同時に無効化されることは設計上あり得ない。

**緩和不可**: L4 はプロジェクト設定・ユーザー設定・AUTORUN モードに関わらず、常に有効。

---

## 3. エスカレーションフロー

### 3.1 標準フロー

```
エラー/リスク検知
    │
    ▼
┌──────────────────────────┐
│  L1: 自動修復試行         │
│  (max 3 retries)         │
├──────────────────────────┤
│ 成功 ──→ 完了（INFO ログ）│
│ 失敗 ──→ ↓               │
└──────────────────────────┘
    │
    ▼
┌──────────────────────────┐
│  L2: ユーザー確認要求     │
│  影響範囲説明 + 承認待ち   │
├──────────────────────────┤
│ 承認 → 実行 → 成功 ──→ 完了（WARN ログ）
│ 承認 → 実行 → 失敗 ──→ ↓
│ 拒否 ──→ 代替案提示       │
└──────────────────────────┘
    │
    ▼
┌──────────────────────────┐
│  L3: エスカレーション      │
│  影響分析 + 代替案 + 理由要求│
├──────────────────────────┤
│ 承認（理由付き）→ 慎重に実行│
│ 拒否 ──→ 作業中断 → 方針見直し
└──────────────────────────┘

────────────────────────────
L4: 即時停止（上記フローとは独立）
────────────────────────────
┌──────────────────────────┐
│  L4: 即時停止             │
│  パターン検知 → 即座にブロック│
├──────────────────────────┤
│ ブロック → 復旧ガイダンス   │
│ （フロー外。検知時点で即発動）│
└──────────────────────────┘
```

### 3.2 エスカレーション判定ロジック

```
function determineLevel(operation, context):
    // L4 チェック（最優先・フロー外）
    if matchesSafetyGatePattern(operation):
        return L4_IMMEDIATE_STOP

    // L3 チェック
    if isDestructiveOperation(operation):
        return L3_ESCALATION
    if isProductionEnvironment(context):
        return L3_ESCALATION
    if affectedFileCount(operation) > 20:
        return L3_ESCALATION

    // L2 チェック
    if requiresExternalSideEffect(operation):
        return L2_CONFIRMATION
    if modifiesFiles(operation) and affectedFileCount(operation) > 5:
        return L2_CONFIRMATION
    if installsPackages(operation):
        return L2_CONFIRMATION

    // L1 チェック
    if isAutoFixable(operation):
        return L1_AUTO_RECOVERY

    // デフォルト: 通過（ガードレール不要）
    return PASS
```

### 3.3 並行発動

複数のガードレールレベルが同時に該当する場合、**最も高いレベルが適用される**。

例: `git push --force` で `.env` を含むコミットを push しようとした場合:
- L2（git push）+ L3（--force）+ L4（.env コミット）→ **L4 が適用**

---

## 4. レベル判定マトリクス

### 4.1 操作別レベル割当

| 操作 | L1 | L2 | L3 | L4 |
|------|:--:|:--:|:--:|:--:|
| lint/format エラー | ● | | | |
| flaky テスト | ● | | | |
| import 未解決 | ● | | | |
| ロックファイル不整合 | ● | | | |
| ファイル変更（5+） | | ● | | |
| git push | | ● | | |
| パッケージインストール | | ● | | |
| 外部 API（POST/PUT/DELETE） | | ● | | |
| DB マイグレーション | | ● | | |
| 設定ファイル変更 | | ● | | |
| git push --force | | | ● | |
| rm -rf（ディレクトリ） | | | ● | |
| DROP TABLE | | | ● | |
| 本番環境操作 | | | ● | |
| 大規模変更（20+ファイル） | | | ● | |
| 破壊的マイグレーション | | | ● | |
| rm -rf / or ~ | | | | ● |
| シークレット外部送信 | | | | ● |
| .env コミット | | | | ● |
| 無制限ループ + 外部 API | | | | ● |
| 認証情報ログ出力 | | | | ● |
| fork bomb | | | | ● |

### 4.2 コンテキスト修飾子

同一操作でもコンテキストによりレベルが変動する:

| コンテキスト | レベル変動 | 例 |
|-------------|----------|-----|
| 本番環境 | +1 レベル | DB マイグレーション: L2 → L3 |
| ステージング環境 | 変動なし | デフォルトレベル適用 |
| 開発環境 | -1 レベル（最低 L1） | rm -rf node_modules: L3 → L2 |
| CI/CD パイプライン | 変動なし + 自動承認無効 | 全て明示的承認が必要 |

---

## 5. 各レベルの設定パラメータ一覧

| Parameter | L1 | L2 | L3 | L4 |
|-----------|:--:|:--:|:--:|:--:|
| max_retry | 3 | 1 | 0 | 0 |
| user_confirmation | 不要 | 必要 | 必要（理由付き） | N/A |
| auto_recovery | 有効 | 無効 | 無効 | 無効 |
| log_level | INFO | WARN | ERROR | CRITICAL |
| escalation_target | L2 | L3 | 停止 | 即時停止 |
| timeout_sec | 30 | 120 | 300 | 0 |
| rollback_required | 不要 | 推奨 | 必須 | N/A |
| approval_log | 不要 | 不要 | 必須（理由記録） | 自動記録 |

---

## 6. Hook との連携

### 6.1 3-Hook 体制との対応

| Hook | 実行タイミング | L1 | L2 | L3 | L4 |
|------|-------------|:--:|:--:|:--:|:--:|
| **PreToolUse** | ツール実行前 | — | `ask_user` | `ask_user` | `block` |
| **PostToolUse** | ツール実行後 | `auto_fix` | `log` | `log` | — |
| **Stop** | セッション終了時 | `summary` | `summary` + warnings | `summary` + errors | — |

### 6.2 tool-risk.js との連携

`_templates/hooks/tool-risk.js` がリスク評価を行い、ガードレールレベルにマッピングする:

```
tool-risk.js リスク判定
    │
    ├─ LOW risk    → ガードレール対象外（通過）
    ├─ MEDIUM risk → L2: ask_user（確認ダイアログ表示）
    ├─ HIGH risk   → L3: ask_user（エスカレーション表示）
    └─ BLOCK       → L4: block（即時ブロック）
```

### 6.3 post-tool-use.js との連携

`_templates/hooks/post-tool-use.js` がツール実行結果を評価し、L1 自動回復をトリガーする:

```
ツール実行結果
    │
    ├─ 成功 → ログ記録のみ
    └─ 失敗
        ├─ L1 対象エラー → auto_fix 実行
        └─ L1 対象外 → エラーレポート → L2 以上へ
```

### 6.4 stop-hook.js との連携

`_templates/hooks/stop-hook.js` がセッション終了時にガードレール発動サマリを出力する:

```
セッション終了時の出力:
- L1 発動回数と自動回復成功率
- L2 発動回数と承認/拒否の内訳
- L3 発動回数と承認理由の一覧
- L4 発動回数（0 が正常）
```

---

## 7. フラグシステムとの連携

### 7.1 フラグレベルとガードレールレベルの対応

| Flag Level | 意味 | Guardrail Level | 動作 |
|:----------:|------|:---------------:|------|
| **GREEN** | 正常 | L1 | 情報表示。自動修復可能な場合は修復を実行 |
| **YELLOW** | 警告 | L2 — L3 | 警告表示。確認またはエスカレーションを要求 |
| **RED** | 危険 | L4 | 即時停止。操作をブロック |

### 7.2 フラグ遷移とガードレール連動

```
GREEN → YELLOW: L1 で3回修復失敗時に自動遷移
YELLOW → RED: L3 で承認拒否が連続した場合
RED → 解除不可: L4 発動後はセッション内で同一操作を再試行不可
```

---

## 8. 自動修復システム（Auto-Repair）との連携

### 8.1 Auto-Repair レベルとの対応表

| Auto-Repair Level | 説明 | Guardrail Level | 連携方式 |
|:------------------:|------|:---------------:|---------|
| **AR-L0** (予防) | 問題発生前のブロック | L4 (事前ブロック) | Safety Gate が危険パターンを予防的にブロック |
| **AR-L1** (即時修復) | 自動修復可能な問題 | L1 (自動回復) | PostToolUse hook が検知 → L1 修復アクション実行 |
| **AR-L2** (ガイド付き) | 修復案の提示 + 確認 | L2 — L3 | 修復案を生成し、ユーザー確認後に実行 |
| **AR-L3** (手動修復) | 自動修復不可 | L3 (エスカレーション) | 問題の詳細分析結果のみ提示。修復はユーザーが実施 |

### 8.2 修復アクション定義

| エラー種別 | AR Level | 修復アクション | 最大試行 | 失敗時遷移 |
|-----------|:--------:|--------------|:--------:|----------|
| eslint エラー | AR-L1 | `eslint --fix` | 1 | AR-L2 |
| prettier 差分 | AR-L1 | `prettier --write` | 1 | AR-L2 |
| 型エラー（軽微） | AR-L1 | 自動型修正 | 2 | AR-L2 |
| テスト失敗（<20%） | AR-L1 | Builder 修正 → 再テスト | 3 | AR-L2 |
| テスト失敗（>50%） | AR-L2 | ロールバック + Sherpa 再分解 | 2 | AR-L3 |
| 破壊的変更 | AR-L2 | Architect 影響分析 + マイグレーション | 1 | AR-L3 |
| ビルドエラー | AR-L2 | ロールバック + 修正 | 2 | AR-L3 |
| セキュリティ脆弱性 | AR-L3 | 手動修復のみ | 0 | 停止 |

---

## 9. AUTORUN モードとの関係

### 9.1 モード別ガードレール動作

| AUTORUN Mode | L1 | L2 | L3 | L4 |
|:------------:|:--:|:--:|:--:|:--:|
| **FULL**（全自動） | 自動 | 自動承認（SIMPLE タスクのみ） | 確認要求 | **ブロック** |
| **AUTO** | 自動 | 確認（COMPLEX タスク） | 確認要求 | **ブロック** |
| **GUIDED** | 自動 | 確認 | 確認 | **ブロック** |
| **INTERACTIVE** | 確認 | 確認 | 確認 | **ブロック** |

> **重要**: L4 は全モードで無条件ブロック。AUTORUN_FULL であっても L4 を回避することはできない。

### 9.2 AUTORUN_FULL における L2 自動承認の条件

AUTORUN_FULL モードでは L2 操作の一部が自動承認されるが、以下の全条件を満たす場合のみ:

1. タスクが SIMPLE 分類である
2. 影響範囲が事前に定義された閾値以内（ファイル変更 < 10、パッケージ追加 < 3）
3. 本番環境への影響がない
4. セキュリティ関連の変更を含まない

いずれか1つでも満たさない場合、AUTORUN_FULL であっても L2 確認が要求される。

### 9.3 モード別エスカレーション挙動

```
FULL:
  L1 → 自動回復 → 失敗 → L2 自動承認（条件付き）→ 失敗 → L3 確認要求 → ユーザー待ち

AUTO:
  L1 → 自動回復 → 失敗 → L2 確認要求 → ユーザー待ち

GUIDED:
  L1 → 自動回復 → 失敗 → L2 確認要求 → ユーザー待ち

INTERACTIVE:
  L1 → 確認要求 → ユーザー待ち（自動回復も確認が必要）
```

---

## 10. カスタマイズ

### 10.1 プロジェクト固有のガードレール追加

`.agents/PROJECT_CONTEXT.md` で定義する:

```json
{
  "custom_guardrails": {
    "L2": [
      "本番 API への POST リクエスト",
      "Stripe API 呼び出し"
    ],
    "L3": [
      "決済関連コードの変更",
      "認証・認可ロジックの変更",
      "GDPR 対象データの処理変更"
    ],
    "L4": [
      "顧客データへの直接アクセス",
      "暗号化キーの操作"
    ]
  }
}
```

### 10.2 ガードレール緩和ルール

| Level | 緩和可否 | 緩和方法 |
|:-----:|:--------:|---------|
| L1 | 緩和不可 | 常に有効。自動修復は基本的安全機構 |
| L2 | 条件付き緩和 | `settings.json` で `allow` ルールを追加。特定ツール・特定パスに対して L2 確認をスキップ |
| L3 | 個別承認のみ | 操作ごとに理由付き承認。包括的な緩和は不可 |
| L4 | 緩和不可 | Safety Gate は常時有効。設定による無効化手段なし |

### 10.3 L2 緩和の設定例

```json
// settings.json
{
  "permissions": {
    "allow": [
      "Bash(git push origin feature/*)",
      "Bash(npm install --save-dev *)"
    ]
  }
}
```

上記設定により、feature ブランチへの push と devDependencies のインストールは L2 確認なしで実行される。ただし `main`/`master` への push や本番依存パッケージの追加は引き続き L2 確認が必要。

### 10.4 タスクタイプ別デフォルトレベル

```yaml
FEATURE:
  default_level: L2
  post_checks: [tests_pass, build_success]

SECURITY:
  default_level: L2
  pre_checks: [sentinel_scan]

REFACTOR:
  default_level: L2
  post_checks: [tests_unchanged, no_behavior_change]

INCIDENT:
  default_level: L3
  post_checks: [service_restored, no_regression]
```

---

## 11. 監査ログ

### 11.1 ログ出力先

全ガードレール発動は `.context/guardrail-log.jsonl` に JSONL 形式で記録する。

### 11.2 ログスキーマ

```json
{
  "timestamp": "2026-03-19T10:00:00.000Z",
  "level": "L3",
  "trigger": "git push --force origin main",
  "trigger_category": "destructive_operation",
  "action": "escalation",
  "user_response": "approved",
  "reason": "hotfix deployment required - production down",
  "agent": "guardian",
  "task_id": "TASK-001",
  "session_id": "sess_abc123",
  "context": {
    "affected_files": ["src/auth/login.ts"],
    "affected_branches": ["main"],
    "environment": "production"
  },
  "recovery": {
    "rollback_available": true,
    "rollback_command": "git push --force origin abc1234"
  }
}
```

### 11.3 ログレベル別記録内容

| Level | 記録項目 | 保持期間 |
|:-----:|---------|---------|
| L1 (INFO) | トリガー、修復アクション、結果 | 7日 |
| L2 (WARN) | トリガー、影響範囲、ユーザー応答 | 30日 |
| L3 (ERROR) | 全フィールド（理由含む） | 90日 |
| L4 (CRITICAL) | 全フィールド + スタックトレース | 無期限 |

### 11.4 ログローテーション

```yaml
log_rotation:
  max_file_size_mb: 10
  max_files: 5
  compress: true
  archive_path: .context/guardrail-log-archive/
```

---

## 12. 運用指標

### 12.1 正常値と異常値

| 指標 | 正常値 | 異常値 | 異常時の対応 |
|------|--------|--------|------------|
| L1 発動率 | < 20% of sessions | > 50% | 開発環境の問題を調査。lint 設定・依存関係の見直し |
| L2 発動率 | < 10% of sessions | > 30% | allow ルールの見直し。頻出操作の緩和を検討 |
| L3 発動率 | < 5% of sessions | > 15% | ワークフローの問題。タスク分解の粒度を見直し |
| L4 発動率 | < 1% of sessions | > 5% | セキュリティ教育の実施。操作手順の標準化 |
| L1 自動回復成功率 | > 90% | < 70% | 修復パターンの追加。AR-L1 アクションの拡充 |
| L2 承認率 | > 80% | < 50% | ガードレール設定が厳しすぎる。閾値の見直し |
| L3 承認率 | 40-60% | > 90% or < 10% | > 90%: ガードレールが形骸化。< 10%: 操作計画の問題 |

### 12.2 異常検知アラート

以下の条件で自動アラートを発出する:

| 条件 | アラートレベル | 対応 |
|------|-------------|------|
| L4 が1セッションで2回以上発動 | CRITICAL | セッションの即時レビュー |
| L3 発動が5回連続で拒否 | ERROR | タスク方針の見直しを提案 |
| L1 自動回復が10回連続で失敗 | WARN | 環境問題の調査を提案 |
| L2 タイムアウト（120秒）が3回連続 | WARN | ユーザー不在の可能性。セッション一時停止を提案 |

---

## 13. 復旧手順

### 13.1 レベル別復旧手順

#### L1 復旧失敗時

```
1. 自動修復ログを確認（.context/guardrail-log.jsonl）
2. エラーの根本原因を特定
3. 手動修復を実施
4. 修復パターンを AR-L1 に追加（再発防止）
```

#### L2 拒否後の代替手段

```
1. 拒否理由を確認
2. 影響範囲をより限定した操作に分割
3. 分割した操作を個別に L2 確認で実行
4. 全操作完了後に統合テストを実行
```

#### L3 拒否後の方針見直し

```
1. エスカレーション内容を確認
2. 代替案の実現可能性を評価
3. タスク自体の再分解を検討（Sherpa）
4. 必要に応じて Architect に設計見直しを依頼
5. 新しい方針でタスクを再開
```

#### L4 ブロック後の復旧

```
1. ブロックされた操作と理由を確認
2. 安全な代替手段を特定:
   - rm -rf / → 特定ディレクトリの個別削除
   - .env コミット → .gitignore 追加後にコミット
   - シークレット送信 → 環境変数経由に変更
3. 代替手段で目的を達成
4. L4 発動原因を振り返り、ワークフローを改善
```

### 13.2 ガードレールシステム自体の障害

ガードレールシステム（Hook）が正常に動作しない場合:

```
1. Hook の実行エラーログを確認
2. Fail Safe: Hook エラー時は操作をブロック（許可ではない）
3. Hook ファイルの整合性チェック（check-drift.sh）
4. 必要に応じて install.sh --with-hooks で再インストール
```

---

## 14. 関連ドキュメント

| ドキュメント | スコープ | 関係 |
|-------------|--------|------|
| `_common/GUARDRAIL.md` | ガードレール運用プロトコル | 本仕様の実行ルールを定義 |
| `_common/ESCALATION.md` | 時間ベースエスカレーション | 本仕様とは独立。同時発動あり |
| `_common/AUTORUN.md` | 自動実行モード | L1-L4 のモード別挙動を規定 |
| `_common/INTERACTION.md` | 不明点ベースエスカレーション | 本仕様とは独立。同時発動あり |
| `_templates/hooks/tool-risk.js` | PreToolUse Hook 実装 | L2-L4 の検知エンジン |
| `_templates/hooks/post-tool-use.js` | PostToolUse Hook 実装 | L1 自動回復のトリガー |
| `_templates/hooks/stop-hook.js` | Stop Hook 実装 | セッション終了時のサマリ |
| `_templates/settings.json` | 権限設定 | allow/deny ルールで L2 緩和・L4 強制 |

---

## 変更履歴

| Version | Date | Description |
|---------|------|-------------|
| 1.0.0 | 2026-03-19 | 初版。4段階ガードレールレベル仕様を定義 |
