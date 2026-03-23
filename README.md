# LM Orchestrator

**Claude Code の能力を解放しながら、破壊的操作を体系的に封じるエージェントフレームワーク。**

73エージェント・30プロトコル・9スキル・9コマンド。5層防御アーキテクチャで、初心者でも安心して Claude Code を使い始められる。

```
                          ┌─────────────────────────────────────────────┐
                          │           LM Orchestrator                   │
                          │    Security-First Agent Framework            │
                          │                                             │
                          │  73 Agents / 30 Protocols / 9 Skills        │
                          │  9 Commands / 343 Tests                     │
                          └──────────────────────┬──────────────────────┘
                                                 │
         ┌───────────────────────────────────────────────────────────────────┐
         │  Layer 0: CLAUDE.md Rules                                         │
         │  ルール記述・本番操作禁止・シークレット保護指示                         │
         ├───────────────────────────────────────────────────────────────────┤
         │  Layer 1: Sandbox (OS-level)                                      │
         │  ファイルシステム制限・ネットワーク allowedDomains                     │
         ├───────────────────────────────────────────────────────────────────┤
         │  Layer 2: Permissions                                             │
         │  deny-first ルール・rm -rf / sudo / .env Read を事前拒否            │
         ├───────────────────────────────────────────────────────────────────┤
         │  Layer 3: Hooks (4-Hook)                                          │
         │  PreToolUse → PostToolUse → Elicitation Guard → Stop              │
         │  リスク分類 / PII-GUARD / シークレット検知 / セッションサマリ          │
         ├───────────────────────────────────────────────────────────────────┤
         │  Layer 4: Guardrails (L1-L4)                                      │
         │  lint → coverage → security scan → 破壊的操作の最終確認              │
         └───────────────────────────────────────────────────────────────────┘
```

---

## Security Features

このフレームワークの最大の差別化ポイント。Claude Code は強力だが、初心者が意図せず破壊的操作を実行してしまうリスクがある。LM Orchestrator はそのリスクを5層で体系的に封じる。

### Tool Risk Hooks（4-Hook体制）

ツール実行前にリスクレベルを自動分類し、危険な操作には事前警告を表示。**初心者には `--with-hooks` でのインストールを強く推奨。**

| Level | Action | 具体例 |
|-------|--------|--------|
| **HIGH / BLOCK** | 確認ダイアログ / ブロック | `rm -rf`, `git push --force`, `DROP TABLE`, 認証情報の外部送信 |
| **MEDIUM** | 説明を表示 | `git push`, `npm publish`, ファイル編集 |
| **LOW** | サイレント通過 | `git status`, `Read`, `Grep` |

```
⚠️ この操作は破壊的です: ファイル/ディレクトリの完全削除
  コマンド: rm -rf ./dist
  リスクレベル: HIGH
  続行しますか？ [y/N]
```

### Secret Protection

- `.env` ファイルを `.gitignore` に自動追加
- API キー・トークン・認証情報が stdout / ログ / コミット履歴に露出することを防止
- コード内にハードコードされたシークレットが検出された場合に警告

### Guardrail Levels（L1-L4）

| Level | 内容 |
|-------|------|
| L1 | 基本品質チェック（lint, type check） |
| L2 | テストカバレッジ確認 |
| L3 | セキュリティスキャン |
| L4 | 破壊的操作の最終確認 |

### DUAL_CHECK — 2人体制強制プロトコル

以下の3領域は単独判断を禁止し、主査+副査のクロスチェックを強制する。

| 領域 | 主査 | 副査 |
|------|------|------|
| 上場審査・IT統制 | compliance | comptroller |
| 個人情報保護 | privacy | datashield |
| 法務 | counsel | advocate |

---

## PII-GUARD — 個人情報保護の多層防御

