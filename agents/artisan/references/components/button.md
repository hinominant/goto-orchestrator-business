# Button

## Overview

| 項目 | 値 |
|------|-----|
| Name | Button |
| Description | ユーザーアクションをトリガーするインタラクティブ要素 |
| Layer | Atom |
| Category | Form |
| Status | Stable |

---

## Anatomy

```
┌───────────────────────────────────┐
│  [1]Icon  [2]Label  [3]Spinner   │
└───────────────────────────────────┘
```

| # | Part | Required | Description |
|----|------|----------|-------------|
| 1 | Icon | Optional | 操作の視覚的手がかり。label と併用が基本 |
| 2 | Label | Required* | 操作内容を示すテキスト。*icon-only の場合は aria-label 必須 |
| 3 | Spinner | Conditional | loading 状態時のみ表示。label を置換 |

---

## Props / API

```typescript
interface ButtonProps {
  /** 視覚スタイル */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  /** サイズ */
  size?: 'sm' | 'md' | 'lg';
  /** 無効状態 */
  isDisabled?: boolean;
  /** 読み込み中 */
  isLoading?: boolean;
  /** 全幅表示 */
  isFullWidth?: boolean;
  /** 左アイコン */
  iconLeft?: ReactNode;
  /** 右アイコン */
  iconRight?: ReactNode;
  /** アイコンのみボタン */
  isIconOnly?: boolean;
  /** HTML type属性 */
  type?: 'button' | 'submit' | 'reset';
  /** クリックハンドラ */
  onClick?: (event: MouseEvent) => void;
  /** コンテンツ */
  children: ReactNode;
}
```

**デフォルト値:** `variant="primary"`, `size="md"`, `type="button"`

---

## Variants

### Size

| Size | Height | Font Size | Padding (Y/X) | Icon Size | Min Width | Use Case |
|------|--------|-----------|----------------|-----------|-----------|----------|
| sm | 32px / `var(--size-8)` | 14px / `var(--font-size-sm)` | 6px 12px | 16px | 64px | テーブル内、インラインアクション |
| md | 40px / `var(--size-10)` | 16px / `var(--font-size-base)` | 10px 16px | 20px | 80px | 標準操作 |
| lg | 48px / `var(--size-12)` | 18px / `var(--font-size-lg)` | 12px 24px | 24px | 96px | CTA、モバイルタッチターゲット |

### Visual

| Variant | Background | Text | Border | Use Case |
|---------|-----------|------|--------|----------|
| primary | `bg-emphasis` Brand/600 `#5538EE` | `text-inverse` `#FFFFFF` | none | 主要アクション（1画面に1つ） |
| secondary | `bg-default` `#FFFFFF` | `text-default` `#27272A` | `border-default` `#DADADD` | 補助アクション |
| ghost | transparent | `text-default` `#27272A` | none | 低優先度アクション、ツールバー |
| danger | `bg-critical` Red/600 `#FF001F` | `text-inverse` `#FFFFFF` | none | 破壊的操作（削除、取消） |

### Icon-Only

- `isIconOnly=true` 時、ラベル非表示
- `aria-label` 必須
- border-radius を `var(--radius-full)` に変更（円形）
- padding を均等に（sm: 6px, md: 10px, lg: 12px）

---

## States

| State | Visual Change | CSS | ARIA |
|-------|--------------|-----|------|
| default | — | — | — |
| hover | 背景色 10% 暗く | `filter: brightness(0.9)` | — |
| active | 背景色 20% 暗く + scale(0.98) | `filter: brightness(0.8)` | — |
| focus | focus-ring 表示 | `outline: 2px solid var(--color-focus-ring); outline-offset: 2px` | — |
| disabled | opacity: 0.4, cursor: not-allowed | `opacity: 0.4; pointer-events: none` | `aria-disabled="true"` |
| loading | Spinner表示, ラベル非表示, クリック無効 | `pointer-events: none` | `aria-busy="true"` |

**focus-ring**: `:focus-visible` のみ。マウスクリックでは非表示。

---

## Design Tokens

> See: [`design-tokens.md`](../design-tokens.md) for full token definitions

