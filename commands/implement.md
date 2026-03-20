# Implement — 新機能追加義務ワークフロー

goto-orchestrator-business に何か新しいものを追加・変更する際の**必須ワークフロー**。
テスト・ドキュメント・自動修復の3点セットを強制する。

**省略・入れ替え禁止。**

## タスク

$ARGUMENTS

---

## 実行手順

### Step 1: 実装前宣言（コードを書く前に必ず記述）

以下を先に宣言する:

```
【追加するもの】（1行で）

【テストファイル】
- パス: tests/hooks/tool-risk.test.js（またはその他）
- テスト名: （追加するテストの名前）

【ドキュメント更新対象】
- （更新するファイルパス、なければ「なし」）

【auto-repair.js 更新要否】
- tool-risk.js の SAFETY_GATE_PATTERNS / HIGH_RISK_PATTERNS を変更する: YES / NO
```

宣言なしに実装を開始した場合 = 手順スキップ → `/quality-gate` 失敗扱い

---

### Step 2: テストを先に書く（RED 確認）

テストファイルに新しいテストケースを追加する。実装はまだしない。

```bash
npm test
```

**新しいテストが FAIL することを確認する（RED）。**
すでに PASS する場合 → テストが実装を検証できていない。テスト内容を見直す。

---

### Step 3: 実装（GREEN）

テストが PASS するよう実装する。

```bash
npm test
```

全テスト PASS を確認。

---

### Step 4: ドキュメント更新

**hook パターン追加の場合（必須）:**
- `docs/SECURITY_ARCHITECTURE.md` — 新パターンの根拠と設計判断
- `docs/DESIGN_DECISIONS.md` — ADR 追記（なぜ BLOCK にしたか / HIGH にしたか）

**auto-repair.js 更新が YES の場合（必須）:**

`scripts/auto-repair.js` の `healthCheck` 関数に検証を追加:

```javascript
// 新しいパターンの存在確認
if (!toolRiskContent.includes('パターンを識別できる固有文字列')) {
  findings.push({ type: 'CRITICAL', message: 'XxxパターンがBLOCKリストから消えています' });
}
```

---

### Step 5: 完了チェックリスト

- [ ] テストケースが追加された（npm test の件数が増えた）
- [ ] 全テスト PASS
- [ ] Step 1 で宣言したドキュメントが更新された
- [ ] auto-repair.js YES の場合、health check に追加した
- [ ] settings.json の `_comment` に新パターンへの言及を追記した（任意だが推奨）

全項目チェック後 → `/quality-gate` を実行してコミット。

---

## ルール

- Step 1 の宣言なしに実装を始めた → 手順スキップとして `/log-failure` 自動記録
- テストは実装前に書く（RED→GREEN 順序厳守）
- ドキュメントは実装と同じコミットに含める（「後で書く」禁止）
- このスキルは goto-orchestrator-business への全ての新機能追加で必須