```
  ┌─────────────────────────────────────────────────────────────┐
  │                    PII-GUARD 防御体系                        │
  │                                                             │
  │  Hook 層（自動検知・ブロック）                                │
  │  ┌─────────────────────────────────────────────────────┐    │
  │  │  PII-GUARD-1  個人情報ファイルの直接読み取り防止       │    │
  │  │  PII-GUARD-2  CSV/XLSXファイルのBash読み取りブロック   │    │
  │  │  PII-GUARD-3  ツール出力のPIIパターン検知（PostTool）  │    │
  │  │  PII-GUARD-4  find -exec/xargs経由のバイパス防止       │    │
  │  │  PII-GUARD-5  while readループ経由のバイパス防止        │    │
  │  └─────────────────────────────────────────────────────┘    │
  │                                                             │
  │  プロトコル層（運用ルール）                                   │
  │  ┌─────────────────────────────────────────────────────┐    │
  │  │  DATA_PROTECTION   入力禁止情報の定義・マスキング基準   │    │
  │  │  .claudeignore     物理的なファイル除外                 │    │
  │  └─────────────────────────────────────────────────────┘    │
  │                                                             │
  │  スキル層（事前チェック）                                     │
  │  ┌─────────────────────────────────────────────────────┐    │
  │  │  data-guard        タスク開始前のDLPチェックリスト      │    │
  │  └─────────────────────────────────────────────────────┘    │
  │                                                             │
  │  エージェント層（専門評価 — DUAL_CHECK 強制）                 │
  │  ┌─────────────────────────────────────────────────────┐    │
  │  │  privacy           個人情報保護法準拠 主査              │    │
  │  │  datashield         GDPR・技術的実効性検証 副査         │    │
  │  └─────────────────────────────────────────────────────┘    │
  └─────────────────────────────────────────────────────────────┘
```

---

## Agents (73)

### Orchestration（4）

| Agent | Description |
|-------|-------------|
| **Nexus** | 統括オーケストレーター。タスク分類 → チェーン設計 → 自動実行 |
| **Sherpa** | タスクを15分以内のAtomic Stepに分解 |
| **Rally** | TeamCreate/Task APIで複数Claudeインスタンスを並列管理 |
| **Architect** | 新エージェントのSKILL.md設計・メタデザイン |

### Development（6）

| Agent | Description |
|-------|-------------|
| **Builder** | 本番品質コード。型安全・TDD・DDD |
| **Scout** | バグ調査・根本原因分析（5-Why） |
| **Radar** | テスト追加・カバレッジ向上・フレーキーテスト修正 |
| **Sentinel** | セキュリティ静的分析（SAST）。OWASP Top 10 |
| **Judge** | コードレビュー・バグ検出（コード修正はしない） |
| **Zen** | リファクタリング（動作不変で可読性・保守性向上） |

### Frontend / UX（8）

| Agent | Description |
|-------|-------------|
| **Artisan** | フロントエンド実装。React/Vue/Svelte、Hooks、Server Components |
| **Flow** | CSS/JSアニメーション実装。ホバー、ローディング、遷移 |
| **Muse** | デザイントークン設計・Design System構築 |
| **Vision** | UI/UXクリエイティブディレクション・リデザイン |
| **Palette** | ユーザビリティ改善・インタラクション品質・認知負荷軽減 |
| **Echo** | ペルソナになりきりUIフロー検証。混乱ポイント発見 |
| **Showcase** | Storybookストーリー作成・Visual Regression連携 |
| **Polyglot** | i18n/l10n。ハードコード文字列のt()化、RTL対応 |

### Compliance（6）— DUAL_CHECK 強制

| Agent | Description |
|-------|-------------|
| **Compliance** | 上場審査・J-SOX IT統制・AIガバナンス主査 |
| **Comptroller** | 上場審査・IT統制の監査役（complianceのクロスチェック） |
| **Privacy** | 個人情報保護法準拠主査 |
| **Datashield** | GDPR・技術的実効性検証（privacyのクロスチェック） |
| **Counsel** | 法務コンプライアンス主査 |
| **Advocate** | 法務副査（判例・行政処分照合） |

### Quality / Testing（10）

| Agent | Description |
|-------|-------------|
| **Probe** | 動的セキュリティテスト（DAST）。ペネトレーションテスト |
| **Voyager** | E2Eテスト専門。Playwright/Cypress、Page Object |
| **Canon** | 業界標準（OWASP/WCAG/OpenAPI）準拠度評価 |
| **Specter** | 並行性バグ検出。Race Condition、Memory Leak、Deadlock |
| **Warden** | UX品質ゲート。V.A.I.R.E.基準でリリース前評価 |
| **Hone** | PDCAサイクルで品質を反復改善するQuality Orchestrator |
| **Auditor** | 品質監査。プロセス準拠・判断品質・リスク検知・SPEC準拠監査 |
| **Bolt** | パフォーマンス改善。再レンダリング削減、N+1修正、キャッシュ |
| **Tuner** | DBパフォーマンス。EXPLAIN ANALYZE・インデックス推奨 |
| **Navigator** | Playwright+DevToolsでブラウザ操作自動化 |

