# Table

## Overview

| 項目 | 値 |
|------|-----|
| Name | Table |
| Description | 構造化データを行と列で表示するデータ表示要素 |
| Layer | Organism |
| Category | Data Display |
| Status | Stable |

---

## Anatomy

```
┌──────────────────────────────────────────────────────┐
│ [1]Toolbar                                            │
│   [2]Bulk Actions    [3]Column Settings  [4]Density  │
├──────────────────────────────────────────────────────┤
│ [5]Header Row                                         │
│ ☐  [6]Col Header ↑  Col Header  Col Header  Actions  │
├──────────────────────────────────────────────────────┤
│ [7]Data Row                                           │
│ ☐  Cell            Cell        Cell        [8]Actions │
│ ☐  Cell            Cell        Cell        Actions    │
│    [9]Expandable Detail Row                           │
│ ☐  Cell            Cell        Cell        Actions    │
├──────────────────────────────────────────────────────┤
│ [10]Footer                                            │
│   選択: 3件  │  1-10 / 248件  < 1 2 3 ... 25 >       │
└──────────────────────────────────────────────────────┘
```

| # | Part | Required | Description |
|----|------|----------|-------------|
| 1 | Toolbar | Optional | 一括操作・設定エリア |
| 2 | Bulk Actions | Conditional | 行選択時に表示される一括操作 |
| 3 | Column Settings | Optional | 列の表示/非表示、並び替え |
| 4 | Density | Optional | 行の高さ切替（compact/normal/comfortable） |
| 5 | Header Row | Required | 列見出し。ソート可能列にはインジケータ |
| 6 | Column Header | Required | ソートアイコン + ラベル |
| 7 | Data Row | Required | データ行 |
| 8 | Row Actions | Optional | 行ごとの操作メニュー |
| 9 | Expandable Row | Optional | 展開詳細行 |
| 10 | Footer | Optional | ページネーション + 選択件数 |

---

## Props / API

```typescript
interface TableProps<T> {
  /** カラム定義 */
  columns: ColumnDef<T>[];
  /** データ */
  data: T[];
  /** ソート可能 */
  isSortable?: boolean;
  /** 行選択可能 */
  isSelectable?: boolean;
  /** 行展開可能 */
  isExpandable?: boolean;
  /** 表示密度 */
  density?: 'compact' | 'normal' | 'comfortable';
  /** ソート状態 */
  sortState?: { column: string; direction: 'asc' | 'desc' };
  /** 選択行 */
  selectedRows?: T[];
  /** ページネーション */
  pagination?: { page: number; pageSize: number; total: number };
  /** ローディング */
  isLoading?: boolean;
  /** 空状態メッセージ */
  emptyMessage?: string;
  /** ソート変更ハンドラ */
  onSortChange?: (column: string, direction: 'asc' | 'desc') => void;
  /** 選択変更ハンドラ */
  onSelectionChange?: (rows: T[]) => void;
  /** ページ変更ハンドラ */
  onPageChange?: (page: number) => void;
  /** 行展開ハンドラ */
  onRowExpand?: (row: T) => void;
}

interface ColumnDef<T> {
  /** カラムID */
  id: string;
  /** ヘッダーラベル */
  header: string;
  /** セルレンダリング */
  cell: (row: T) => ReactNode;
  /** ソート可能 */
  isSortable?: boolean;
  /** 幅 */
  width?: string | number;
  /** 最小幅 */
  minWidth?: number;
  /** テキスト配置 */
  align?: 'left' | 'center' | 'right';
  /** 固定列（横スクロール時） */
  isSticky?: boolean;
}
```

---

## Variants

### Density

| Density | Row Height | Font Size | Padding | Use Case |
|---------|-----------|-----------|---------|----------|
| compact | 36px | 13px | 4px 12px | データ量が多い、一覧性重視 |
| normal | 48px | 14px | 8px 12px | 標準（デフォルト） |
| comfortable | 64px | 16px | 12px 16px | アバター付き、操作が多い |

### Features

| Feature | Description | 推奨条件 |
|---------|-------------|---------|
| Sortable | 列ヘッダークリックでソート | データが10行以上 |
| Selectable | チェックボックスで行選択 | 一括操作が必要 |
| Expandable | 行クリックで詳細展開 | 補足情報が多い |
| Sticky Header | スクロール時にヘッダー固定 | データが1画面に収まらない |
| Sticky Column | 横スクロール時に左列固定 | カラムが多い |
| Resizable | 列幅のドラッグ調整 | カラムの重要度がユーザーにより異なる |

---

## States

