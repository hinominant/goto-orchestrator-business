# Quickstart Guide

> 5分で Agent Orchestrator をプロジェクトに導入する。

---

## 1. インストール

```bash
# プロジェクトルートで実行
curl -sL https://raw.githubusercontent.com/luna-matching/agent-orchestrator/main/install.sh | bash
```

### オプション: Hooks付き

```bash
# ローカルクローンから（Hooks対応）
git clone https://github.com/luna-matching/agent-orchestrator.git /tmp/ao
cd your-project && /tmp/ao/install.sh --with-hooks
```

Hooks は3つ:
- **tool-risk.js** (PreToolUse) — 高リスク操作をブロック
- **post-tool-use.js** (PostToolUse) — ツール実行ログ記録
- **stop-hook.js** (Stop) — セッションサマリ永続化

---

## 2. 基本的な使い方

### エージェント呼び出し

```
/nexus ログイン機能を実装したい
/ceo この機能の優先度を判断して
/analyst ユーザー離脱率を分析して
/rally フロントエンドとバックエンドを並列実装して
```

### コマンド呼び出し

```
/superpowers 認証システムをリファクタリングして
/pr-review #123
/retro
```

---

## 3. プロジェクト設定

### ビジネス文脈（CEO使用時）

`.agents/LUNA_CONTEXT.md` をプロジェクトに合わせて編集:

```markdown
# Business Context

## Product
- サービス名:
- ターゲット:
- ビジネスモデル:

## Principles
- [プロダクト原則]

## Current Focus
- [現在の注力領域]
```

### 共有知識

`.agents/PROJECT.md` にチーム共有の知識を蓄積:
- アーキテクチャ決定
- 技術スタック
- Activity Log（エージェント実行履歴）

---

## 4. ALICE統合（Lunaプロジェクトのみ）

### 前提条件
- ARIS pattern dictionaries が `docs/` に配置済み
- LROS リポジトリへのアクセス

### セットアップ
1. 標準インストール実施
2. `.agents/LUNA_CONTEXT.md` にALICEコンポーネント参照を追記
3. CEO → ARIS 4-mind 判断が自動的に有効化
4. Analyst → LROS SSoT 参照が自動的に有効化

### ALICE Chain の使い方

```
/ceo [ビジネス判断]     → ARIS 4-mind で評価
/analyst [分析依頼]     → LROS SSoT + 誤読防止チェック
/retro                  → ARIS feedback pipeline
```

---

## 5. カスタマイズ

### エージェント選択

全68エージェントは不要。プリセットから選択:

```bash
# Minimal（5エージェント）
install.sh nexus builder radar scout guardian

# Standard（10エージェント）
install.sh nexus rally sherpa builder artisan radar sentinel judge zen guardian
```

詳細は `docs/AGENT_SELECTION.md` 参照。

### Frontmatter カスタマイズ

エージェントの `model`, `maxTurns`, `memory` は frontmatter で変更可能。仕様は `_templates/FRONTMATTER_SPEC.md` 参照。

---

## 6. 検証

```bash
# ドリフトチェック（テンプレート準拠確認）
scripts/check-drift.sh

# 特定エージェントのみ
scripts/check-drift.sh ceo nexus builder radar
```

---

## Next Steps

- `docs/AGENT_SELECTION.md` — エージェント選択ガイド
- `_common/MODEL_ROUTING.md` — モデル選択ガイドライン
- `_common/ALICE_INTEGRATION.md` — ALICE統合詳細
- `_templates/FRONTMATTER_SPEC.md` — Frontmatter仕様
