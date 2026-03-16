# Agent Selection Guide

> プロジェクトに最適なエージェント構成を選択するためのガイド。

---

## 選択原則

1. **最小構成から始める** — 必要になったら追加。全68エージェントは不要
2. **コアは必ず入れる** — Nexus + Builder + Radar は基本セット
3. **CEO はビジネス判断がある場合のみ** — 純粋な技術プロジェクトでは不要
4. **ALICE統合はLunaプロジェクトのみ** — 外部プロジェクトではALICEコンポーネント不要

---

## プリセット構成

### Minimal（5エージェント）
最小限の開発チーム。

```bash
install.sh nexus builder radar scout guardian
```

### Standard（10エージェント）
標準的なフルスタック開発。

```bash
install.sh nexus rally sherpa builder artisan radar sentinel judge zen guardian
```

### Full Stack + CEO（13エージェント）
ビジネス判断を含むフルスタック開発。

```bash
install.sh nexus rally sherpa builder artisan forge radar sentinel judge zen guardian ceo analyst
```

### Luna Project（16エージェント）
Luna プロジェクト向け。ALICE統合あり。

```bash
install.sh nexus rally sherpa builder artisan forge radar sentinel judge zen guardian ceo analyst auditor architect launch
```

### Data-Heavy（8エージェント）
データ分析・KPI重視のプロジェクト。

```bash
install.sh nexus analyst ceo pulse experiment researcher canvas sherpa
```

---

## タスク別推奨エージェント

| Task Type | Required | Optional |
|-----------|----------|----------|
| バグ修正 | Nexus, Scout, Builder, Radar | Sentinel, Sherpa |
| 新機能開発 | Nexus, Builder, Radar | Sherpa, Rally, Forge, Artisan |
| リファクタリング | Nexus, Zen, Radar | Atlas, Ripple |
| セキュリティ | Nexus, Sentinel, Probe, Radar | Builder |
| PR準備 | Guardian, Judge | Radar |
| データ分析 | Analyst, CEO | Nexus, Pulse |
| パフォーマンス | Bolt, Radar | Tuner, Builder |
| ドキュメント | Quill, Scribe | Canvas, Morph |

---

## ALICE Chain（Luna専用）

ALICE統合を使用するチェーン:

| Chain | Flow |
|-------|------|
| ビジネス判断 | CEO(ARIS 4-mind) → Nexus → Builder → Radar |
| データ分析 | Analyst(LROS SSoT) → CEO → Nexus |
| 品質監査 | Auditor(ARIS Audit) → CEO → Nexus |
| 振り返り | `/retro` → ARIS feedback pipeline |

---

## Model コスト考慮

| Model | Cost | Use |
|-------|------|-----|
| opus | $$$ | CEO のみ（意思決定） |
| sonnet | $$ | 大半のエージェント（デフォルト） |
| haiku | $ | Sherpa、Skills |

コスト最適化: Tier 1 以外のエージェントはデフォルト sonnet。明確な理由がある場合のみ変更。
