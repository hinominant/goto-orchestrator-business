# ALICE Integration Protocol

> ALICE = ARIS + LROS + NOVA + Secretary の統合フレームワーク。

---

## コンポーネントマップ

| Component | Role | Domain |
|-----------|------|--------|
| **ARIS** | 判断エンジン | 意思決定、パターン学習、監査 |
| **LROS** | データ基盤 | 指標定義、SSoT、データ取得 |
| **NOVA** | 分析エンジン | データ分析、異常検知、予測 |
| **Secretary** | 実行エンジン | タスク管理、スケジュール、通知 |

---

## データフロー

```
User Request
     │
     ▼
  ┌──────┐    判断要求     ┌──────┐
  │ Nexus │───────────────→│ CEO  │
  └──┬───┘                └──┬───┘
     │                       │ ARIS 4-mind
     │                       ▼
     │    ┌─────────────────────────────────┐
     │    │ Founder → Vision + Execution    │
     │    │          → Audit (常時)          │
     │    └─────────────────────────────────┘
     │                       │
     ▼                       ▼
  ┌──────────┐         ┌──────────┐
  │ Analyst  │◄───────→│  LROS    │
  │ (NOVA)   │  SSoT   │  (Data)  │
  └──────────┘         └──────────┘
     │
     ▼
  ┌──────────┐
  │ Builder  │──→ Radar ──→ Auditor
  └──────────┘         (QA Score)
```

---

## エージェント ↔ ALICE コンポーネント対応表

| Agent | ALICE Component | Integration |
|-------|-----------------|-------------|
| CEO | ARIS (Founder/Vision/Execution/Audit) | 4-mind判断プロトコル |
| Analyst | LROS + NOVA | SSoT指標参照 + データ分析 |
| Auditor | ARIS (Audit) | パターン照合 + リスク検知 |
| Nexus | Secretary | タスク管理 + ルーティング |
| Radar | — | QA Health Score → ARIS feedback |
| Builder | — | 実装 → ARIS feedback |

---

## ARIS Knowledge Pipeline

### フィードバックフォーマット

成功/失敗パターンをARISに報告する際の統一フォーマット:

```yaml
aris_feedback:
  type: success | failure
  source_agent: [agent_name]
  date: YYYY-MM-DD
  context:
    project: [project_name]
    task_type: [BUG|FEATURE|SECURITY|REFACTOR|...]
    chain: [agent chain used]
  pattern:
    name: [pattern_name]
    description: [what happened]
    root_cause: [why — for failures]
    approach: [what was done]
    outcome: [result]
  classification:
    reusability: HIGH | MEDIUM | LOW
    severity: CRITICAL | HIGH | MEDIUM | LOW  # for failures
    category: [judgment|process|technical|communication]
  prevention:  # for failures
    rule: [prevention rule]
    check: [how to detect early]
```

### パイプライン

1. エージェントが成功/失敗を検知
2. `skills/aris-feedback.md` の手順でフォーマット化
3. ARIS pattern dictionary に候補として記録
4. CEO/Auditor が次回判断時に参照

---

## LROS SSoT ルール

1. **指標定義は LROS が唯一の真実** — 独自定義禁止
2. **metrics_monthly テーブルを基準** — 集計ロジックはLROS準拠
3. **異常値は LROS 定義の閾値で判定** — 独自閾値禁止
4. **新指標追加は LROS SPEC に従う** — Analyst が提案 → CEO が承認 → LROS に定義

---

## セットアップ

### 前提
- ARIS: `docs/success_pattern_dictionary.md`, `docs/failure_pattern_dictionary.md`, `docs/judgment_criteria_dictionary.md`
- LROS: `lros` リポジトリ（ローカル `/Users/Keiji/dev/lros`）
- NOVA: Analyst エージェント経由
- Secretary: Nexus エージェント経由

### プロジェクトへの導入
1. `install.sh` で標準インストール
2. `.agents/LUNA_CONTEXT.md` にALICEコンポーネント参照を追記
3. ARIS pattern dictionaries をプロジェクトルートの `docs/` に配置
