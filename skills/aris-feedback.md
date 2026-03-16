---
name: aris-feedback
description: ARIS成功/失敗記録手順スキル
model: haiku
---

# ARIS Feedback Skill

## Purpose
ARIS（Adaptive Reasoning & Intelligence System）への成功/失敗パターンフィードバック。

## Success Pattern Recording

### トリガー条件
- フェーズ/マイルストーンの完了
- 想定より効率的な手法の発見
- 困難な技術課題の解決
- ユーザーからの明確な肯定フィードバック

### 記録フォーマット
```yaml
type: success
date: YYYY-MM-DD
pattern_name: [パターン名]
context: [状況の説明]
approach: [採用したアプローチ]
outcome: [結果]
reusability: [HIGH/MEDIUM/LOW]
tags: [関連タグ]
```

## Failure Pattern Recording

### トリガー条件
- ツール実行のエラー（設計ミス・判断ミス起因）
- フェーズ順序のスキップ
- 間違ったアプローチによる時間浪費
- ユーザーからの修正指示
- データ欠損・不整合の発見

### 記録フォーマット
```yaml
type: failure
date: YYYY-MM-DD
pattern_name: [パターン名]
context: [状況の説明]
wrong_approach: [誤ったアプローチ]
correct_approach: [正しいアプローチ]
root_cause: [根本原因]
prevention: [再発防止策]
tags: [関連タグ]
```

## 記録先
- Success: `docs/success_pattern_dictionary.md` 候補
- Failure: `docs/failure_pattern_dictionary.md` 候補
- 判断基準: `docs/judgment_criteria_dictionary.md` 候補
