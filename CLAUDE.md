# Goto Orchestrator Framework

## Overview

Claude Code を安全に使うためのエージェントフレームワーク。73エージェント体制。27+プロトコル + 8スキル + Tool Risk Hooks（4-Hook体制）。Security-First設計で、初心者でも安心してClaude Codeを使い始められる。

各プロジェクトに `install.sh` でエージェント定義を配布する。このリポジトリ自体はレジストリであり、直接 clone して使うものではない。


## Repository Structure

```
LM-orchestrator-engineer/
├── agents/              # エージェント定義（67個）
│   ├── analyst/         # データ分析
│   ├── nexus/           # 統括オーケストレーター
│   ├── rally/           # 並列オーケストレーター
│   ├── sherpa/          # タスク分解
│   ├── builder/         # 本番実装
│   ├── scout/           # バグ調査
│   ├── radar/           # テスト
│   ├── sentinel/        # セキュリティ（SAST）
│   ├── guardian/        # Git/PR
│   ├── judge/           # コードレビュー
│   ├── zen/             # リファクタリング
│   ├── forge/           # プロトタイプ
│   ├── artisan/         # フロントエンド
│   ├── architect/       # メタデザイナー
│   ├── anvil/           # CLI/TUI構築
│   ├── arena/           # 競争/協力開発
│   ├── auditor/         # 品質監査・SPEC準拠監査
│   ├── advocate/        # 法務副査（counselのクロスチェック、判例・行政処分照合）
│   ├── atlas/           # アーキテクチャ分析
│   ├── bard/            # devグランブル投稿
│   ├── bolt/            # パフォーマンス改善
│   ├── bridge/          # ビジネス⇔技術翻訳
│   ├── canon/           # 標準準拠評価
│   ├── canvas/          # 可視化（Mermaid等）
│   ├── cipher/          # 意図解読
│   ├── compliance/      # 上場審査・J-SOX IT統制・AIガバナンス主査（comptrollerとペア）
│   ├── comptroller/     # 上場審査・IT統制の監査役（complianceのクロスチェック）
│   ├── compete/         # 競合調査
│   ├── counsel/         # 法務コンプライアンス主査（advocateとペア）
│   ├── datashield/      # 個人情報保護副査（privacyのクロスチェック、GDPR・技術的実効性検証）
│   ├── director/        # デモ動画撮影
│   ├── echo/            # UXフロー検証
│   ├── experiment/      # A/Bテスト設計
│   ├── flow/            # アニメーション実装
│   ├── gateway/         # API設計
│   ├── gear/            # CI/CD・DevOps
│   ├── grove/           # リポジトリ構造
│   ├── growth/          # SEO/CRO
│   ├── harvest/         # PR情報収集・レポート
│   ├── hone/            # 品質反復改善
│   ├── horizon/         # モダナイゼーション
│   ├── launch/          # リリース管理
│   ├── lens/            # コード理解
│   ├── magi/            # 3視点意思決定
│   ├── morph/           # フォーマット変換
│   ├── muse/            # デザイントークン
│   ├── navigator/       # ブラウザ操作自動化
│   ├── palette/         # ユーザビリティ改善
│   ├── polyglot/        # i18n/l10n
│   ├── privacy/         # 個人情報保護法準拠主査（datashieldとペア）
│   ├── probe/           # DAST
│   ├── pulse/           # KPI/トラッキング
│   ├── quill/           # JSDoc/README
│   ├── reel/            # ターミナル録画
│   ├── researcher/      # ユーザーリサーチ
│   ├── retain/          # リテンション施策
│   ├── rewind/          # Git考古学
│   ├── ripple/          # 影響分析
│   ├── scaffold/        # IaC/Docker
│   ├── schema/          # DBスキーマ設計
│   ├── scribe/          # 仕様書作成
│   ├── showcase/        # Storybook
│   ├── spark/           # 新機能提案
│   ├── specter/         # 並行性バグ検出
│   ├── stream/          # データパイプライン
│   ├── sweep/           # クリーンアップ
│   ├── trace/           # 行動分析
│   ├── triage/          # 障害対応
│   ├── tuner/           # DB最適化
│   ├── vision/          # UI/UXディレクション
│   ├── voice/           # フィードバック収集
│   ├── voyager/         # E2Eテスト
│   ├── warden/          # UX品質ゲート
│   └── (各エージェントに references/ サブディレクトリあり)
│   └── _base.tmpl       # SKILL.md構造テンプレート
├── commands/            # カスタムスラッシュコマンド（7個）
│   ├── superpowers.md    # リサーチ→TDD→検証の大規模タスクモード
│   ├── frontend-design.md # 数値基準付きデザインプロトコル
│   ├── code-simplifier.md # git diffベースの軽量クリーンアップ
│   ├── playground.md     # 単一HTMLインタラクティブツール生成
│   ├── chrome.md         # Playwrightブラウザ操作自動化
│   ├── pr-review.md      # 5観点構造化PRレビュー
│   └── retro.md          # スプリントレトロスペクティブ
├── skills/              # 再利用可能スキル（7個）
│   ├── spec-compliance.md  # SPEC準拠チェック
│   ├── test-coverage.md    # カバレッジ分析
│   ├── git-pr-prep.md      # PR準備
│   ├── diff-analysis.md    # Diff-aware分析
│   ├── secret-scan.md      # シークレット検出スキャン
│   ├── safety-check.md     # 安全性チェック
│   ├── external-install-check.md  # 外部コンテンツ導入前セキュリティチェック
│   ├── data-guard.md       # データ保護事前チェック（個人情報・本番データ・機密情報）
│   └── design-md.md       # Figma → DESIGN.md 変換（デザイントークン翻訳層）
├── _common/             # 共通プロトコル（28個）
│   ├── AUTORUN.md
│   ├── INTERACTION.md
│   ├── GUARDRAIL.md
│   ├── GIT_GUIDELINES.md
│   ├── PARALLEL.md
│   ├── PROJECT_AFFINITY.md
│   ├── REVERSE_FEEDBACK.md
│   ├── MEMORY.md              # メモリ管理プロトコル
│   ├── AGENT_MEMORY.md        # エージェントスコープメモリ
│   ├── MAINTENANCE.md         # 定期メンテナンスプロトコル
│   ├── MCP.md                 # MCP連携プロトコル
│   ├── CLOUD_ROUTING.md       # Cloud実行ルーティングプロトコル
│   ├── PROGRESS.md            # 進捗表示プロトコル
│   ├── WORKFLOW_AUTOMATION.md # ワークフロー自動化プロトコル
│   ├── CONTEXT_HYGIENE.md     # コンテキスト衛生管理
│   ├── REVIEW_CHECKLIST.md    # レビューチェックリスト
│   ├── PTC.md                 # Programmatic Tool Calling
│   ├── TOOL_RISK.md           # ツールリスク管理（4-Hook体制）
│   ├── MODEL_ROUTING.md       # Bloom Taxonomy モデルルーティング
│   ├── CRITICAL_THINKING.md   # 批判的思考プロトコル
│   ├── CONTEXT_RECOVERY.md    # セッション復帰プロトコル
│   ├── TEST_POLICY.md         # テストポリシー（SKIP=FAIL）
│   ├── SPEC_FIRST.md          # 仕様→テスト→実装パイプライン
│   ├── ESCALATION.md          # 時間ベース3段階エスカレーション
│   ├── SLIM_CONTEXT.md        # トークン予算管理
│   ├── SKILL_DISCOVERY.md     # ボトムアップ スキル発見
│   ├── COMPONENT_SPEC.md      # コンポーネント仕様プロトコル
│   └── ENGINE_ROUTING.md      # エンジンルーティングプロトコル
├── _templates/          # プロジェクト配布テンプレート
│   ├── CLAUDE_PROJECT.md  → .claude/agents/_framework.md
│   ├── PROJECT.md         → .agents/PROJECT.md
│   ├── PROJECT_CONTEXT.md → .agents/PROJECT_CONTEXT.md
│   ├── SKILL_TEMPLATE.md  # 新エージェント作成用
│   ├── FRONTMATTER_SPEC.md # Frontmatter YAML仕様書
│   ├── mcp-settings.json  # MCP設定テンプレート
│   ├── settings.json       # Hook + Permissions設定テンプレート
│   ├── settings.local.example.json  # 個人用Permissions例
│   ├── devcontainer.json  # Codespaces devcontainer設定
│   ├── post-create.sh     # Codespaces初期化スクリプト
│   └── hooks/             # Hook実装
│       ├── tool-risk.js        # PreToolUse リスク評価
│       ├── post-tool-use.js    # PostToolUse ログ記録
│       ├── elicitation-guard.js # Elicitation インジェクションガード
│       └── stop-hook.js        # Stop セッションサマリ
├── scripts/
│   ├── cloud/           # Cloud実行基盤（GitHub Codespaces）
│   │   ├── codespace.sh    # Codespaces CLIラッパー（cs コマンド）
│   │   └── .env.example    # 設定テンプレート
│   ├── redash/          # Redash API ツール
│   │   ├── query.sh
│   │   └── .env.example
│   ├── setup-mcp.sh    # MCP一括セットアップ
│   └── check-drift.sh  # SKILL.md構造ドリフト検出
├── docs/                # ドキュメント（12個）
│   ├── QUICKSTART.md           # クイックスタート
│   ├── BEGINNERS_GUIDE.md      # 初心者向けガイド
│   ├── AGENT_SELECTION.md      # エージェント選択ガイド
│   ├── FAQ.md                  # よくある質問
│   ├── SECURITY_ARCHITECTURE.md # セキュリティアーキテクチャ（多層防御・CVE対応）
│   ├── ARCHITECTURE.md         # システムアーキテクチャ全体設計
│   ├── FLAG_SYSTEM.md          # フラグシステム仕様
│   ├── GUARDRAIL_LEVELS.md     # ガードレールレベル（L1-L4）
│   ├── AUTO_REPAIR.md          # 自動修復システム（AR-L0〜L3）
│   ├── DESIGN_DECISIONS.md     # 設計決定記録（ADR 12件）
│   ├── FAILURE_PATTERNS.md     # 失敗パターン辞書
│   └── CLOUD_ARCHITECTURE.md   # Cloud-first実行基盤アーキテクチャ
├── .github/workflows/
│   └── drift-check.yml  # PR時ドリフトチェックCI
└── install.sh           # インストーラー（--with-hooks / --with-mcp / --with-permissions対応）
```

