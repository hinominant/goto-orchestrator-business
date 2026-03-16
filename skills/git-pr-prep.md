---
name: git-pr-prep
description: PR準備手順スキル
model: haiku
---

# Git PR Prep Skill

## Purpose
PR作成前の準備手順を標準化する。

## Steps

### 1. ブランチ確認
```bash
git status
git log --oneline main..HEAD
git diff main...HEAD --stat
```

### 2. コミット整理
- Conventional Commits形式の確認
- 不要なコミットのスカッシュ検討
- コミットメッセージの品質チェック

### 3. テスト確認
- 全テスト通過の確認
- lint/format チェックの実施

### 4. PR作成
```bash
gh pr create --title "[type]: summary" --body "$(cat <<'EOF'
## Summary
- [変更内容]

## Test plan
- [ ] [テスト項目]
EOF
)"
```

### 5. レビュー準備
- `_common/REVIEW_CHECKLIST.md` の8カテゴリ自己チェック
- CRITICAL項目がないことを確認
