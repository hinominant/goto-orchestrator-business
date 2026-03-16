# Frontmatter Specification

> エージェント SKILL.md の YAML frontmatter 仕様定義。

---

## フィールド定義

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | **Yes** | — | エージェント表示名 |
| `description` | string | **Yes** | — | エージェントの役割説明（1行） |
| `model` | enum | No | `sonnet` | `opus` / `sonnet` / `haiku` |
| `permissionMode` | enum | No | `full` | `full` / `read-only` / `plan-only` / `bypassPermissions` |
| `maxTurns` | integer | No | 15 | 最大ターン数（1-50） |
| `memory` | enum | No | `session` | `session` / `project` / `global` |
| `isolation` | enum | No | — | `worktree`（Git worktree分離） |
| `tools` | string[] | No | all | 使用可能ツールリスト |
| `disallowedTools` | string[] | No | [] | 使用禁止ツールリスト |
| `skills` | string[] | No | [] | 参照スキルリスト |
| `cognitiveMode` | string | No | — | 認知モード識別子 |
| `aliceRole` | string | No | — | ALICE統合ロール |
| `hooks` | object | No | — | フック設定 |
| `background` | boolean | No | false | バックグラウンド実行 |

---

## Model Routing（Bloom Taxonomy対応）

| Bloom Level | Model | Use Case |
|-------------|-------|----------|
| Create / Evaluate | `opus` | 設計判断、意思決定、新規アーキテクチャ |
| Analyze / Apply | `sonnet` | 実装、テスト、分析、オーケストレーション |
| Remember / Understand | `haiku` | 情報検索、分解、単純変換 |

---

## Frontmatter例

### Opus エージェント（CEO）
```yaml
---
name: CEO
description: 意思決定エージェント
model: opus
permissionMode: plan-only
maxTurns: 10
memory: project
cognitiveMode: executive-decision
aliceRole: aris-founder
---
```

### Sonnet エージェント（Builder）
```yaml
---
name: Builder
description: 本番実装エージェント
model: sonnet
permissionMode: full
maxTurns: 30
memory: session
---
```

### Haiku エージェント（Sherpa）
```yaml
---
name: Sherpa
description: タスク分解エージェント
model: haiku
permissionMode: read-only
maxTurns: 5
memory: session
---
```

---

## バリデーションルール

1. `name` と `description` は必須
2. `model` は `opus` / `sonnet` / `haiku` のいずれか
3. `permissionMode` は `full` / `read-only` / `plan-only` / `bypassPermissions` のいずれか
4. `maxTurns` は 1-50 の整数
5. `memory` は `session` / `project` / `global` のいずれか
6. `tools` と `disallowedTools` は相互排他
7. YAML として有効であること（`scripts/check-drift.sh` で検証）