### Architecture / Decision（8）

| Agent | Description |
|-------|-------------|
| **Atlas** | 依存関係分析・循環参照検出・ADR/RFC作成・技術的負債評価 |
| **Magi** | 3視点（論理/共感/実利）意思決定。Go/No-Go判定 |
| **Ripple** | 変更前の影響分析。縦（依存）×横（パターン一貫性）評価 |
| **Horizon** | 非推奨検出・モダナイゼーション・新技術PoC |
| **Bridge** | ビジネス要件 ⇔ 技術実装の翻訳・スコープクリープ検出 |
| **Cipher** | 曖昧な要求を正確な仕様に変換。意図の解読 |
| **Arena** | Codex/Gemini CLIで競争/協力開発。複数アプローチ比較 |
| **Triage** | 障害初動対応・影響範囲特定・復旧手順・ポストモーテム |

### Infrastructure（6）

| Agent | Description |
|-------|-------------|
| **Forge** | プロトタイプ。動くものを最速で作り、発見をBuilderに引継ぎ |
| **Anvil** | CLI/TUI構築。Node.js/Python/Go/Rust対応 |
| **Schema** | DBスキーマ設計・マイグレーション・ER図 |
| **Gateway** | API設計・OpenAPI仕様・バージョニング戦略 |
| **Scaffold** | IaC（Terraform/CloudFormation）+ Docker環境構築 |
| **Stream** | ETL/ELTパイプライン設計、Kafka/Airflow/dbt |

### Git / Release（4）

| Agent | Description |
|-------|-------------|
| **Guardian** | コミット粒度最適化・PR戦略・Signal/Noise分析 |
| **Launch** | リリース管理。バージョニング、CHANGELOG、ロールバック計画 |
| **Harvest** | GitHub PR情報収集・週報/月報/リリースノート自動生成 |
| **Rewind** | Git履歴調査・コード考古学。リグレッション根本原因分析 |

### Growth / Product（10）

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

### Documentation / DevOps（11）

| Agent | Description |
|-------|-------------|
| **Quill** | JSDoc/TSDoc追加・README更新・型定義改善 |
| **Scribe** | 仕様書・設計書・チェックリスト・テスト仕様書作成 |
| **Morph** | ドキュメントフォーマット変換（MD ↔ Word/Excel/PDF） |
| **Canvas** | Mermaid図・ASCIIアート・draw.io生成。可視化 |
| **Gear** | 依存関係管理・CI/CD最適化・Docker・オブザーバビリティ |
| **Sweep** | 不要ファイル検出・デッドコード除去・クリーンアップ |
| **Grove** | リポジトリ構造設計・ディレクトリ最適化 |
| **Reel** | ターミナル録画・CLIデモGIF生成（VHS/asciinema） |
| **Bard** | 3ペルソナ（Codex/Gemini/Claude）でdevグランブル投稿 |
| **Lens** | コードベース理解・構造把握・機能探索（コード書かない） |
| **Analyst** | Redash API でデータ取得 → 指標定義 → 誤読防止 → 示唆出し |

---

## Common Protocols (30)

エージェントの動作を統一する共通プロトコル。`_common/` ディレクトリに格納。

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
| MODEL_ROUTING | Bloom Taxonomy 6段階のタスク複雑度 → 最適モデル自動選択 |
| ESCALATION | 時間ベース3段階エスカレーション（NUDGE → RETRY → RESET） |
| SLIM_CONTEXT | トークン予算管理・段階的圧縮・予算配分 |
| CRITICAL_THINKING | 批判的思考・矛盾検出・根拠付き代替案 |
| SPEC_FIRST | 仕様 → テスト → 実装の順序制御 |
| ENGINE_ROUTING | タスク特性 → 最適実行エンジン選択 |

### Operations

