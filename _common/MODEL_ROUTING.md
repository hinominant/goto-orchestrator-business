# Model Routing Protocol

> Bloom Taxonomy に基づくモデル選択ガイドライン。

---

## Bloom Taxonomy × Model Mapping

| Level | Cognitive Task | Model | Cost |
|-------|---------------|-------|------|
| **Create** | 新規設計、アーキテクチャ、意思決定 | `opus` | $$$ |
| **Evaluate** | 品質判定、Go/No-Go、監査 | `opus` | $$$ |
| **Analyze** | データ分析、影響分析、コードレビュー | `sonnet` | $$ |
| **Apply** | 実装、テスト作成、リファクタリング | `sonnet` | $$ |
| **Understand** | コード理解、ドキュメント読解 | `haiku` | $ |
| **Remember** | 情報検索、タスク分解、単純変換 | `haiku` | $ |

---

## 3層ルーティング

### Agent層（エージェント選択）
frontmatter の `model` フィールドで指定。Tier 1 エージェントの割り当て:

| Agent | Model | Rationale |
|-------|-------|-----------|
| CEO | opus | 意思決定（Create/Evaluate） |
| Nexus | sonnet | オーケストレーション（Analyze/Apply） |
| Rally | sonnet | 並列管理（Apply） |
| Analyst | sonnet | データ分析（Analyze） |
| Auditor | sonnet | 監査（Evaluate — コスト効率考慮でsonnet） |
| Radar | sonnet | テスト（Apply） |
| Builder | sonnet | 実装（Apply） |
| Sherpa | haiku | 分解（Remember/Understand） |

### Skill層（スキル実行）
Skills は原則 `haiku` で実行（定型手順のため）:

| Skill | Model | Rationale |
|-------|-------|-----------|
| data-retrieval | haiku | 定型データ取得手順 |
| spec-compliance | haiku | チェックリスト照合 |
| test-coverage | haiku | カバレッジ分析 |
| git-pr-prep | haiku | PR準備手順 |
| diff-analysis | haiku | diff解析 |
| aris-feedback | haiku | パターン記録 |

### Command層（コマンド実行）
Commands は呼び出し元セッションのモデルを継承。

---

## コスト最適化ルール

1. **デフォルトはsonnet** — 明確な理由がない限りsonnet
2. **opusは意思決定のみ** — CEO、重大なアーキテクチャ判断
3. **haikuは定型作業** — 分解、検索、単純変換、スキル実行
4. **エスカレーション** — haiku/sonnetで対応不能な場合のみopusに昇格
