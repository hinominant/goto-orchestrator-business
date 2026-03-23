# Four Eyes Test Protocol — 4観点テストプロトコル

## 概要

「できた」の判定基準。テスト通過 ≠ 完成。4つの異なる観点で検証し、全て通って初めて「できた」と言える。

**どこかでFAILしたらそこで止めて修正。次の観点に進まない。**

ARIS TST-007 の教訓に基づく: 9回の監査で「PASS」と報告しながら実際のユーザーフローが壊れていた。原因は全て同じ視点（エンジニア視点）でチェックしていたこと。

---

## 4つの観点

```
[1. エンジニアの目] → PASS → [2. データの目] → PASS → [3. ユーザーの目] → PASS → [4. 壊す人の目] → PASS → 「できた」
       ↓ FAIL              ↓ FAIL               ↓ FAIL                ↓ FAIL
    修正して1からやり直し
```

### 観点1: エンジニアの目（Coverage Auditor + SSoT Verifier）

**担当**: Coverage Auditor + SSoT Verifier（2体並列）

**チェック項目**:

#### Coverage Auditor
- [ ] ユニットテスト実行（`npm test` / `vitest run` 等）— 全PASS確認
- [ ] ビルド確認（`npm run build` / `next build` 等）— エラーなし
- [ ] 構文チェック（`node --check` / `tsc --noEmit` 等）
- [ ] **何がテストされていないかを明示** — テスト件数ではなく、未テスト経路のリストを出力
- [ ] 新規ファイルにテストが存在するか（TST-001）
- [ ] テストデータのフィールド名が実データと一致しているか（TST-006）

#### SSoT Verifier
- [ ] ハードコード値（ID、コード、定数）のSSoT（唯一の信頼源）を特定
- [ ] 全ハードコード値がSSoTの値と一致しているか突合
- [ ] 不一致があれば即FAIL（推測値による二次バグ防止 — TST-007）

**FAIL条件**: テスト失敗、ビルドエラー、SSoT不一致が1件でもあればFAIL

---

### 観点2: データの目（Flow Tracer）

**担当**: Flow Tracer（1体）

**チェック項目**:

- [ ] プロジェクト内の全データ書き込み箇所を列挙
  - localStorage / sessionStorage への書き込み
  - API POST/PUT/PATCH/DELETE 呼び出し
  - DB INSERT/UPDATE
- [ ] 各書き込みに対応する読み込み箇所を特定
  - ダッシュボード / 一覧画面 / 詳細画面
  - API GET
  - DB SELECT
- [ ] **Write→DB→Read の全経路が1本の線で繋がっているか検証**
  - localStorage に書いているのに API を呼んでいない → FAIL（TST-007 の直接原因）
  - API は呼んでいるが DB のカラム名/テーブル名が不一致 → FAIL
  - DB に書いているがダッシュボードのクエリが別テーブルを見ている → FAIL
- [ ] 各経路の検証結果を表で出力:

```markdown
| Write箇所 | API | DBテーブル.カラム | Read箇所 | 接続 |
|-----------|-----|-----------------|----------|------|
| StepFooter.tsx | /api/progress/complete | progress.completed_at | /api/dashboard/summary | OK/NG |
```

**FAIL条件**: 1経路でも切断（Write側とRead側が繋がっていない）があればFAIL

---

### 観点3: ユーザーの目（User Journey Verifier）

**担当**: User Journey Verifier（1体）

**チェック項目**:

- [ ] 主要ユーザーフローを列挙（プロジェクトの目的から逆算）
- [ ] 各フローについて、実際に操作をシミュレーション:
  - 入力 → ボタン押下 → 画面遷移 → 結果表示
  - Playwright E2E テストで実行、またはコードレベルでフロー追跡
- [ ] **テスト全PASSでも、画面で期待通りの結果が出なければFAIL**
- [ ] エラーメッセージが日本語で表示されるか
- [ ] ローディング状態の表示は適切か
- [ ] 権限のないユーザーが操作した場合の挙動

**FAIL条件**: ユーザーが期待する結果が画面に出ない場合はFAIL（テスト結果は無関係）

**検証フォーマット**:
```markdown
| ユーザー操作 | 期待する結果 | 実際の結果 | 判定 |
|------------|------------|-----------|------|
| 「理解した」を押す | ダッシュボードに反映 | 反映される | OK |
```

---

### 観点4: 壊す人の目（Failure Pattern Detector）

**担当**: Failure Pattern Detector（1体）

**チェック項目**:

#### ARIS失敗パターン自動検知
- [ ] TST-001: 新規ファイルにテストがない
- [ ] TST-002: カバレッジ%のみで品質を主張
- [ ] TST-003: フロントエンド変更にE2Eテストがない
- [ ] TST-005: テスト量と品質の混同
- [ ] TST-006: テストデータとプロダクションデータの乖離
- [ ] TST-007: Write→DB→Read全経路未検証 / SSoT未確認 / テスト全PASS信頼バイアス

#### エッジケース・セキュリティ
- [ ] 想定外の入力（空文字、null、超長文、特殊文字）
- [ ] 認証切れ時の挙動
- [ ] 権限のない操作の試行
- [ ] 同時操作（競合状態）
- [ ] 個人情報の漏洩経路（PII-GUARD）

**FAIL条件**: TST-001〜007 のいずれかに該当する場合はFAIL

---

## 「できた」の5条件（全て必須）

| # | 条件 | 検証観点 |
|---|------|---------|
| 1 | 全テストPASS + 未テスト経路を明示 | エンジニアの目 |
| 2 | 全ハードコード値がSSoTと一致 | エンジニアの目 |
| 3 | Write→DB→Read の全経路が接続されている | データの目 |
| 4 | 実画面で主要ユーザーフローが動作する | ユーザーの目 |
| 5 | TST-001〜007 のいずれにも該当しない | 壊す人の目 |

---

## 実行方法

### スキル経由（推奨）
```
/four-eyes-test
```

### Nexus AUTORUN チェーン
```yaml
_AGENT_CHAIN:
  - Agent: CoverageAuditor + SSoTVerifier  # 観点1: エンジニアの目
    Parallel: true
    FailFast: true
  - Agent: FlowTracer                      # 観点2: データの目
    FailFast: true
  - Agent: UserJourneyVerifier             # 観点3: ユーザーの目
    FailFast: true
  - Agent: FailurePatternDetector          # 観点4: 壊す人の目
    FailFast: true
```

---

## 適用タイミング

- **機能実装完了時**: 「できた」と言う前に必ず実行
- **バグ修正完了時**: 修正で新バグを入れていないか確認
- **納品前**: 全観点を通過して初めて納品可
- **quality-gate スキル内**: /quality-gate の Phase A 前に自動実行

---

## 参照

- ARIS TST-007: テスト全PASS信頼バイアス
- ARIS TST-001〜006: テスト品質の失敗パターン
- ARIS SP-TECH-005: 実物検証主義
- Global CLAUDE.md 絶対原則 1-3
