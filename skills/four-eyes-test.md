---
name: four-eyes-test
description: 4観点テスト（エンジニア→データ→ユーザー→壊す人）を順番に実行し、全て通って初めて「できた」と判定する。
model: sonnet
---

# Four Eyes Test — 4観点テスト実行スキル

「できた」の判定を行う。4つの異なる観点で順番にチェックし、全て通過して初めて完了とする。

**プロトコル詳細**: `_common/FOUR_EYES_TEST.md`

## 実行手順

### 観点1: エンジニアの目（Coverage Auditor + SSoT Verifier）

#### 1-A: テスト実行

```bash
# プロジェクトのテストを実行（自動検出）
npm test 2>&1 || npx vitest run 2>&1 || echo "テストコマンドが見つかりません"
```

全テスト PASS を確認。1件でも FAIL があればここで止めて修正。

#### 1-B: ビルド確認

```bash
npm run build 2>&1 || npx next build 2>&1 || echo "ビルドコマンドが見つかりません"
```

#### 1-C: 未テスト経路の明示

テストが存在しないが重要な機能を列挙する:

1. `tests/` または `__tests__/` の既存テストファイル一覧を確認
2. `app/` または `src/` の主要ファイル一覧と比較
3. テストされていないファイル/関数/フローをリストアップ
4. **「何がテストされていないか」を明示**（テスト件数だけで判断しない）

#### 1-D: SSoT突合

プロジェクト内のハードコード値（ID、コード、定数）について:

1. その値の「正解」がどこに定義されているか（SSoT）を特定
2. コード内の全箇所がSSoTの値と一致しているか検証
3. 不一致があれば即 **FAIL**

```bash
# 例: courseId のSSoT突合
grep -rn "courseId" components/ hooks/ app/ --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v .next
```

**観点1のFAIL条件**: テスト失敗 / ビルドエラー / SSoT不一致

---

### 観点2: データの目（Flow Tracer）

プロジェクト内の全データフロー（Write→DB→Read）を追跡する。

#### 2-A: 書き込み箇所の列挙

```bash
# localStorage への書き込み
grep -rn "localStorage.setItem\|localStorage.set" app/ components/ hooks/ --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v .next

# API POST/PUT/PATCH 呼び出し
grep -rn 'fetch.*POST\|fetch.*PUT\|fetch.*PATCH\|method.*POST\|method.*PUT' app/ components/ hooks/ --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v .next
```

#### 2-B: 各書き込みの読み込み対応を確認

各 Write 箇所について:
1. どの API に書き込んでいるか
2. その API がどの DB テーブル/カラムに書いているか
3. そのテーブル/カラムを読んでいるのはどの API か
4. その API を呼んでいるのはどの画面か
5. **線が1本で繋がっているか**

#### 2-C: 結果を表で出力

```markdown
| Write箇所 | 呼ぶAPI | DBテーブル.カラム | 読むAPI | 表示画面 | 接続 |
|-----------|--------|-----------------|--------|---------|------|
```

**観点2のFAIL条件**: 1経路でも切断（localStorage のみでAPI未呼出、DB書込先と読込先の不一致等）があればFAIL

---

### 観点3: ユーザーの目（User Journey Verifier）

ユーザーが実際に操作するフローを検証する。

#### 3-A: 主要ユーザーフローの列挙

プロジェクトの目的から逆算して、主要なユーザーフローを列挙:
- ユーザーが最もよく行う操作は何か
- その操作の結果、何が画面に表示されるべきか

#### 3-B: 各フローの検証

各フローについて:
1. ユーザーの操作手順を書き出す
2. 各ステップで期待される画面の状態を書き出す
3. **実際にコードを追跡して、期待通りの結果が出るか検証**
4. Playwright E2E テストがあれば実行

```markdown
| ユーザー操作 | 期待する結果 | 実際の結果 | 判定 |
|------------|------------|-----------|------|
```

**観点3のFAIL条件**: ユーザーが期待する結果が出ない場合はFAIL（テスト全PASSでも関係なし）

---

### 観点4: 壊す人の目（Failure Pattern Detector）

#### 4-A: ARIS失敗パターン自動検知

以下の各パターンに該当するかチェック:

- **TST-001**: 新規ファイルにテストがない → `find` で新規ファイルとテストのペアを確認
- **TST-002**: カバレッジ%のみで品質を主張 → テスト結果報告に「未テスト経路」が含まれているか
- **TST-003**: フロントエンド変更にE2Eテストがない → `e2e/` ディレクトリの確認
- **TST-005**: テスト量と品質の混同 → 「Nテスト全PASS」だけを根拠にしていないか
- **TST-006**: テストデータのフィールド名がプロダクションと異なる
- **TST-007**: Write→DB→Read全経路未検証 / SSoT未確認 / localStorage のみ書込

#### 4-B: エッジケース・セキュリティ

- 空文字、null、超長文の入力
- 認証切れ時の挙動
- 権限のない操作の試行
- 個人情報の漏洩経路（PII-GUARD該当箇所）

**観点4のFAIL条件**: TST-001〜007 のいずれかに該当 / セキュリティ上の問題

---

## 最終判定

4観点全てPASSした場合のみ:

```
✅ Four Eyes Test: PASS
  観点1（エンジニア）: PASS — X tests, 0 failures
  観点2（データ）: PASS — Y data flows, all connected
  観点3（ユーザー）: PASS — Z user journeys verified
  観点4（壊す人）: PASS — 0 failure patterns detected
```

1つでもFAILした場合:

```
❌ Four Eyes Test: FAIL at 観点N
  失敗内容: ...
  修正後、観点1からやり直してください
```
