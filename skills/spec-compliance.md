---
name: spec-compliance
description: SPEC準拠チェック手順スキル
model: haiku
---

# Spec Compliance Skill

## Purpose
コードや設計がプロジェクトSPECに準拠しているかチェックする。

## Steps

### 1. SPEC参照
- `.agents/PROJECT.md` のプロジェクト仕様を確認
- `.agents/LUNA_CONTEXT.md` のビジネス文脈を確認
- 該当するドメインのSPEC文書を特定

### 2. 準拠チェック
| チェック項目 | 確認内容 |
|-------------|---------|
| 命名規則 | SPEC定義の命名パターンに従っているか |
| データ型 | SPEC定義の型定義に合致しているか |
| API契約 | エンドポイント・レスポンス形式がSPEC通りか |
| ビジネスルール | ドメインロジックがSPEC通りか |

### 3. 違反レポート
```markdown
| 違反箇所 | SPEC条項 | 現状 | 修正案 |
|----------|---------|------|--------|
```

### 4. 自動修正候補
修正が自明な違反は修正コードを提案。
