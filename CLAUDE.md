# LM Orchestrator Framework

Claude Code を安全に使うためのエージェントフレームワーク。73エージェント・30プロトコル・9スキル・9コマンド・Tool Risk Hooks（4-Hook体制）。Security-First設計。

---

## Document Map（逆引き）

| やりたいこと | 読むべきファイル |
|---|---|
| セキュリティ設計を知りたい | `docs/SECURITY_ARCHITECTURE.md` |
| エージェントを追加したい | `agents/_base.tmpl` + 本ファイル Contributing セクション |
| 上場審査・IT統制チェック | `agents/compliance/SKILL.md` + `agents/comptroller/SKILL.md` |
| 個人情報保護チェック | `agents/privacy/SKILL.md` + `agents/datashield/SKILL.md` |
| 法務チェック | `agents/counsel/SKILL.md` + `agents/advocate/SKILL.md` |
| デザインフロー | `skills/design-md.md` + `commands/frontend-design.md` |
| インシデント対応 | `docs/AI_INCIDENT_RESPONSE.md` |
| 越境移転対応 | `docs/CROSS_BORDER_TRANSFER.md` |
| ガードレールレベル詳細 | `docs/GUARDRAIL_LEVELS.md` |
| 自動修復の仕組み | `docs/AUTO_REPAIR.md` |
| Cloud実行ルーティング | `_common/CLOUD_ROUTING.md` + `docs/CLOUD_ARCHITECTURE.md` |
| セッション復帰 | `_common/CONTEXT_RECOVERY.md` |
| 営業秘密保護 | `docs/TRADE_SECRET_GUIDE.md` |
| 外部API利用の法的注意 | `docs/EXTERNAL_API_NOTICE.md` |
| AIガバナンスチェック | `docs/AI_GOVERNANCE_CHECKLIST.md` |
| 設計判断の経緯（ADR） | `docs/DESIGN_DECISIONS.md` |
| 初心者ガイド | `docs/BEGINNERS_GUIDE.md` + `docs/QUICKSTART.md` |

---

## Core Principles（12原則）

1. **Security-first** - ツール実行前のリスク分類、シークレット保護、破壊的操作の警告
2. **Hub-spoke** - 全通信はオーケストレーター経由
3. **Minimum viable chain** - 必要最小限のエージェント構成
4. **File ownership is law** - 並列実行時のファイルオーナーシップ厳守
5. **Fail fast, recover smart** - ガードレール L1-L4
6. **Context is precious** - `.agents/PROJECT.md` + `.agents/PROJECT_CONTEXT.md` で知識共有
7. **Coordinator never codes** - コーディネーターは計画・委任・レビューに専念
8. **Memory is persistent** - 学習内容を即座に永続化、毎セッション蓄積
9. **Self-maintaining** - メモリ・ログの定期メンテナンスで品質を維持
10. **Cloud-first execution** - 重い処理はGitHub Codespacesへ自動ルーティング
11. **Simplicity first** - 最小影響コードを強制。過剰設計より3行の重複を許容する
12. **Root cause only** - 一時的修正禁止。根本原因を見つけて直す

---

## PII-GUARD（個人情報保護 7層防御）

| Layer | 防御層 | 担当 |
|-------|--------|------|
| L1 | データ保護事前チェック | `skills/data-guard.md` |
| L2 | シークレット検出スキャン | `skills/secret-scan.md` |
| L3 | Tool Risk Hooks（PreToolUse） | `_templates/hooks/tool-risk.js` |
| L4 | 個人情報保護法準拠チェック（主査+副査） | `agents/privacy/` + `agents/datashield/` |
| L5 | データ保護プロトコル | `_common/DATA_PROTECTION.md` |
| L6 | 越境移転ガイドライン | `docs/CROSS_BORDER_TRANSFER.md` |
| L7 | インシデント対応フロー | `docs/AI_INCIDENT_RESPONSE.md` |

---

## 必須ワークフロー（省略禁止）

### 新機能追加・パターン追加・スクリプト変更時

**必ず `/implement` を先に実行すること。**
- テスト先書き（RED→GREEN）、ドキュメント同時更新、auto-repair.js 更新を強制する
- 宣言なしに実装を開始した場合 → `/log-failure` 自動記録