| Token | DS v3 Reference | Resolved Value | Usage |
|-------|----------------|----------------|-------|
| `--btn-primary-bg` | `var(--color-bg-emphasis)` | Brand/600 `#5538EE` | Primary背景 |
| `--btn-primary-text` | `var(--color-text-inverse)` | Black/0 `#FFFFFF` | Primaryテキスト |
| `--btn-primary-hover-bg` | `var(--color-bg-emphasis-interactive)` | Brand/700 `#4D2FD3` | Primaryホバー |
| `--btn-secondary-bg` | `var(--color-bg-default)` | Black/0 `#FFFFFF` | Secondary背景 |
| `--btn-secondary-border` | `var(--color-border-default)` | Black/200 `#DADADD` | Secondaryボーダー |
| `--btn-secondary-text` | `var(--color-text-default)` | Black/950 `#27272A` | Secondaryテキスト |
| `--btn-ghost-hover-bg` | `var(--color-bg-interactive)` | Black/100 `#EFEEF0` | Ghostホバー背景 |
| `--btn-danger-bg` | `var(--color-bg-critical)` | Red/600 `#FF001F` | Danger背景 |
| `--btn-danger-hover-bg` | `var(--color-bg-critical-interactive)` | Red/700 `#D7001A` | Dangerホバー |
| `--btn-danger-text` | `var(--color-text-inverse)` | Black/0 `#FFFFFF` | Dangerテキスト |
| `--btn-disabled-bg` | `var(--color-bg-disabled)` | Black/200 `#DADADD` | 無効背景 |
| `--btn-disabled-text` | `var(--color-text-disabled)` | Black/400 `#94939D` | 無効テキスト |
| `--btn-radius` | `var(--radius-md)` | `12px` | 角丸 |
| `--btn-font-weight` | `var(--font-weight-bold)` | `700` | フォントウェイト |
| `--btn-font-family` | `var(--font-family)` | `Noto Sans JP` | フォント |
| `--btn-transition` | `150ms ease` | — | トランジション |

---

## Accessibility

### ARIA

| Attribute | Value | Condition |
|-----------|-------|-----------|
| `aria-label` | 操作説明 | `isIconOnly` 時 |
| `aria-disabled` | `true` | `isDisabled` 時 |
| `aria-busy` | `true` | `isLoading` 時 |

### Keyboard

| Key | Action |
|-----|--------|
| `Enter` | アクション実行 |
| `Space` | アクション実行 |
| `Tab` | 次の要素へフォーカス移動 |

### Color Contrast
- primary: 白テキスト on プライマリカラー → 4.5:1 以上
- ghost: テキスト on 背景 → 4.5:1 以上
- danger: 白テキスト on 赤系 → 4.5:1 以上

---

## Do / Don't

### Do
- ✅ 1画面にprimaryボタンは1つまで → ユーザーの意思決定を単純化
- ✅ ラベルは動詞で始める（「保存する」「削除する」） → `palette/references/content-guidelines-ja.md` 参照
- ✅ disabled時はtooltipで理由を表示 → ユーザーが解決策を理解できる
- ✅ 破壊的操作にはdangerバリアントを使用 → 視覚的警告
- ✅ loading中はボタン幅を維持 → レイアウトシフト防止

### Don't
- ❌ `<a>` タグにボタンスタイルを適用しない → セマンティクス混乱。ページ遷移はLinkを使う
- ❌ icon-onlyで `aria-label` を省略しない → スクリーンリーダーで操作不能
- ❌ 複数のprimaryを並べない → 優先順位が不明になる
- ❌ disabledボタンを完全に非表示にしない → UIの予測不能化
- ❌ ラベルに「クリック」「押す」を含めない → 操作方法でなく操作内容を書く

---

## Related

### Similar Components

| Component | Use When | Don't Use When |
|-----------|----------|---------------|
| Button | ユーザーアクションを実行 | ページ遷移のみ |
| Link | ページ遷移 | 状態変更を伴う操作 |
| IconButton | スペースが限られている | ラベルが必要な場面 |
| ToggleButton | ON/OFF切り替え | 1回限りのアクション |

### Composition Patterns
- → `vision/references/patterns/form-wizard.md` — フォームステップ間のナビゲーション
- → `vision/references/patterns/delete-confirmation.md` — 削除確認ダイアログ内の配置
- → `dialog.md` — ダイアログフッターでの primary/secondary 配置
