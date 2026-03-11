# Dialog

## Overview

| 項目 | 値 |
|------|-----|
| Name | Dialog |
| Description | ユーザーの注意を集中させ、操作・情報入力・確認を促すオーバーレイ要素 |
| Layer | Organism |
| Category | Overlay |
| Status | Stable |

---

## Anatomy

```
┌─ Backdrop (overlay) ────────────────────────┐
│                                              │
│   ┌─ Dialog ─────────────────────────────┐   │
│   │ [1]Header                            │   │
│   │   [2]Title     [3]Close Button       │   │
│   │   [4]Description                     │   │
│   ├──────────────────────────────────────┤   │
│   │ [5]Body                              │   │
│   │   コンテンツ / フォーム               │   │
│   ├──────────────────────────────────────┤   │
│   │ [6]Footer                            │   │
│   │   [7]Secondary Action  [8]Primary    │   │
│   └──────────────────────────────────────┘   │
│                                              │
└──────────────────────────────────────────────┘
```

| # | Part | Required | Description |
|----|------|----------|-------------|
| 1 | Header | Required | タイトル領域 |
| 2 | Title | Required | ダイアログの目的を示す |
| 3 | Close Button | Required* | ✕ボタン。*alert では省略可 |
| 4 | Description | Optional | タイトルの補足説明 |
| 5 | Body | Required | メインコンテンツ |
| 6 | Footer | Required* | アクションボタン領域。*情報表示のみなら省略可 |
| 7 | Secondary Action | Optional | キャンセル等の補助アクション |
| 8 | Primary Action | Required (Footer有時) | 主要アクション |

---

## Props / API

```typescript
interface DialogProps {
  /** ダイアログタイプ */
  type?: 'default' | 'alert' | 'confirm' | 'form' | 'fullscreen';
  /** サイズ */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'fullscreen';
  /** 開閉状態 */
  isOpen: boolean;
  /** タイトル */
  title: string;
  /** 説明文 */
  description?: string;
  /** Backdrop クリックで閉じるか */
  isDismissable?: boolean;
  /** 閉じるハンドラ */
  onClose: () => void;
  /** コンテンツ */
  children: ReactNode;
  /** フッターアクション */
  footer?: ReactNode;
}
```

---

## Variants

### Size

| Size | Width | Use Case |
|------|-------|----------|
| sm | 400px | 確認ダイアログ、シンプルなアラート |
| md | 560px | 標準フォーム、情報表示 |
| lg | 720px | 複雑なフォーム、プレビュー |
| xl | 960px | データテーブル、比較画面 |
| fullscreen | 100vw × 100vh | 集中操作、モバイル |

**max-height:** `calc(100vh - 128px)` — 画面端から64pxのマージン

### Type

| Type | Close Button | Backdrop Dismiss | Footer | Use Case |
|------|-------------|-----------------|--------|----------|
| default | ✓ | ✓ | Optional | 情報表示 |
| alert | ✗ | ✗ | Required（OKのみ） | 重要通知、エラー |
| confirm | ✓ | ✗ | Required（2ボタン） | 操作確認 |
| form | ✓ | ✗ | Required（送信+キャンセル） | データ入力 |
| fullscreen | ✓ | ✗ | Optional | 集中操作 |

**confirm/form でBackdrop Dismissを無効にする理由:** 入力途中のデータ損失を防ぐ。

---

## States

| State | Visual Change | ARIA | Trigger |
|-------|--------------|------|---------|
| closed | 非表示 | `aria-hidden="true"` | isOpen=false |
| opening | フェードイン + スケールアニメーション | — | isOpen=true |
| open | 表示 | — | アニメーション完了 |
| closing | フェードアウト | — | onClose |
| loading | Body内にローディング表示、アクション無効 | `aria-busy="true"` | 非同期処理中 |

**アニメーション:**
- 開: `opacity: 0→1`, `scale: 0.95→1`, `duration: 200ms`, `ease-out`
- 閉: `opacity: 1→0`, `duration: 150ms`, `ease-in`
- Backdrop: `opacity: 0→0.5`, `duration: 200ms`