### 実装完了 → push 前

**必ず `/quality-gate` を実行すること。**
3フェーズ検証（標準テスト×2 → 視点違いテスト×2 → 外部監査×1）を経てコミットする。
手動 `git commit` / `git push` は禁止。スキル経由必須。

---

## Repository Structure

```
LM-orchestrator-engineer/
├── agents/              # エージェント定義（73個）
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
│   └── _base.tmpl       # SKILL.md構造テンプレート
├── commands/            # カスタムスラッシュコマンド（9個）
│   ├── superpowers.md    # リサーチ→TDD→検証の大規模タスクモード
│   ├── frontend-design.md # 数値基準付きデザインプロトコル
│   ├── code-simplifier.md # git diffベースの軽量クリーンアップ
│   ├── playground.md     # 単一HTMLインタラクティブツール生成
│   ├── chrome.md         # Playwrightブラウザ操作自動化
│   ├── pr-review.md      # 5観点構造化PRレビュー
│   ├── retro.md          # スプリントレトロスペクティブ
│   ├── implement.md      # 新機能追加ワークフロー
│   └── quality-gate.md   # Push前品質ゲート
├── skills/              # 再利用可能スキル（9個）
│   ├── spec-compliance.md  # SPEC準拠チェック
│   ├── test-coverage.md    # カバレッジ分析
│   ├── git-pr-prep.md      # PR準備
│   ├── diff-analysis.md    # Diff-aware分析
│   ├── secret-scan.md      # シークレット検出スキャン
│   ├── safety-check.md     # 安全性チェック
│   ├── external-install-check.md  # 外部コンテンツ導入前セキュリティチェック
│   ├── data-guard.md       # データ保護事前チェック
│   └── design-md.md       # Figma → DESIGN.md 変換
├── _common/             # 共通プロトコル（30個）
│   ├── AUTORUN.md
│   ├── INTERACTION.md
│   ├── GUARDRAIL.md
│   ├── GIT_GUIDELINES.md
│   ├── PARALLEL.md
│   ├── PROJECT_AFFINITY.md
│   ├── REVERSE_FEEDBACK.md
│   ├── MEMORY.md
│   ├── AGENT_MEMORY.md
│   ├── MAINTENANCE.md
│   ├── MCP.md
│   ├── CLOUD_ROUTING.md
│   ├── PROGRESS.md
│   ├── WORKFLOW_AUTOMATION.md
│   ├── CONTEXT_HYGIENE.md
│   ├── REVIEW_CHECKLIST.md
│   ├── PTC.md
│   ├── TOOL_RISK.md
│   ├── MODEL_ROUTING.md
│   ├── CRITICAL_THINKING.md
│   ├── CONTEXT_RECOVERY.md
│   ├── TEST_POLICY.md
│   ├── SPEC_FIRST.md
│   ├── ESCALATION.md
│   ├── SLIM_CONTEXT.md
│   ├── SKILL_DISCOVERY.md
│   ├── COMPONENT_SPEC.md
│   ├── ENGINE_ROUTING.md
│   ├── DATA_PROTECTION.md
│   └── DUAL_CHECK.md
├── _templates/          # プロジェクト配布テンプレート
│   ├── CLAUDE_PROJECT.md
│   ├── PROJECT.md
│   ├── PROJECT_CONTEXT.md
│   ├── SKILL_TEMPLATE.md
│   ├── FRONTMATTER_SPEC.md
│   ├── mcp-settings.json
│   ├── settings.json
│   ├── settings.local.example.json
│   ├── devcontainer.json
│   ├── post-create.sh
│   └── hooks/
│       ├── tool-risk.js
│       ├── post-tool-use.js
│       ├── elicitation-guard.js
│       └── stop-hook.js
├── scripts/
│   ├── cloud/
│   │   ├── codespace.sh
│   │   └── .env.example
│   ├── redash/
│   │   ├── query.sh
│   │   └── .env.example
│   ├── setup-mcp.sh
│   └── check-drift.sh
├── docs/                # ドキュメント（18個）
│   ├── QUICKSTART.md
│   ├── BEGINNERS_GUIDE.md
│   ├── AGENT_SELECTION.md
│   ├── FAQ.md
│   ├── SECURITY_ARCHITECTURE.md
│   ├── ARCHITECTURE.md
│   ├── FLAG_SYSTEM.md
│   ├── GUARDRAIL_LEVELS.md
│   ├── AUTO_REPAIR.md
│   ├── DESIGN_DECISIONS.md
│   ├── FAILURE_PATTERNS.md
│   ├── CLOUD_ARCHITECTURE.md
│   ├── AI_GOVERNANCE_CHECKLIST.md
│   ├── AI_INCIDENT_RESPONSE.md
│   ├── CROSS_BORDER_TRANSFER.md
│   ├── EXTERNAL_API_NOTICE.md
│   ├── SECURITY_PATTERNS.md
│   └── TRADE_SECRET_GUIDE.md
├── .github/workflows/
│   └── drift-check.yml
└── install.sh
```

