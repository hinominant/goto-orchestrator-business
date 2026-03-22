# LM Orchestrator

Claude Code を安全に使うためのエージェントフレームワーク。

初心者エンジニアでも安心して Claude Code を活用できるよう、**Security-First** で設計されたエージェントチーム構築フレームワーク。73エージェント + 27+共通プロトコル + Tool Risk Hooks（4-Hook体制）で、強力かつ安全な開発体験を提供する。

---

## Security Features

このフレームワークの最大の差別化ポイント。Claude Code は強力だが、初心者が意図せず破壊的操作を実行してしまうリスクがある。LM Orchestrator はそのリスクを体系的に軽減する。

### Tool Risk Hooks（4-Hook体制）

ツール実行前にリスクレベルを自動分類し、危険な操作には事前警告を表示。**初心者には `--with-hooks` でのインストールを強く推奨。**

| Level | Action | 具体例 |
|-------|--------|--------|
| **HIGH / BLOCK** | ⚠️ 確認ダイアログ / ブロック | `rm -rf`, `git push --force`, `DROP TABLE`, 認証情報の外部送信 |
| **MEDIUM** | 説明を表示 | `git push`, `npm publish`, ファイル編集 |
| **LOW** | サイレント通過 | `git status`, `Read`, `Grep` |

```
⚠️ この操作は破壊的です: ファイル/ディレクトリの完全削除
  コマンド: rm -rf ./dist
  リスクレベル: HIGH
  続行しますか？ [y/N]
```

### Secret Protection（シークレット保護）

- `.env` ファイルを `.gitignore` に自動追加
- API キー・トークン・認証情報が stdout / ログ / コミット履歴に露出することを防止
- コード内にハードコードされたシークレットが検出された場合に警告

### Beginner Safety Net（初心者向け安全ネット）

- 各ツールの実行内容を事前に説明
- 破壊的操作の代わりに、より安全な代替手段を提案
- Guardrail L1-L4 の段階的な品質・安全チェック

### Guardrail Levels

| Level | 内容 |
|-------|------|
| L1 | 基本品質チェック（lint, type check） |
| L2 | テストカバレッジ確認 |
| L3 | セキュリティスキャン |
| L4 | 破壊的操作の最終確認 |

---

## Install

```bash
# 推奨: git clone → スクリプト内容を確認 → 手動実行
git clone --depth 1 https://github.com/hinominant/LM-orchestrator-business.git /tmp/LM-orchestrator-business
cat /tmp/LM-orchestrator-business/install.sh  # 内容を確認
cd your-project && /tmp/LM-orchestrator-business/install.sh --with-hooks

# ワンライナー（信頼できるネットワーク環境でのみ使用）
curl -sL https://raw.githubusercontent.com/hinominant/LM-orchestrator-business/main/install.sh | bash -s -- --with-hooks

# 特定のエージェントのみ
curl -sL https://raw.githubusercontent.com/hinominant/LM-orchestrator-business/main/install.sh | bash -s -- --with-hooks nexus rally builder radar

# Permissions テンプレート付き
./install.sh --with-permissions

# MCP付きインストール
./install.sh --with-mcp

# 全オプション同時（推奨）
./install.sh --with-mcp --with-permissions --with-hooks
```

> 初めて使う方は [docs/QUICKSTART.md](docs/QUICKSTART.md) を参照してください。

### インストール結果

