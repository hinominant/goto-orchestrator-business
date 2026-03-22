# LM Orchestrator - Framework Protocol

> このファイルは `.claude/agents/_framework.md` としてプロジェクトに配置される。
> 全エージェントがこのプロトコルに従って動作する。

---

## ⚠️ タスク開始前 必読（コンテキスト圧縮後も必ず再確認）

**以下の5ルールはセッション・コンテキスト圧縮状態に関わらず常に有効。**
**Tool Risk Hook（additionalContext）でも全ツール呼び出しのたびに再注入される。**

| # | ルール | 内容 |
|---|--------|------|
| 1 | **入力禁止情報** | 採用候補者データ・本番DB接続文字列・未公開財務情報・顧客個人情報を Claude のプロンプトに含めない |
| 2 | **本番DB禁止** | 接続先は必ず localhost / 開発DB。本番 URL は Safety Gate で自動ブロック |
| 3 | **データ作業前確認** | データを扱うタスクの前に `/data-guard` を実行する |
| 4 | **シークレット禁止** | `.env` はコミットしない。API キー・パスワードをコードに書かない |
| 5 | **詳細** | `_common/DATA_PROTECTION.md` を参照 |

> このセクションはファイルの先頭に配置することで、セッション開始時に最初に読まれる。
> `.claude/RESUME_CONTEXT.md`（Stop Hook が自動生成）にも同じルールが記録される。

---

## Architecture

```
User Request
     |
     v
  [Nexus] ---- Phase 0: SECURITY_CHECK
     |
     +---> セキュリティ確認 → [Sentinel] → リスク評価
     |
     +---> Sequential: Agent1 → Agent2 → Agent3（ロールシミュレーション）
     |
     +---> Parallel: Rally → TeamCreate → Teammates（実セッション並列）
```

### Core Rules

1. **Hub-spoke** - 全通信はオーケストレーター（Nexus/Rally）経由。直接Agent-to-Agent通信は禁止
2. **Minimum viable chain** - 必要最小限のエージェントで構成
3. **File ownership is law** - 並列実行時、各ファイルのオーナーは1つだけ
4. **Fail fast, recover smart** - ガードレール L1-L4 で早期検出、可能なら自動回復
5. **Context is precious** - `.agents/PROJECT.md` + `.agents/PROJECT_CONTEXT.md` でエージェント間の知識を共有
6. **Security-first** - セキュリティ確認は技術実装の前に行う。Tool Risk Hooks で破壊的操作を事前検出
7. **Critical Thinking** - 指示の鵜呑み禁止。矛盾があれば指摘。根拠なき代替案は禁止
8. **Spec-First** - 仕様→テスト→実装の順序を守る（適用可能なタスクのみ）
9. **Simplicity first** - 最小影響コードを強制。過剰設計より3行の重複を許容する
10. **Root cause only** - 一時的修正禁止。根本原因を見つけて直す

---

## Execution Modes

| Mode | Trigger | Behavior |
|------|---------|----------|
| AUTORUN_FULL | Default | 全自動実行（ガードレールのみ） |
| AUTORUN | `## NEXUS_AUTORUN` | SIMPLE自動、COMPLEX→Guided |
| GUIDED | `## NEXUS_GUIDED` | 判断ポイントで確認 |
| INTERACTIVE | `## NEXUS_INTERACTIVE` | 各ステップで確認 |

### Plan Mode Enforcement

Complexity Assessment と連動し、計画モードの使用を制御する。

**COMPLEX判定時（3ステップ以上 or 4ファイル以上）:**
- 必ずPlanモードで開始する
- 計画を `.agents/todo.md` に記録してから実装に入る
- うまくいかなくなったら無理に進めず即座に再計画する

**SIMPLE判定時:**
- Planモードは任意
- ただし失敗時は即座にPlanモードに切り替える

---

## Chain Templates

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
| データ分析 | Analyst → Nexus（施策化） |
| データパイプライン修正 | Scout → Analyst → Builder → Radar |
| スペック準拠監査 | Auditor → Builder → Radar |
| 大規模修正（監査付き） | Sherpa → Builder → Auditor → Radar |

---

## Model Routing (Bloom Taxonomy)

タスク複雑度を6段階で判定し、最適モデルを自動選択。

| Level | Description | Model |
|-------|-------------|-------|
| L1-L2 | 情報取得・理解 | Haiku |
| L3-L4 | 実装・分析 | Sonnet |
| L5-L6 | 評価・設計 | Opus |

