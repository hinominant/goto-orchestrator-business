# Input

## Overview

| 項目 | 値 |
|------|-----|
| Name | Input |
| Description | テキストデータの入力を受け付けるフォーム要素 |
| Layer | Atom |
| Category | Form |
| Status | Stable |

---

## Anatomy

```
[1]Label
[2]Helper Text (optional)
┌──────────────────────────────────────┐
│ [3]Prefix  [4]Input Area  [5]Suffix  │
└──────────────────────────────────────┘
[6]Error Message / Character Count
```

| # | Part | Required | Description |
|----|------|----------|-------------|
| 1 | Label | Required | 入力内容を説明。`<label>` で紐付け |
| 2 | Helper Text | Optional | 入力のヒントや制約の説明 |
| 3 | Prefix | Optional | アイコンまたはテキスト（通貨記号等） |
| 4 | Input Area | Required | テキスト入力領域 |
| 5 | Suffix | Optional | アイコン（検索、クリア）またはテキスト（単位） |
| 6 | Feedback | Conditional | エラーメッセージまたは文字数カウント |

---

## Props / API

```typescript
interface InputProps {
  /** 入力タイプ */
  type?: 'text' | 'email' | 'password' | 'search' | 'number' | 'tel' | 'url';
  /** サイズ */
  size?: 'sm' | 'md' | 'lg';
  /** ラベルテキスト */
  label: string;
  /** プレースホルダー */
  placeholder?: string;
  /** ヘルパーテキスト */
  helperText?: string;
  /** エラーメッセージ */
  errorMessage?: string;
  /** 無効状態 */
  isDisabled?: boolean;
  /** 読み取り専用 */
  isReadOnly?: boolean;
  /** 必須 */
  isRequired?: boolean;
  /** エラー状態 */
  isInvalid?: boolean;
  /** 左プレフィックス */
  prefix?: ReactNode;
  /** 右サフィックス */
  suffix?: ReactNode;
  /** 最大文字数（カウント表示） */
  maxLength?: number;
  /** 値 */
  value?: string;
  /** 変更ハンドラ */
  onChange?: (value: string) => void;
  /** フォーカスハンドラ */
  onFocus?: () => void;
  /** ブラーハンドラ */
  onBlur?: () => void;
}
```

---

## Variants

### Size

| Size | Height | Font Size | Label Size | Use Case |
|------|--------|-----------|------------|----------|
| sm | 32px | 14px / `var(--font-size-sm)` | 12px | コンパクトフォーム、テーブル内フィルタ |
| md | 40px | 16px / `var(--font-size-base)` | 14px | 標準フォーム |
| lg | 48px | 18px / `var(--font-size-lg)` | 16px | モバイル、検索バー |

### Type別の補助UI

| Type | Prefix | Suffix | 追加動作 |
|------|--------|--------|---------|
| text | — | — | — |
| email | Mail icon | — | email バリデーション |
| password | Lock icon | 表示/非表示トグル | テキストマスク |
| search | Search icon | Clear button | Escape でクリア |
| number | — | 増減ボタン | 数値のみ受付 |
| tel | — | — | tel バリデーション |

---

## States

| State | Visual Change | ARIA | Trigger |
|-------|--------------|------|---------|
| default | border: `var(--color-border)` | — | 初期状態 |
| hover | border: `var(--color-border-hover)` | — | マウスオーバー |
| focus | border: `var(--color-primary)`, focus-ring | — | フォーカス取得 |
| filled | — | — | 値が入力されている |
| disabled | opacity: 0.4, bg: `var(--color-muted)` | `aria-disabled="true"` | isDisabled |
| readOnly | bg: `var(--color-muted)`, border消去 | `aria-readonly="true"` | isReadOnly |
| error | border: `var(--color-destructive)`, エラーメッセージ表示 | `aria-invalid="true"`, `aria-describedby` | isInvalid |
| loading | Skeleton表示 or Spinner in suffix | `aria-busy="true"` | 非同期バリデーション中 |