```
your-project/
├── .claude/
│   ├── agents/
│   │   ├── _framework.md    # フレームワークプロトコル
│   │   ├── nexus.md          # オーケストレーター
│   │   ├── analyst.md        # データ分析
│   │   ├── auditor.md        # 品質監査
│   │   ├── ...               # 他のエージェント（73個）
│   │   ├── bard/             # references/ を持つエージェント
│   │   │   └── references/
│   │   └── atlas/
│   │       └── references/
│   ├── commands/
│   │   ├── superpowers.md    # 大規模タスク向けTDD+検証モード
│   │   ├── frontend-design.md # 洗練されたUI設計
│   │   ├── code-simplifier.md # 動作不変のコードクリーンアップ
│   │   ├── playground.md     # 単一HTML生成
│   │   ├── chrome.md         # ブラウザ操作自動化
│   │   └── pr-review.md     # 多面的PRレビュー
│   ├── skills/
│   │   ├── spec-compliance.md # SPEC準拠チェック
│   │   ├── test-coverage.md  # カバレッジ分析
│   │   ├── git-pr-prep.md    # PR準備
│   │   ├── diff-analysis.md  # Diff分析
│   │   ├── secret-scan.md    # シークレット検出スキャン
│   │   ├── safety-check.md   # 安全性チェック
│   │   └── external-install-check.md  # 外部コンテンツ導入前セキュリティチェック
│   └── scripts/
│       └── cloud/
│           ├── codespace.sh      # Codespaces CLIラッパー
│           └── .env.example      # 設定テンプレート
├── ~/.claude/hooks/              # --with-hooks 指定時（推奨）
│   ├── tool-risk.js             # ツールリスク分類フック
│   ├── post-tool-use.js         # ツール実行ログ記録
│   ├── elicitation-guard.js     # Elicitation インジェクションガード
│   └── stop-hook.js             # セッションサマリ永続化
├── .agents/
│   ├── PROJECT.md            # 共有知識ファイル
│   ├── PROJECT_CONTEXT.md    # プロジェクトのビジネス文脈
│   └── memory/              # エージェントスコープメモリ
└── CLAUDE.md                 # フレームワーク参照を追記
```

## Architecture

```
User Request
     |
     v
  [Nexus] ---- Phase 0: RISK_ASSESSMENT（Security-First）
     |
     +---> Sequential: Agent1 → Agent2 → Agent3 (role simulation)
     |
     +---> Parallel: Rally → TeamCreate → Teammates (実セッション並列)
```

### Registry Pattern

```
                 ┌──────────────────────────┐
                 │  GitHub Repository        │
                 │  (hinominant/             │
                 │   LM-orchestrator-business)      │
                 │                          │
                 │  73 agents + references  │
                 └────────┬─────────────────┘
                          │
            curl / install.sh
                          │
          ┌───────────────┼───────────────┐
          │               │               │
          v               v               v
     Project A       Project B       Project C
     .claude/agents/ .claude/agents/ .claude/agents/
     (必要なエージェントを選択)
```

## Agents (73)

### Orchestration（統括）

| Agent | Description |
|-------|-------------|
| **Nexus** | 統括オーケストレーター。タスク分類→チェーン設計→自動実行 |
| **Sherpa** | タスクを15分以内のAtomic Stepに分解 |
| **Rally** | TeamCreate/Task APIで複数Claudeインスタンスを並列管理 |
| **Architect** | 新エージェントのSKILL.md設計・メタデザイン |

### Data / Analysis（データ・分析）

| Agent | Description |
|-------|-------------|
| **Analyst** | Redash API でデータ取得→指標定義→誤読防止→示唆出し |
| **Auditor** | 品質監査。プロセス準拠・判断品質・リスク検知・SPEC準拠監査 |

### Investigation / Implementation（調査・実装）

| Agent | Description |
|-------|-------------|
| **Scout** | バグ調査・根本原因分析（5-Why） |
| **Builder** | 本番品質コード。型安全・TDD・DDD |
| **Forge** | プロトタイプ。動くものを最速で作り、発見をBuilderに引継ぎ |
| **Artisan** | フロントエンド実装。React/Vue/Svelte、Hooks、Server Components |
| **Anvil** | CLI/TUI構築。Node.js/Python/Go/Rust対応 |
| **Bolt** | パフォーマンス改善。再レンダリング削減、N+1修正、キャッシュ |
| **Schema** | DBスキーマ設計・マイグレーション・ER図 |
| **Gateway** | API設計・OpenAPI仕様・バージョニング戦略 |
| **Scaffold** | IaC（Terraform/CloudFormation）+ Docker環境構築 |
| **Stream** | ETL/ELTパイプライン設計、Kafka/Airflow/dbt |

### Quality / Testing（品質・テスト）

| Agent | Description |
|-------|-------------|
| **Radar** | テスト追加・カバレッジ向上・フレーキーテスト修正 |
| **Sentinel** | セキュリティ静的分析（SAST）。OWASP Top 10 |
| **Probe** | 動的セキュリティテスト（DAST）。ペネトレーションテスト |
| **Judge** | コードレビュー・バグ検出（コード修正はしない） |
| **Zen** | リファクタリング（動作不変で可読性・保守性向上） |
| **Voyager** | E2Eテスト専門。Playwright/Cypress、Page Object |
| **Canon** | 業界標準（OWASP/WCAG/OpenAPI）準拠度評価 |
| **Specter** | 並行性バグ検出。Race Condition、Memory Leak、Deadlock |
| **Warden** | UX品質ゲート。V.A.I.R.E.基準でリリース前評価 |
| **Hone** | PDCAサイクルで品質を反復改善するQuality Orchestrator |

