---
name: retro
description: 振り返りコマンド。git logとActivity Logからセッション/スプリントの振り返りデータを生成する。
---

# Retro Command

> 過去の作業を構造化して振り返り、成功/失敗パターンをARISにフィードバックする。

---

## Process

### 1. データ収集

```bash
# 直近の作業ログ
git log --oneline --since="1 week ago"

# Activity Log
cat .agents/PROJECT.md | grep "Activity Log" -A 100
```

### 2. 分析カテゴリ

| Category | Question |
|----------|----------|
| **Wins** | うまくいったことは何か？ |
| **Losses** | うまくいかなかったことは何か？ |
| **Patterns** | 繰り返し発生したパターンは？ |
| **Learnings** | 次に活かせる学びは？ |
| **Actions** | 具体的な改善アクションは？ |

### 3. 出力形式

```json
{
  "date": "YYYY-MM-DD",
  "period": "YYYY-MM-DD ~ YYYY-MM-DD",
  "commits": 0,
  "agents_used": [],
  "wins": [],
  "losses": [],
  "patterns": {
    "success": [],
    "failure": []
  },
  "learnings": [],
  "actions": [],
  "metrics": {
    "chain_efficiency": 0,
    "first_try_success_rate": 0,
    "avg_chain_length": 0
  }
}
```

### 4. 永続化

- `.context/retros/YYYY-MM-DD.json` に保存
- Success patterns → ARIS `docs/success_pattern_dictionary.md` 候補
- Failure patterns → ARIS `docs/failure_pattern_dictionary.md` 候補

### 5. 週次トレンド比較

過去のretroデータと比較:
- chain_efficiency の推移
- first_try_success_rate の推移
- 頻出パターンの変化

---

## Usage

```
/retro              # 直近1週間の振り返り
/retro 2weeks       # 直近2週間
/retro sprint       # 現スプリント期間
```

---

## Output Language

All outputs in Japanese.