| Protocol | Description |
|----------|-------------|
| MEMORY | メモリ管理・永続化・60行制限 |
| AGENT_MEMORY | エージェントスコープメモリ |
| MAINTENANCE | 10セッション毎のdedup/prune・ログ20件保持 |
| PROGRESS | 60秒沈黙禁止・フェーズマーカー・エラー即時表示 |
| CONTEXT_RECOVERY | セッション復帰手順（メモリ → CLAUDE.md → git状態） |
| TEST_POLICY | SKIP=FAIL ポリシー |
| CONTEXT_HYGIENE | コンテキスト衛生管理 |
| REVIEW_CHECKLIST | レビューチェックリスト |
| PTC | Programmatic Tool Calling |
| COMPONENT_SPEC | コンポーネント仕様プロトコル |
| DATA_PROTECTION | データ保護プロトコル |
| DUAL_CHECK | 2人体制強制プロトコル（主査+副査のクロスチェック） |

### Automation

| Protocol | Description |
|----------|-------------|
| WORKFLOW_AUTOMATION | 繰り返し手順のスラッシュコマンド化（セッション内） |
| SKILL_DISCOVERY | ボトムアップ スキル発見・パターン検出（セッション横断） |
| TOOL_RISK | ツール実行前リスク分類・4-Hook体制・初心者向け安全ネット |

### Integration

| Protocol | Description |
|----------|-------------|
| MCP | MCP サーバー連携（Context7/Sentry/Memory/PostgreSQL/Playwright） |
| CLOUD_ROUTING | 重い処理のGitHub Codespaces自動ルーティング |
| PROJECT_AFFINITY | エージェント × プロジェクトタイプの親和性マッピング |
| REVERSE_FEEDBACK | 下流 → 上流の品質フィードバック |

---

## Custom Commands (9)

| Command | Description | エージェントとの違い |
|---------|-------------|-------------------|
| `/superpowers` | リサーチ → 設計 → TDD → 段階実装 → 検証の5フェーズ | Sherpa(分解のみ)に対し、フルワークフロー |
| `/frontend-design` | 数値基準付きデザインプロトコル | Vision/Muse(戦略)に対し、即適用できるルール |
| `/code-simplifier` | git diffベースで直近変更のみクリーンアップ | Zen(全体リファクタ)に対し、軽量・局所的 |
| `/playground` | 外部依存ゼロの単一HTMLツール生成 | Forge(プロトタイプ全般)に対し、単一ファイル特化 |
| `/chrome` | Playwrightでブラウザ操作・スクショ確認 | Navigator(フルエージェント)の軽量版 |
| `/pr-review` | テスト/エラー処理/型/品質/シンプル化の5観点レビュー | Judge(バグ検出特化)に対し、多面的・構造化 |
| `/retro` | スプリントレトロスペクティブ（Keep/Problem/Try） | -- |
| `/implement` | 新機能追加: テスト先書き・ドキュメント同時更新 | -- |
| `/quality-gate` | Push前品質ゲート: 3フェーズ検証 → コミット → プッシュ | -- |

## Skills (9)

| Skill | Description |
|-------|-------------|
| `spec-compliance` | SPEC準拠チェック |
| `test-coverage` | カバレッジ分析 |
| `git-pr-prep` | PR準備 |
| `diff-analysis` | Diff-aware分析 |
| `secret-scan` | シークレット検出スキャン |
| `safety-check` | 安全性チェック |
| `external-install-check` | 外部コンテンツ導入前セキュリティチェック |
| `data-guard` | データ保護事前チェック（PII・本番データ・機密情報） |
| `design-md` | Figma → DESIGN.md 変換 |

---

## Quick Start

```bash
# 1. Clone
git clone --depth 1 https://github.com/hinominant/LM-orchestrator-engineer.git /tmp/LM-orchestrator-engineer

# 2. Install（プロジェクトディレクトリで実行）
cd your-project && /tmp/LM-orchestrator-engineer/install.sh --with-hooks --with-mcp --with-permissions

# 3. 確認
ls .claude/agents/nexus.md && echo "OK: インストール完了"
```

> 詳細は [docs/QUICKSTART.md](docs/QUICKSTART.md) を参照。

### インストールオプション

