---
name: data-retrieval
description: LROS/Redash からのデータ取得手順スキル
model: haiku
---

# Data Retrieval Skill

## Purpose
LROS または Redash からデータを取得するための標準手順。

## Steps

### 1. データソース特定
- LROS API: 指標定義、月次メトリクス
- Redash: クエリベースのデータ取得

### 2. Redash経由の取得
```bash
# クエリ結果取得
scripts/redash/query.sh <query_id>

# パラメータ付き
scripts/redash/query.sh <query_id> '{"p_start_date":"YYYY-MM-DD","p_end_date":"YYYY-MM-DD"}'

# CSV出力
scripts/redash/query.sh <query_id> '' csv
```

### 3. バリデーション
- レスポンスのHTTPステータス確認
- データ件数の妥当性チェック
- 期間・フィルタ条件の確認

### 4. 出力
取得データは `artifacts/redash/` に保存（gitignore対象）。
