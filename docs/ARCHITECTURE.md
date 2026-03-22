# LM Orchestrator — System Architecture

> **Version**: 1.0
> **Last Updated**: 2026-03-19
> **Status**: Reference Architecture Document

---

## 目次

1. [システム概要](#1-システム概要)
2. [アーキテクチャ全体図](#2-アーキテクチャ全体図)
3. [コンポーネントアーキテクチャ](#3-コンポーネントアーキテクチャ)
4. [通信マトリクス](#4-通信マトリクス)
5. [データフロー](#5-データフロー)
6. [デプロイモデル](#6-デプロイモデル)
7. [実行モデル](#7-実行モデル)
8. [統合ポイント](#8-統合ポイント)
9. [設計制約](#9-設計制約)

---

## 1. システム概要

LM Orchestrator は Claude Code のエージェントチーム構築フレームワークである。セキュリティを最優先設計原則とし、初心者エンジニアでも安全に Claude Code を活用できる環境を提供する。

### 構成要素

| カテゴリ | 数量 | 概要 |
|----------|------|------|
| エージェント | 67 | ドメイン特化型 AI エージェント |
| 共通プロトコル | 27+ | エージェント動作を統一するルール群 |
| カスタムコマンド | 6 | セッション内ワークフローモード |
| スキル | 6 | 再利用可能な手順スキル |
| Hook | 4 | PreToolUse / PostToolUse / Elicitation / Stop |

### 設計原点

Security-First / MCP連携 / Cloud実行 / Permissions / Hooks を基盤とした独自設計。

### アーキテクチャ特性

```
+------------------+--------------------------------------------+
| 特性             | 実装                                       |
+------------------+--------------------------------------------+
| Security-First   | 4-Hook体制 + Sandbox + Permissions         |
| Hub-Spoke        | 全通信はNexus/Rally経由                    |
| Registry Pattern | 中央リポジトリ → per-project install       |
| Cloud-First      | 重い処理はGitHub Codespacesへ自動ルーティング |
| Self-Maintaining | メモリ・ログの定期メンテナンス             |
+------------------+--------------------------------------------+
```

---

## 2. アーキテクチャ全体図

### システム全体構造

```
                          ┌──────────────────┐
                          │   User Request    │
                          └────────┬─────────┘
                                   │
                    ╔══════════════╧══════════════╗
                    ║    LAYER 1: SECURITY        ║
                    ║  ┌─────────┐ ┌───────────┐  ║
                    ║  │ Sandbox │ │Permissions│  ║
                    ║  └────┬────┘ └─────┬─────┘  ║
                    ║       │            │         ║
                    ║  ┌────┴────────────┴─────┐   ║
                    ║  │ PreToolUse Hook        │   ║
                    ║  │ (tool-risk.js)         │   ║
                    ║  │ BLOCK / HIGH / MED / LOW│  ║
                    ║  └───────────┬────────────┘  ║
                    ║              │ Secret         ║
                    ║              │ Protection     ║
                    ╚══════════════╧══════════════╝
                                   │
                    ╔══════════════╧══════════════╗
                    ║    LAYER 2: ORCHESTRATION   ║
                    ║                              ║
                    ║  ┌───────────────────────┐   ║
                    ║  │       Nexus            │   ║
                    ║  │  ・タスク分類          │   ║
                    ║  │  ・チェーン設計        │   ║
                    ║  │  ・Sequential実行      │   ║
                    ║  └─────┬───────────┬─────┘   ║
                    ║        │           │         ║
                    ║  ┌─────┴──┐  ┌─────┴──┐      ║
                    ║  │ Sherpa │  │ Rally  │      ║
                    ║  │ (分解) │  │ (並列) │      ║
                    ║  └────────┘  └────────┘      ║
                    ╚══════════════╧══════════════╝
                                   │
                    ╔══════════════╧══════════════╗
                    ║    LAYER 3: EXECUTION       ║
                    ║                              ║
                    ║  ┌────┐┌────┐┌────┐┌────┐   ║
                    ║  │ A1 ││ A2 ││ A3 ││ A4 │   ║
                    ║  └────┘└────┘└────┘└────┘   ║
                    ║  67 specialized agents       ║
                    ║                              ║
                    ║  Sequential: role simulation ║
                    ║  Parallel:   real sessions   ║
                    ╚══════════════╧══════════════╝
                                   │
                    ╔══════════════╧══════════════╗
                    ║    LAYER 4: QUALITY         ║
                    ║                              ║
                    ║  ┌──────────────────────┐    ║
                    ║  │ Guardrails L1-L4     │    ║
                    ║  │ L1: MONITORING (log)  │    ║
                    ║  │ L2: CHECKPOINT (auto) │    ║
                    ║  │ L3: PAUSE (recover)   │    ║
                    ║  │ L4: ABORT (stop)      │    ║
                    ║  └──────────────────────┘    ║
                    ║  ┌──────────┐┌───────────┐   ║
                    ║  │PostTool  ││ Stop Hook │   ║
                    ║  │Hook(log) ││ (summary) │   ║
                    ║  └──────────┘└───────────┘   ║
                    ╚══════════════╧══════════════╝
                                   │
                    ╔══════════════╧══════════════╗
                    ║    LAYER 5: PERSISTENCE     ║
                    ║                              ║
                    ║  .agents/PROJECT.md           ║
                    ║  .agents/PROJECT_CONTEXT.md   ║
                    ║  .agents/memory/<agent>/      ║
                    ║  .context/tool-log.jsonl      ║
                    ║  .context/sessions/*.jsonl    ║
                    ╚══════════════════════════════╝
                                   │
                          ┌────────┴─────────┐
                          │      Output       │
                          └──────────────────┘
```

### オーケストレーション分岐

```
User Request
     │
     v
  [Nexus] ─── Phase 0: RISK_ASSESSMENT (Security-First)
     │
     ├── SIMPLE task ──────> Sequential: Agent1 → Agent2 → Agent3
     │                        (Nexus内部でrole simulation)
     │
     ├── COMPLEX task ─────> Sherpa(分解) → Sequential/Parallel
     │
     └── PARALLEL task ────> Rally → TeamCreate → Teammates
                              (実セッション並列実行)
```

### Registry Pattern（配布モデル）

```
                 ┌──────────────────────────┐
                 │  GitHub Repository        │
                 │  hinominant/              │
                 │   LM-orchestrator-business       │
                 │                           │
                 │  73 agents + references   │
                 │  27+ protocols            │
                 │  9 commands + 9 skills    │
                 │  4 hooks + templates      │
                 └────────┬─────────────────┘
                          │
            curl / install.sh (選択的)
                          │
          ┌───────────────┼───────────────┐
          │               │               │
          v               v               v
     Project A       Project B       Project C
     .claude/agents/ .claude/agents/ .claude/agents/
     (全67)          (nexus,builder, (nexus,analyst,
                      radar)          pulse)
```

---

## 3. コンポーネントアーキテクチャ

### Layer 1: Security（入口防御）

Security Layer は全てのツール実行に先行して評価される。deny は allow より優先される。

#### 4-Hook体制

```
┌────────────────────────────────────────────────────────────────┐
│                        Hook Pipeline                            │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  ┌───────┐ │
│  │ PreToolUse   │  │ PostToolUse  │  │Elicitation │  │ Stop  │ │
│  │ tool-risk.js │→│ post-tool-   │  │elicitation-│  │ stop- │ │
│  │              │  │ use.js       │  │ guard.js   │  │hook.js│ │
│  ├──────────────┤  ├──────────────┤  ├────────────┤  ├───────┤ │
│  │ リスク分類   │  │ ツールログ   │  │ MCPインジェ│  │セッシ │ │
│  │ Safety Gate  │  │ 記録         │  │ クション   │  │ョンサ │ │
│  │ ブロック/確認│  │ .context/    │  │ 検知/ブロック│ │マリ  │ │
│  │ コンテキスト│  │  tool-log    │  │            │  │生成   │ │
│  │  注入       │  │  .jsonl      │  │            │  │       │ │
│  └──────────────┘  └──────────────┘  └────────────┘  └───────┘ │
└────────────────────────────────────────────────────────────────┘
```

#### PreToolUse Hook（tool-risk.js）リスク分類

| レベル | 判定 | アクション | 代表例 |
|--------|------|-----------|--------|
| **BLOCK** | Safety Gate パターン一致 | 自動ブロック | 認証情報の外部送信、`rm -rf /`、`DROP DATABASE`、`git push --force main`、`.env` の `git add`、シークレットの stdout 出力、無制限ループ |
| **HIGH** | 高リスクパターン一致 | 確認ダイアログ | `rm -rf`、`git reset --hard`、`DELETE FROM`、`TRUNCATE TABLE`、`chmod 777`、`dd if=` |
| **MEDIUM** | 中リスクパターン一致 | 説明表示 | `git push`、`git commit`、`npm publish`、`docker build`、ファイル Write/Edit |
| **LOW** | Read-only or パターン不一致 | サイレント通過 | `Read`、`Grep`、`Glob`、`git status`、`ls` |

#### リスク分類フロー

```
Tool Execution Request
         │
         v
  ┌──────────────┐
  │ LOW_TOOL_NAMES│──── Yes ──→ approve (silent)
  │ に一致?      │
  └──────┬───────┘
         │ No
         v
  ┌──────────────┐
  │ Safety Gate  │──── Match ──→ block (自動ブロック)
  │ パターン?    │
  └──────┬───────┘
         │ No match
         v
  ┌──────────────┐
  │ HIGH RISK    │──── Match ──→ ask_user (🔴 確認)
  │ パターン?    │
  └──────┬───────┘
         │ No match
         v
  ┌──────────────┐
  │ MEDIUM RISK  │──── Match ──→ ask_user (🟡 説明)
  │ パターン?    │
  └──────┬───────┘
         │ No match
         v
    approve (silent)
```

#### Sandbox & Permissions

**Sandbox** (`settings.json`):
- OS レベルのサンドボックス有効化
- unsandboxed コマンド禁止
- ファイルシステム読み取り拒否リスト:
  - `~/.aws/credentials`, `~/.aws/config`
  - `~/.ssh/id_*`, `~/.ssh/config`
  - `~/.gnupg/**`
  - `~/.config/gh/hosts.yml`, `~/.netrc`

**Permissions**:
- deny は allow より先に評価される（deny-first）
- allow: テスト実行、lint、git 読み取り系、gh CLI 等の安全な操作
- deny: `rm -rf /`, `sudo`, `chmod 777`, `git push --force`, シークレット送信、`.env` 読み取り、秘密鍵読み取り

#### Secret Protection

| 保護対象 | メカニズム |
|----------|-----------|
| `.env` ファイル | `.gitignore` 自動追加、Permissions deny |
| API キー・トークン | Safety Gate パターン検知 |
| 秘密鍵 (`.pem`, `.key`) | Permissions deny (Read) |
| credentials.json | Permissions deny (Read) |
| stdout 出力 | Safety Gate: echo/printf/cat でシークレット変数出力をブロック |
| git add | Safety Gate: `.env` ファイルの git add をブロック |

---

### Layer 2: Orchestration（指揮）

#### Nexus（統括オーケストレーター）

```yaml
name: Nexus
model: sonnet
permissionMode: full
maxTurns: 20
memory: project
cognitiveMode: orchestration
```

**責務**:
1. タスク分類（SIMPLE / COMPLEX）
2. 複雑性評価（推定ステップ数、影響ファイル数、セキュリティ関連性、破壊的変更有無）
3. 最小エージェントチェーン設計
4. AUTORUN モードでの内部 role simulation 実行
5. ガードレールレベル適用判断
6. Cloud ルーティング判定

**ルーティングマトリクス**:

| タスク種別 | 主チェーン | 追加条件 |
|------------|-----------|---------|
| BUG | Scout → Builder → Radar | +Sentinel (security), +Sherpa (complex) |
| FEATURE | Forge → Builder → Radar | +Sherpa (complex), +Artisan (frontend) |
| SECURITY | Sentinel → Builder → Radar | |
| REFACTOR | Zen → Radar | +Architect (architectural) |
| DEPLOY | Guardian → Launch | |
| PARALLEL | Rally | +Sherpa (decomposition) |

**チェーンテンプレート（実用例）**:

| タスク | チェーン |
|--------|---------|
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
| スペック準拠監査 | Auditor → Builder → Radar |
| 大規模修正（監査付き） | Sherpa → Builder → Auditor → Radar |

#### Rally（並列オーケストレーター）

```yaml
name: Rally
model: sonnet
permissionMode: full
maxTurns: 15
memory: project
cognitiveMode: parallel-orchestration
```

**責務**:
1. 並列化可能性の評価
2. チーム構成設計とファイルオーナーシップ宣言
3. TeamCreate / TaskCreate API による実セッション並列実行
4. ブランチ間マージとコンフリクト解決
5. エスカレーション監視（per-branch）

**Fan-out / Fan-in パターン**:

```
              PREPARE (snapshot)
                    │
         ┌──────────┼──────────┐
         │          │          │
      Branch A   Branch B   Branch C
      (Agent)    (Agent)    (Agent)
         │          │          │
         └──────────┼──────────┘
                    │
              AGGREGATE (merge)
                    │
               VERIFY (test)
```

**ファイルオーナーシップ**:

```yaml
ownership_map:
  teammate_a:
    exclusive_write:
      - src/features/auth/**
      - tests/auth/**
    shared_read:
      - src/types/**
      - src/config/**
  teammate_b:
    exclusive_write:
      - src/features/profile/**
      - tests/profile/**
    shared_read:
      - src/types/**
```

| ルール | 説明 |
|--------|------|
| exclusive_write | そのチームメイトのみ書き込み可 |
| shared_read | 誰でも読み取り可（書き込み不可） |
| 型定義・設定 | 常に shared_read |
| 重複 | オーナーシップの重複は禁止 |

**並列実行制限**:

| メトリクス | 上限 |
|-----------|------|
| 最大ブランチ数 | 4 |
| ブランチあたり最大ステップ | 5 |
| 並列ステップ合計上限 | 15 |

**マージ戦略**:

| 戦略 | 説明 |
|------|------|
| CONCAT | 全変更を結合（重複なし前提） |
| RESOLVE | 自動コンフリクト解決 |
| MANUAL | ユーザーに提示して判断 |

#### Sherpa（タスク分解）

```yaml
name: Sherpa
model: haiku
permissionMode: read-only
maxTurns: 5
memory: session
cognitiveMode: decomposition
```

**責務**:
1. タスクのスコープと依存関係分析
2. Atomic Step への分割（各 <15分, <50行）
3. 並列化可能グループの識別（Rally 用マーキング）
4. エージェント割り当て付きチェックリスト出力

**重要**: Sherpa は分解のみを行い、実行はしない。

---

### Layer 3: Execution（実行）

#### 73エージェント ドメイン分類

```
┌─────────────────────────────────────────────────────────────┐
│                    ORCHESTRATION (4)                         │
│  Nexus  │  Rally  │  Sherpa  │  Architect                   │
├─────────────────────────────────────────────────────────────┤
│               DATA / ANALYSIS (2)                           │
│  Analyst  │  Auditor                                        │
├─────────────────────────────────────────────────────────────┤
│          INVESTIGATION / IMPLEMENTATION (10)                │
│  Scout │ Builder │ Forge │ Artisan │ Anvil │ Bolt           │
│  Schema │ Gateway │ Scaffold │ Stream                       │
├─────────────────────────────────────────────────────────────┤
│             QUALITY / TESTING (10)                           │
│  Radar │ Sentinel │ Probe │ Judge │ Zen │ Voyager           │
│  Canon │ Specter │ Warden │ Hone                            │
├─────────────────────────────────────────────────────────────┤
│              GIT / RELEASE (4)                              │
│  Guardian  │  Launch  │  Harvest  │  Rewind                 │
├─────────────────────────────────────────────────────────────┤
│        ARCHITECTURE / DECISION (8)                          │
│  Atlas │ Magi │ Ripple │ Horizon │ Bridge                   │
│  Cipher │ Arena │ Triage                                    │
├─────────────────────────────────────────────────────────────┤
│            FRONTEND / UX (8)                                │
│  Palette │ Flow │ Muse │ Vision │ Echo                      │
│  Showcase │ Navigator │ Polyglot                            │
├─────────────────────────────────────────────────────────────┤
│           GROWTH / PRODUCT (10)                             │
│  Growth │ Retain │ Voice │ Pulse │ Experiment               │
│  Researcher │ Spark │ Compete │ Trace │ Director            │
├─────────────────────────────────────────────────────────────┤
│        DOCUMENTATION / DEVOPS (11)                          │
│  Quill │ Scribe │ Morph │ Canvas │ Gear │ Sweep            │
│  Grove │ Tuner │ Reel │ Bard │ Lens                        │
└─────────────────────────────────────────────────────────────┘
```

#### 実行方式の比較

| 方式 | 実装 | セッション | ユースケース |
|------|------|-----------|-------------|
| **Sequential (Role Simulation)** | Nexus が各エージェントの役割を内部的に模倣実行 | 単一セッション | SIMPLE タスク、AUTORUN_FULL |
| **Parallel (Real Sessions)** | Rally が TeamCreate API で実 Claude インスタンスを起動 | 複数セッション | 独立した並列タスク |

**Sequential 実行時のコンテキスト注入**:

```
_AGENT_CONTEXT:
  Role: [AgentName]
  Task: [Specific task]
  Guidelines: [Key points from AgentName's SKILL.md]

[Execute as AgentName following their methodology]

_STEP_COMPLETE:
  Agent: [AgentName]
  Status: SUCCESS | PARTIAL | BLOCKED
  Output: [Results]
  Next: [NextAgent] | VERIFY | DONE
```

#### モデルルーティング（Bloom Taxonomy）

| Bloom Level | タスク複雑度 | デフォルトモデル | 代表エージェント |
|-------------|-------------|-----------------|-----------------|
| L1 REMEMBER | 単純情報取得 | haiku | Sherpa |
| L2 UNDERSTAND | 理解・要約 | haiku | Lens |
| L3 APPLY | パターン適用 | sonnet | Builder, Radar |
| L4 ANALYZE | 構造分析 | sonnet | Analyst, Nexus |
| L5 EVALUATE | 判断・比較 | sonnet | Auditor |
| L6 CREATE | 新規設計 | opus | Magi |

---

### Layer 4: Quality（品質）

#### Guardrails L1-L4

```
L1 (MONITORING)                L2 (CHECKPOINT)
  │ ログのみ                     │ 自動検証
  │ lint警告、軽微な非推奨       │ テスト失敗<20%、セキュリティ警告
  │                              │
  │ issue持続                    │ auto_recovery成功 → CONTINUE
  └──────→ L2                    │ recovery失敗
                                 └──────→ L3

L3 (PAUSE)                     L4 (ABORT)
  │ 自動回復 or 待機             │ 即時停止
  │ テスト失敗>50%、破壊的変更   │ クリティカルセキュリティ
  │                              │ データ整合性リスク
  │ resolved → CONTINUE          │
  │ critical                     │ ROLLBACK + STOP
  └──────→ L4                    └──────→ END
```

**Auto-Recovery テーブル**:

| レベル | トリガー | 回復アクション | 最大試行 |
|--------|---------|---------------|---------|
| L2 | test_failure_minor | Builder修正→再テスト | 3 |
| L2 | type_error | Builder型強化 | 2 |
| L2 | lint_error | auto-fix | 1 |
| L3 | test_failure_major | ロールバック + Sherpa再分解 | 2 |
| L3 | breaking_change | Architect影響分析 + マイグレーション | 1 |
| L3 | build_failure | ロールバック + 修正 | 2 |

**タスク種別ごとのデフォルトレベル**:

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

#### 3系統エスカレーション

| プロトコル | スコープ | トリガー |
|-----------|---------|---------|
| ESCALATION | 時間ベース | エージェント無応答・停滞 |
| GUARDRAIL | 品質ベース | テスト失敗・セキュリティ・ビルドエラー |
| INTERACTION | 不明点ベース | 判断困難・複数選択肢・ブロッキング |

**時間ベースエスカレーション**:

```
正常応答中
  ↓ 2分無応答
Phase 1: NUDGE → リマインドメッセージ
  ↓ さらに2分無応答
Phase 2: RETRY → タスク再送（最大2回）
  ↓ さらに2分無応答 or リトライ上限
Phase 3: RESET → 再割当 or 人間エスカレート
```

#### PostToolUse Hook

全ツール実行後に `.context/tool-log.jsonl` へ JSONL 形式でログを追記する。

```json
{
  "timestamp": "2026-03-19T10:30:00.000Z",
  "session_id": "sess_abc123",
  "tool": "Bash",
  "input_summary": "npm test",
  "success": true
}
```

#### Stop Hook

セッション終了時にツールログからセッションサマリを集計し、`.context/sessions/YYYY-MM-DD.jsonl` に永続化する。

```json
{
  "session_id": "sess_abc123",
  "stop_reason": "end_turn",
  "timestamp": "2026-03-19T11:00:00.000Z",
  "tool_count": 42,
  "tools_used": ["Bash", "Read", "Edit", "Grep"],
  "errors": 1
}
```

#### レビューチェックリスト

8カテゴリ構造化チェック（Functionality / Types / Error Handling 等）。Severity は CRITICAL（ブロッキング）と INFORMATIONAL（PR本文記載）の2段階。

---

### Layer 5: Persistence（永続化）

#### 永続化レイヤー構造

```
┌─────────────────────────────────────────────────────┐
│              User Memory                             │
│  ~/.claude/projects/{project}/memory/MEMORY.md       │
│  (60行以内、セマンティック整理)                       │
├─────────────────────────────────────────────────────┤
│              Project Knowledge                       │
│  .agents/PROJECT.md           共有知識               │
│  .agents/PROJECT_CONTEXT.md   ビジネス文脈           │
├─────────────────────────────────────────────────────┤
│              Agent Memory (3スコープ)                │
│  session:  メモリ内（揮発）                          │
│  project:  .agents/memory/<agent>/                   │
│  global:   ~/.claude/agent-memory/<agent>/            │
├─────────────────────────────────────────────────────┤
│              Session Logs                            │
│  .context/tool-log.jsonl      ツール実行ログ         │
│  .context/sessions/*.jsonl    セッションサマリ       │
└─────────────────────────────────────────────────────┘
```

#### メモリアクセス制御

| 操作 | 自スコープ | 他エージェントスコープ |
|------|-----------|---------------------|
| READ | 可 | 可（READ ONLY） |
| WRITE | 可 | 不可 |
| DELETE | 可 | 不可 |

#### メモリ管理ルール

| ルール | 値 |
|--------|-----|
| MEMORY.md 行数上限 | 60行 |
| エージェントメモリファイル上限 | 100行/ファイル |
| メンテナンス頻度 | 10セッション毎（dedup/prune） |
| ログ保持数 | 20件 |

---

## 4. 通信マトリクス

### コンポーネント間通信

| From | To | プロトコル | データ | 方向 |
|------|----|-----------|--------|------|
| User | Nexus | 自然言語 | タスク要求 | → |
| Nexus | Agent(Sequential) | _AGENT_CONTEXT | ロール + タスク + ガイドライン | → |
| Agent | Nexus | _STEP_COMPLETE | ステータス + 出力 + 次ステップ | → |
| Nexus | Rally | タスク委任 | 並列化可能なタスク群 | → |
| Rally | Teammate | TeamCreate/TaskCreate API | タスク + ファイルオーナーシップ | → |
| Teammate | Rally | TaskList/TaskGet | 完了通知 + 成果物 | → |
| Nexus | Sherpa | 複雑タスク | 分解対象のタスク | → |
| Sherpa | Nexus | チェックリスト | Atomic Steps + エージェント割当 | → |
| PreToolUse | Claude Code | JSON | approve / ask_user / block | → |
| PostToolUse | .context/ | JSONL | ツール実行ログ | → |
| StopHook | .context/sessions/ | JSONL | セッションサマリ | → |
| Agent | .agents/memory/ | Markdown | エージェント学習データ | → |
| Agent | .agents/PROJECT.md | Markdown | チーム共有知識 | ↔ |
| MCP Server | Agent | MCP Protocol | 外部データ（ドキュメント/エラー/DB） | ↔ |

### トークン予算

| 通信シナリオ | 予算 | 圧縮戦略 |
|-------------|------|---------|
| NEXUS_HANDOFF | 3,000 tokens | summary 優先 |
| Rally branch merge | 1,000 tokens | file list 優先 |
| Knowledge context injection | 4,000 tokens | highlights 抽出 |
| Error report | 500 tokens | stacktrace 冒頭 |

**Handoff 予算配分**:

```yaml
HANDOFF_BUDGET:
  summary:      500 tokens   # 必須: 結果サマリー
  key_findings: 1000 tokens  # 重要: 発見事項
  artifacts:    500 tokens   # ファイルパス・コマンド
  context:      remaining    # 残りをコンテキストに配分
  total:        3000 tokens
```

### Hub-Spoke トポロジ

```
                    ┌─────────┐
          ┌────────→│  Scout  │
          │         └─────────┘
          │         ┌─────────┐
          ├────────→│ Builder │
          │         └─────────┘
          │         ┌─────────┐
 ┌───────┐├────────→│  Radar  │
 │ Nexus ├┤         └─────────┘
 └───────┘│         ┌─────────┐
          ├────────→│Sentinel │
          │         └─────────┘
          │         ┌─────────┐
          ├────────→│  Rally ─┼──→ Teammate A
          │         │         │──→ Teammate B
          │         └─────────┘
          │         ┌─────────┐
          └────────→│ Sherpa  │
                    └─────────┘

  ※ エージェント間の直接通信は禁止
  ※ 全通信は Nexus/Rally を経由する
```

---

## 5. データフロー

### リクエストライフサイクル（AUTORUN_FULL）

```
                                    Time →
User ─────────────────────────────────────────────────────────→
  │ "ログイン機能にバグがある"
  v
[1. Security Check]
  │ PreToolUse Hook: ツール実行なし（自然言語入力）
  v
[2. Nexus: タスク分類]
  │ Type: BUG
  │ Complexity: COMPLEX (セキュリティ関連)
  │ Chain: Scout → Builder → Radar → Sentinel
  │ Cloud Routing: Score=0 → LOCAL
  │ Guardrail: L2 (CHECKPOINT)
  v
[3. Nexus as Scout: 調査]
  │ _AGENT_CONTEXT: Role=Scout
  │ → 5-Why Analysis
  │ → Root Cause 特定
  │
  │ [PreToolUse: Read → approve(LOW)]
  │ [PreToolUse: Bash(git log) → approve(LOW)]
  │ [PostToolUse: ログ記録]
  │
  │ _STEP_COMPLETE: SUCCESS
  │ Output: "Token refresh timing issue"
  v
[4. Nexus as Builder: 修正]
  │ _AGENT_CONTEXT: Role=Builder
  │ → TDD: テスト先行
  │ → 実装
  │
  │ [PreToolUse: Edit → ask_user(MEDIUM)]  ← ファイル変更確認
  │ [PreToolUse: Bash(npm test) → approve(LOW)]
  │ [PostToolUse: ログ記録]
  │
  │ _STEP_COMPLETE: SUCCESS
  v
[5. Nexus as Radar: テスト]
  │ [L2 CHECKPOINT: tests_pass?]
  │ → YES → CONTINUE
  │ → NO  → Auto-Recovery (Builder修正→再テスト, max 3)
  v
[6. Nexus as Sentinel: セキュリティ]
  │ OWASP Top 10 チェック
  │ _STEP_COMPLETE: SUCCESS
  v
[7. NEXUS_COMPLETE]
  │ Summary: 4 steps completed
  │ Files changed: [list]
  │ Tests: PASS
  │ Verification: [手順]
  v
[8. Stop Hook]
  │ セッションサマリ → .context/sessions/2026-03-19.jsonl
  v
Output to User
```

### セキュリティチェック介入ポイント

```
リクエスト開始
     │
     ├── [Sandbox] OS レベル隔離 ─────────────── 常時有効
     │
     ├── [Permissions deny] 明示的禁止操作 ──── 最優先評価
     │
     ├── [PreToolUse] 各ツール実行前 ──────────── BLOCK/HIGH/MED/LOW
     │      │
     │      ├── Safety Gate → 自動ブロック
     │      ├── HIGH Risk → 確認ダイアログ
     │      ├── MEDIUM Risk → 説明表示
     │      └── LOW Risk → サイレント通過
     │
     ├── [Guardrail L1-L4] 実行結果評価 ──────── ステップ完了後
     │
     ├── [PostToolUse] 全ツール実行ログ ──────── 監査証跡
     │
     └── [Stop Hook] セッション終了サマリ ────── セッション終了時
```

### コンテキストフロー（エージェント間）

```
┌─────────────┐      HANDOFF (3000 tokens)     ┌─────────────┐
│   Agent A    │ ─────────────────────────────→ │   Agent B    │
│              │   summary: 500                 │              │
│  findings    │   key_findings: 1000           │  receives    │
│  artifacts   │   artifacts: 500               │  context     │
│  context     │   context: remaining           │              │
└─────────────┘                                 └─────────────┘
       │                                               │
       v                                               v
  .agents/memory/agentA/                   .agents/memory/agentB/
  (project scope, WRITE)                   (project scope, WRITE)
       │                                               │
       └──────────────→ .agents/PROJECT.md ←───────────┘
                         (shared, READ/WRITE)
```

---

## 6. デプロイモデル

### インストールフロー

```
install.sh [options] [agents...]
     │
     ├── [1/12] Agent definitions → .claude/agents/*.md
     │          (references/ サブディレクトリも含む)
     │
     ├── [2/12] Custom commands → .claude/commands/*.md
     │
     ├── [3/12] Framework protocol → .claude/agents/_framework.md
     │
     ├── [4/12] Common protocols → .claude/agents/_protocol_*.md
     │
     ├── [5/12] Skills → .claude/skills/*.md
     │
     ├── [6/12] Shared knowledge → .agents/PROJECT.md
     │
     ├── [7/12] Project context → .agents/PROJECT_CONTEXT.md
     │
     ├── [8/12] MCP scripts + cloud scripts + devcontainer
     │
     ├── [9/12] CLAUDE.md (フレームワーク参照追記)
     │
     ├── [10/12] MCP setup (--with-mcp)
     │
     ├── [11/12] Permissions (--with-permissions)
     │
     └── [12/12] Hooks (--with-hooks)
                  → .claude/hooks/ (project-local)
                  → ~/.claude/hooks/ (global)
                  → .claude/settings.json
```

### インストールオプション

| オプション | 効果 | 推奨度 |
|-----------|------|--------|
| `--with-hooks` | 4-Hook体制の有効化（tool-risk.js + post-tool-use.js + elicitation-guard.js + stop-hook.js） | 強く推奨（初心者必須） |
| `--with-permissions` | Sandbox + Permission deny/allow ルール設定 | 推奨 |
| `--with-mcp` | MCP サーバー一括セットアップ | 任意 |
| `(エージェント名)` | 指定エージェントのみインストール | 軽量運用時 |
| `(引数なし)` | 全73エージェントインストール | デフォルト |

### インストール後ファイルレイアウト

```
your-project/
├── .claude/
│   ├── agents/
│   │   ├── _framework.md              # フレームワークプロトコル
│   │   ├── _protocol_AUTORUN.md       # 共通プロトコル群
│   │   ├── _protocol_GUARDRAIL.md
│   │   ├── _protocol_PARALLEL.md
│   │   ├── _protocol_*.md             # (27+ファイル)
│   │   ├── nexus.md                   # エージェント定義
│   │   ├── builder.md
│   │   ├── *.md                       # (67ファイル)
│   │   ├── bard/references/           # 参照ドキュメント
│   │   └── tuner/references/
│   ├── commands/
│   │   ├── superpowers.md
│   │   ├── frontend-design.md
│   │   ├── code-simplifier.md
│   │   ├── playground.md
│   │   ├── chrome.md
│   │   └── pr-review.md
│   ├── skills/
│   │   ├── spec-compliance.md
│   │   ├── test-coverage.md
│   │   ├── git-pr-prep.md
│   │   └── diff-analysis.md
│   ├── hooks/                          # --with-hooks
│   │   ├── tool-risk.js
│   │   ├── post-tool-use.js
│   │   ├── elicitation-guard.js
│   │   └── stop-hook.js
│   ├── scripts/cloud/
│   │   ├── codespace.sh
│   │   └── .env.example
│   ├── settings.json                   # --with-permissions
│   └── mcp-settings.template.json      # --with-mcp
├── .agents/
│   ├── PROJECT.md                      # 共有知識
│   ├── PROJECT_CONTEXT.md              # ビジネス文脈
│   └── memory/                         # エージェントスコープメモリ
│       ├── nexus/
│       ├── builder/
│       └── radar/
├── .context/                            # (実行時に自動生成)
│   ├── tool-log.jsonl
│   └── sessions/
│       └── 2026-03-19.jsonl
├── .devcontainer/                       # --with-mcp
│   ├── devcontainer.json
│   └── post-create.sh
├── CLAUDE.md                            # フレームワーク参照追記
└── ~/.claude/hooks/                     # グローバルHook (--with-hooks)
    ├── tool-risk.js
    ├── post-tool-use.js
    ├── elicitation-guard.js
    └── stop-hook.js
```

---

## 7. 実行モデル

### 4段階実行モード

```
┌───────────────────────────────────────────────────────────┐
│                    AUTORUN_FULL                            │
│  デフォルト。全自動実行。                                  │
│  SIMPLE + COMPLEX タスクともに自動進行。                   │
│  ガードレール L1-L4 のみが介入ポイント。                   │
│                                                           │
│  トリガー: ## NEXUS_AUTORUN_FULL (または Default)          │
│  セキュリティ: 全Hook有効 + Guardrail自動回復              │
├───────────────────────────────────────────────────────────┤
│                    AUTORUN                                │
│  SIMPLEタスクは自動、COMPLEXはGUIDEDに自動切替。          │
│                                                           │
│  トリガー: ## NEXUS_AUTORUN                               │
│  セキュリティ: 全Hook有効 + COMPLEXでユーザー確認         │
├───────────────────────────────────────────────────────────┤
│                    GUIDED                                 │
│  判断ポイントでユーザー確認。学習目的に最適。              │
│  Nexus が NEXUS_HANDOFF ブロックを出力し、                │
│  ユーザーが次のエージェントを手動で起動する。              │
│                                                           │
│  トリガー: ## NEXUS_GUIDED                                │
│  セキュリティ: 全Hook有効 + 全ステップでユーザー確認      │
├───────────────────────────────────────────────────────────┤
│                    INTERACTIVE                            │
│  全ステップでユーザー確認。最も安全。                      │
│                                                           │
│  トリガー: ## NEXUS_INTERACTIVE                           │
│  セキュリティ: 全Hook有効 + 毎アクションでユーザー確認    │
└───────────────────────────────────────────────────────────┘
```

### モード選択ガイド

| 条件 | 推奨モード |
|------|-----------|
| 熟練者、信頼できるタスク | AUTORUN_FULL |
| 日常的な開発タスク | AUTORUN |
| Claude Code 学習中 | GUIDED |
| 本番環境操作、初回利用 | INTERACTIVE |

### 複雑性判定による自動切替

| 指標 | SIMPLE | COMPLEX |
|------|--------|---------|
| 推定ステップ | 1-2 | 3+ |
| 影響ファイル | 1-3 | 4+ |
| セキュリティ関連 | No | Yes |
| 破壊的変更 | No | Yes |

AUTORUN モードでは SIMPLE タスクは自動実行し、COMPLEX タスクは自動的に GUIDED に切り替わる。

### セキュリティ含意

```
                 自動化レベル
                     ↑
  AUTORUN_FULL ──────┤ 高い自動化、Hook + Guardrail が安全弁
                     │
  AUTORUN ───────────┤ SIMPLE自動、COMPLEX手動
                     │
  GUIDED ────────────┤ 判断ポイントで確認
                     │
  INTERACTIVE ───────┤ 最大安全、最低速度
                     ↓
                 ユーザー制御
```

全モードで Security Layer（Hook + Sandbox + Permissions）は常時有効。モードの違いはオーケストレーション層の自動化レベルのみに影響する。

---

## 8. 統合ポイント

### MCP サーバー統合

```
┌──────────────────────────────────────────────────────┐
│                 MCP Integration                       │
│                                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │ Context7 │  │  Sentry  │  │  Memory  │  Global    │
│  │ (docs)   │  │ (errors) │  │ (graph)  │  Scope     │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘            │
│       │              │              │                  │
│  Builder         Scout          Nexus                  │
│  Artisan         Triage         全coordinator          │
│  Forge           Sentinel                              │
│  Anvil                                                 │
│                                                        │
│  ┌───────────┐  ┌────────────┐                        │
│  │ PostgreSQL│  │ Playwright │  Global /               │
│  │ (SQL)     │  │ (browser)  │  Project                │
│  └────┬──────┘  └────┬───────┘  Scope                  │
│       │               │                                │
│  Analyst          Navigator                             │
│  Schema           Voyager                               │
│  Tuner            Director                              │
│                   Probe                                  │
└──────────────────────────────────────────────────────┘
```

| MCP Server | 用途 | スコープ | エージェント親和性 | セキュリティ制約 |
|------------|------|---------|-------------------|----------------|
| **Context7** | ライブラリ最新ドキュメント注入 | Global (user) | Builder, Artisan, Forge, Anvil | - |
| **Sentry** | エラー監視・スタックトレース分析 | Global (user) | Scout, Triage, Sentinel | OAuth認証 |
| **Memory** | ナレッジグラフベース永続メモリ | Global (user) | Nexus, 全コーディネーター | ローカル保存のみ |
| **PostgreSQL** | 自然言語→SQL変換、データ分析 | Project | Analyst, Schema, Tuner | READ ONLYユーザー必須 |
| **Playwright** | ブラウザ操作・E2E・スクリーンショット | Global (user) | Navigator, Voyager, Director, Probe | ローカルブラウザのみ |

### Cloud 実行統合（GitHub Codespaces）

```
User Request
     │
     v
  [Nexus] ── タスク分類
     │
     ├── Agent Affinity Check
     │     Local固定: Lens, Judge, Cipher, Magi, Bridge,
     │                Canvas, Scribe, Quill
     │     Cloud固定: (ビルド/テスト/スキャン/データ処理)
     │
     ├── Signal Score 算出 (threshold: 2)
     │     +2: build/install/compile/train/backfill/watch/dev
     │     +1: pytest/test/docker/npm run
     │     +3: "cloud:" prefix
     │    -10: "local:" prefix
     │
     └── Score >= 2 → Cloud: cs run <command>
         Score <  2 → Local: 通常実行
```

| Cloud 実行条件 | ローカル実行条件 |
|---------------|-----------------|
| 実行見込み10分超 | 短時間（3分以内） |
| 大量ログ出力 | UI操作中心 |
| LLM/embedding/スクレイピング | 軽量確認（git status 等） |
| 並列2本以上 | エージェント親和性がlocal |
| メモリ推定8GB超 | |

### CI/CD 統合

```
┌─────────────────────────────────────────┐
│  .github/workflows/drift-check.yml      │
│                                          │
│  PR時にSKILL.md構造のドリフトを検出      │
│  → scripts/check-drift.sh を実行         │
│  → _base.tmpl テンプレートとの差異を検出  │
│  → 非準拠の場合はPRブロック              │
└─────────────────────────────────────────┘
```

---

## 9. 設計制約

### 絶対制約（Invariants）

| # | 制約 | 根拠 |
|---|------|------|
| 1 | **Hub-spoke**: 全通信はオーケストレーター経由 | エージェント間の直接通信は制御不能な複雑性を生む |
| 2 | **File ownership is law**: 並列実行時のファイルオーナーシップ厳守 | 並列書き込みによるコンフリクトを構造的に排除 |
| 3 | **Coordinator never codes**: コーディネーターは計画・委任・レビューに専念 | 役割混在は品質低下を招く |
| 4 | **Security-first**: deny は allow より先に評価 | 安全性を担保するために deny-first は不変 |
| 5 | **Simplicity first**: 最小影響コードを強制、過剰設計より3行の重複を許容 | 複雑性は最大のリスク |
| 6 | **Root cause only**: 一時的修正禁止、根本原因を見つけて直す | 技術的負債の蓄積を防止 |
| 7 | **Minimum viable chain**: 必要最小限のエージェント構成 | 不要なエージェントはコンテキスト消費とレイテンシの浪費 |
| 8 | **Context is precious**: `.agents/PROJECT.md` + `.agents/PROJECT_CONTEXT.md` で知識共有 | セッション横断の知識継続 |
| 9 | **Memory is persistent**: 学習内容を即座に永続化 | 修正指示の繰り返しを防止 |
| 10 | **SKIP=FAIL**: テストスキップは失敗と同義 | テスト負債の蓄積を防止 |

### トークン制約

| シナリオ | 上限 |
|---------|------|
| MEMORY.md | 60行 |
| Agent メモリ | 100行/ファイル |
| Handoff 通信 | 3,000 tokens |
| Branch 通信 | 1,000 tokens |
| Error report | 500 tokens |

### 並列実行制約

| メトリクス | 上限 |
|-----------|------|
| 最大同時ブランチ | 4 |
| ブランチあたり最大ステップ | 5 |
| 並列ステップ合計 | 15 |
| エスカレーション: NUDGE | 2分無応答 |
| エスカレーション: RETRY | 4分無応答（最大2回） |
| エスカレーション: RESET | 6分無応答 |

### アーキテクチャ決定記録（ADR 要約）

| 決定 | 理由 | トレードオフ |
|------|------|-------------|
| Registry Pattern（中央リポジトリ → per-project install） | バージョン管理と選択的インストールの両立 | プロジェクト間で定義が分岐する可能性 |
| Role Simulation（Sequential） | 単一セッションで完結、低レイテンシ | エージェント専門性の厳密さが低下 |
| Real Sessions（Parallel） | 真の並列実行、ファイルオーナーシップ制御 | セッション管理のオーバーヘッド |
| 4-Hook体制 | ツール実行のライフサイクル全体をカバー | Hook 実行による微小なレイテンシ |
| deny-first Permissions | 安全性の構造的担保 | 正当な操作が誤ブロックされる可能性 |
| Bloom Taxonomy モデルルーティング | タスク複雑度に応じたコスト最適化 | モデル選択の誤判定リスク |
| Cloud-first 実行 | ローカル環境のメモリ制約回避 | Codespaces の起動レイテンシとコスト |

---

## 付録

### A. プロトコル一覧

| カテゴリ | プロトコル | ファイル |
|---------|-----------|---------|
| **Core** | AUTORUN | `_common/AUTORUN.md` |
| | INTERACTION | `_common/INTERACTION.md` |
| | GUARDRAIL | `_common/GUARDRAIL.md` |
| | PARALLEL | `_common/PARALLEL.md` |
| | GIT_GUIDELINES | `_common/GIT_GUIDELINES.md` |
| **Intelligence** | MODEL_ROUTING | `_common/MODEL_ROUTING.md` |
| | ENGINE_ROUTING | `_common/ENGINE_ROUTING.md` |
| | ESCALATION | `_common/ESCALATION.md` |
| | SLIM_CONTEXT | `_common/SLIM_CONTEXT.md` |
| | CRITICAL_THINKING | `_common/CRITICAL_THINKING.md` |
| | SPEC_FIRST | `_common/SPEC_FIRST.md` |
| **Operations** | MEMORY | `_common/MEMORY.md` |
| | AGENT_MEMORY | `_common/AGENT_MEMORY.md` |
| | MAINTENANCE | `_common/MAINTENANCE.md` |
| | PROGRESS | `_common/PROGRESS.md` |
| | CONTEXT_RECOVERY | `_common/CONTEXT_RECOVERY.md` |
| | CONTEXT_HYGIENE | `_common/CONTEXT_HYGIENE.md` |
| | TEST_POLICY | `_common/TEST_POLICY.md` |
| | REVIEW_CHECKLIST | `_common/REVIEW_CHECKLIST.md` |
| | PTC | `_common/PTC.md` |
| | COMPONENT_SPEC | `_common/COMPONENT_SPEC.md` |
| **Automation** | WORKFLOW_AUTOMATION | `_common/WORKFLOW_AUTOMATION.md` |
| | SKILL_DISCOVERY | `_common/SKILL_DISCOVERY.md` |
| | TOOL_RISK | `_common/TOOL_RISK.md` (implied) |
| **Integration** | MCP | `_common/MCP.md` |
| | CLOUD_ROUTING | `_common/CLOUD_ROUTING.md` |
| | PROJECT_AFFINITY | `_common/PROJECT_AFFINITY.md` |
| | REVERSE_FEEDBACK | `_common/REVERSE_FEEDBACK.md` |

### B. エージェント Frontmatter 仕様

```yaml
---
name: AgentName                    # 必須: エージェント名
description: 説明文                # 必須: 役割の説明
model: sonnet | haiku | opus       # 必須: 使用モデル
permissionMode: full | read-only   # 必須: 権限モード
maxTurns: 20                       # 必須: 最大ターン数
memory: session | project | global # 必須: メモリスコープ
cognitiveMode: orchestration | ... # 任意: 認知モード
---
```

### C. settings.json 構造

```json
{
  "sandbox": {
    "enabled": true,
    "allowUnsandboxedCommands": false,
    "filesystem": {
      "denyRead": ["~/.aws/credentials", "~/.ssh/id_*", ...]
    }
  },
  "permissions": {
    "allow": ["Bash(npm test *)", "Bash(git status)", ...],
    "deny": ["Bash(rm -rf /)", "Bash(sudo *)", "Read(./.env)", ...]
  },
  "hooks": {
    "PreToolUse":  [{ "matcher": "*", "hooks": [{ "type": "command", "command": "node .claude/hooks/tool-risk.js" }] }],
    "PostToolUse": [{ "matcher": "*", "hooks": [{ "type": "command", "command": "node .claude/hooks/post-tool-use.js" }] }],
    "Elicitation": [{ "matcher": "*", "hooks": [{ "type": "command", "command": "node .claude/hooks/elicitation-guard.js" }] }],
    "Stop":        [{ "matcher": "*", "hooks": [{ "type": "command", "command": "node .claude/hooks/stop-hook.js" }] }]
  }
}
```