### Git / Release（Git・リリース）

| Agent | Description |
|-------|-------------|
| **Guardian** | コミット粒度最適化・PR戦略・Signal/Noise分析 |
| **Launch** | リリース管理。バージョニング、CHANGELOG、ロールバック計画 |
| **Harvest** | GitHub PR情報収集・週報/月報/リリースノート自動生成 |
| **Rewind** | Git履歴調査・コード考古学。リグレッション根本原因分析 |

### Architecture / Decision（アーキテクチャ・意思決定）

| Agent | Description |
|-------|-------------|
| **Atlas** | 依存関係分析・循環参照検出・ADR/RFC作成・技術的負債評価 |
| **Magi** | 3視点（論理/共感/実利）意思決定。Go/No-Go判定 |
| **Ripple** | 変更前の影響分析。縦（依存）×横（パターン一貫性）評価 |
| **Horizon** | 非推奨検出・モダナイゼーション・新技術PoC |
| **Bridge** | ビジネス要件⇔技術実装の翻訳・スコープクリープ検出 |
| **Cipher** | 曖昧な要求を正確な仕様に変換。意図の解読 |
| **Arena** | Codex/Gemini CLIで競争/協力開発。複数アプローチ比較 |
| **Triage** | 障害初動対応・影響範囲特定・復旧手順・ポストモーテム |

### Frontend / UX（フロントエンド・UX）

| Agent | Description |
|-------|-------------|
| **Palette** | ユーザビリティ改善・インタラクション品質・認知負荷軽減 |
| **Flow** | CSS/JSアニメーション実装。ホバー、ローディング、遷移 |
| **Muse** | デザイントークン設計・Design System構築 |
| **Vision** | UI/UXクリエイティブディレクション・リデザイン |
| **Echo** | ペルソナになりきりUIフロー検証。混乱ポイント発見 |
| **Showcase** | Storybookストーリー作成・Visual Regression連携 |
| **Navigator** | Playwright+DevToolsでブラウザ操作自動化 |
| **Polyglot** | i18n/l10n。ハードコード文字列のt()化、RTL対応 |

### Growth / Product（グロース・プロダクト）

| Agent | Description |
|-------|-------------|
| **Growth** | SEO/SMO/CRO 3軸で成長支援 |
| **Retain** | リテンション施策・チャーン予防・ゲーミフィケーション |
| **Voice** | ユーザーフィードバック収集・NPS・感情分析 |
| **Pulse** | KPI定義・トラッキング設計・ダッシュボード仕様 |
| **Experiment** | A/Bテスト設計・サンプルサイズ計算・統計的有意性判定 |
| **Researcher** | ユーザーリサーチ設計・インタビュー・ペルソナ作成 |
| **Spark** | 既存データから新機能をMarkdown仕様書で提案 |
| **Compete** | 競合調査・差別化ポイント・SWOT分析 |
| **Trace** | セッションリプレイ分析・行動パターン抽出 |
| **Director** | Playwright E2Eテスト活用の機能デモ動画自動撮影 |

### Documentation / DevOps（ドキュメント・DevOps）

| Agent | Description |
|-------|-------------|
| **Quill** | JSDoc/TSDoc追加・README更新・型定義改善 |
| **Scribe** | 仕様書・設計書・チェックリスト・テスト仕様書作成 |
| **Morph** | ドキュメントフォーマット変換（MD↔Word/Excel/PDF） |
| **Canvas** | Mermaid図・ASCIIアート・draw.io生成。可視化 |
| **Gear** | 依存関係管理・CI/CD最適化・Docker・オブザーバビリティ |
| **Sweep** | 不要ファイル検出・デッドコード除去・クリーンアップ |
| **Grove** | リポジトリ構造設計・ディレクトリ最適化 |
| **Tuner** | DBパフォーマンス。EXPLAIN ANALYZE・インデックス推奨 |
| **Reel** | ターミナル録画・CLIデモGIF生成（VHS/asciinema） |
| **Bard** | 3ペルソナ（Codex/Gemini/Claude）でdevグランブル投稿 |
| **Lens** | コードベース理解・構造把握・機能探索（コード書かない） |

