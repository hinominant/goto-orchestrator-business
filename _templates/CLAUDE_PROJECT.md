# Agent Orchestrator - Framework Protocol

> このファイルは `.claude/agents/_framework.md` としてプロジェクトに配置される。
> 全エージェントがこのプロトコルに従って動作する。

---

## Architecture

```
User Request
     |
     v
  [Nexus] ---- Phase 0: EXECUTIVE_REVIEW
     |
     +---> CEO判断が必要？ → [CEO] → 方針・制約を付与
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
5. **Context is precious** - `.agents/PROJECT.md` + `.agents/LUNA_CONTEXT.md` でエージェント間の知識を共有
6. **CEO-first for business** - ビジネス判断は技術実装の前にCEOが方針を出す

---

## Execution Modes

| Mode | Trigger | Behavior |
|------|---------|----------|
| AUTORUN_FULL | Default | 全自動実行（ガードレールのみ） |
| AUTORUN | `## NEXUS_AUTORUN` | SIMPLE自動、COMPLEX→Guided |
| GUIDED | `## NEXUS_GUIDED` | 判断ポイントで確認 |
| INTERACTIVE | `## NEXUS_INTERACTIVE` | 各ステップで確認 |

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
| セキュリティ監査 | Sentinel → Builder → Radar |
| PR準備 | Guardian → Judge |
| ビジネス/戦略 | CEO → Sherpa → Forge/Builder → Radar |
| データ分析 | Analyst → CEO（意思決定要時）→ Nexus（施策化） |

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

---

## Coordinator Protocols

コーディネーター（Nexus / 直接セッション）が遵守する運用プロトコル。
エージェントチェーンの制御とは独立した、セッション管理の規約。

### Memory Management

- セッション開始時にメモリファイルを読んでから応答開始
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

### Coordinator Role

```
計画 → 委任 → レビュー
```

- コーディネーターは **コードを書かない**
- 実装はエージェント（Builder, Artisan 等）に委任する
- 全成果物をレビューしてからユーザーに報告する
- 実装完了後はテスト + パイプライン実行 + 出力目視確認まで行う

---

## Context Hygiene

コンテキスト管理は `_common/CONTEXT_HYGIENE.md` に従う。

- 50%到達で手動compact推奨、80%で自動compact
- topic変更時は `/clear`、迷走時は `/rewind`
- 長チェーン時はNexusが中間compact管理

## ALICE Integration

ALICE（ARIS/LROS/NOVA/Secretary）統合については `_common/ALICE_INTEGRATION.md` を参照。

- CEO: ARIS 4-mind統合（Founder/Vision/Execution/Audit）
- Analyst: LROS SSoT参照
- Radar: QA Health Score + Diff-Aware Mode

---

## Output Language

全ての出力は **日本語** で記述すること。
