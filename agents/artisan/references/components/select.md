# Select

## Overview

| 項目 | 値 |
|------|-----|
| Name | Select |
| Description | 定義済みの選択肢リストから値を選択するフォーム要素 |
| Layer | Molecule |
| Category | Form |
| Status | Stable |

---

## Anatomy

```
[1]Label
[2]Helper Text (optional)
┌────────────────────────────────────────┐
│ [3]Selected Value / Placeholder  [4]▼  │
└────────────────────────────────────────┘
   ┌────────────────────────────────┐
   │ [5]Search Input (searchable)   │
   ├────────────────────────────────┤
   │ [6]Option Group Label          │
   │   [7]Option (icon + label)     │
   │   [7]Option (selected ✓)       │
   │   [7]Option                    │
   ├────────────────────────────────┤
   │ [8]No results message          │
   └────────────────────────────────┘
[9]Error Message
```

| # | Part | Required | Description |
|----|------|----------|-------------|
| 1 | Label | Required | 選択内容の説明 |
| 2 | Helper Text | Optional | 選択のヒント |
| 3 | Trigger | Required | 現在の選択値またはプレースホルダー |
| 4 | Arrow | Required | ドロップダウン開閉インジケータ |
| 5 | Search Input | Conditional | searchable時のフィルタ入力 |
| 6 | Group Label | Optional | 選択肢のグループ見出し |
| 7 | Option | Required | 個別の選択肢 |
| 8 | Empty State | Conditional | 検索結果なし時のメッセージ |
| 9 | Error Message | Conditional | バリデーションエラー |

---

## Props / API

```typescript
interface SelectProps<T = string> {
  /** 選択モード */
  mode?: 'single' | 'multi';
  /** サイズ */
  size?: 'sm' | 'md' | 'lg';
  /** ラベル */
  label: string;
  /** プレースホルダー */
  placeholder?: string;
  /** 選択肢 */
  options: SelectOption<T>[];
  /** 選択値（single） */
  value?: T;
  /** 選択値（multi） */
  values?: T[];
  /** 検索可能 */
  isSearchable?: boolean;
  /** クリア可能 */
  isClearable?: boolean;
  /** 無効 */
  isDisabled?: boolean;
  /** 必須 */
  isRequired?: boolean;
  /** エラー状態 */
  isInvalid?: boolean;
  /** エラーメッセージ */
  errorMessage?: string;
  /** ヘルパーテキスト */
  helperText?: string;
  /** 変更ハンドラ */
  onChange?: (value: T | T[]) => void;
}

interface SelectOption<T = string> {
  value: T;
  label: string;
  icon?: ReactNode;
  isDisabled?: boolean;
  group?: string;
}
```

---

## Variants

### Size

| Size | Trigger Height | Option Height | Font Size | Use Case |
|------|---------------|---------------|-----------|----------|
| sm | 32px | 28px | 14px | フィルタ、テーブル内 |
| md | 40px | 36px | 16px | 標準フォーム |
| lg | 48px | 44px | 18px | モバイル |

### Mode

| Mode | Trigger表示 | Max選択数 | Use Case |
|------|------------|----------|----------|
| single | 選択されたラベル1つ | 1 | 国、カテゴリ等の排他選択 |
| multi | Tag/Chip の並び | 制限なし | タグ、スキル等の複数選択 |

**Multi-select のTag表示:**
- 3個まで: 個別Tag表示
- 4個以上: 「3件 + 他N件」と省略

### Searchable

- `isSearchable=true` 時、ドロップダウン上部に検索入力を表示
- 選択肢が10個以上の場合に推奨
- フィルタはラベルテキストの部分一致

---

## States

| State | Visual Change | ARIA | Trigger |
|-------|--------------|------|---------|
| default | border: `var(--color-border)` | `aria-expanded="false"` | 初期状態 |
| hover | border: `var(--color-border-hover)` | — | マウスオーバー |
| open | border: `var(--color-primary)`, ドロップダウン表示 | `aria-expanded="true"` | クリック/Enter/Space |
| focused-option | 選択肢のハイライト | `aria-activedescendant` | 矢印キー |
| selected | 選択値表示、✓マーク | `aria-selected="true"` | クリック/Enter |
| disabled | opacity: 0.4 | `aria-disabled="true"` | isDisabled |
| error | border: `var(--color-destructive)` | `aria-invalid="true"` | isInvalid |

