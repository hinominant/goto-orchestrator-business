# Agent Orchestrator Framework

## Overview

エージェントチーム構築のための中央レジストリリポジトリ。68エージェント体制（simota/agent-skills 65 + Luna独自 3）。27プロトコル + ALICE統合。

各プロジェクトに `install.sh` でエージェント定義を配布する。このリポジトリ自体はレジストリであり、直接 clone して使うものではない。

**Origin**: [simota/agent-skills](https://github.com/simota/agent-skills) の設計思想をベースに構築。

## Repository Structure

```
agent-orchestrator/
├── agents/              # エージェント定義（68個）
│   ├── ceo/             # Luna独自: 意思決定（最上流）
│   ├── analyst/         # Luna独自: データ分析
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
│   ├── auditor/         # Luna独自: 品質監査・ARIS Audit
│   ├── atlas/           # アーキテクチャ分析
│   ├── bard/            # devグランブル投稿
│   ├── bolt/            # パフォーマンス改善
│   ├── bridge/          # ビジネス⇔技術翻訳
│   ├── canon/           # 標準準拠評価
│   ├── canvas/          # 可視化（Mermaid等）
│   ├── cipher/          # 意図解読
│   ├── compete/         # 競合調査
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
│   ├── pr-review.md     # 5観点構造化PRレビュー
│   └── retro.md         # 振り返り→ARISフィードバック
├── skills/              # 再利用可能スキル（6個）
│   ├── data-retrieval.md   # LROS/Redashデータ取得
│   ├── spec-compliance.md  # SPEC準拠チェック
│   ├── test-coverage.md    # カバレッジ分析
│   ├── git-pr-prep.md      # PR準備
│   ├── diff-analysis.md    # Diff-aware分析
│   └── aris-feedback.md    # ARIS成功/失敗記録
├── _common/             # 共通プロトコル（27個）
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
│   ├── PROGRESS.md            # 進捗表示プロトコル
│   ├── WORKFLOW_AUTOMATION.md # ワークフロー自動化プロトコル
│   ├── CONTEXT_HYGIENE.md     # コンテキスト衛生管理
│   ├── REVIEW_CHECKLIST.md    # レビューチェックリスト
│   ├── PTC.md                 # Programmatic Tool Calling
│   ├── TOOL_RISK.md           # ツールリスク管理（3-Hook体制）
│   ├── MODEL_ROUTING.md       # Bloom Taxonomy モデルルーティング
│   └── ALICE_INTEGRATION.md   # ALICE統合プロトコル
├── _templates/          # プロジェクト配布テンプレート
│   ├── CLAUDE_PROJECT.md  → .claude/agents/_framework.md
│   ├── PROJECT.md         → .agents/PROJECT.md
│   ├── LUNA_CONTEXT.md    → .agents/LUNA_CONTEXT.md
│   ├── SKILL_TEMPLATE.md  # 新エージェント作成用
│   ├── FRONTMATTER_SPEC.md # Frontmatter YAML仕様書
│   ├── settings.json       # Hook設定テンプレート
│   └── hooks/             # Hook実装
│       ├── tool-risk.js    # PreToolUse リスク評価
│       ├── post-tool-use.js # PostToolUse ログ記録
│       └── stop-hook.js    # Stop セッションサマリ
├── scripts/
│   ├── redash/          # Redash API ツール
│   │   ├── query.sh
│   │   └── .env.example
│   └── check-drift.sh  # SKILL.md構造ドリフト検出
├── docs/                # ドキュメント
│   ├── AGENT_SELECTION.md  # エージェント選択ガイド
│   └── QUICKSTART.md       # クイックスタート
├── .github/workflows/
│   └── drift-check.yml  # PR時ドリフトチェックCI
└── install.sh           # インストーラー
```

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
| `/retro` | 振り返り→ARISフィードバック |

## Skills (6)

エージェントから呼び出される再利用可能な手順スキル（原則 haiku で実行）。

| Skill | Purpose |
|-------|---------|
| `data-retrieval` | LROS/Redash データ取得 |
| `spec-compliance` | SPEC準拠チェック |
| `test-coverage` | カバレッジ分析 |
| `git-pr-prep` | PR準備 |
| `diff-analysis` | Diff-aware分析 |
| `aris-feedback` | ARIS成功/失敗記録 |

## ALICE Integration

ALICE（ARIS/LROS/NOVA/Secretary）統合。詳細は `_common/ALICE_INTEGRATION.md` 参照。

| Component | Role | Agent |
|-----------|------|-------|
| ARIS | 判断エンジン | CEO (4-mind), Auditor |
| LROS | データ基盤 | Analyst (SSoT) |
| NOVA | 分析エンジン | Analyst |
| Secretary | 実行エンジン | Nexus |

## Installation (per-project)

```bash
# 全68エージェント
curl -sL https://raw.githubusercontent.com/luna-matching/agent-orchestrator/main/install.sh | bash

# 選択インストール
curl -sL https://raw.githubusercontent.com/luna-matching/agent-orchestrator/main/install.sh | bash -s -- nexus builder radar ceo

# Hooks付き
./install.sh --with-hooks
```

## Core Principles

1. **CEO-first for business decisions** - ビジネス判断は技術実装の前にCEOが方針を出す
2. **Hub-spoke** - 全通信はオーケストレーター経由
3. **Minimum viable chain** - 必要最小限のエージェント構成
4. **File ownership is law** - 並列実行時のファイルオーナーシップ厳守
5. **Fail fast, recover smart** - ガードレール L1-L4
6. **Context is precious** - `.agents/PROJECT.md` + `.agents/LUNA_CONTEXT.md` で知識共有
7. **Coordinator never codes** - コーディネーターは計画・委任・レビューに専念
8. **Memory is persistent** - 学習内容を即座に永続化、毎セッション蓄積
9. **Self-maintaining** - メモリ・ログの定期メンテナンスで品質を維持

## Contributing

### エージェント追加

1. `agents/[name]/SKILL.md` を `agents/_base.tmpl` に従い作成（frontmatter必須）
2. `install.sh` の `ALL_AGENTS` に名前を追加
3. `_common/PROJECT_AFFINITY.md` にアフィニティを追記
4. `README.md` / `CLAUDE.md` の Agents 一覧を更新
5. `scripts/check-drift.sh [name]` でテンプレート準拠を検証
