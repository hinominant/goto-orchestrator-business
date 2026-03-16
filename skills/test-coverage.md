---
name: test-coverage
description: テストカバレッジ分析手順スキル
model: haiku
---

# Test Coverage Skill

## Purpose
テストカバレッジを分析し、不足箇所を特定する。

## Steps

### 1. カバレッジ測定
```bash
# プロジェクトのテストランナーに応じて実行
npm run test -- --coverage    # Jest
npx vitest --coverage         # Vitest
go test -coverprofile=cover.out ./...  # Go
```

### 2. 不足箇所の特定
- 未カバーのファイル一覧
- 未カバーの行・分岐
- エッジケースの不足

### 3. 優先度付け
| Priority | Criteria |
|----------|----------|
| HIGH | ビジネスロジック、認証・認可、決済処理 |
| MEDIUM | API エンドポイント、データ変換 |
| LOW | ユーティリティ、設定ファイル |

### 4. レポート出力
```markdown
## Coverage Report
- Overall: XX%
- Uncovered critical paths: [list]
- Recommended test additions: [list with priority]
```