## Security-First Design

このフレームワークの最大の特徴。Claude Codeの強力なツール実行能力を、安全に制御する。

### Tool Risk Hooks（4-Hook体制）

ツール実行前にリスクレベルを自動分類し、危険な操作を事前警告する。初心者には `--with-hooks` でのインストールを強く推奨。

| Level | Action | Example |
|-------|--------|---------|
| HIGH / BLOCK | ⚠️ 確認ダイアログ / ブロック | `rm -rf`, `git push --force`, `DROP TABLE`, 認証情報の外部送信 |
| MEDIUM | 説明表示 | `git push`, `npm publish`, ファイル編集 |
| LOW | サイレント通過 | `git status`, `Read`, `Grep` |

### Secret Protection

- `.env` ファイルを `.gitignore` に自動追加
- API キー・トークン・認証情報が stdout/ログ/コミット履歴に露出することを防止
- コード内にシークレットが検出された場合に警告

### Operation Awareness Alerts

破壊的コマンド実行前に明確な日本語警告を表示:
- `rm -rf` → ⚠️ この操作は破壊的です: ファイル/ディレクトリの完全削除
- `DROP TABLE` → ⚠️ この操作は破壊的です: テーブルの完全削除
- `git push --force` → ⚠️ この操作は破壊的です: リモート履歴の強制上書き
- `npm publish` → ⚠️ この操作は不可逆です: パッケージの公開

