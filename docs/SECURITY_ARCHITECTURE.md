# Security Architecture — goto-orchestrator

> goto-orchestrator のコアドキュメント。Claude Code を安全に使うための多層防御アーキテクチャの完全仕様。
>
> 各セクションは ARIS 品質基準（問題 → 根本原因 → 解決策 → 検知 → 復旧）で記述する。

---

## 目次

1. [セキュリティ設計思想](#1-セキュリティ設計思想)
2. [脅威モデル（Threat Model）](#2-脅威モデルthreat-model)
3. [多層防御アーキテクチャ（5層）](#3-多層防御アーキテクチャ5層)
4. [Layer 0: CLAUDE.md ルール](#4-layer-0-claudemd-ルール)
5. [Layer 1: Sandbox](#5-layer-1-sandbox)
6. [Layer 2: Permissions](#6-layer-2-permissions)
7. [Layer 3: Hooks（3-Hook体制）](#7-layer-3-hooks3-hook体制)
8. [Layer 4: Guardrails](#8-layer-4-guardrails)
9. [シークレット保護（詳細設計）](#9-シークレット保護詳細設計)
10. [組織向け Managed Settings](#10-組織向け-managed-settings)
11. [セキュリティチェックリスト](#11-セキュリティチェックリスト)
12. [付録: 設定テンプレート集](#12-付録-設定テンプレート集)

---

## 1. セキュリティ設計思想

### 基本原則

Claude Code はシェルコマンド実行、ファイル読み書き、ネットワークアクセスという強力な能力を持つ。この能力を「制限する」のではなく「安全に活かす」ことが goto-orchestrator の設計思想である。

#### 1.1 便利さと安全性のトレードオフ

セキュリティは一度にすべてを導入する必要はない。段階的に実装し、チームの成熟度に合わせて強化する。

```
Phase 1（必須）: Sandbox + 基本deny      → 壊滅的事故の防止
Phase 2（推奨）: Hooks + ネットワーク制限  → 運用中のリスク可視化
Phase 3（上級）: Managed Settings          → チーム統一ポリシー
Phase 4（組織）: 監査ログ + ポリシー配信    → ガバナンス確立
```

**判断基準**: 安全性を上げるほど開発体験は低下する。各チームが許容できるバランスを Phase 単位で選択する。

#### 1.2 多層防御（Defense in Depth）

単一の防御層に依存しない。1層が突破されても次の層が防ぐ。

```
問題: 単一防御層（例: CLAUDE.md のルール記述のみ）に依存した場合、
      LLM がルールを無視すれば全防御が崩壊する
根本原因: LLM はプロンプトを確率的に解釈するため、指示の 100% 遵守は保証できない
解決策: OS レベル（Sandbox）、ルールエンジン（Permissions）、
        プログラマティック検知（Hooks）、エージェントレベル（Guardrails）の 5 層で防御
検知: /status コマンドで各層の有効状態を確認
復旧: 層ごとに独立して再設定可能。1層の障害が他層に波及しない
```

#### 1.3 Fail-safe Default

**デフォルトは安全側に倒す。** 明示的に許可されていない操作は拒否される。

- Sandbox: `allowUnsandboxedCommands: false`（デフォルト拒否）
- Permissions: `deny` が `allow` より先に評価される
- Hooks: パースエラー時は `approve`（可用性確保）だが、Safety Gate パターンは先に評価

#### 1.4 最小権限の原則（Principle of Least Privilege）

Claude Code に付与する権限は必要最小限にとどめる。

- ファイルシステム: プロジェクトディレクトリ外の読み取りを制限
- ネットワーク: 必要なドメインのみホワイトリストで許可
- コマンド: `allow` リストは実際に使うコマンドだけに限定
- 機密情報: `.env`、`*.pem`、`*.key` はデフォルトで読み取り拒否

---

## 2. 脅威モデル（Threat Model）

### 脅威分類表

| ID | 脅威カテゴリ | 具体例 | 影響度 | 発生頻度 | 主要防御層 |
|------|-------------|--------|--------|---------|-----------|
| SEC-001 | シークレット漏洩 | `.env` のコミット、API キーの stdout 出力、curl での認証情報送信 | **CRITICAL** | HIGH | L1, L2, L3 |
| SEC-002 | 破壊的操作 | `rm -rf /`, `DROP TABLE`, `git push --force` | **CRITICAL** | MEDIUM | L2, L3 |
| SEC-003 | 権限昇格 | `sudo` 実行、`chmod 777` | HIGH | LOW | L1, L2 |
| SEC-004 | データ外部送信 | curl/wget で内部データを外部エンドポイントに送信 | HIGH | LOW | L1, L3 |
| SEC-005 | コスト暴走 | 無制限ループ（`while true`）、大量 API 呼び出し | MEDIUM | MEDIUM | L3 |
| SEC-006 | 本番環境接続 | 本番 DB への直接 SELECT/UPDATE/DELETE | **CRITICAL** | LOW | L0, L2, L3 |
| SEC-007 | サプライチェーン | 悪意のある npm/pip パッケージのインストール | HIGH | LOW | L2, L3 |

### 各脅威の詳細分析

#### SEC-001: シークレット漏洩

```
問題: API キーやパスワードがコミット履歴、stdout、ログファイルに露出する
根本原因: Claude Code はファイル内容を読み取り、コマンドを実行できるため、
          意図せずシークレットを含む出力を生成する可能性がある
解決策:
  - Layer 1（Sandbox）: ~/.aws, ~/.ssh を読み取り禁止
  - Layer 2（Permissions）: .env, *.pem, *.key の Read を deny
  - Layer 3（Hooks）: シークレット変数の stdout 出力を Safety Gate でブロック
  - Layer 3（Hooks）: git add .env を Safety Gate でブロック
検知:
  - PreToolUse Hook がリアルタイムで検知
  - PostToolUse Hook がログに記録
  - シークレットパターンの正規表現マッチング
復旧:
  - 漏洩検知時: 即座にシークレットをローテーション
  - コミット履歴への混入: git filter-branch または BFG Repo-Cleaner で履歴書き換え
  - 公開リポジトリへのプッシュ: GitHub Secret Scanning Alert + 即時 revoke
```

#### SEC-002: 破壊的操作

```
問題: ファイルシステム、データベース、Git リポジトリの不可逆な破壊
根本原因: Claude Code は Bash コマンドを直接実行でき、
          タスク遂行のために破壊的コマンドを選択する可能性がある
解決策:
  - Layer 2（Permissions）: rm -rf /, sudo, git push --force 等を deny
  - Layer 3（Hooks）: Safety Gate が DROP DATABASE, force push to main をブロック
  - Layer 3（Hooks）: HIGH リスク分類で確認ダイアログを表示
検知:
  - PreToolUse Hook のリスク分類で HIGH/BLOCK を検出
  - Permissions の deny ルールによる事前拒否
復旧:
  - ファイル削除: バックアップからの復元、git checkout でのファイル復旧
  - DB 破壊: バックアップからのリストア
  - Git 履歴破壊: reflog からの復旧、リモートからの再 clone
```

#### SEC-003: 権限昇格

```
問題: sudo や chmod 777 によるシステムレベルの権限操作
根本原因: タスク実行中に権限不足に遭遇した場合、
          Claude Code が sudo で回避しようとする可能性
解決策:
  - Layer 1（Sandbox）: OS レベルで特権操作を制限
  - Layer 2（Permissions）: sudo *, chmod 777 * を deny
検知: Permissions deny ルールでブロック時にエラーとして表示
復旧: chmod の誤変更は適切な権限値への再設定で対応
```

#### SEC-004: データ外部送信

```
問題: 機密データが curl/wget 経由で外部に送信される
根本原因: デバッグや API テスト中に、意図せず内部データを外部サービスに送信
解決策:
  - Layer 1（Sandbox）: ネットワークの allowedDomains ホワイトリストで制限
  - Layer 3（Hooks）: Safety Gate が認証情報を含む curl を検知・ブロック
  - Layer 2（Permissions）: curl --data *password* 等を deny
検知: PreToolUse Hook + Permissions deny のダブルチェック
復旧: 送信済みデータの取り消しは不可能 → 予防が最重要
```

#### SEC-005: コスト暴走

```
問題: 無制限ループや大量 API 呼び出しによるリソース枯渇・課金爆発
根本原因: while true やバッチ処理の制御不備
解決策:
  - Layer 3（Hooks）: Safety Gate が while true, 大量 seq を検知・ブロック
  - Layer 4（Guardrails）: L3 レベルで異常なリソース使用を検知
検知: PreToolUse Hook のパターンマッチング
復旧: プロセス kill + セッション停止
```

#### SEC-006: 本番環境接続

```
問題: 開発中に本番 DB への直接操作が実行される
根本原因: 環境変数やコンフィグの誤設定で本番接続情報が読み込まれる
解決策:
  - Layer 0（CLAUDE.md）: 本番環境への直接操作を明示的に禁止
  - Layer 2（Permissions）: 本番ホスト名を含む接続コマンドを deny
  - Layer 3（Hooks）: 本番ドメインへの接続を検知
検知: ホスト名パターンマッチング（prod-*, *.production.* 等）
復旧: トランザクションのロールバック、DB バックアップからのリストア
```

#### SEC-007: サプライチェーン

```
問題: 悪意のある npm/pip パッケージのインストール
根本原因: Claude Code がタスク遂行のために未知のパッケージを提案・インストール
解決策:
  - Layer 2（Permissions）: npm install -g を deny（グローバルインストール禁止）
  - Layer 3（Hooks）: pip install, npm install を MEDIUM リスクとして通知
  - Layer 0（CLAUDE.md）: 新規パッケージ追加時は人間のレビュー必須と明記
検知: PostToolUse Hook がパッケージインストールを記録
復旧: package.json/requirements.txt の変更を revert、lockfile の再生成
```

---

## 3. 多層防御アーキテクチャ（5層）

### アーキテクチャ全体像

```
┌─────────────────────────────────────────────────────┐
│                  User Request                        │
│         「このバグを修正して」「テストを実行して」        │
└─────────────┬───────────────────────────────────────┘
              ▼
┌─────────────────────────────────────────────────────┐
│  Layer 0: CLAUDE.md（ルールベース指示）                │
│  ├── セキュリティルールの記述                          │
│  ├── 禁止操作の明示                                   │
│  └── 防御力: ★★☆☆☆（LLM依存、確率的遵守）           │
└─────────────┬───────────────────────────────────────┘
              ▼
┌─────────────────────────────────────────────────────┐
│  Layer 1: Sandbox（OS レベル隔離）                    │
│  ├── macOS Seatbelt / Linux Bubble Wrap              │
│  ├── ファイルシステム制限                              │
│  ├── ネットワーク制限                                 │
│  └── 防御力: ★★★★★（OS カーネルレベル強制）          │
└─────────────┬───────────────────────────────────────┘
              ▼
┌─────────────────────────────────────────────────────┐
│  Layer 2: Permissions（deny/allow ルール）            │
│  ├── 評価順序: deny → ask → allow                    │
│  ├── ツール + 引数パターンによるマッチング              │
│  └── 防御力: ★★★★☆（ルール記述精度に依存）          │
└─────────────┬───────────────────────────────────────┘
              ▼
┌─────────────────────────────────────────────────────┐
│  Layer 3: Hooks（3-Hook体制）                        │
│  ├── PreToolUse: tool-risk.js（リスク評価 + Safety Gate）│
│  ├── PostToolUse: post-tool-use.js（ログ記録）        │
│  ├── Stop: stop-hook.js（セッションサマリ）            │
│  └── 防御力: ★★★★☆（カスタムロジックで柔軟に対応）  │
└─────────────┬───────────────────────────────────────┘
              ▼
┌─────────────────────────────────────────────────────┐
│  Layer 4: Guardrails（L1-L4 エージェントレベル品質ゲート）│
│  ├── L1: MONITORING（ログのみ）                       │
│  ├── L2: CHECKPOINT（自動検証）                       │
│  ├── L3: PAUSE（自動回復 or 待機）                    │
│  ├── L4: ABORT（即時停止）                            │
│  └── 防御力: ★★★☆☆（エージェント協調に依存）        │
└─────────────────────────────────────────────────────┘
```

### 脅威×防御層 マッピング

各脅威がどの防御層でカバーされるかの全体像。

| 脅威 | L0 CLAUDE.md | L1 Sandbox | L2 Permissions | L3 Hooks | L4 Guardrails |
|------|:---:|:---:|:---:|:---:|:---:|
| SEC-001 シークレット漏洩 | ○ | ◎ | ◎ | ◎ | - |
| SEC-002 破壊的操作 | ○ | - | ◎ | ◎ | ○ |
| SEC-003 権限昇格 | ○ | ◎ | ◎ | - | - |
| SEC-004 データ外部送信 | ○ | ◎ | ○ | ◎ | - |
| SEC-005 コスト暴走 | ○ | - | - | ◎ | ○ |
| SEC-006 本番環境接続 | ◎ | - | ○ | ○ | ○ |
| SEC-007 サプライチェーン | ○ | - | ○ | ○ | - |

- ◎ = 主要防御層  ○ = 補助防御層  - = カバー外

---

## 4. Layer 0: CLAUDE.md ルール

### 位置付け

CLAUDE.md は Claude Code が最初に読み込むプロジェクト指示書であり、セキュリティルールを LLM に直接伝達する最初の防御層。

```
問題: LLM はプロンプト指示を確率的に解釈するため、100% の遵守は保証できない
根本原因: LLM の「忘却」「再解釈」「コンテキスト競合」
解決策: CLAUDE.md でルールを明記しつつ、L1-L4 で確実に補完する
検知: /status でルールの読み込み状態を確認
復旧: CLAUDE.md のルール修正 → 次回セッションで反映
```

### 効果と限界

| 項目 | 評価 |
|------|------|
| 設定容易性 | ★★★★★（テキスト記述のみ） |
| 防御確実性 | ★★☆☆☆（LLM の遵守率に依存） |
| 柔軟性 | ★★★★★（自然言語で任意のルール記述可能） |
| バイパスリスク | 高（LLM がルールを「忘れる」「再解釈する」可能性） |

**結論**: Layer 0 は「意図の伝達」として重要だが、セキュリティの根幹を任せてはならない。必ず L1-L3 で補完する。

### 推奨テンプレート

```markdown
## Security Rules

### 絶対禁止事項
- .env ファイルは絶対にコミットしない（git add .env 禁止）
- API キー・トークン・パスワードをコード内にハードコードしない
- シークレットを echo/console.log/print で出力しない
- curl/wget でシークレットを含むデータを外部に送信しない
- 本番データベースに直接接続しない
- sudo を実行しない

### 環境変数の扱い
- 環境変数は process.env / os.environ 経由でアクセスする
- .env.example にはダミー値のみ記載する（実際の値は絶対に書かない）
- 新しい環境変数を追加した場合は .env.example も更新する

### パッケージ管理
- 新しいパッケージを追加する前に、本当に必要か確認する
- 既知の脆弱性がないか npm audit / pip audit で確認する
- グローバルインストール（npm install -g）は行わない

### 本番環境
- 本番環境への操作は一切行わない
- DB マイグレーションは開発環境でのみ実行する
- デプロイは CI/CD パイプライン経由でのみ行う
```

### カスタマイズ指針

プロジェクト固有のセキュリティ要件を追記する場合:

```markdown
## Project-Specific Security

### API 制限
- OpenAI API の呼び出しは1セッションあたり最大 10 回まで
- 外部 API のテストには必ずモック/スタブを使用する

### データ保護
- 個人情報（PII）を含むデータをログに出力しない
- テストデータにはフェイクデータジェネレータを使用する

### インフラ
- Terraform apply は禁止（plan のみ許可）
- Kubernetes の本番 namespace への操作は禁止
```

---

## 5. Layer 1: Sandbox

### 位置付け

OS カーネルレベルでファイルシステムとネットワークを制限する最も強力な防御層。LLM の意図に関係なく、物理的にアクセスを遮断する。

```
問題: Claude Code が機密ファイル（~/.aws/credentials, ~/.ssh/id_rsa）を読み取り、
      外部に送信する可能性
根本原因: デフォルトではプロセスはユーザーの全ファイルにアクセス可能
解決策: OS レベルのサンドボックスでファイルシステム・ネットワークを隔離
検知: sandbox 外のリソースにアクセスしようとするとOSがブロック
復旧: 不要（アクセスが物理的に不可能なため、インシデント自体が発生しない）
```

### サンドボックスエンジン

| OS | エンジン | 特徴 |
|----|---------|------|
| macOS | Seatbelt (`sandbox-exec`) | Apple 標準、カーネルレベル強制 |
| Linux | Bubble Wrap (`bwrap`) | ユーザー空間サンドボックス、namespace 隔離 |

### ファイルシステム制限

#### 推奨 denyRead リスト

```json
{
  "sandbox": {
    "enabled": true,
    "allowUnsandboxedCommands": false,
    "filesystem": {
      "denyRead": [
        "~/.aws/credentials",
        "~/.aws/config",
        "~/.ssh/id_*",
        "~/.ssh/config",
        "~/.gnupg/**",
        "~/.config/gh/hosts.yml",
        "~/.netrc"
      ]
    }
  }
}
```

| パス | 保護対象 | リスク |
|------|---------|--------|
| `~/.aws/credentials` | AWS アクセスキー・シークレットキー | クラウドリソースの不正利用 |
| `~/.aws/config` | AWS アカウント情報・リージョン | 攻撃対象の特定 |
| `~/.ssh/id_*` | SSH 秘密鍵 | サーバーへの不正アクセス |
| `~/.ssh/config` | SSH 接続先情報 | インフラ構成の漏洩 |
| `~/.gnupg/**` | GPG 秘密鍵 | 署名の偽造 |
| `~/.config/gh/hosts.yml` | GitHub 認証トークン | リポジトリの不正操作 |
| `~/.netrc` | 各種サービスの認証情報 | 複数サービスへの不正アクセス |

#### 追加推奨（プロジェクトに応じて）

```json
{
  "filesystem": {
    "denyRead": [
      "~/.kube/config",
      "~/.docker/config.json",
      "~/.npmrc",
      "~/.pypirc",
      "~/.*_history"
    ]
  }
}
```

### ネットワーク制限

ホワイトリスト方式で外部への意図しないデータ送信を防止する。

```json
{
  "sandbox": {
    "network": {
      "allowedDomains": [
        "github.com",
        "*.githubusercontent.com",
        "*.npmjs.org",
        "registry.yarnpkg.com",
        "pypi.org",
        "files.pythonhosted.org"
      ]
    }
  }
}
```

#### ドメイン追加の判断基準

| 判断基準 | 許可 | 拒否 |
|---------|------|------|
| パッケージレジストリ | npm, PyPI, crates.io | 不明なレジストリ |
| ソースコードホスティング | GitHub, GitLab | 個人サーバー |
| ドキュメント | 公式 docs サイト | 任意の URL |
| API エンドポイント | - | すべて（明示的に追加が必要） |

### `allowUnsandboxedCommands: false` の重要性

```
問題: allowUnsandboxedCommands: true にすると、
      サンドボックス外でコマンドを実行可能になり、全制限が無効化される
根本原因: 一部のコマンドがサンドボックス非対応の場合に回避オプションとして用意されている
解決策: 常に false を維持する。非対応コマンドは allow ルールで個別に許可する
検知: /status でサンドボックス設定を確認
復旧: settings.json で false に戻す
```

**これを true にする正当な理由はほぼ存在しない。**

### 回避方法と対策

| 回避シナリオ | リスク | 対策 |
|------------|--------|------|
| ユーザーが settings.json を手動変更 | sandbox 無効化 | Managed Settings で強制（セクション10参照） |
| サンドボックス非対応コマンドの実行 | 制限回避 | `allowUnsandboxedCommands: false` を維持 |
| シンボリックリンクで制限外パスにアクセス | denyRead 回避 | OS のシンボリックリンク解決が denyRead に含まれることを確認 |

### 検証コマンド

```bash
# 現在のサンドボックス設定を確認
# Claude Code セッション内で:
/status

# macOS でサンドボックスプロファイルを確認
sandbox-exec -p "(version 1)(deny default)" /bin/ls
```

---

## 6. Layer 2: Permissions

### 位置付け

ツール名 + 引数パターンによるルールベースのアクセス制御。deny/allow ルールの組み合わせで、コマンドの実行可否を決定する。

```
問題: Claude Code が意図せず破壊的コマンドや機密ファイルへのアクセスを試みる
根本原因: LLM は指示の解釈に基づいてツールを選択するが、
          その選択が常に安全とは限らない
解決策: deny/allow ルールで明示的にアクセスを制御
検知: /permissions で現在の設定を一覧表示
復旧: settings.json のルール修正 → 即時反映
```

### 評価順序

**deny → ask → allow**（deny 最優先）

```
1. deny にマッチ → 即座にブロック（例外なし）
2. allow にマッチ → 自動承認（ユーザー確認なし）
3. どちらにもマッチしない → ユーザーに確認（ask）
```

この順序により、deny ルールは常に最強の権限を持つ。allow ルールで「安全なはず」と判断されたコマンドでも、deny ルールにマッチすればブロックされる。

### 推奨 deny ルール

#### 破壊的操作

```json
{
  "deny": [
    "Bash(rm -rf /)",
    "Bash(rm -rf ~)",
    "Bash(rm -rf /*)",
    "Bash(rm -rf ~/*)",
    "Bash(sudo *)",
    "Bash(chmod 777 *)",
    "Bash(mkfs *)",
    "Bash(dd if=*)",
    "Bash(: > *)"
  ]
}
```

#### Git 破壊的操作

```json
{
  "deny": [
    "Bash(git push --force *)",
    "Bash(git push -f *)",
    "Bash(git reset --hard *)",
    "Bash(git clean -fd *)"
  ]
}
```

#### シークレット送信防止

```json
{
  "deny": [
    "Bash(curl * --data *password*)",
    "Bash(curl * --data *secret*)",
    "Bash(curl * --data *token*)",
    "Bash(curl * -d *password*)",
    "Bash(curl * -d *secret*)",
    "Bash(curl * -d *token*)"
  ]
}
```

#### 機密ファイル読み取り禁止

```json
{
  "deny": [
    "Read(./.env)",
    "Read(./.env.*)",
    "Read(./secrets/**)",
    "Read(**/*.pem)",
    "Read(**/*.key)",
    "Read(**/credentials.json)",
    "Read(**/.htpasswd)"
  ]
}
```

### 推奨 allow ルール

安全なコマンドを自動承認し、開発体験を維持する。

#### テスト・Lint

```json
{
  "allow": [
    "Bash(npm test *)",
    "Bash(npm run *)",
    "Bash(pnpm *)",
    "Bash(bun *)",
    "Bash(npx *)",
    "Bash(yarn *)",
    "Bash(pip *)",
    "Bash(python -m pytest *)",
    "Bash(python -m mypy *)",
    "Bash(ruff *)",
    "Bash(eslint *)",
    "Bash(prettier *)",
    "Bash(tsc *)"
  ]
}
```

#### Git 読み取り操作

```json
{
  "allow": [
    "Bash(git status)",
    "Bash(git diff *)",
    "Bash(git log *)",
    "Bash(git branch *)",
    "Bash(git stash *)",
    "Bash(gh pr *)",
    "Bash(gh issue *)",
    "Bash(gh api *)"
  ]
}
```

#### システム情報（読み取り専用）

```json
{
  "allow": [
    "Bash(ls *)",
    "Bash(wc *)",
    "Bash(which *)",
    "Bash(pwd)"
  ]
}
```

### `disableBypassPermissionsMode`

```json
{
  "permissions": {
    "disableBypassPermissionsMode": "disable"
  }
}
```

**重要**: この設定を `"disable"` にすると、ユーザーが `--dangerously-skip-permissions` フラグでパーミッションチェックを迂回することを防止する。チーム運用では必須。

### 回避方法と対策

| 回避シナリオ | リスク | 対策 |
|------------|--------|------|
| ワイルドカードの抜け穴 | パターンにマッチしない変形コマンド | 正規表現パターンの網羅性を検証 |
| コマンドの別名実行 | `\rm` で alias 回避 | deny ルールはバイナリ名でマッチするため影響なし |
| パイプ経由の実行 | `echo "rm -rf /" \| bash` | パイプ実行パターンも deny に追加検討 |
| `--dangerously-skip-permissions` | 全ルール無効化 | `disableBypassPermissionsMode: "disable"` |

### 検証コマンド

```bash
# Claude Code セッション内で:
/permissions
```

---

## 7. Layer 3: Hooks（3-Hook体制）

### 位置付け

プログラマティックなツール実行制御。JavaScript で任意のロジックを実装でき、パターンマッチング、コンテキスト注入、ログ記録を行う。

```
問題: 静的な deny/allow ルールでは検知できない複合的なリスクパターンがある
      （例: curl コマンドの引数にシークレット変数が含まれているかの判定）
根本原因: Permissions はワイルドカードマッチングのみで、
          引数の意味的な解析ができない
解決策: PreToolUse Hook で正規表現ベースの意味的リスク分類を実行
検知: Hook の出力がリアルタイムでユーザーに表示される
復旧: Hook スクリプトの修正 → 次回ツール呼び出しから反映
```

### Hook 一覧

| Hook | ファイル | フェーズ | 目的 |
|------|---------|---------|------|
| PreToolUse | `.claude/hooks/tool-risk.js` | ツール実行前 | リスク評価 + Safety Gate + ブロック判定 |
| PostToolUse | `.claude/hooks/post-tool-use.js` | ツール実行後 | 実行ログ記録 + エラーパターン蓄積 |
| Stop | `.claude/hooks/stop-hook.js` | セッション終了時 | セッションサマリ生成 + メモリ永続化 |

### settings.json での登録

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/tool-risk.js"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/post-tool-use.js"
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/stop-hook.js"
          }
        ]
      }
    ]
  }
}
```

### 7.1 PreToolUse: tool-risk.js

#### Hook の入出力

```
入力（stdin）: { "tool_name": "Bash", "tool_input": { "command": "rm -rf /tmp/test" } }
出力（stdout）:
  - ブロック: { "decision": "block", "reason": "Safety Gate: ..." }
  - 承認:     { "decision": "approve" }
  - 確認要求: { "decision": "ask_user", "reason": "🔴 HIGH RISK: ..." }
  - コンテキスト注入: { "decision": "approve", "additionalContext": "..." }
```

#### Safety Gate パターン（auto-block）

Safety Gate は最も重要な防御メカニズム。以下のパターンが検知されると、ユーザー確認なしで即座にブロックされる。

| ID | パターン | トリガー条件 | ブロック理由 |
|----|---------|-------------|------------|
| SG-001 | 認証情報送信 | `curl/wget` で `password/secret/token/api_key/credential` を含むデータ送信 | 外部への認証情報漏洩 |
| SG-002 | システム破壊 | `rm -rf /`, `rm -rf ~`, `DROP DATABASE`, `git push --force main` | 不可逆な破壊操作 |
| SG-003 | コスト暴走 | `while true`, `seq` で 4桁以上のカウント | リソース制御不能 |
| SG-004 | シークレット stdout 出力 | `echo/printf/cat` でシークレット変数名（SECRET, TOKEN, KEY, PASSWORD, API_KEY, PRIVATE）を含む変数出力 | ログへのシークレット漏洩 |
| SG-005 | .env コミット | `git add .env` | シークレットのバージョン管理混入 |

#### Safety Gate の正規表現

```javascript
// SG-001: 認証情報送信
/curl.*(-d|--data)/.test(cmd) && /(password|secret|token|api_key|credential)/i.test(cmd)

// SG-002: システム破壊
/(rm\s+-rf\s+[\/~]|DROP\s+(TABLE|DATABASE)|git\s+push\s+.*--force\s+.*main)/i.test(cmd)

// SG-003: コスト暴走
/(while\s+true|for\s+.*in\s+\$\(seq\s+\d{4,})/i.test(cmd)

// SG-004: シークレット stdout 出力
/(echo|printf|cat)\s+.*\$\{?([\w]*(?:SECRET|TOKEN|KEY|PASSWORD|API_KEY|PRIVATE)[\w]*)\}?/i.test(cmd)

// SG-005: .env コミット
/git\s+add\s+.*\.env(?:\s|$)/i.test(cmd)
```

#### Risk Classification（HIGH / MEDIUM / LOW）

Safety Gate を通過したコマンドは、リスクレベルに分類される。

**HIGH リスク**（確認ダイアログ表示）:

| カテゴリ | パターン |
|---------|---------|
| ファイル削除 | `rm` with `-f` or `-r` flags |
| Git 破壊 | `git push --force`, `git reset --hard`, `git clean -f`, `git branch -D` |
| DB 破壊 | `DROP TABLE/DATABASE/INDEX`, `DELETE FROM`, `TRUNCATE TABLE` |
| コンテナ破壊 | `docker rm -f`, `docker rmi -f` |
| プロセス終了 | `kill -9` |
| 権限変更 | `chmod 777` |
| ディスク操作 | `mkfs`, `dd if=`, `> /dev/sd*` |
| システム停止 | `shutdown`, `reboot` |
| 認証情報露出 | curl/wget with Bearer/Basic token (20+ chars) |

**MEDIUM リスク**（説明表示）:

| カテゴリ | パターン |
|---------|---------|
| Git 書き込み | `git push`, `git commit`, `git merge`, `git rebase`, `git checkout .`, `git restore .` |
| パッケージ公開 | `npm publish` |
| パッケージインストール | `npm install -g`, `pip install` |
| コンテナ操作 | `docker build/run/compose` |
| HTTP 書き込み | `curl -X POST/PUT/DELETE/PATCH` |
| リモート接続 | `ssh`, `scp`, `rsync` |
| システムパッケージ | `brew install/uninstall`, `apt install/remove` |
| ファイル変更 | Write, Edit, NotebookEdit ツール |

**LOW リスク**（サイレント通過）:

| カテゴリ | ツール/コマンド |
|---------|--------------|
| 読み取りツール | Read, Glob, Grep, WebFetch, WebSearch, TaskList, TaskGet |
| 読み取りコマンド | `ls`, `cat`, `grep`, `git status`, `git log`, `git diff`, `npm test`, `echo`, `pwd`, `which` |

#### additionalContext 注入

Hook はツール実行にコンテキストを注入できる。ファイルオーナーシップの警告などに使用。

```javascript
// Write/Edit ツールの場合、ファイルオーナーシップ情報を注入
if (['Write', 'Edit', 'NotebookEdit'].includes(toolName)) {
  return {
    level: 'MEDIUM',
    reason: 'ファイル変更: ' + filePath,
    additionalContext: `Editing ${filePath}. Ensure file ownership rules are respected per _common/PARALLEL.md.`
  };
}
```

### 7.2 PostToolUse: post-tool-use.js

#### 目的

すべてのツール実行を `.context/tool-log.jsonl` に記録する。セキュリティ監査、デバッグ、セッション分析に使用。

#### ログフォーマット

```jsonl
{"timestamp":"2026-03-19T10:30:00.000Z","session_id":"abc123","tool":"Bash","input_summary":"npm test","success":true}
{"timestamp":"2026-03-19T10:30:05.000Z","session_id":"abc123","tool":"Edit","input_summary":"src/index.ts","success":true}
{"timestamp":"2026-03-19T10:30:10.000Z","session_id":"abc123","tool":"Bash","input_summary":"git push origin main","success":false}
```

#### 記録項目

| フィールド | 内容 |
|-----------|------|
| `timestamp` | ISO 8601 形式のタイムスタンプ |
| `session_id` | セッション識別子 |
| `tool` | ツール名（Bash, Read, Edit, Write, Grep, Glob 等） |
| `input_summary` | 入力の要約（コマンドは先頭 100 文字、ファイルパス等） |
| `success` | 実行成否（`true` / `false`） |

#### セキュリティ活用

- **事後検知**: stdout にシークレットが出力された場合の検知（将来拡張）
- **異常パターン分析**: 短時間に大量のファイル変更があった場合の検知
- **エラーパターン蓄積**: 繰り返し失敗するコマンドの特定

### 7.3 Stop: stop-hook.js

#### 目的

セッション終了時にサマリを生成し、`.context/sessions/` に日付別で永続化する。

#### サマリフォーマット

```json
{
  "session_id": "abc123",
  "stop_reason": "user_stop",
  "timestamp": "2026-03-19T11:00:00.000Z",
  "tool_count": 42,
  "tools_used": ["Bash", "Read", "Edit", "Grep"],
  "errors": 2
}
```

#### セキュリティ活用

- **セッション振り返り**: 各セッションで何が実行されたかの全体像
- **セキュリティイベントのハイライト**: BLOCK/HIGH が発生したセッションの特定
- **トレンド分析**: エラー率の推移でセキュリティリスクの変化を検知

### Hook の回避方法と対策

| 回避シナリオ | リスク | 対策 |
|------------|--------|------|
| settings.json から Hook 削除 | 全 Hook 無効化 | Managed Settings の `allowManagedHooksOnly` で強制 |
| Hook スクリプトの改変 | Safety Gate 無効化 | ファイル整合性チェック（ハッシュ比較） |
| パースエラーの悪用 | エラー時 approve で通過 | Safety Gate チェックをパース前に実行（現在の実装では Safety Gate が先に評価される） |
| 正規表現の抜け穴 | パターン未検知 | 定期的なパターン更新 + 新しい脅威パターンの追加 |

---

## 8. Layer 4: Guardrails

### 位置付け

エージェントレベルの品質・安全ゲート。Layer 1-3 がツール単位の防御であるのに対し、Layer 4 はタスク全体の安全性を管理する。

```
問題: 個々のツール実行は安全でも、それらの組み合わせが危険な結果を生む可能性がある
      （例: 本番 DB からの SELECT は安全だが、その結果を外部に送信する流れは危険）
根本原因: ツール単位の防御ではタスク全体の文脈を考慮できない
解決策: エージェントレベルで L1-L4 のガードレールを設定し、
        タスク全体の安全性を段階的に制御
検知: 各レベルに応じたアクション（ログ、検証、待機、停止）
復旧: レベルに応じた自動回復 or 人間介入
```

### ガードレールレベル

| Level | 名前 | アクション | トリガー |
|-------|------|----------|---------|
| **L1** | MONITORING | ログのみ記録 | lint 警告、軽微な非推奨 |
| **L2** | CHECKPOINT | 自動検証実行 | テスト失敗 < 20%、セキュリティ警告 |
| **L3** | PAUSE | 自動回復試行 or 人間待機 | テスト失敗 > 50%、破壊的変更検知 |
| **L4** | ABORT | 即時停止 + ロールバック | クリティカルセキュリティ、データ整合性リスク |

### L1: MONITORING（ログのみ）

- **発動条件**: lint 警告、型チェック警告、軽微な非推奨 API 使用
- **アクション**: ログに記録するのみ。開発フローを止めない
- **使いどころ**: 開発体験を維持しながら問題を可視化する

### L2: CHECKPOINT（自動検証）

- **発動条件**: テスト失敗率 < 20%、セキュリティスキャン警告（非クリティカル）、型エラー
- **アクション**: 自動検証を実行し、回復を試みる
- **回復パターン**:

| トリガー | 回復アクション | 最大試行回数 |
|---------|--------------|------------|
| テスト失敗（軽微） | Builder エージェントが修正 → 再テスト | 3 |
| 型エラー | Builder が型定義を修正 | 2 |
| lint エラー | auto-fix 実行 | 1 |

### L3: PAUSE（自動回復 or 待機）

- **発動条件**: テスト失敗率 > 50%、破壊的変更検知、ビルド失敗
- **アクション**: ロールバック + 再分析。回復失敗時は人間に委ねる
- **回復パターン**:

| トリガー | 回復アクション | 最大試行回数 |
|---------|--------------|------------|
| テスト大量失敗 | ロールバック + Sherpa 再分解 | 2 |
| 破壊的変更 | Architect 影響分析 + マイグレーション | 1 |
| ビルド失敗 | ロールバック + 修正 | 2 |

### L4: ABORT（即時停止）

- **発動条件**: クリティカルセキュリティ脆弱性、データ整合性リスク、本番環境接続検知
- **アクション**: 即時停止。ロールバック。人間の介入を待つ
- **自動回復なし**: L4 は常に人間が判断する

### エスカレーションパス

```
L1 (Log)
  ↓ 問題が持続
L2 (Checkpoint)
  ├── auto_recovery_success → CONTINUE
  └── recovery_failed
        ↓
      L3 (Pause)
        ├── resolved → CONTINUE
        └── critical
              ↓
            L4 (Abort) → ROLLBACK + STOP
```

### Tool Risk との統合

| Tool Risk Level | 対応 Guardrail Level |
|----------------|---------------------|
| BLOCK | 即時停止（Safety Gate、L4 相当） |
| HIGH | L3-L4（破壊的操作は即時確認） |
| MEDIUM | L1-L2（ログ + 軽い警告） |
| LOW | なし（サイレント通過） |

---

## 9. シークレット保護（詳細設計）

### 保護対象パターン

| 種類 | パターン（正規表現） | 例 |
|------|-------------------|-----|
| AWS アクセスキー | `AKIA[0-9A-Z]{16}` | `AKIAIOSFODNN7EXAMPLE` |
| AWS シークレットキー | `[0-9a-zA-Z/+]{40}` | （40文字のBase64文字列） |
| GitHub トークン | `ghp_[a-zA-Z0-9]{36}` | `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| GitHub OAuth | `gho_[a-zA-Z0-9]{36}` | `gho_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| OpenAI API キー | `sk-[a-zA-Z0-9]{48}` | `sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| Slack Bot Token | `xoxb-[0-9]+-[0-9]+-[a-zA-Z0-9]+` | `xoxb-123456-789012-abcdef` |
| Slack User Token | `xoxp-[0-9]+-[0-9]+-[a-zA-Z0-9]+` | `xoxp-123456-789012-abcdef` |
| Bearer トークン | `Bearer\s+[A-Za-z0-9_\-\.]{20,}` | `Bearer eyJhbGciOiJIUzI1NiIs...` |
| Basic 認証 | `Basic\s+[A-Za-z0-9+/=]{10,}` | `Basic dXNlcjpwYXNz` |
| 秘密鍵ヘッダ | `-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----` | PEM 形式秘密鍵 |
| 汎用シークレット変数 | `\$\{?(SECRET\|TOKEN\|KEY\|PASSWORD\|API_KEY\|PRIVATE)[_A-Z]*\}?` | `$SECRET_KEY`, `${API_TOKEN}` |

### 検知ポイント

| 検知ポイント | 防御層 | メカニズム | タイミング |
|------------|--------|----------|----------|
| コード内ハードコード | L0 (CLAUDE.md) | LLM への指示 | コード生成時 |
| ファイル読み取り | L1 (Sandbox) | denyRead | ファイルアクセス時 |
| ファイル読み取り | L2 (Permissions) | deny (Read) | ファイルアクセス時 |
| コマンド引数 | L2 (Permissions) | deny (curl) | コマンド実行前 |
| コマンド引数 | L3 (Hooks/PreToolUse) | Safety Gate 正規表現 | コマンド実行前 |
| stdout 出力 | L3 (Hooks/PreToolUse) | Safety Gate (echo) | コマンド実行前 |
| Git ステージング | L3 (Hooks/PreToolUse) | Safety Gate (git add .env) | コマンド実行前 |
| 実行ログ | L3 (Hooks/PostToolUse) | ログ記録 | コマンド実行後 |

### 防御層の対応表（脅威別）

| シークレット漏洩シナリオ | L0 | L1 | L2 | L3 |
|----------------------|:---:|:---:|:---:|:---:|
| .env ファイルの git add | ○ | - | - | ◎ (SG-005) |
| .env ファイルの Read | ○ | - | ◎ | - |
| ~/.aws/credentials の読み取り | ○ | ◎ | - | - |
| echo $SECRET_KEY の実行 | ○ | - | - | ◎ (SG-004) |
| curl -d "token=xxx" の実行 | ○ | - | ◎ | ◎ (SG-001) |
| コード内に API キーをハードコード | ◎ | - | - | - |
| Bearer トークン付き curl | ○ | - | - | ◎ (HIGH) |
| npm publish（.env 含む） | ○ | - | - | ○ (MEDIUM) |

- ◎ = 主要防御  ○ = 補助防御  - = カバー外

### インシデント対応手順（シークレット漏洩時）

#### フェーズ 1: 封じ込め（5分以内）

```bash
# 1. 漏洩したシークレットの特定
# 何が、どこに、いつ漏洩したかを確認

# 2. 即座にシークレットを無効化（revoke）
# 各サービスのコンソールでキーを無効化する
# AWS: IAM → Access keys → Deactivate
# GitHub: Settings → Developer settings → Personal access tokens → Revoke
# OpenAI: API keys → Revoke
```

#### フェーズ 2: 影響範囲の調査（30分以内）

```bash
# 3. コミット履歴の確認
git log --all --oneline --diff-filter=A -- '*.env' '.env*'

# 4. 公開リポジトリへのプッシュ有無を確認
git remote -v
git log --all --oneline origin/main..HEAD

# 5. GitHub Secret Scanning Alert の確認
gh api repos/{owner}/{repo}/secret-scanning/alerts
```

#### フェーズ 3: 修復

```bash
# 6. 新しいシークレットを生成し、.env を更新

# 7. コミット履歴からシークレットを除去（必要な場合）
# BFG Repo-Cleaner を使用
bfg --replace-text passwords.txt
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 8. Force push（履歴書き換え後）
git push --force --all

# 9. 全チームメンバーに通知し、ローカルリポジトリの再 clone を依頼
```

#### フェーズ 4: 再発防止

```bash
# 10. .gitignore に .env が含まれていることを確認
echo ".env" >> .gitignore
echo ".env.*" >> .gitignore

# 11. Hooks が有効であることを確認（/status で確認）

# 12. ARIS に失敗パターンとして記録
```

---

## 10. 組織向け Managed Settings

### 概要

チーム全体に統一されたセキュリティポリシーを強制するための設定。個人の settings.json より優先され、ユーザーが上書きできない。

```
問題: 個人の settings.json はユーザーが自由に変更でき、
      セキュリティポリシーの統一が困難
根本原因: デフォルトの設定ファイルにはユーザー権限での書き換え制限がない
解決策: OS レベルの Managed Settings で管理者権限による設定強制
検知: /status で managed settings の読み込み状態を確認
復旧: 管理者が managed-settings.json を修正 → 全ユーザーに即時反映
```

### Server-managed vs Endpoint-managed

| 種類 | 配置方法 | 用途 |
|------|---------|------|
| Server-managed | MDM / Chef / Ansible で配布 | 大規模チーム、コンプライアンス要件あり |
| Endpoint-managed | 手動配置 or スクリプト配布 | 小規模チーム、迅速な適用 |

### 配置先パス

| OS | パス |
|----|------|
| macOS | `/Library/Application Support/ClaudeCode/managed-settings.json` |
| Linux | `/etc/claude-code/managed-settings.json` |

**注意**: これらのパスは管理者権限（root / sudo）でのみ書き込み可能。

### 推奨統合設定

```json
{
  "_comment": "Organization-wide Claude Code security policy",
  "permissions": {
    "disableBypassPermissionsMode": "disable",
    "deny": [
      "Bash(rm -rf /)",
      "Bash(rm -rf ~)",
      "Bash(rm -rf /*)",
      "Bash(rm -rf ~/*)",
      "Bash(sudo *)",
      "Bash(chmod 777 *)",
      "Bash(git push --force *)",
      "Bash(git push -f *)",
      "Bash(git reset --hard *)",
      "Bash(curl * --data *password*)",
      "Bash(curl * --data *secret*)",
      "Bash(curl * --data *token*)",
      "Bash(curl * -d *password*)",
      "Bash(curl * -d *secret*)",
      "Bash(curl * -d *token*)",
      "Read(./.env)",
      "Read(./.env.*)",
      "Read(**/*.pem)",
      "Read(**/*.key)",
      "Read(**/credentials.json)"
    ]
  },
  "allowManagedPermissionRulesOnly": true,
  "allowManagedHooksOnly": true,
  "sandbox": {
    "enabled": true,
    "allowUnsandboxedCommands": false,
    "filesystem": {
      "denyRead": [
        "~/.aws/credentials",
        "~/.aws/config",
        "~/.ssh/id_*",
        "~/.ssh/config",
        "~/.gnupg/**",
        "~/.config/gh/hosts.yml",
        "~/.netrc"
      ]
    }
  }
}
```

### 主要設定フラグ

| フラグ | 値 | 効果 |
|--------|-----|------|
| `allowManagedPermissionRulesOnly` | `true` | ユーザーの個人 permissions ルールを無視し、managed のルールのみ適用 |
| `allowManagedHooksOnly` | `true` | ユーザーの個人 hooks を無視し、managed の hooks のみ実行 |
| `disableBypassPermissionsMode` | `"disable"` | `--dangerously-skip-permissions` フラグを無効化 |

### 配布スクリプト例

```bash
#!/bin/bash
# deploy-managed-settings.sh
# MDM またはプロビジョニングツールから実行

set -euo pipefail

SETTINGS_FILE=""
if [[ "$(uname)" == "Darwin" ]]; then
  SETTINGS_DIR="/Library/Application Support/ClaudeCode"
else
  SETTINGS_DIR="/etc/claude-code"
fi
SETTINGS_FILE="${SETTINGS_DIR}/managed-settings.json"

sudo mkdir -p "${SETTINGS_DIR}"
sudo cp managed-settings.json "${SETTINGS_FILE}"
sudo chmod 644 "${SETTINGS_FILE}"
sudo chown root:wheel "${SETTINGS_FILE}" 2>/dev/null || sudo chown root:root "${SETTINGS_FILE}"

echo "Managed settings deployed to: ${SETTINGS_FILE}"
```

---

## 11. セキュリティチェックリスト

段階的に実装するチェックリスト。Phase 1 から順に実施し、チームの成熟度に合わせて Phase を上げる。

### Phase 1: 必須（全プロジェクト）

> 壊滅的事故の防止。10分で完了。

- [ ] Sandbox 有効化（`sandbox.enabled: true`）
- [ ] `allowUnsandboxedCommands: false` を確認
- [ ] 基本 deny ルール設定（`rm -rf /`, `sudo *`, `git push --force *`）
- [ ] .env ファイルが `.gitignore` に含まれていることを確認
- [ ] 機密ファイルの Read deny（`.env`, `*.pem`, `*.key`）
- [ ] CLAUDE.md にセキュリティルールセクションを追加
- [ ] `/status` でサンドボックスと permissions の有効状態を確認

**検証方法**:
```bash
# install.sh で一括セットアップ
./install.sh --with-permissions

# 設定確認
# Claude Code セッション内で:
/status
/permissions
```

### Phase 2: 推奨（セキュリティ意識の高いチーム）

> リスクの可視化と運用中の防御。30分で完了。

- [ ] Hooks 導入（`tool-risk.js`, `post-tool-use.js`, `stop-hook.js`）
- [ ] ネットワーク制限（`allowedDomains` ホワイトリスト設定）
- [ ] ファイルシステム denyRead 拡張（`~/.aws`, `~/.ssh`, `~/.gnupg`）
- [ ] シークレット送信防止 deny ルール（curl + password/secret/token）
- [ ] PostToolUse ログの確認手順を確立
- [ ] セッションサマリの定期レビュー

**検証方法**:
```bash
# install.sh で一括セットアップ
./install.sh --with-hooks --with-permissions

# Hooks の動作確認（Claude Code セッション内で破壊的コマンドを試す）
# → Safety Gate のブロック or HIGH リスク警告が表示されることを確認
```

### Phase 3: 上級（セキュリティ要件の厳しいプロジェクト）

> カスタム防御の構築。1-2時間。

- [ ] Managed Settings の配置（管理者権限）
- [ ] `disableBypassPermissionsMode: "disable"` の設定
- [ ] カスタム Hook の作成（プロジェクト固有のリスクパターン）
- [ ] 本番環境ドメインの検知パターン追加
- [ ] API 呼び出し回数制限の Hook 追加
- [ ] シークレットパターンの正規表現拡張

**検証方法**:
```bash
# Managed Settings の配置
sudo cp managed-settings.json "/Library/Application Support/ClaudeCode/managed-settings.json"

# 反映確認
# Claude Code セッション内で:
/status
# → managed settings が読み込まれていることを確認
```

### Phase 4: チーム/組織（ガバナンス要件あり）

> 統一ポリシーの強制と監査体制。半日-1日。

- [ ] `allowManagedPermissionRulesOnly: true` で個人ルールを無効化
- [ ] `allowManagedHooksOnly: true` で個人 hooks を無効化
- [ ] MDM / Chef / Ansible での Managed Settings 配布パイプライン
- [ ] 監査ログの集約基盤（`.context/tool-log.jsonl` の収集）
- [ ] セキュリティインシデント対応手順の文書化
- [ ] 定期的なパターン更新プロセスの確立
- [ ] 新メンバーオンボーディングにセキュリティ設定手順を組み込み

---

## 12. 付録: 設定テンプレート集

### Phase 1: 最小限セキュリティ設定

```json
{
  "_comment": "Phase 1: 最小限のセキュリティ設定。壊滅的事故を防止する。",
  "sandbox": {
    "enabled": true,
    "allowUnsandboxedCommands": false
  },
  "permissions": {
    "deny": [
      "Bash(rm -rf /)",
      "Bash(rm -rf ~)",
      "Bash(rm -rf /*)",
      "Bash(rm -rf ~/*)",
      "Bash(sudo *)",
      "Bash(chmod 777 *)",
      "Bash(git push --force *)",
      "Bash(git push -f *)",
      "Bash(git reset --hard *)",
      "Read(./.env)",
      "Read(./.env.*)",
      "Read(**/*.pem)",
      "Read(**/*.key)"
    ]
  }
}
```

### Phase 2: 推奨セキュリティ設定

```json
{
  "_comment": "Phase 2: Hooks + ネットワーク制限 + 拡張 deny ルール",
  "sandbox": {
    "enabled": true,
    "allowUnsandboxedCommands": false,
    "filesystem": {
      "denyRead": [
        "~/.aws/credentials",
        "~/.aws/config",
        "~/.ssh/id_*",
        "~/.ssh/config",
        "~/.gnupg/**",
        "~/.config/gh/hosts.yml",
        "~/.netrc"
      ]
    },
    "network": {
      "allowedDomains": [
        "github.com",
        "*.githubusercontent.com",
        "*.npmjs.org",
        "registry.yarnpkg.com",
        "pypi.org",
        "files.pythonhosted.org"
      ]
    }
  },
  "permissions": {
    "allow": [
      "Bash(npm test *)",
      "Bash(npm run *)",
      "Bash(pnpm *)",
      "Bash(bun *)",
      "Bash(npx *)",
      "Bash(yarn *)",
      "Bash(pip *)",
      "Bash(python -m pytest *)",
      "Bash(python -m mypy *)",
      "Bash(ruff *)",
      "Bash(eslint *)",
      "Bash(prettier *)",
      "Bash(tsc *)",
      "Bash(git status)",
      "Bash(git diff *)",
      "Bash(git log *)",
      "Bash(git branch *)",
      "Bash(git stash *)",
      "Bash(gh pr *)",
      "Bash(gh issue *)",
      "Bash(gh api *)",
      "Bash(ls *)",
      "Bash(wc *)",
      "Bash(which *)",
      "Bash(pwd)"
    ],
    "deny": [
      "Bash(rm -rf /)",
      "Bash(rm -rf ~)",
      "Bash(rm -rf /*)",
      "Bash(rm -rf ~/*)",
      "Bash(sudo *)",
      "Bash(chmod 777 *)",
      "Bash(git push --force *)",
      "Bash(git push -f *)",
      "Bash(git reset --hard *)",
      "Bash(git clean -fd *)",
      "Bash(: > *)",
      "Bash(mkfs *)",
      "Bash(dd if=*)",
      "Bash(curl * --data *password*)",
      "Bash(curl * --data *secret*)",
      "Bash(curl * --data *token*)",
      "Bash(curl * -d *password*)",
      "Bash(curl * -d *secret*)",
      "Bash(curl * -d *token*)",
      "Read(./.env)",
      "Read(./.env.*)",
      "Read(./secrets/**)",
      "Read(**/*.pem)",
      "Read(**/*.key)",
      "Read(**/credentials.json)",
      "Read(**/.htpasswd)"
    ]
  },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/tool-risk.js"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/post-tool-use.js"
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/stop-hook.js"
          }
        ]
      }
    ]
  }
}
```

### Phase 3: Managed Settings（管理者用）

```json
{
  "_comment": "Phase 3: 組織統一ポリシー。/Library/Application Support/ClaudeCode/managed-settings.json に配置。",
  "permissions": {
    "disableBypassPermissionsMode": "disable",
    "deny": [
      "Bash(rm -rf /)",
      "Bash(rm -rf ~)",
      "Bash(rm -rf /*)",
      "Bash(rm -rf ~/*)",
      "Bash(sudo *)",
      "Bash(chmod 777 *)",
      "Bash(mkfs *)",
      "Bash(dd if=*)",
      "Bash(git push --force *)",
      "Bash(git push -f *)",
      "Bash(git reset --hard *)",
      "Bash(git clean -fd *)",
      "Bash(curl * --data *password*)",
      "Bash(curl * --data *secret*)",
      "Bash(curl * --data *token*)",
      "Bash(curl * -d *password*)",
      "Bash(curl * -d *secret*)",
      "Bash(curl * -d *token*)",
      "Read(./.env)",
      "Read(./.env.*)",
      "Read(./secrets/**)",
      "Read(**/*.pem)",
      "Read(**/*.key)",
      "Read(**/credentials.json)",
      "Read(**/.htpasswd)"
    ]
  },
  "allowManagedPermissionRulesOnly": true,
  "allowManagedHooksOnly": true,
  "sandbox": {
    "enabled": true,
    "allowUnsandboxedCommands": false,
    "filesystem": {
      "denyRead": [
        "~/.aws/credentials",
        "~/.aws/config",
        "~/.ssh/id_*",
        "~/.ssh/config",
        "~/.gnupg/**",
        "~/.config/gh/hosts.yml",
        "~/.netrc",
        "~/.kube/config",
        "~/.docker/config.json",
        "~/.npmrc",
        "~/.pypirc"
      ]
    },
    "network": {
      "allowedDomains": [
        "github.com",
        "*.githubusercontent.com",
        "*.npmjs.org",
        "registry.yarnpkg.com",
        "pypi.org",
        "files.pythonhosted.org"
      ]
    }
  }
}
```

### Phase 4: 完全統制設定（補足: hooks 定義付き）

Phase 3 の Managed Settings に加え、プロジェクトレベルの settings.json で hooks を定義:

```json
{
  "_comment": "Phase 4: プロジェクトレベル設定。Managed Settings と組み合わせて使用。",
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/tool-risk.js"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/post-tool-use.js"
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/stop-hook.js"
          }
        ]
      }
    ]
  }
}
```

### 個人用ローカル設定（.gitignore 対象）

```json
{
  "_comment": "個人実験用設定。settings.local.json として保存し .gitignore に追加。",
  "permissions": {
    "allow": [
      "Bash(docker *)",
      "Bash(docker-compose *)"
    ],
    "deny": []
  }
}
```

---

## 変更履歴

| 日付 | バージョン | 内容 |
|------|----------|------|
| 2026-03-19 | 1.0.0 | 初版作成。5層防御アーキテクチャ、7脅威モデル、4段階チェックリスト |
