# Checkbox & Radio Button

## Overview

| 項目 | 値 |
|------|-----|
| Name | Checkbox / RadioButton |
| Description | 選択肢の選択・切替を行うフォーム要素 |
| Layer | Atom |
| Category | Form |
| Status | Stable |

**2つのコンポーネントを1仕様にまとめる理由:** Anatomy・States・Accessibilityの構造が共通。差異はセクション内で明記。

---

## Anatomy

```
Checkbox:
┌────┐
│ [1]│ [2]Label  [3]Helper Text
└────┘

Radio:
┌────┐
│ [1]│ [2]Label  [3]Helper Text
└────┘

Group:
[4]Group Label
  ┌────┐
  │ ○  │ Option A
  └────┘
  ┌────┐
  │ ○  │ Option B
  └────┘
  [5]Error Message
```

| # | Part | Required | Description |
|----|------|----------|-------------|
| 1 | Control | Required | チェックボックス□ / ラジオ○ |
| 2 | Label | Required | 選択肢の説明テキスト |
| 3 | Helper Text | Optional | 補足情報 |
| 4 | Group Label | Required (Group) | グループ全体の説明 |
| 5 | Error Message | Conditional | バリデーションエラー |

---

## Props / API

```typescript
// 単体
interface CheckboxProps {
  /** チェック状態 */
  isChecked?: boolean;
  /** 不確定状態（親Checkbox用） */
  isIndeterminate?: boolean;
  /** ラベル */
  label: string;
  /** ヘルパーテキスト */
  helperText?: string;
  /** 無効 */
  isDisabled?: boolean;
  /** エラー */
  isInvalid?: boolean;
  /** 値 */
  value?: string;
  /** 変更ハンドラ */
  onChange?: (checked: boolean) => void;
}

interface RadioProps {
  /** ラベル */
  label: string;
  /** ヘルパーテキスト */
  helperText?: string;
  /** 無効 */
  isDisabled?: boolean;
  /** 値 */
  value: string;
}

// グループ
interface CheckboxGroupProps {
  /** グループラベル */
  label: string;
  /** 選択値（複数） */
  values?: string[];
  /** 選択肢 */
  options: { value: string; label: string; helperText?: string; isDisabled?: boolean }[];
  /** 方向 */
  orientation?: 'vertical' | 'horizontal';
  /** 変更ハンドラ */
  onChange?: (values: string[]) => void;
}

interface RadioGroupProps {
  /** グループラベル */
  label: string;
  /** 選択値（1つ） */
  value?: string;
  /** 選択肢 */
  options: { value: string; label: string; helperText?: string; isDisabled?: boolean }[];
  /** 方向 */
  orientation?: 'vertical' | 'horizontal';
  /** 必須 */
  isRequired?: boolean;
  /** 変更ハンドラ */
  onChange?: (value: string) => void;
}
```

---

## Variants

### Size

| Size | Control Size | Font Size | Gap (control-label) | Use Case |
|------|-------------|-----------|---------------------|----------|
| sm | 16px | 14px | 8px | コンパクトリスト |
| md | 20px | 16px | 10px | 標準フォーム |
| lg | 24px | 18px | 12px | モバイル |

### Orientation

| Orientation | Layout | Use Case |
|-------------|--------|----------|
| vertical | 縦並び（デフォルト） | 3個以上、ラベルが長い |
| horizontal | 横並び | 2-3個、ラベルが短い |

### Checkbox固有: Indeterminate

- 子Checkboxの一部のみ選択時、親Checkboxに表示
- `isIndeterminate=true`: □に「−」マーク
- クリックで全選択 → 全解除のトグル

---

## States

| State | Checkbox Visual | Radio Visual | ARIA |
|-------|----------------|-------------|------|
| default (unchecked) | 空の□ | 空の○ | — |
| hover | border色変化 | border色変化 | — |
| checked | ✓入り□、bg: primary | ●入り○、bg: primary | `aria-checked="true"` |
| indeterminate | −入り□ | N/A | `aria-checked="mixed"` |
| focus | focus-ring | focus-ring | — |
| disabled | opacity: 0.4 | opacity: 0.4 | `aria-disabled="true"` |
| disabled + checked | ✓入り、opacity: 0.4 | ●入り、opacity: 0.4 | `aria-disabled="true"`, `aria-checked="true"` |
| error | border: destructive | border: destructive | `aria-invalid="true"` |