### Guardrail Levels（L1-L4）

| Level | Description |
|-------|-------------|
| L1 | 基本品質チェック（lint, type check） |
| L2 | テストカバレッジ確認 |
| L3 | セキュリティスキャン |
| L4 | 破壊的操作の最終確認 |

## Custom Commands (7)

エージェント召喚とは異なり、現在のセッションにワークフローモードを適用するスラッシュコマンド。

| Command | Purpose |
|---------|---------|
| `/superpowers` | Explore→設計→TDD→段階実装→検証 |
| `/frontend-design` | タイポグラフィ・余白・配色の数値基準適用 |
| `/code-simplifier` | git diffベースの直近変更クリーンアップ |
| `/playground` | 外部依存ゼロの単一HTMLツール生成 |
| `/chrome` | Playwright でブラウザ操作自動化 |
| `/pr-review` | 5観点（テスト/エラー/型/品質/シンプル化）の構造化レビュー |
| `/retro` | スプリントレトロスペクティブ（Keep/Problem/Try 構造化記録） |

## Skills (9)

エージェントから呼び出される再利用可能な手順スキル（原則 haiku で実行）。

| Skill | Purpose |
|-------|---------|
| `spec-compliance` | SPEC準拠チェック |
| `test-coverage` | カバレッジ分析 |
| `git-pr-prep` | PR準備 |
| `diff-analysis` | Diff-aware分析 |
| `secret-scan` | シークレット検出スキャン（APIキー・トークン・認証情報の検出） |
| `safety-check` | 安全性チェック（破壊的操作・セキュリティリスクの事前評価） |
| `external-install-check` | 外部コンテンツ（MCP・npm・スクリプト）導入前の必須セキュリティチェック |
| `data-guard` | データ保護事前チェック（個人情報・本番データ・機密情報の除外確認） |
| `design-md` | Figma → DESIGN.md 変換（デザイントークンをエージェント参照可能な形式に変換） |

