# Card

## Overview

| 項目 | 値 |
|------|-----|
| Name | Card |
| Description | 関連する情報をグループ化して表示するコンテナ要素 |
| Layer | Molecule |
| Category | Data Display |
| Status | Stable |

---

## Anatomy

```
┌─────────────────────────────────────────┐
│ [1]Media (optional)                      │
│   画像 / 動画 / イラスト                  │
├─────────────────────────────────────────┤
│ [2]Header                                │
│   [3]Badge/Tag  [4]Overflow Menu (⋯)    │
│   [5]Title                               │
│   [6]Subtitle                            │
├─────────────────────────────────────────┤
│ [7]Body                                  │
│   コンテンツテキスト / リスト             │
├─────────────────────────────────────────┤
│ [8]Footer                                │
│   [9]Meta Info    [10]Actions            │
└─────────────────────────────────────────┘
```

| # | Part | Required | Description |
|----|------|----------|-------------|
| 1 | Media | Optional | 画像・動画などのビジュアル |
| 2 | Header | Required | タイトル領域 |
| 3 | Badge/Tag | Optional | ステータス・カテゴリ表示 |
| 4 | Overflow Menu | Optional | その他のアクション |
| 5 | Title | Required | カードの主題 |
| 6 | Subtitle | Optional | 補足情報（日時・カテゴリ等） |
| 7 | Body | Optional | 本文コンテンツ |
| 8 | Footer | Optional | メタ情報・アクション領域 |
| 9 | Meta Info | Optional | 日付・作成者・閲覧数等 |
| 10 | Actions | Optional | ボタン・リンク |

---

## Props / API

```typescript
interface CardProps {
  /** カードタイプ */
  variant?: 'basic' | 'interactive' | 'media' | 'stat';
  /** サイズ */
  size?: 'sm' | 'md' | 'lg';
  /** 方向 */
  orientation?: 'vertical' | 'horizontal';
  /** パディング */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** クリック可能（interactive用） */
  isClickable?: boolean;
  /** 選択状態 */
  isSelected?: boolean;
  /** href（リンクカード） */
  href?: string;
  /** クリックハンドラ */
  onClick?: () => void;
  /** コンテンツ */
  children: ReactNode;
}

// 合成コンポーネント
Card.Media: ({ src, alt, aspectRatio }) => ReactNode;
Card.Header: ({ children }) => ReactNode;
Card.Title: ({ children }) => ReactNode;
Card.Subtitle: ({ children }) => ReactNode;
Card.Body: ({ children }) => ReactNode;
Card.Footer: ({ children }) => ReactNode;
```

---

## Variants

### Type

| Variant | 特徴 | Use Case |
|---------|------|----------|
| basic | 静的表示、ボーダー区切り | 情報の表示（プロフィール、詳細） |
| interactive | ホバーエフェクト、クリック可能 | 一覧からの選択、ナビゲーション |
| media | メディア領域が大きい | ブログ記事、商品カード |
| stat | 数値を大きく表示 | KPIカード、ダッシュボード |

### Size

| Size | Width | Padding | Title Size | Use Case |
|------|-------|---------|-----------|----------|
| sm | 280px | 12px | 16px | サイドバー、コンパクト一覧 |
| md | 360px | 16px | 18px | 標準グリッド |
| lg | 480px | 24px | 20px | フィーチャーカード |

### Orientation

| Orientation | Layout | Use Case |
|-------------|--------|----------|
| vertical | メディア上、コンテンツ下 | グリッド表示 |
| horizontal | メディア左、コンテンツ右 | リスト表示（min-width: 480px） |

---

## States

| State | Visual Change | CSS | Trigger |
|-------|--------------|-----|---------|
| default | shadow-sm, border | — | 初期状態 |
| hover | shadow-md, translateY(-2px) | `transition: 200ms ease` | マウスオーバー（interactive） |
| active | shadow-sm, scale(0.99) | — | クリック中（interactive） |
| focus | focus-ring | `outline: 2px solid var(--color-focus-ring)` | Tab（interactive） |
| selected | border: primary, bg: primary-50 | — | isSelected |
| loading | Skeleton表示 | — | データ取得中 |
| disabled | opacity: 0.5, pointer-events: none | — | リンク無効時 |