---

## Design Tokens

> See: [`design-tokens.md`](../design-tokens.md) for full token definitions

| Token | DS v3 Reference | Resolved Value | Usage |
|-------|----------------|----------------|-------|
| `--select-bg` | `var(--color-bg-default)` | Black/0 `#FFFFFF` | トリガー背景 |
| `--select-border` | `var(--color-border-default)` | Black/200 `#DADADD` | ボーダー |
| `--select-border-focus` | `var(--color-border-emphasis)` | Brand/600 `#5538EE` | フォーカス時ボーダー |
| `--select-dropdown-bg` | `var(--color-bg-default)` | Black/0 `#FFFFFF` | ドロップダウン背景 |
| `--select-option-hover` | `var(--color-bg-interactive)` | Black/100 `#EFEEF0` | 選択肢ホバー |
| `--select-option-selected` | `var(--color-bg-secondary)` | Brand/50 `#EDEFFF` | 選択済み背景 |
| `--select-tag-bg` | `var(--color-bg-tertiary)` | Black/50 `#F7F7F8` | Multi Tag背景 |
| `--select-text` | `var(--color-text-default)` | Black/950 `#27272A` | テキスト |
| `--select-placeholder` | `var(--color-text-disabled)` | Black/400 `#94939D` | プレースホルダー |
| `--select-icon` | `var(--color-icon-secondary)` | Black/500 `#777681` | 矢印アイコン |
| `--select-radius` | `var(--radius-md)` | `12px` | 角丸 |

---

## Accessibility

### ARIA

| Attribute | Value | Condition |
|-----------|-------|-----------|
| `role` | `combobox` | searchable時 / `listbox` otherwise |
| `aria-expanded` | `true/false` | ドロップダウン開閉 |
| `aria-haspopup` | `listbox` | 常時 |
| `aria-activedescendant` | option id | キーボードナビゲーション中 |
| `aria-selected` | `true` | 選択済みoption |
| `aria-multiselectable` | `true` | multi mode |

### Keyboard

| Key | Action |
|-----|--------|
| `Enter` / `Space` | ドロップダウン開閉 / 選択肢決定 |
| `↑` / `↓` | 選択肢間の移動 |
| `Home` / `End` | 最初/最後の選択肢に移動 |
| `Escape` | ドロップダウンを閉じる |
| 英数字 | searchable時: フィルタ入力 / 非searchable時: 先頭一致ジャンプ |

### Focus Management
- ドロップダウン開時: 検索入力 or 最初の選択肢にフォーカス
- 選択肢決定後: single → ドロップダウン閉じてトリガーにフォーカス戻す / multi → 開いたまま
- Escape: ドロップダウン閉じてトリガーにフォーカス戻す

---

## Do / Don't

### Do
- ✅ 選択肢が5個以下ならRadioButtonを検討 → 全選択肢が一覧できる
- ✅ 選択肢が10個以上なら `isSearchable` を有効化 → 目的の選択肢を見つけやすい
- ✅ プレースホルダーに「選択してください」を使う → 操作の指示
- ✅ グループ化で選択肢を整理する → 大量の選択肢で見通し改善

### Don't
- ❌ 2択にSelectを使わない → Toggle/Switchを使う
- ❌ 選択肢の動的変更を頻繁にしない → ユーザーが混乱する
- ❌ 長いラベルでトリガー幅を圧迫しない → `text-overflow: ellipsis` で対応

---

## Related

### Similar Components

| Component | Use When | Don't Use When |
|-----------|----------|---------------|
| Select | 6個以上の排他選択 | 自由入力が必要 |
| RadioGroup | 2-5個の排他選択 | 選択肢が多い |
| Combobox | 選択肢+自由入力 | 選択肢のみで十分 |
| Checkbox Group | 複数選択（少数） | 選択肢が多い |

### Composition Patterns
- → `vision/references/patterns/search-filter.md` — フィルタ条件としての使用
- → `vision/references/patterns/form-wizard.md` — フォームステップ内での配置