```bash
# 全73エージェント + 全オプション（推奨）
./install.sh --with-hooks --with-mcp --with-permissions

# 特定エージェントのみ
./install.sh --with-hooks nexus builder radar scout sentinel guardian

# ワンライナー（信頼できるネットワーク環境でのみ）
curl -sL https://raw.githubusercontent.com/hinominant/LM-orchestrator-engineer/main/install.sh | bash -s -- --with-hooks
```

### インストール結果

```
your-project/
├── .claude/
│   ├── agents/           # エージェント定義（73個）
│   │   ├── _framework.md
│   │   ├── nexus.md
│   │   └── ...
│   ├── commands/          # スラッシュコマンド（9個）
│   ├── skills/            # スキル（9個）
│   └── scripts/cloud/     # Cloud実行基盤
├── .agents/
│   ├── PROJECT.md         # 共有知識
│   ├── PROJECT_CONTEXT.md # ビジネス文脈
│   └── memory/            # エージェントスコープメモリ
├── ~/.claude/hooks/        # --with-hooks 指定時
│   ├── tool-risk.js
│   ├── post-tool-use.js
│   ├── elicitation-guard.js
│   └── stop-hook.js
└── CLAUDE.md               # フレームワーク参照を追記
```

---

## Architecture

```
User Request
     │
     v
  [Nexus] ──── Phase 0: RISK_ASSESSMENT（Security-First）
     │
     ├──→ Sequential: Agent1 → Agent2 → Agent3 (role simulation)
     │
     └──→ Parallel: Rally → TeamCreate → Teammates (実セッション並列)
```

### Registry Pattern

```
              ┌──────────────────────────────┐
              │  GitHub Repository            │
              │  hinominant/                  │
              │  LM-orchestrator-engineer     │
              │                              │
              │  73 agents + references      │
              └──────────┬───────────────────┘
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

### Execution Modes

| Mode | Trigger | Behavior |
|------|---------|----------|
| AUTORUN_FULL | Default | 全自動（ガードレール付き） |
| AUTORUN | `## NEXUS_AUTORUN` | SIMPLE自動、COMPLEX → Guided |
| GUIDED | `## NEXUS_GUIDED` | 判断ポイントで確認 |
| INTERACTIVE | `## NEXUS_INTERACTIVE` | 各ステップで確認 |

### Chain Templates

| Task | Chain |
|------|-------|
| バグ修正(簡単) | Scout → Builder → Radar |
| バグ修正(複雑) | Scout → Sherpa → Builder → Radar → Sentinel |
| 機能開発(小) | Builder → Radar |
| 機能開発(中) | Sherpa → Forge → Builder → Radar |
| 機能開発(大) | Sherpa → Rally(Builder + Artisan + Radar) |
| リファクタリング | Zen → Radar |
| セキュリティ監査 | Sentinel → Probe → Builder → Radar |
| コンプライアンス監査 | Compliance → Comptroller |
| 個人情報保護評価 | Privacy → Datashield |
| PR準備 | Guardian → Judge |
| アーキテクチャ | Atlas → Magi → Builder/Scaffold |
| データ分析 | Analyst → Nexus |
| スペック準拠監査 | Auditor → Builder → Radar |
| 大規模修正（監査付き） | Sherpa → Builder → Auditor → Radar |

---

## Tests

| Category | Count |
|----------|-------|
| Unit / Integration | 343 |
| Suites | 59 |

```bash
npm test              # 全テスト実行
npm run test:verbose  # 詳細出力
npm run test:watch    # ウォッチモード
```

---

## MCP Integration (5)

| MCP Server | Purpose | Agent Affinity |
|------------|---------|---------------|
| **Context7** | ライブラリ最新ドキュメント注入 | Builder, Artisan, Forge, Anvil |
| **Sentry** | エラー監視・スタックトレース分析 | Scout, Triage, Sentinel |
| **Memory** | ナレッジグラフベースの永続メモリ | Nexus, 全コーディネーター |
| **PostgreSQL** | 自然言語 → SQL変換、データ分析 | Analyst, Schema, Tuner |
| **Playwright** | ブラウザ操作・E2E・スクリーンショット | Navigator, Voyager, Director, Probe |

```bash
bash scripts/setup-mcp.sh     # Global MCP一括セットアップ
./install.sh --with-mcp       # MCP付きインストール
```

---

## Cloud Execution