## Common Protocols (27+)

エージェントの動作を統一する共通プロトコル。`_common/` ディレクトリに格納され、フレームワーク (`_framework.md`) から参照される。

### Core

| Protocol | Description |
|----------|-------------|
| AUTORUN | 4段階実行モード（FULL/AUTO/GUIDED/INTERACTIVE） |
| INTERACTION | 対話制御・質問フォーマット・複雑度判定 |
| GUARDRAIL | L1-L4 品質ガードレール・自動回復 |
| PARALLEL | Rally並列実行・ファイルオーナーシップ・マージ戦略 |
| GIT_GUIDELINES | Conventional Commits・ブランチ命名 |

### Intelligence

| Protocol | Description |
|----------|-------------|
| MODEL_ROUTING | Bloom Taxonomy 6段階のタスク複雑度→最適モデル自動選択 |
| ESCALATION | 時間ベース3段階エスカレーション（NUDGE→RETRY→RESET） |
| SLIM_CONTEXT | トークン予算管理・段階的圧縮・予算配分 |
| CRITICAL_THINKING | 批判的思考・矛盾検出・根拠付き代替案 |
| SPEC_FIRST | 仕様→テスト→実装の順序制御 |

### Operations

| Protocol | Description |
|----------|-------------|
| MEMORY | メモリ管理・永続化・60行制限 |
| AGENT_MEMORY | エージェントスコープメモリ |
| MAINTENANCE | 10セッション毎のdedup/prune・ログ20件保持 |
| PROGRESS | 60秒沈黙禁止・フェーズマーカー・エラー即時表示 |
| CONTEXT_RECOVERY | セッション復帰手順（メモリ→CLAUDE.md→git状態） |
| TEST_POLICY | SKIP=FAIL ポリシー |
| CONTEXT_HYGIENE | コンテキスト衛生管理 |
| REVIEW_CHECKLIST | レビューチェックリスト |
| PTC | Programmatic Tool Calling |

### Automation

| Protocol | Description |
|----------|-------------|
| WORKFLOW_AUTOMATION | 繰り返し手順のスラッシュコマンド化（セッション内） |
| SKILL_DISCOVERY | ボトムアップ スキル発見・パターン検出（セッション横断） |
| TOOL_RISK | ツール実行前リスク分類・4-Hook体制・Hooks連携（初心者向け安全ネット） |

### Integration

| Protocol | Description |
|----------|-------------|
| MCP | MCP サーバー連携（Context7/Sentry/Memory/PostgreSQL/Playwright） |
| CLOUD_ROUTING | 重い処理のGitHub Codespaces自動ルーティング |
| PROJECT_AFFINITY | エージェント×プロジェクトタイプの親和性マッピング |
| REVERSE_FEEDBACK | 下流→上流の品質フィードバック |

## Custom Commands (9)

エージェントとは別に、ワークフローモードとして使えるスラッシュコマンド。デフォルトで全てインストールされる。

| Command | Description | 類似エージェントとの違い |
|---------|-------------|----------------------|
| `/superpowers` | リサーチ→設計→TDD→段階実装→検証の5フェーズ。大規模タスク向け | Sherpa(分解のみ) に対し、フルワークフロー |
| `/frontend-design` | 数値基準付きデザインプロトコル。タイポグラフィ・余白・配色・レスポンシブ | Vision/Muse(戦略) に対し、即適用できるルール |
| `/code-simplifier` | git diffベースで直近変更のみクリーンアップ。各ステップでテスト確認 | Zen(全体リファクタ) に対し、軽量・局所的 |
| `/playground` | 外部依存ゼロの単一HTMLツール生成。open コマンドで即確認 | Forge(プロトタイプ全般) に対し、単一ファイル特化 |
| `/chrome` | Playwrightでブラウザ操作。既存セッション活用、スクショ確認 | Navigator(フルエージェント) の軽量インライン版 |
| `/pr-review` | テスト/エラー処理/型/品質/シンプル化の5観点で構造化レビュー | Judge(バグ検出特化) に対し、多面的・構造化 |
| `/retro` | スプリントレトロスペクティブ。Keep/Problem/Try を構造化して `.context/retros/` に記録 | — |

