# Review Checklist Protocol

> チェックリスト as Code — 構造化されたレビュー基準で品質を担保する。

---

## Severity分類

### CRITICAL（ブロッキング）
PRマージを **ブロック** する問題。修正必須。

### INFORMATIONAL（PR本文記載）
改善推奨だがブロックしない。PR本文に記載して追跡。

---

## 8カテゴリ チェックリスト

### 1. Functionality（機能）
- [ ] 要件を満たしているか
- [ ] エッジケース（null, 空配列, 境界値）の処理
- [ ] 既存機能のリグレッションがないか

### 2. Types（型設計）
- [ ] `any` 型が使用されていないか
- [ ] `unknown` に適切な型ガードがあるか
- [ ] Generics が適切に使用されているか
- [ ] null/undefined の処理が明示的か

### 3. Error Handling（エラー処理）
- [ ] try-catch のスコープが適切か
- [ ] エラーメッセージが具体的か
- [ ] リソースリーク（未クローズのコネクション等）がないか
- [ ] API エラーの適切なハンドリング

### 4. Tests（テスト）
- [ ] 新規コードパスにテストがあるか
- [ ] エッジケーステストがあるか
- [ ] 既存テストが更新されているか
- [ ] テストが実行順序に依存していないか

### 5. Security（セキュリティ）
- [ ] ユーザー入力のバリデーション
- [ ] SQLインジェクション / XSS 対策
- [ ] 認証・認可チェック
- [ ] シークレットのハードコーディングなし

### 6. Accessibility（アクセシビリティ）
- [ ] セマンティックHTML
- [ ] ARIA属性の適切な使用
- [ ] キーボード操作対応
- [ ] カラーコントラスト（4.5:1以上）

### 7. Performance（パフォーマンス）
- [ ] N+1クエリがないか
- [ ] 不要な再レンダリングがないか
- [ ] 大量データの適切なページネーション
- [ ] メモリリークの可能性

### 8. Code Quality（コード品質）
- [ ] 関数が30行以下か
- [ ] パラメータが3個以下か
- [ ] 命名が明確か
- [ ] DRY原則（不要な重複なし）

---

## Suppressions（False Positive除外）

以下のパターンはチェック対象外:

```yaml
suppressions:
  - pattern: "test/**/*.test.ts"
    skip: [types, performance]
    reason: "テストファイルでは any 型や非効率なパターンを許容"
  - pattern: "scripts/**"
    skip: [types]
    reason: "スクリプトファイルは型厳密性を緩和"
  - pattern: "*.config.*"
    skip: [code-quality]
    reason: "設定ファイルは構造が固定"
```

---

## レビュー出力形式

```markdown
## Review Summary

### CRITICAL (N件)
| # | Category | File | Line | Issue | Fix |
|---|----------|------|------|-------|-----|

### INFORMATIONAL (N件)
| # | Category | File | Line | Issue | Suggestion |
|---|----------|------|------|-------|------------|

### Positive Feedback
- [良い点を具体的に]
```