---

## Design Tokens

> See: [`design-tokens.md`](../design-tokens.md) for full token definitions

| Token | DS v3 Reference | Resolved Value | Usage |
|-------|----------------|----------------|-------|
| `--checkbox-border` | `var(--color-border-default)` | Black/200 `#DADADD` | 未チェック時ボーダー |
| `--checkbox-checked-bg` | `var(--color-bg-emphasis)` | Brand/600 `#5538EE` | チェック時背景 |
| `--checkbox-checked-icon` | `var(--color-icon-inverse)` | Black/0 `#FFFFFF` | ✓/●の色 |
| `--checkbox-label-text` | `var(--color-text-default)` | Black/950 `#27272A` | ラベルテキスト |
| `--checkbox-disabled-bg` | `var(--color-bg-disabled)` | Black/200 `#DADADD` | 無効背景 |
| `--checkbox-radius` | `var(--radius-sm)` | `8px` | Checkbox角丸 |
| `--radio-radius` | `var(--radius-full)` | `9999px` | Radio角丸（円形） |
| `--checkbox-label-gap` | `var(--space-sm)` | `8px` | コントロール-ラベル間 |
| `--checkbox-group-gap` | `var(--space-md)` | `12px` | 選択肢間の余白 |

---

## Accessibility

### ARIA

| Attribute | Element | Value |
|-----------|---------|-------|
| `role` | Checkbox Group | `group` |
| `role` | Radio Group | `radiogroup` |
| `aria-checked` | Checkbox | `true` / `false` / `mixed` |
| `aria-checked` | Radio | `true` / `false` |
| `aria-labelledby` | Group | Group Labelのid |
| `aria-required` | Group | `true`（必須時） |
| `aria-invalid` | Group | `true`（エラー時） |

### Keyboard

**Checkbox:**
| Key | Action |
|-----|--------|
| `Space` | チェック/アンチェック切替 |
| `Tab` | 次の要素へフォーカス移動 |

**Radio:**
| Key | Action |
|-----|--------|
| `↑` / `←` | 前のラジオへ移動（ループ） |
| `↓` / `→` | 次のラジオへ移動（ループ） |
| `Space` | 現在のラジオを選択 |
| `Tab` | グループ外へフォーカス移動 |

**重要な違い:** CheckboxはTab移動、Radioは矢印キー移動（`radiogroup`のネイティブ挙動）。

---

## Do / Don't

### Do
- ✅ Checkboxは独立した選択に使う（0個以上選択可能） → 複数選択の自由度
- ✅ Radioは排他的選択に使う（必ず1つ選択） → 明確な択一
- ✅ ラベルのクリックでも状態変更 → タッチターゲット拡大
- ✅ RadioGroupにはデフォルト選択を設定 → ユーザーの意思決定を支援

### Don't
- ❌ 単独のRadioは使わない → 必ず2つ以上のRadioGroupで使用
- ❌ ON/OFFの切替にCheckboxを使わない → Toggle/Switchを使う
- ❌ 6個以上の選択肢にRadio/Checkboxを使わない → Select/MultiSelectを検討
- ❌ ラベルなしで使わない → 何を選択しているか不明になる

---

## Related

### Similar Components

| Component | Use When | Don't Use When |
|-----------|----------|---------------|
| Checkbox | 複数選択（0個以上） | 排他的選択 |
| Radio | 排他的選択（2-5個） | 複数選択が必要 |
| Toggle/Switch | ON/OFF即時反映 | フォーム送信時に反映 |
| Select (multi) | 多数の選択肢から複数選択 | 選択肢が少ない |

### Composition Patterns
- → `vision/references/patterns/form-wizard.md` — フォームステップ内での配置
- → `vision/references/patterns/search-filter.md` — フィルタ条件としての使用