```bash
/superpowers 認証システムをリファクタリングして
/frontend-design ダッシュボードのUIを設計して
/code-simplifier 直近の変更をクリーンアップして
/playground マークダウンエディタを作って
/chrome このページのデータを収集して
/pr-review #123
/retro 今週のスプリントを振り返って
```

## Execution Modes

| Mode | Trigger | Behavior |
|------|---------|----------|
| AUTORUN_FULL | Default | 全自動（ガードレール付き） |
| AUTORUN | `## NEXUS_AUTORUN` | SIMPLE自動、COMPLEX→Guided |
| GUIDED | `## NEXUS_GUIDED` | 判断ポイントで確認 |
| INTERACTIVE | `## NEXUS_INTERACTIVE` | 各ステップで確認 |

## Chain Templates

| Task | Chain |
|------|-------|
| バグ修正(簡単) | Scout → Builder → Radar |
| バグ修正(複雑) | Scout → Sherpa → Builder → Radar → Sentinel |
| 機能開発(小) | Builder → Radar |
| 機能開発(中) | Sherpa → Forge → Builder → Radar |
| 機能開発(大) | Sherpa → Rally(Builder + Artisan + Radar) |
| リファクタリング | Zen → Radar |
| セキュリティ監査 | Sentinel → Probe → Builder → Radar |
| PR準備 | Guardian → Judge |
| アーキテクチャ | Atlas → Magi → Builder/Scaffold |
| データ分析 | Analyst → Nexus |
| データパイプライン修正 | Scout → Analyst → Builder → Radar |
| スペック準拠監査 | Auditor → Builder → Radar |
| 大規模修正（監査付き） | Sherpa → Builder → Auditor → Radar |

## Tool Risk Hooks

Claude Code のツール実行前にリスクレベルを自動分類し、危険な操作を事前警告する。4-Hook体制（PreToolUse / PostToolUse / Elicitation / Stop）。**初心者のオンボーディングに最適。**

| Level | Action | Example |
|-------|--------|---------|
| HIGH / BLOCK | ⚠️ 確認ダイアログ / ブロック | `rm -rf`, `git push --force`, `DROP TABLE`, 認証情報の外部送信 |
| MEDIUM | 説明表示 | `git push`, `npm publish`, ファイル編集 |
| LOW | サイレント通過 | `git status`, `Read`, `Grep` |

```bash
# インストール（推奨）
./install.sh --with-hooks

# 経験者向け: 無効化する場合
# settings.json の hooks.PreToolUse を空配列に
```

## Cloud Execution

ローカル環境のメモリ制約を回避するため、重い処理をGitHub Codespacesに自動ルーティングする。詳細は `docs/CLOUD_ARCHITECTURE.md` 参照。

### Routing Rule

| Condition | Execution |
|-----------|-----------|
| 実行見込み10分超 | Cloud |
| 大量ログ出力 | Cloud |
| LLM/embedding/スクレイピング/バックフィル | Cloud |
| 並列2本以上 | Cloud |
| メモリ推定8GB超 | Cloud |
| 短時間スクリプト（3分以内） | Local |
| UI操作中心 | Local |

### Quick Start

```bash
# 1. 設定（初回のみ）
cp scripts/cloud/.env.example scripts/cloud/.env

# 2. Codespace作成
bash scripts/cloud/codespace.sh create --repo hinominant/your-project --machine 4-core

# 3. コマンド実行
bash scripts/cloud/codespace.sh run "cd /workspaces/project && npm run build"
bash scripts/cloud/codespace.sh status
bash scripts/cloud/codespace.sh ssh
bash scripts/cloud/codespace.sh stop
```

### CLI Commands

| Command | Description |
|---------|-------------|
| `cs create [--repo OWNER/REPO]` | Codespace作成 |
| `cs run <command>` | Codespace内でコマンド実行 |
| `cs ssh` | CodespaceにSSH接続 |
| `cs list` | Codespace一覧 |
| `cs stop [name]` | Codespace停止（課金停止） |
| `cs delete [name]` | Codespace削除 |
| `cs status` | Codespace状態確認 |

## MCP Integration (5)

エージェントの能力を拡張するMCPサーバー連携。詳細は `_common/MCP.md` 参照。