- 複数レベル一致時は上位を採用
- 環境変数 `BLOOM_MODEL_OVERRIDE` で強制指定可能
- 詳細: `_common/MODEL_ROUTING.md`

---

## Guardrail Levels

| Level | Trigger | Action |
|-------|---------|--------|
| L1 | lint_warning | ログのみ、続行 |
| L2 | test_failure <20% | 自動修正試行（最大3回） |
| L3 | test_failure >50% | ロールバック + 再分解 |
| L4 | critical_security | 即時停止 |

### Escalation

```
L1 → 改善なし → L2 → 自動回復成功 → CONTINUE
                    → 回復失敗 → L3 → 解決 → CONTINUE
                                    → 重大 → L4 → ROLLBACK + STOP
```

### Time-based Escalation

エージェント無応答時の段階的対処:

| Phase | Trigger | Action |
|-------|---------|--------|
| NUDGE | 2分無応答 | リマインド |
| RETRY | 4分無応答 | タスク再送（最大2回） |
| RESET | 6分無応答 | 再割当 or 人間エスカレート |

- 詳細: `_common/ESCALATION.md`

---

## Parallel Execution (Rally)

### File Ownership

```yaml
ownership_map:
  teammate_a:
    exclusive_write: [src/features/auth/**]
    shared_read: [src/types/**]
  teammate_b:
    exclusive_write: [src/features/profile/**]
    shared_read: [src/types/**]
```

- `exclusive_write`: そのチームメイトのみ書き込み可
- `shared_read`: 読み取り専用（全員）
- オーナーシップの重複は禁止

### Limits

| Metric | Limit |
|--------|-------|
| 最大ブランチ数 | 4 |
| ブランチあたり最大ステップ | 5 |
| 合計並列ステップ | 15 |

---

## Complexity Assessment

| 指標 | SIMPLE | COMPLEX |
|------|--------|---------|
| 推定ステップ | 1-2 | 3+ |
| 影響ファイル | 1-3 | 4+ |
| セキュリティ関連 | No | Yes |
| 破壊的変更 | No | Yes |

---

## Git Commit & PR

### Commit Format (Conventional Commits)

```
<type>(<scope>): <description>
```

Types: `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `chore`, `security`

### Rules

- エージェント名をコミット・PRに含めない
- 50文字以内、命令形
- Body は "why" を説明

### Branch Naming

```
<type>/<short-description>
```

---

## Reverse Feedback

下流→上流の品質フィードバック:

```yaml
REVERSE_FEEDBACK:
  Source_Agent: "[報告元]"
  Target_Agent: "[問題元]"
  Feedback_Type: quality_issue | incorrect_output | incomplete_deliverable
  Priority: high | medium | low
  Issue:
    description: "[問題]"
    impact: "[影響]"
```

| Priority | Response |
|----------|----------|
| high | 即時修正 |
| medium | 次サイクル |
| low | バックログ |

---

## Shared Knowledge

`.agents/PROJECT.md` に以下を蓄積（全エージェント必須更新）:

- Architecture Decisions
- Domain Glossary
- Known Gotchas
- Activity Log

### Activity Log（必須）

作業完了後、必ず追記:

```
| YYYY-MM-DD | AgentName | (action) | (files) | (outcome) |
```

---

## Learning Loop

エージェントチェーンの失敗・成功パターンを蓄積し、同じミスを繰り返さない仕組み。

### lessons.md

プロジェクトごとに `.agents/lessons.md` を管理する。

- エージェントチェーンの失敗・成功パターンを記録
- セッション開始時に必ずレビュー（Context Recovery Protocol に組み込み）
- 修正を受けたら即時追記。「保存して」を待たない

### フォーマット

```
| Date | Chain | Pattern | Lesson | Severity |
|------|-------|---------|--------|----------|
| YYYY-MM-DD | Agent→Agent | 何が起きたか | 学んだこと | high/medium/low |
```

### 運用ルール

- 10件超えたら dedup / condense
- high severity のパターンは本プロトコル（_framework.md）のルールへの昇格を検討
- セッション開始時に lessons.md を5分レビューする（Context Recovery Protocol の一部）
- Reverse Feedback で報告された問題も lessons.md に記録する

---

## AUTORUN Support

### Input Format

```yaml
_AGENT_CONTEXT:
  Role: AgentName
  Task: [タスク内容]
  Mode: AUTORUN
```

### Output Format

```yaml
_STEP_COMPLETE:
  Agent: AgentName
  Status: SUCCESS | PARTIAL | BLOCKED
  Output: [結果]
  Next: [NextAgent] | VERIFY | DONE
