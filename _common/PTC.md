# PTC: Programmatic Tool Calling

> バッチツール操作パターンでトークン効率を最大化する。

---

## 基本原則

1. **並列化可能なものは並列に** — 独立した操作は1メッセージで同時実行
2. **チェーンは最短に** — 依存関係がある場合のみ逐次実行
3. **冗長な読み込みを避ける** — 一度読んだ内容は再読不要

---

## パターン集

### Pattern 1: Parallel Read（並列読み込み）

複数ファイルを同時に読む。依存関係がない場合は必ず並列化。

```
# BAD: 逐次読み込み
Read(file_a) → Read(file_b) → Read(file_c)

# GOOD: 並列読み込み（1メッセージで3ツール）
Read(file_a) + Read(file_b) + Read(file_c)
```

### Pattern 2: Chained Search（連鎖検索）

検索結果に基づいて次の検索を行う。結果が入力になる場合のみ逐次。

```
# Step 1: ファイル特定
Glob("**/auth*.ts")

# Step 2: 結果のファイルを読む（並列）
Read(found_file_1) + Read(found_file_2)

# Step 3: 関連コードを検索
Grep("AuthService", path=found_file_1)
```

### Pattern 3: Batch Edit（バッチ編集）

同一ファイル内の複数箇所を1回のEditで処理。異なるファイルは並列Edit。

```
# BAD: 同じファイルへの逐次Edit
Edit(file_a, change_1) → Edit(file_a, change_2)

# GOOD: 異なるファイルへの並列Edit
Edit(file_a, change_1) + Edit(file_b, change_2)
```

### Pattern 4: Speculative Search（投機的検索）

正確な場所が分からない場合、複数パターンで同時検索。

```
# 並列で複数パターンを試行
Glob("**/config*.ts") + Glob("**/settings*.ts") + Grep("DATABASE_URL")
```

### Pattern 5: Agent Delegation（エージェント委譲）

独立した調査タスクは Agent ツールで並列化。

```
# 並列エージェント起動
Agent("調査A: APIエンドポイント") + Agent("調査B: DB スキーマ")
```

---

## トークン効率化ガイドライン

| ルール | 効果 |
|--------|------|
| 並列ツール呼び出し | ラウンドトリップ削減 |
| Glob/Grep で絞ってから Read | 不要なファイル読み込み回避 |
| Edit で差分のみ送信（Write より優先） | 転送量削減 |
| Agent で重い調査を委譲 | メインコンテキスト保護 |
| head_limit で出力制限 | 不要な出力抑制 |

---

## アンチパターン

| パターン | 問題 | 改善 |
|----------|------|------|
| 1ファイルずつ逐次Read | ラウンドトリップ過多 | 並列Read |
| Read全体 → Grep | 全文読み込みの無駄 | Grep先 → 必要部分のみRead |
| 同じファイルを複数回Read | トークン浪費 | 1回で読み切る |
| Agent で単純検索 | オーバーヘッド | 直接 Glob/Grep |
