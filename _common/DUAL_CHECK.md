# Dual-Check Protocol — 2人体制強制プロトコル

## 概要

以下の3領域は**必ず2人体制（主査＋副査）で運用する**。1人だけの起動は禁止。

## ペア定義

| 領域 | 主査（評価実行） | 副査（クロスチェック） | 起動コマンド例 |
|------|----------------|---------------------|--------------|
| 上場審査・IT統制 | **compliance** | **comptroller** | `compliance → comptroller` |
| 個人情報保護 | **privacy** | **datashield** | `privacy → datashield` |
| 法務 | **counsel** | **advocate** | `counsel → advocate` |

## 強制ルール

### 1. 単独起動禁止

主査・副査のいずれも**単独で最終判断を出してはならない**。

- 主査が評価を完了したら、必ず副査にハンドオフする
- 副査のクロスチェックなしに「PASS」「問題なし」等の最終判断を出すことは禁止
- 主査の出力には必ず `CrossCheckRequired: true` を含める

### 2. Nexus からの起動時

Nexus（オーケストレーター）がこれらのエージェントを起動する場合:

```yaml
# 正しい起動（ペアで連鎖）
_AGENT_CHAIN:
  - Agent: Compliance
    Next: Comptroller  # 必須
  - Agent: Comptroller
    Next: Nexus

# 禁止（単独起動）
_AGENT_CONTEXT:
  Role: Compliance
  # Next に Comptroller がない → プロトコル違反
```

### 3. 副査の判定権限

副査は以下の2つの判定のみを出す:

- **APPROVED**: 主査の評価に同意（独自の検証根拠付き）
- **RETURNED**: 主査に差し戻し（具体的な改善点を提示）

副査が RETURNED を出した場合、主査は指摘事項を修正して再度ハンドオフする。このサイクルは APPROVED が出るまで繰り返す。

### 4. 3領域統合監査

3領域全てを統合的に監査する場合の推奨チェーン:

```
Nexus
  → Compliance → Comptroller（上場審査・IT統制）
  → Privacy → Datashield（個人情報保護）
  → Counsel → Advocate（法務）
  → Nexus（統合レポート）
```

各ペアは並列実行可能（Rally 経由）。ただし、ペア内の主査→副査は直列。

### 5. 違反検知

以下のいずれかに該当する場合、プロトコル違反として警告する:

- 主査が `CrossCheckRequired: true` なしに最終出力を返した
- 副査なしに `NEXUS_HANDOFF` で `Next action: DONE` を返した
- 副査が主査のレポートを受領せずに単独で判断を出した

## 呼び出しパターン

### パターン A: Nexus AUTORUN（推奨）

```
User: 「上場審査チェックをして」
  → Nexus が Compliance を起動
    → Compliance が評価実行 → COMPLIANCE_REVIEW_HANDOFF を出力
      → Nexus が Comptroller を起動（Compliance の出力を入力として）
        → Comptroller がクロスチェック → APPROVED or RETURNED
          → RETURNED なら Compliance に差し戻し
          → APPROVED なら Nexus に返却
```

### パターン B: 直接起動

```
User: 「@compliance 〇〇を評価して」
  → Compliance が評価実行
  → 最終出力に「⚠️ comptroller によるクロスチェックが必要です」を付加
  → User が @comptroller を起動（Compliance の出力を入力として）
```

### パターン C: 3領域統合（Rally 並列）

```
User: 「全領域の監査をして」
  → Nexus → Rally（並列起動）
    → [Compliance → Comptroller]（上場審査）
    → [Privacy → Datashield]（個人情報）
    → [Counsel → Advocate]（法務）
  → Nexus が3領域の結果を統合レポート
```