---

## Design Tokens

> See: [`design-tokens.md`](../design-tokens.md) for full token definitions

| Token | DS v3 Reference | Resolved Value | Usage |
|-------|----------------|----------------|-------|
| `--dialog-bg` | `var(--color-bg-default)` | Black/0 `#FFFFFF` | ダイアログ背景 |
| `--dialog-border` | `var(--color-border-default)` | Black/200 `#DADADD` | ボーダー |
| `--dialog-radius` | `var(--radius-lg)` | `16px` | 角丸 |
| `--dialog-backdrop` | `rgba(0, 0, 0, 0.5)` | — | Backdrop色 |
| `--dialog-header-border` | `var(--color-border-divider)` | Black/100 `#EFEEF0` | Header下線 |
| `--dialog-footer-border` | `var(--color-border-divider)` | Black/100 `#EFEEF0` | Footer上線 |
| `--dialog-padding` | `var(--space-xl)` | `24px` | 内部パディング |
| `--dialog-title-text` | `var(--color-text-default)` | Black/950 `#27272A` | タイトルテキスト |
| `--dialog-body-text` | `var(--color-text-secondary)` | Black/500 `#777681` | 本文テキスト |

---

## Accessibility

### ARIA

| Attribute | Value | Condition |
|-----------|-------|-----------|
| `role` | `dialog` | default/form |
| `role` | `alertdialog` | alert/confirm |
| `aria-modal` | `true` | 常時 |
| `aria-labelledby` | title要素のid | 常時 |
| `aria-describedby` | description要素のid | description有時 |

### Keyboard

| Key | Action |
|-----|--------|
| `Escape` | ダイアログを閉じる（alert以外） |
| `Tab` | ダイアログ内でフォーカス循環（トラップ） |
| `Shift+Tab` | 逆方向のフォーカス循環 |
| `Enter` | Primary Actionの実行（formタイプ） |

### Focus Management
1. **開時**: ダイアログ内の最初のフォーカス可能要素にフォーカス（form: 最初の入力、confirm: Primaryボタン）
2. **フォーカストラップ**: Tab/Shift+Tab でダイアログ外に出さない
3. **閉時**: ダイアログを開いたトリガー要素にフォーカスを戻す
4. **スクロールロック**: body の `overflow: hidden` で背景スクロールを防ぐ

---

## Do / Don't

### Do
- ✅ タイトルは動詞ベース（「項目を削除」「プロフィールを編集」） → 目的が明確
- ✅ 破壊的操作には影響範囲を説明文に明記 → `vision/references/patterns/delete-confirmation.md` 参照
- ✅ フォームダイアログでは未保存変更の確認を実装 → データ損失防止
- ✅ ボタンラベルは具体的な動詞（「削除する」「保存する」） → 「OK」「はい」より明確

### Don't
- ❌ ダイアログの中でダイアログを開かない → ユーザーの文脈喪失
- ❌ 長いコンテンツにダイアログを使わない → 専用ページを使う
- ❌ 成功通知にダイアログを使わない → Toast/Snackbar を使う
- ❌ 「はい/いいえ」ボタンを使わない → 具体的な動詞ラベルを使う

---

## Related

### Similar Components

| Component | Use When | Don't Use When |
|-----------|----------|---------------|
| Dialog | 確認・入力が必要な割り込み | 簡易通知 |
| Toast | 成功/情報の一時通知 | ユーザー操作が必要 |
| Drawer | サイドパネルでの追加情報 | 注意の集中が必要 |
| Popover | 要素近くの補足情報 | 複雑な操作 |

### Composition Patterns
- → `vision/references/patterns/delete-confirmation.md` — 削除確認フロー
- → `vision/references/patterns/form-wizard.md` — ダイアログ内フォーム
- → `button.md` — フッターのボタン配置（Secondary左、Primary右）