---

## Design Tokens

> See: [`design-tokens.md`](../design-tokens.md) for full token definitions

| Token | DS v3 Reference | Resolved Value | Usage |
|-------|----------------|----------------|-------|
| `--input-bg` | `var(--color-bg-default)` | Black/0 `#FFFFFF` | 背景色 |
| `--input-border` | `var(--color-border-default)` | Black/200 `#DADADD` | ボーダー |
| `--input-border-focus` | `var(--color-border-emphasis)` | Brand/600 `#5538EE` | フォーカス時ボーダー |
| `--input-border-error` | `var(--color-border-critical)` | Red/600 `#FF001F` | エラー時ボーダー |
| `--input-text` | `var(--color-text-default)` | Black/950 `#27272A` | 入力テキスト |
| `--input-placeholder` | `var(--color-text-disabled)` | Black/400 `#94939D` | プレースホルダー |
| `--input-label` | `var(--color-text-default)` | Black/950 `#27272A` | ラベル |
| `--input-helper` | `var(--color-text-secondary)` | Black/500 `#777681` | ヘルパーテキスト |
| `--input-error` | `var(--color-text-critical)` | Red/700 `#D7001A` | エラーメッセージ |
| `--input-disabled-bg` | `var(--color-bg-disabled)` | Black/200 `#DADADD` | 無効背景 |
| `--input-radius` | `var(--radius-md)` | `12px` | 角丸 |

---

## Accessibility

### ARIA

| Attribute | Value | Condition |
|-----------|-------|-----------|
| `aria-required` | `true` | isRequired 時 |
| `aria-invalid` | `true` | isInvalid 時 |
| `aria-disabled` | `true` | isDisabled 時 |
| `aria-readonly` | `true` | isReadOnly 時 |
| `aria-describedby` | helperText/errorMessage の id | ヘルパーまたはエラーがある時 |
| `aria-errormessage` | errorMessage の id | isInvalid 時 |

### Keyboard

| Key | Action |
|-----|--------|
| `Tab` | フォーカス移動 |
| `Escape` | search タイプ時に入力クリア |
| `Enter` | フォーム送信（type=submit のフォーム内） |

### Label
- `<label>` 要素で `for`/`htmlFor` を使い `<input>` と紐付け
- ラベルを非表示にする場合は `aria-label` を使用（`display: none` のラベルは不可）
- 必須フィールドはラベルに `*` を表示 + `aria-required`

---

## Do / Don't

### Do
- ✅ ラベルは常に表示する → プレースホルダーはラベルの代替にならない
- ✅ エラーメッセージは「何が + なぜ + どうすれば」の3要素 → `palette/references/content-guidelines-ja.md` 参照
- ✅ 適切な `type` を使う（email, tel等） → モバイルで適切なキーボード表示
- ✅ `maxLength` 使用時はカウンターを表示 → ユーザーが残り文字数を把握

### Don't
- ❌ プレースホルダーをラベル代わりにしない → フォーカス時に消えて手がかりを失う
- ❌ エラーメッセージを赤色のみで示さない → 色覚多様性への配慮
- ❌ `autocomplete` 属性を省略しない → ブラウザの自動入力を活用
- ❌ 数値入力に `type="text"` を使わない → `type="number"` で適切な制約

---

## Related

### Similar Components

| Component | Use When | Don't Use When |
|-----------|----------|---------------|
| Input | 1行のテキスト入力 | 複数行のテキスト |
| Textarea | 複数行のテキスト入力 | 1行で収まる入力 |
| Select | 定義済み選択肢から選ぶ | 自由入力が必要 |
| Combobox | 選択肢+自由入力 | 選択肢が少ない（5個以下） |

### Composition Patterns
- → `vision/references/patterns/form-wizard.md` — フォーム内での配置
- → `vision/references/patterns/search-filter.md` — 検索バーでの使用
- → `select.md` — Select との使い分け