---

## Security-First Design

### Tool Risk Hooks（4-Hook体制）

| Level | Action | Example |
|-------|--------|---------|
| HIGH / BLOCK | 確認ダイアログ / ブロック | `rm -rf`, `git push --force`, `DROP TABLE`, 認証情報の外部送信 |
| MEDIUM | 説明表示 | `git push`, `npm publish`, ファイル編集 |
| LOW | サイレント通過 | `git status`, `Read`, `Grep` |

### Guardrail Levels（L1-L4）

| Level | Description |
|-------|-------------|
| L1 | 基本品質チェック（lint, type check） |
| L2 | テストカバレッジ確認 |
| L3 | セキュリティスキャン |
| L4 | 破壊的操作の最終確認 |

---

## Commands (9)

| Command | Purpose |
|---------|---------|
| `/superpowers` | Explore→設計→TDD→段階実装→検証 |
| `/frontend-design` | タイポグラフィ・余白・配色の数値基準適用 |
| `/code-simplifier` | git diffベースの直近変更クリーンアップ |
| `/playground` | 外部依存ゼロの単一HTMLツール生成 |
| `/chrome` | Playwright でブラウザ操作自動化 |
| `/pr-review` | 5観点（テスト/エラー/型/品質/シンプル化）の構造化レビュー |
| `/retro` | スプリントレトロスペクティブ（Keep/Problem/Try） |
| `/implement` | 新機能追加ワークフロー（テスト先書き・ドキュメント同時更新） |
| `/quality-gate` | Push前品質ゲート（3フェーズ検証→コミット→プッシュ） |

## Skills (9)

| Skill | Purpose |
|-------|---------|
| `spec-compliance` | SPEC準拠チェック |
| `test-coverage` | カバレッジ分析 |
| `git-pr-prep` | PR準備 |
| `diff-analysis` | Diff-aware分析 |
| `secret-scan` | シークレット検出スキャン |
| `safety-check` | 安全性チェック（破壊的操作・セキュリティリスク事前評価） |
| `external-install-check` | 外部コンテンツ導入前の必須セキュリティチェック |
| `data-guard` | データ保護事前チェック（個人情報・本番データ・機密情報） |
| `design-md` | Figma → DESIGN.md 変換（デザイントークン翻訳） |

---

## Installation

```bash
# 全オプション同時（推奨）
./install.sh --with-hooks --with-mcp --with-permissions

# リモートから（初心者は --with-hooks を推奨）
curl -sL https://raw.githubusercontent.com/hinominant/LM-orchestrator-engineer/main/install.sh | bash -s -- --with-hooks

# 選択インストール
curl -sL https://raw.githubusercontent.com/hinominant/LM-orchestrator-engineer/main/install.sh | bash -s -- --with-hooks nexus builder radar
```

---

## Contributing

### エージェント追加手順

1. `agents/[name]/SKILL.md` を `agents/_base.tmpl` に従い作成（frontmatter必須）
2. `install.sh` の `ALL_AGENTS` に名前を追加
3. `_common/PROJECT_AFFINITY.md` にアフィニティを追記
4. `README.md` / `CLAUDE.md` の Agents 一覧を更新
5. `scripts/check-drift.sh [name]` でテンプレート準拠を検証