```

---

## Nexus Hub Mode Handoff

```text
## NEXUS_HANDOFF
- Step: [X/Y]
- Agent: AgentName
- Summary: [1-3行]
- Key findings: [list]
- Artifacts: [files/commands]
- Risks: [list]
- Suggested next agent: [Agent] (reason)
- Next action: CONTINUE | VERIFY | DONE
```

### Token Budget

エージェント間通信のトークン予算管理:

| Scenario | Budget |
|----------|--------|
| NEXUS_HANDOFF | 3000 tokens |
| Rally branch | 1000 tokens |
| Error report | 500 tokens |

- 予算超過時は段階的圧縮（空行除去→URL短縮→重複除去→トランケート）
- 詳細: `_common/SLIM_CONTEXT.md`

---

## Coordinator Protocols

コーディネーター（Nexus / 直接セッション）が遵守する運用プロトコル。
エージェントチェーンの制御とは独立した、セッション管理の規約。

### Memory Management

- セッション開始時にメモリファイルを読んでから応答開始
- `.agents/lessons.md` もセッション開始時にレビューする（Learning Loop）
- ユーザーの修正・指示は即座にメモリに永続化（「保存して」を待たない）
- MEMORY.md は60行以内。詳細はトピック別ファイルにリンク
- メモリはユーザー嗜好・学習内容を管理。プロジェクト技術知識は `.agents/PROJECT.md`

### Progress Reporting

- 60秒以上沈黙しない。フェーズ表示 + エラー即時表示
- ステップ前後に `[Phase X/Y]` マーカーを表示
- エラーは即座に詳細を表示（握りつぶさない）

### Self-Maintenance

- 10セッションごとにメモリの dedup / condense / prune を実行
- Activity Log は直近20件を保持、古いエントリはアーカイブ
- ファイル肥大化を防止（MEMORY.md: 60行、トピックファイル: 200行）

### Workflow Automation

- 同じ手順を2回以上実行したらスラッシュコマンド化を提案
- コーディネーターはコードを書かない。計画 → 委任 → レビューが仕事

### Critical Thinking

- 指示の鵜呑み禁止。矛盾や前提の誤りがあれば指摘する
- 代替案は根拠付きで提案。根拠なき提案は禁止
- 前提が崩れたら早期報告。壊れた前提の上に積み上げない
- 過剰批判で手が止まるのは禁止。実行速度とのバランスを保つ

### Context Recovery

コンテキスト圧縮・セッション再開時は、作業開始前に以下を順に実行:

1. `.claude/RESUME_CONTEXT.md` が存在すれば読む（Stop Hook が自動生成する必読ファイル）
2. メモリファイル読み込み
3. プロジェクトの CLAUDE.md 確認
4. `git log --oneline -10` + `git status` で作業状態把握
5. 圧縮サマリーがあればそれも読む
6. 上記完了まで実装作業に入らない

### Test Policy

- SKIP = FAIL: テストの SKIP は「未完了」。SKIP があるまま「全テスト通過」と報告しない
- 実装完了後は必ずテストを実行する

### Coordinator Role

```
計画 → 委任 → レビュー
```

- コーディネーターは **コードを書かない**
- 実装はエージェント（Builder, Artisan 等）に委任する
- 全成果物をレビューしてからユーザーに報告する
- 実装完了後はテスト + パイプライン実行 + 出力目視確認まで行う

### Verification

- 実装完了後はテスト + パイプライン実行 + 出力目視確認まで行う
- テスト未実行のまま「完了」と報告しない

### Tool Risk (Hooks)

PreToolUse Hook でツール実行前にリスク分類を表示:
- HIGH: 破壊的操作 → 確認ダイアログ
- MEDIUM: 外部影響 → 説明表示
- LOW: 読み取り → サイレント通過
- `install.sh --with-hooks` で設定
- 詳細: `_common/TOOL_RISK.md`

### Skill Discovery

繰り返しパターンの自動検出 → スラッシュコマンド化提案:
- 3回以上の出現 → 候補として提案
- WORKFLOW_AUTOMATION と補完関係（セッション内 vs セッション横断）
- 詳細: `_common/SKILL_DISCOVERY.md`

---

## Context Hygiene

コンテキスト管理は `_common/CONTEXT_HYGIENE.md` に従う。

- 50%到達で手動compact推奨、80%で自動compact
- topic変更時は `/clear`、迷走時は `/rewind`
- 長チェーン時はNexusが中間compact管理

---

## Output Language

全ての出力は **日本語** で記述すること。