---

## Design Tokens

> See: [`design-tokens.md`](../design-tokens.md) for full token definitions

| Token | DS v3 Reference | Resolved Value | Usage |
|-------|----------------|----------------|-------|
| `--card-bg` | `var(--color-bg-default)` | Black/0 `#FFFFFF` | 背景 |
| `--card-border` | `var(--color-border-default)` | Black/200 `#DADADD` | ボーダー |
| `--card-selected-border` | `var(--color-border-emphasis)` | Brand/600 `#5538EE` | 選択時ボーダー |
| `--card-selected-bg` | `var(--color-bg-secondary)` | Brand/50 `#EDEFFF` | 選択時背景 |
| `--card-radius` | `var(--radius-lg)` | `16px` | 角丸 |
| `--card-media-radius` | `var(--radius-lg) var(--radius-lg) 0 0` | `16px 16px 0 0` | メディア角丸 |
| `--card-padding` | `var(--space-lg)` | `16px` | 内部パディング |
| `--card-gap` | `var(--space-md)` | `12px` | セクション間余白 |
| `--card-text` | `var(--color-text-default)` | Black/950 `#27272A` | テキスト |
| `--card-text-secondary` | `var(--color-text-secondary)` | Black/500 `#777681` | 補助テキスト |

---

## Accessibility

### ARIA

| Attribute | Value | Condition |
|-----------|-------|-----------|
| `role` | `article` | コンテンツカード |
| `role` | `link` | href有のクリッカブルカード |
| `tabindex` | `0` | interactive / isClickable |
| `aria-selected` | `true` | isSelected |
| `aria-label` | カードの説明 | クリッカブルで title が不十分な場合 |

### Keyboard

| Key | Action |
|-----|--------|
| `Enter` / `Space` | カードのクリックアクション（interactive） |
| `Tab` | カード間 / カード内アクション間の移動 |

### Focus Management
- クリッカブルカード: カード全体が1つのフォーカスターゲット
- カード内にボタン/リンクがある場合: カード自体はフォーカス不可、内部要素のみフォーカス

**注意:** カード全体がクリッカブル + カード内にボタンが存在する場合、ネストされたインタラクティブ要素の問題が発生する。この場合、カード全体のクリックは `<a>` の疑似要素で実現し、内部ボタンは `position: relative; z-index: 1` で上に配置する。

---

## Do / Don't

### Do
- ✅ カード内の情報は優先度順に配置 → タイトル → 本文 → メタ → アクション
- ✅ グリッド表示時はカードの高さを揃える → 視覚的整合性
- ✅ statカードは数値を最も目立たせる → ダッシュボードの一覧性
- ✅ Skeleton ローディングでカードのレイアウトを維持 → CLS防止

### Don't
- ❌ 1つのカードに3つ以上のアクションを置かない → Overflow Menuにまとめる
- ❌ カード内に長文テキストを詰め込まない → 2-3行でtruncate
- ❌ クリッカブルカード内にネストしたクリッカブル要素を安易に置かない → a11y問題
- ❌ メディアのアスペクト比を歪めない → `object-fit: cover` で対応

---

## Related

### Similar Components

| Component | Use When | Don't Use When |
|-----------|----------|---------------|
| Card | 関連情報のグループ化 | 単一の値や文 |
| Table Row | 構造化データの1行 | ビジュアル重視の表示 |
| ListItem | 単純なリスト項目 | 複数セクションの情報 |
| Tile | 均等なグリッド表示 | 不均等なコンテンツ |

### Composition Patterns
- → `vision/references/patterns/data-table.md` — カードビューとの切替
- → `vision/references/patterns/search-filter.md` — 検索結果のカード表示
- → `vision/references/patterns/sidebar-layout.md` — メインコンテンツ内のカードグリッド