| State | Visual Change | ARIA | Trigger |
|-------|--------------|------|---------|
| default | — | — | 初期状態 |
| loading | Skeleton行表示 or オーバーレイスピナー | `aria-busy="true"` | データ取得中 |
| empty | emptyMessage + イラスト表示 | — | data.length === 0 |
| error | エラーメッセージ + リトライボタン | `aria-live="polite"` | データ取得失敗 |
| row-hover | 行背景色変化 | — | マウスオーバー |
| row-selected | 行背景色: selected | `aria-selected="true"` | チェックボックス選択 |
| row-expanded | 詳細行展開 | `aria-expanded="true"` | 行クリック/ボタン |
| sorting | ソートインジケータ表示（↑/↓） | `aria-sort="ascending/descending"` | ヘッダークリック |

---

## Design Tokens

> See: [`design-tokens.md`](../design-tokens.md) for full token definitions

| Token | DS v3 Reference | Resolved Value | Usage |
|-------|----------------|----------------|-------|
| `--table-bg` | `var(--color-bg-default)` | Black/0 `#FFFFFF` | テーブル背景 |
| `--table-header-bg` | `var(--color-bg-tertiary)` | Black/50 `#F7F7F8` | ヘッダー背景 |
| `--table-header-text` | `var(--color-text-secondary)` | Black/500 `#777681` | ヘッダーテキスト |
| `--table-border` | `var(--color-border-divider)` | Black/100 `#EFEEF0` | 行ボーダー |
| `--table-row-hover` | `var(--color-bg-interactive)` | Black/100 `#EFEEF0` | 行ホバー |
| `--table-row-selected` | `var(--color-bg-secondary)` | Brand/50 `#EDEFFF` | 選択行背景 |
| `--table-row-stripe` | `var(--color-bg-tertiary)` | Black/50 `#F7F7F8` | ゼブラストライプ |
| `--table-text` | `var(--color-text-default)` | Black/950 `#27272A` | セルテキスト |
| `--table-sort-icon` | `var(--color-icon-default)` | Black/950 `#27272A` | ソートアイコン |
| `--table-sort-icon-inactive` | `var(--color-icon-disabled)` | Black/300 `#BAB9C0` | 非アクティブソート |
| `--table-radius` | `var(--radius-lg)` | `16px` | テーブル角丸 |

---

## Accessibility

### ARIA

| Attribute | Element | Value |
|-----------|---------|-------|
| `role` | `<table>` | `table`（ネイティブ要素推奨） |
| `aria-sort` | `<th>` | `ascending` / `descending` / `none` |
| `aria-selected` | `<tr>` | `true`（選択行） |
| `aria-expanded` | `<tr>` | `true`（展開行） |
| `aria-busy` | `<table>` | `true`（ローディング中） |
| `aria-rowcount` | `<table>` | 総行数（ページネーション時） |
| `aria-label` | `<table>` | テーブルの説明 |

### Keyboard

| Key | Action |
|-----|--------|
| `Tab` | テーブル内のインタラクティブ要素間を移動 |
| `↑` / `↓` | 行間の移動（selectable時） |
| `Space` | 行の選択/選択解除 |
| `Enter` | 行の展開/折りたたみ、または行アクション |

### Screen Reader
- ソート変更時: `aria-live="polite"` で「{列名}を{昇順/降順}でソートしました」を通知
- ページ変更時: 同様に現在のページ範囲を通知

---

## Do / Don't

### Do
- ✅ ネイティブ `<table>` 要素を使用 → スクリーンリーダーのテーブルナビゲーション対応
- ✅ 空状態で次のアクションを提示 → 「データがありません。新規作成してください」
- ✅ ローディング中はSkeleton行を表示 → レイアウトシフト防止
- ✅ 数値列は右揃え → 桁数の比較がしやすい
- ✅ ソート可能列はヘッダーにインジケータ → 操作可能であることを示す

### Don't
- ❌ `<div>` でテーブルを組まない → a11yが破壊される
- ❌ 10列以上を横一列に並べない → 横スクロール or 列選択機能を追加
- ❌ 行全体をクリッカブルにしつつ行内にリンク/ボタンを置かない → クリック対象が曖昧
- ❌ ページネーションなしで100行以上表示しない → パフォーマンス低下

---

## Related

### Similar Components

| Component | Use When | Don't Use When |
|-----------|----------|---------------|
| Table | 構造化データの一覧表示 | 非構造化コンテンツ |
| Card List | ビジュアル重視のデータ表示 | 数値比較が必要 |
| DataGrid | セル編集が必要 | 閲覧のみ |
| List | 単カラムの項目一覧 | 複数属性の比較 |

### Composition Patterns
- → `vision/references/patterns/data-table.md` — ソート+フィルタ+ページネーション統合パターン
- → `vision/references/patterns/search-filter.md` — テーブルと検索フィルタの組み合わせ