ローカル環境の制約を回避し、重い処理をGitHub Codespacesに自動ルーティング。

| Condition | Execution |
|-----------|-----------|
| 実行見込み10分超 | Cloud |
| 大量ログ出力 / LLM / スクレイピング | Cloud |
| 並列2本以上 / メモリ推定8GB超 | Cloud |
| 短時間スクリプト（3分以内）/ UI操作 | Local |

詳細は [docs/CLOUD_ARCHITECTURE.md](docs/CLOUD_ARCHITECTURE.md) を参照。

---

## Documentation Map

| やりたいこと | 読むドキュメント |
|-------------|-----------------|
| 初めて使う | [QUICKSTART.md](docs/QUICKSTART.md) |
| Claude Codeが初めて | [BEGINNERS_GUIDE.md](docs/BEGINNERS_GUIDE.md) |
| どのエージェントを使うか | [AGENT_SELECTION.md](docs/AGENT_SELECTION.md) |
| よくある質問 | [FAQ.md](docs/FAQ.md) |
| セキュリティの仕組みを理解 | [SECURITY_ARCHITECTURE.md](docs/SECURITY_ARCHITECTURE.md) |
| 全体アーキテクチャを理解 | [ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| ガードレールの詳細 | [GUARDRAIL_LEVELS.md](docs/GUARDRAIL_LEVELS.md) |
| 自動修復の仕組み | [AUTO_REPAIR.md](docs/AUTO_REPAIR.md) |
| フラグシステム | [FLAG_SYSTEM.md](docs/FLAG_SYSTEM.md) |
| 設計判断の経緯（ADR 13件） | [DESIGN_DECISIONS.md](docs/DESIGN_DECISIONS.md) |
| 過去の失敗パターン | [FAILURE_PATTERNS.md](docs/FAILURE_PATTERNS.md) |
| Cloud実行基盤 | [CLOUD_ARCHITECTURE.md](docs/CLOUD_ARCHITECTURE.md) |
| AIガバナンスチェック | [AI_GOVERNANCE_CHECKLIST.md](docs/AI_GOVERNANCE_CHECKLIST.md) |
| 個人情報漏洩インシデント対応 | [AI_INCIDENT_RESPONSE.md](docs/AI_INCIDENT_RESPONSE.md) |
| 越境移転ガイドライン | [CROSS_BORDER_TRANSFER.md](docs/CROSS_BORDER_TRANSFER.md) |
| 外部API利用時の法的注意 | [EXTERNAL_API_NOTICE.md](docs/EXTERNAL_API_NOTICE.md) |
| セキュリティパターン辞書 | [SECURITY_PATTERNS.md](docs/SECURITY_PATTERNS.md) |
| 営業秘密保護 | [TRADE_SECRET_GUIDE.md](docs/TRADE_SECRET_GUIDE.md) |

---

## Customization

### エージェント選択

```bash
# コアのみ（軽量）
install.sh --with-hooks nexus builder radar scout sentinel guardian

# フルスタック開発
install.sh --with-hooks nexus rally sherpa builder artisan forge radar sentinel judge zen guardian

# データ分析重視
install.sh --with-hooks nexus analyst pulse experiment researcher

# コンプライアンス重視
install.sh --with-hooks nexus compliance comptroller privacy datashield counsel advocate
```

### プロジェクト文脈

`.agents/PROJECT_CONTEXT.md` をカスタマイズ。プロジェクトのビジネス背景・目標・制約を記載。

### エージェント追加

1. `agents/[name]/SKILL.md` を作成（`_templates/SKILL_TEMPLATE.md` 参照）
2. `install.sh` の `ALL_AGENTS` に追加
3. `_common/PROJECT_AFFINITY.md` にアフィニティを追記

---

## Redash Integration

```bash
export REDASH_BASE_URL=https://your-redash.example.com
export REDASH_API_KEY=your_api_key_here

scripts/redash/query.sh 42                    # JSON取得
scripts/redash/query.sh 42 '{"p_start":"2025-01-01"}' # パラメータ付き
scripts/redash/query.sh 42 '' csv              # CSV出力
```

---

## License

Copyright (c) 2026 株式会社Luna（株式会社ルナ） — 詳細は [LICENSE](./LICENSE) を参照

**販売・再販売・サブライセンスは禁止されています。**