## Installation (per-project)

```bash
# 全73エージェント（初心者は --with-hooks を推奨）
curl -sL https://raw.githubusercontent.com/hinominant/LM-orchestrator-engineer/main/install.sh | bash -s -- --with-hooks

# 選択インストール
curl -sL https://raw.githubusercontent.com/hinominant/LM-orchestrator-engineer/main/install.sh | bash -s -- --with-hooks nexus builder radar

# Hooks付き（推奨: ツールリスク分類で安全に使える）
./install.sh --with-hooks

# MCP付きインストール
./install.sh --with-mcp

# Permissions付きインストール
./install.sh --with-permissions

# 全オプション同時（推奨）
./install.sh --with-hooks --with-mcp --with-permissions
```

## Core Principles

1. **Security-first** - ツール実行前のリスク分類、シークレット保護、破壊的操作の警告
2. **Hub-spoke** - 全通信はオーケストレーター経由
3. **Minimum viable chain** - 必要最小限のエージェント構成
4. **File ownership is law** - 並列実行時のファイルオーナーシップ厳守
5. **Fail fast, recover smart** - ガードレール L1-L4
6. **Context is precious** - `.agents/PROJECT.md` + `.agents/PROJECT_CONTEXT.md` で知識共有
7. **Coordinator never codes** - コーディネーターは計画・委任・レビューに専念
8. **Memory is persistent** - 学習内容を即座に永続化、毎セッション蓄積
9. **Self-maintaining** - メモリ・ログの定期メンテナンスで品質を維持
10. **Cloud-first execution** - 重い処理はGitHub Codespacesへ自動ルーティング（ルールは `_common/CLOUD_ROUTING.md`、CLIは `scripts/cloud/codespace.sh`）
11. **Simplicity first** - 最小影響コードを強制。過剰設計より3行の重複を許容する
12. **Root cause only** - 一時的修正禁止。根本原因を見つけて直す

## 必須ワークフロー（省略禁止）

### 新機能追加・パターン追加・スクリプト変更時

**必ず `/implement` スキルを先に実行すること。**
- テスト先書き（RED→GREEN）、ドキュメント同時更新、auto-repair.js 更新を強制する
- 宣言なしに実装を開始した場合 → `/log-failure` 自動記録

### 実装完了 → push 前

**必ず `/quality-gate` スキルを実行すること。**
3フェーズ検証（標準テスト×2 → 視点違いテスト×2 → 外部監査×1）を経てコミットする。
手動 `git commit` / `git push` は禁止。スキル経由必須。

## Contributing

### エージェント追加

1. `agents/[name]/SKILL.md` を `agents/_base.tmpl` に従い作成（frontmatter必須）
2. `install.sh` の `ALL_AGENTS` に名前を追加
3. `_common/PROJECT_AFFINITY.md` にアフィニティを追記
4. `README.md` / `CLAUDE.md` の Agents 一覧を更新
5. `scripts/check-drift.sh [name]` でテンプレート準拠を検証