| MCP Server | Purpose | Agent Affinity |
|------------|---------|---------------|
| **Context7** | ライブラリ最新ドキュメント注入 | Builder, Artisan, Forge, Anvil |
| **Sentry** | エラー監視・スタックトレース分析 | Scout, Triage, Sentinel |
| **Memory** | ナレッジグラフベースの永続メモリ | Nexus, 全コーディネーター |
| **PostgreSQL** | 自然言語→SQL変換、データ分析 | Analyst, Schema, Tuner |
| **Playwright** | ブラウザ操作・E2Eテスト・スクリーンショット | Navigator, Voyager, Director, Probe |

```bash
# Global MCP一括セットアップ
bash scripts/setup-mcp.sh

# MCP付きインストール
./install.sh --with-mcp

# Project-specific PostgreSQL
claude mcp add postgres -- npx -y @modelcontextprotocol/server-postgres 'postgresql://user:pass@host:5432/db'
```

## Redash Integration

Analyst エージェントが Redash API を使用してデータを取得・分析する。

```bash
export REDASH_BASE_URL=https://your-redash.example.com
export REDASH_API_KEY=your_api_key_here

scripts/redash/query.sh 42                    # JSON取得
scripts/redash/query.sh 42 '{"p_start":"2025-01-01"}' # パラメータ付き
scripts/redash/query.sh 42 '' csv              # CSV出力
```

## Customization

### エージェント選択

プロジェクトに必要なエージェントだけをインストール:

```bash
# コアのみ（軽量）
install.sh --with-hooks nexus builder radar scout sentinel guardian

# フルスタック開発
install.sh --with-hooks nexus rally sherpa builder artisan forge radar sentinel judge zen guardian

# データ分析重視
install.sh --with-hooks nexus analyst pulse experiment researcher
```

### プロジェクト文脈

`.agents/PROJECT_CONTEXT.md` をプロジェクトに合わせてカスタマイズ。プロジェクトのビジネス背景・目標・制約を記載する。

### エージェント追加

1. `agents/[name]/SKILL.md` を作成（`_templates/SKILL_TEMPLATE.md` 参照）
2. `install.sh` の `ALL_AGENTS` に追加
3. `_common/PROJECT_AFFINITY.md` にアフィニティを追記

### Frontmatter

Tier 1 エージェントは YAML frontmatter で model/permissionMode/maxTurns/memory を指定。仕様は `_templates/FRONTMATTER_SPEC.md` 参照。

### QA Health Score

Radar が8次元加重ルーブリックで品質スコアリング（70+ PASS / 50-69 WARN / <50 FAIL）。

## Documentation

| ドキュメント | 内容 |
|-------------|------|
| [docs/QUICKSTART.md](docs/QUICKSTART.md) | 初回セットアップ・最初の実行 |
| [docs/BEGINNERS_GUIDE.md](docs/BEGINNERS_GUIDE.md) | 初心者向けガイド |
| [docs/AGENT_SELECTION.md](docs/AGENT_SELECTION.md) | タスク別エージェント選択ガイド |
| [docs/FAQ.md](docs/FAQ.md) | よくある質問 |
| [docs/SECURITY_ARCHITECTURE.md](docs/SECURITY_ARCHITECTURE.md) | セキュリティアーキテクチャ（多層防御・CVE対応） |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | システムアーキテクチャ全体設計 |
| [docs/FLAG_SYSTEM.md](docs/FLAG_SYSTEM.md) | フラグシステム仕様 |
| [docs/GUARDRAIL_LEVELS.md](docs/GUARDRAIL_LEVELS.md) | ガードレールレベル定義（L1-L4） |
| [docs/AUTO_REPAIR.md](docs/AUTO_REPAIR.md) | 自動修復システム（AR-L0〜L3） |
| [docs/DESIGN_DECISIONS.md](docs/DESIGN_DECISIONS.md) | 設計決定記録（ADR 12件） |
| [docs/FAILURE_PATTERNS.md](docs/FAILURE_PATTERNS.md) | 失敗パターン辞書 |
| [docs/CLOUD_ARCHITECTURE.md](docs/CLOUD_ARCHITECTURE.md) | Cloud-first実行基盤 |

## License

Copyright (c) 2026 株式会社Luna（株式会社ルナ） — 詳細は [LICENSE](./LICENSE) を参照
