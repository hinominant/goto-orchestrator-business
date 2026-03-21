#!/usr/bin/env node
'use strict';

/**
 * Claude Code PreToolUse Hook - Tool Risk Classification + Safety Gate
 * ビジネス向け版（goto-orchestrator-business）
 *
 * エンジニア版との違い:
 * - BLOCK/HIGH メッセージを平易な日本語で説明（「なぜ危険か」「次のステップ」付き）
 * - ビジネスデータ（顧客名簿・給与・財務）への Safety Gate パターンを追加
 * - 法的根拠（個人情報保護法・J-SOX）を参照するメッセージ
 * - 上場準備企業向けのIT統制・適時開示リスクを明示
 *
 * Install: ~/.claude/hooks/tool-risk.js
 * Settings: ~/.claude/settings.json の hooks.PreToolUse に登録
 */

// === DATA PROTECTION REMINDER (ビジネス版) ===
// additionalContext として全ツール呼び出しに注入する。
// コンテキスト圧縮後も毎回フレッシュに再注入されるため「忘れ」が起きない。
const DATA_PROTECTION_REMINDER =
  '[データ保護] ⚠️ 入力禁止: 顧客名簿・給与データ・未発表財務情報・APIキー・契約書原本。' +
  '判断に迷う場合は担当者に確認してください。AI使用ポリシー: docs/AI_USAGE_POLICY.md';

// === ビジネスメッセージフォーマット ===

/** BLOCK/HIGH 向けのビジネス向けメッセージを構築する */
function blockMsg(title, whatHappens, whyDangerous, nextSteps) {
  return (
    `🚨 自動ブロック: ${title}\n\n` +
    `【何が起きるか】${whatHappens}\n` +
    `【なぜ危険か】${whyDangerous}\n` +
    `【次のステップ】${nextSteps}`
  );
}

function highMsg(title, whatHappens, whyDangerous, nextSteps) {
  return (
    `⚠️ 要確認: ${title}\n\n` +
    `【何が起きるか】${whatHappens}\n` +
    `【なぜ危険か】${whyDangerous}\n` +
    `【次のステップ】${nextSteps}`
  );
}

// === GlassWorm / Trojan Source: Unicode不可視文字検知 (SEC-014) ===
// ゼロ幅スペース・方向制御文字などの不可視Unicode文字を検知する。
// これらは人間のコードレビューで見えないまま悪意あるコードを混入させる攻撃手法に使われる。
const INVISIBLE_UNICODE_RE = /[\u200B\u200C\u200D\u200E\u200F\u2060\u2061\u2062\u2063\u2064\uFEFF\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180E\u2000-\u200A\u202A-\u202E\u2066-\u206F\u2800\u3164\uFFA0]/;

// === Safety Gate Patterns (auto-block) ===

const SAFETY_GATE_PATTERNS = [
  {
    // ユーザー安全性: 認証情報の外部送信
    test: (cmd) =>
      /curl.*(-d|--data)/.test(cmd) &&
      /(password|secret|token|api_key|credential)/i.test(cmd),
    reason: blockMsg(
      '認証情報の外部送信',
      'パスワード・APIキー・トークンなどの認証情報が外部サーバーに送信されます。',
      '漏洩した認証情報は悪用まで平均数分。業務停止・情報漏洩インシデントに発展します（GitHub: 年間3900万件漏洩）。',
      '① 担当者（CISO・情報システム部）に即時報告 ② 関連するキー・パスワードを今すぐ無効化・再発行してください'
    ),
  },
  {
    // 破壊的操作: ルートや home への rm（フラグ順序・スペースに依存しない）
    test: (cmd) => {
      if (!/\brm\b/.test(cmd)) return false;
      const hasDestructiveFlag = /(?:-[a-zA-Z]*[rf]|--force|--recursive)/i.test(cmd);
      if (!hasDestructiveFlag) return false;
      return /(?:\s+[\/~]|-[a-zA-Z]*[rf][\/~]|\s+--\s+[\/~])/.test(cmd);
    },
    reason: blockMsg(
      '全ファイル削除コマンド',
      'コンピューター全体またはホームフォルダ内の全データが永久に消えます（元に戻せません）。',
      '「rm -rf /」は2.5年分の業務データが数秒で失われた実例があります。ゴミ箱には入りません。',
      'このメッセージをエンジニアに共有して対応を依頼してください。削除が必要な場合はファイル名を具体的に指定してください。'
    ),
  },
  {
    // 破壊的操作: DROP DATABASE, force push to protected branches
    test: (cmd) =>
      /DROP\s+(TABLE|DATABASE)/i.test(cmd) ||
      /git\s+push\s+.*--force.*(?:main|master|develop|release\/)/i.test(cmd) ||
      /git\s+push\s+.*(?:main|master|develop|release\/).*--force/i.test(cmd),
    reason: blockMsg(
      'データベース削除 または 開発履歴の強制上書き',
      'データベースのテーブル/データが完全に削除される、またはチーム全員の開発履歴が上書きされます。',
      '上場審査ではソースコードの開発履歴の一貫性が確認されます。強制上書きはIT統制の証跡（監査ログ）を破壊します。',
      'エンジニアに相談してください。通常の git push で対応できる場合がほとんどです。'
    ),
  },
  {
    // コスト制御不能: 無制限ループ
    test: (cmd) =>
      /while\s+(?:true|:|\[\s*1\s*-eq\s*1\s*\]|\[\s*true\s*\])/i.test(cmd) ||
      /for\s*\(\s*\(\s*[^;]*;\s*;[^)]*\)\s*\)/i.test(cmd) ||
      /for\s+\w+\s+in\s+(?:\$\(|`)seq\s+\d{4,}/i.test(cmd),
    reason: blockMsg(
      'APIコスト暴走リスク（無限ループ）',
      'AIが停止せず延々と処理を続け、APIの利用コストが青天井になります。',
      '無制御のループは数分で数万円のコストを発生させる場合があります。月次予算の超過につながります。',
      'エンジニアに確認を依頼してください。ループが必要な場合は回数上限を設定してください。'
    ),
  },
  {
    // シークレット漏洩: echo/printでシークレットをstdoutに出力
    test: (cmd) =>
      /(echo|printf|cat)\s+.*\$\{?([\w]*(?:SECRET|TOKEN|KEY|PASSWORD|API_KEY|PRIVATE)[\w]*)\}?/i.test(cmd),
    reason: blockMsg(
      'シークレット変数の画面出力',
      'APIキー・パスワード・トークンがターミナル画面に表示されます。',
      'CI/CDログ・ターミナル録画・画面共有中に露出したシークレットは漏洩リスクがあります。',
      'シークレットを画面に表示しないでください。必要な場合はエンジニアに相談してください。'
    ),
  },
  {
    // シークレット漏洩: .envファイルをgit addしようとする
    test: (cmd) =>
      /git\s+add\s+.*\.env/i.test(cmd),
    reason: blockMsg(
      'シークレットファイルのGitコミット',
      'APIキー・パスワードを含む.envファイルがGit（バージョン管理）に登録されます。',
      'GitHubに公開した場合、ボットが1分以内に検出して悪用します（2024年: 3900万件漏洩実績）。コミット後の削除も困難です。',
      '① .gitignoreに.envを追加してください ② すでにコミット済みの場合はエンジニアに相談してAPIキーを再発行してください'
    ),
  },
  {
    // ANTHROPIC_BASE_URL 書き換えによる API キー外部送信（CVE-2026-21852）
    test: (cmd) =>
      /ANTHROPIC_BASE_URL\s*=/.test(cmd),
    reason: blockMsg(
      'Claude APIの送信先変更（攻撃の疑い）',
      'AIへのリクエストが正規Anthropicサーバーではなく別のサーバーに向けられます。',
      'すべての会話内容とAPIキーが攻撃者のサーバーに送信されます（CVE-2026-21852）。これは攻撃パターンの典型的手口です。',
      '① 作業を即時中止 ② セキュリティ担当者に報告してください（これは攻撃の可能性が高いです）'
    ),
  },
  {
    // python3/node 経由のネットワーク通信・環境変数漏洩バイパス
    // AUDIT-FIX: python3 --command 長形式、node --eval/-p も検知
    test: (cmd) =>
      /python3?\s+(?:-c|--command)\s+['"].*(?:urllib|requests|http|socket|subprocess|os\.environ|os\.getenv)/.test(cmd) ||
      /node\s+(?:-e|--eval|-p)\s+['"].*(?:https?|fetch|axios|net\.Socket|child_process|require\(\s*['"]net['"]\s*\)|net\.connect|process\.env)/.test(cmd),
    reason: blockMsg(
      'プログラム経由の外部通信・環境変数アクセス',
      'Python/node.jsのインラインコードを使って外部サーバーへの通信が試みられています。',
      '環境変数（APIキー等）や機密データが外部に送信される可能性があります。通常の開発業務では不要な操作です。',
      'エンジニアに確認を依頼してください。'
    ),
  },
  {
    // osascript / security コマンドによるキーチェーンアクセス（macOS）
    test: (cmd) =>
      /(?:^|[|;&\s`(]|sudo\s+)(?:(?:\/[^\s|;&`]*\/)?osascript)/i.test(cmd.trim()) ||
      /(?:bash|sh)\s+-c\s+['"][^'"]*\bosascript\b/i.test(cmd) ||
      /(?:^|[|;&\s`(]|sudo\s+)(?:(?:\/[^\s|;&`]*\/)?security)\s+(?:find|add|delete|import|export|dump|list|show)/i.test(cmd.trim()),
    reason: blockMsg(
      'macOSキーチェーンへのアクセス試行',
      'コンピューターに保存された全パスワード・証明書・認証情報へのアクセスが試みられています。',
      'キーチェーンには銀行・業務システム・メール・クラウドサービスのパスワードが含まれます。',
      '① 作業を即時中止 ② このメッセージをスクリーンショットしてCISO・情報システム部に報告してください'
    ),
  },
  {
    // 生ソケット通信（nc/ncat/telnet）
    test: (cmd) =>
      /(?:^|[|;&\s`])(?:(?:\/[^\s|;&`]*\/)?)(?:nc|ncat|netcat|telnet)\s/i.test(cmd.trim()) ||
      /(?:bash|sh)\s+-c\s+['"][^'"]*\b(?:nc|ncat|netcat|telnet)\s/i.test(cmd),
    reason: blockMsg(
      '外部サーバーへの直接接続',
      '社内のデータを外部サーバーに直接送信するトンネルが開かれます。',
      '顧客データ・営業情報・財務データが社外に流出する可能性があります。通常の業務では使用しません。',
      '① 作業を即時中止 ② セキュリティ担当者に報告 ③ docs/INCIDENT_RESPONSE.md を参照してください'
    ),
  },
  {
    // eval 経由のリモートコード実行
    // AUDIT-FIX: バックティック形式 eval `curl ...` も検知
    test: (cmd) =>
      /eval\s+["'`]?\$\((?:curl|wget)/.test(cmd) ||
      /eval\s+["'][^'"]*(?:curl|wget)/.test(cmd) ||
      /eval\s+`[^`]*(?:curl|wget)/i.test(cmd),
    reason: blockMsg(
      '外部スクリプトの自動実行（サプライチェーン攻撃リスク）',
      'インターネットからダウンロードしたプログラムを検査せずにそのまま実行しようとしています。',
      '悪意あるコードが混入している場合、会社のデータが盗まれます。AI がパッケージ名を間違える「slopsquatting」攻撃の典型的な手口です。',
      '/external-install-check コマンドでスクリプトの安全性を確認してからインストールしてください。'
    ),
  },
  {
    // print/console.log でシークレット変数を stdout に出力
    test: (cmd) =>
      /(?:print|console\.log|console\.error|puts|echo|printf)\s*.*\$\{?(?:[A-Z_]*(?:SECRET|TOKEN|KEY|PASSWORD|API_KEY|PRIVATE|CREDENTIAL)[A-Z_]*)\}?/i.test(cmd) ||
      (/(?:python3?\s+-c|node\s+-e)\s+['"]/.test(cmd) &&
       /(?:dotenv|load_dotenv|require\s*\(?\s*['"]dotenv['"])/.test(cmd) &&
       /(?:print|console\.log)/.test(cmd)),
    reason: blockMsg(
      'シークレット変数の画面出力リスク',
      'APIキー・パスワード・トークンがターミナル画面に表示されます。',
      'CI/CDのログに記録されたシークレットは全員に閲覧可能になります。',
      'シークレットを画面に出力しないでください。値の確認が必要な場合はエンジニアに相談してください。'
    ),
  },
  {
    // パイプ経由のスクリプト実行（サプライチェーン攻撃）
    test: (cmd) =>
      /(?:curl|wget)\s+.*\|\s*(?:ba)?sh\b/.test(cmd) ||
      /(?:ba)?sh\b\s+<\s*\(\s*(?:curl|wget)/.test(cmd),
    reason: blockMsg(
      '外部スクリプトのパイプ実行（サプライチェーン攻撃リスク）',
      'インターネットからダウンロードしたプログラムを検査せずに実行します。',
      'npm パッケージ偽装（slopsquatting）などで、AIが間違ったパッケージ名を提案してマルウェアが実行される事例があります。',
      '/external-install-check でスクリプトの安全性を確認してください。または公式ドキュメントの手順に従ってください。'
    ),
  },
  {
    // 本番DB接続文字列の使用（RFC 1918 private IP除外）
    test: (cmd) =>
      /(?:postgresql|mysql|mongodb|redis):\/\/[^:]+:[^@]+@(?!localhost|127\.0\.0\.1|0\.0\.0\.0|(?:10|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.)/i.test(cmd) ||
      /(?:DATABASE_URL|DB_URL|MONGO_URL|REDIS_URL)\s*=\s*['"]?(?:postgresql|mysql|mongodb|redis):\/\/[^:]+:[^@]+@(?!localhost|127\.0\.0\.1|(?:10|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.)/i.test(cmd),
    reason: blockMsg(
      '本番データベースへの接続試行',
      '本番環境のデータベース（顧客情報・財務データ等）に接続しようとしています。',
      '個人情報保護法では本番データのAI入力は「第三者提供」に該当する可能性があります。上場審査でも問題になります。',
      '① ダミーデータ・テスト環境を使用してください ② どうしても必要な場合は法務・コンプライアンス担当者に相談してください'
    ),
  },
  {
    // .envファイルの直接読み取り・パイプ経由エクスフィルトレーション
    test: (cmd) =>
      /\bcat\s+[^\n|;&`]*\.env\b/i.test(cmd),
    reason: blockMsg(
      'シークレットファイルの直接読み取り',
      'APIキー・パスワード・認証情報が入った.envファイルを読み取ります。',
      'ターミナルに表示された内容がAIの入力に含まれると、会話ログを通じて漏洩するリスクがあります。',
      '.envの内容はAIに入力しないでください。設定確認が必要な場合はエンジニアに相談してください。'
    ),
  },
  {
    // .envファイルへの代替読み取りツールによる回避防止（BYPASS-5）
    // AUDIT-FIX: grep/awk/sed/vi/vim/nano/nl/wc/diff も追加
    test: (cmd) =>
      /\b(?:head|tail|tac|less|more|sort|grep|awk|sed|vi|vim|nano|nl|wc|diff)\s+[^\n|;&`]*\.env\b/i.test(cmd),
    reason: blockMsg(
      'シークレットファイルの読み取り試行',
      'シークレットファイル（.env）の内容を読み取ります。',
      'cat .envと同様に、シークレットがAIの入力に含まれる可能性があります。',
      '.envの内容はAIに入力しないでください。必要な場合はエンジニアに相談してください。'
    ),
  },

  // ===== ビジネス版: HIGH→BLOCK 格上げパターン =====
  // エンジニア版では ask_user（HIGH）だが、ビジネスユーザーは判断材料がないため BLOCK にする

  {
    // git add 一括ステージング — .envや個人情報ファイルが含まれるか判断できない
    // AUDIT-FIX: -u/--update（追跡済みファイル一括）、. --force（.gitignore済みファイルも含む）、./ も追加
    test: (cmd) =>
      /git\s+add\s+(-A|--all)\b/.test(cmd) ||
      /git\s+add\s+(-u|--update)\b/.test(cmd) ||
      /git\s+add\s+\.(?:[\/\s]|$)/.test(cmd) ||
      /git\s+add\s+\*\s*$/.test(cmd),
    reason: blockMsg(
      '全ファイルの一括Gitステージング（要エンジニア確認）',
      '全ての変更ファイルをGitに登録しようとしています。',
      '.envファイルや顧客データが誤って含まれると、GitHubで全世界に公開されます（2024年: 3900万件漏洩）。含まれているかを判断するには技術的知識が必要です。',
      '① エンジニアに「どのファイルをコミットすべきか」確認する ② ファイルを個別に指定してもらう（例: git add src/app.js）'
    ),
  },
  {
    // git reset --hard — 何が消えるか判断できない
    test: (cmd) => /git\s+reset\s+--hard/.test(cmd),
    reason: blockMsg(
      'Git変更の強制リセット（取り消し不可）',
      '未コミットの全変更が永久に消えます。',
      '「何が消えるか」を判断するには変更内容の把握が必要です。誤承認すると作業が完全に失われます。',
      'エンジニアに相談してください。作業を一時保存したい場合は「git stash」を使うよう依頼してください。'
    ),
  },
  {
    // npx -y — パッケージの安全性を評価できない
    // AUDIT-FIX: フラグ後置（npx pkg -y）、大文字NPX も検知
    test: (cmd) => /npx\s+.+\s(-y|--yes)\b/i.test(cmd) || /npx\s+(-y|--yes)\s+/i.test(cmd),
    reason: blockMsg(
      '外部パッケージの無検証自動実行',
      'セキュリティ確認なしで外部プログラムをダウンロード・実行します。',
      'AIがパッケージ名を1文字間違えると偽物のマルウェアが実行されます（slopsquatting攻撃）。安全性の評価には技術的知識が必要です。',
      '/external-install-check を先に実行してください。またはエンジニアに確認を依頼してください。'
    ),
  },
  {
    // npm install -g — グローバルインストールのリスクを評価できない
    // AUDIT-FIX: `npm i -g` 略語、`npm install --global` 長形式も検知
    test: (cmd) => /npm\s+(?:install|i)\s+(?:.*\s+)?(?:-g|--global)\b/.test(cmd),
    reason: blockMsg(
      'グローバルパッケージのインストール',
      'コンピューター全体に影響するプログラムをインストールします。',
      'グローバルインストールされたマルウェアは全プロジェクトに影響します。安全性の評価には技術的知識が必要です。',
      'エンジニアに確認してからインストールしてください。'
    ),
  },
  {
    // docker system/volume prune + docker rm/rmi -f — 影響範囲を把握できない
    // AUDIT-FIX: `docker prune`（素のサブコマンドなし形式）も追加
    test: (cmd) =>
      /docker\s+(?:system|volume|network|container|image)\s+prune/.test(cmd) ||
      /docker\s+prune\b/.test(cmd) ||
      /docker\s+(?:rm|rmi)\s+-f/.test(cmd),
    reason: blockMsg(
      'Docker環境の一括削除（取り消し不可）',
      'Dockerコンテナ・イメージ・ボリュームが削除されます（元に戻せません）。',
      '開発環境の再構築に時間がかかります。本番稼働中のコンテナが含まれる可能性もあります。',
      'エンジニアに確認してから実行してください。'
    ),
  },
  {
    // claude mcp add — MCPサーバーの安全性を評価できない
    test: (cmd) => /claude\s+mcp\s+add\b/.test(cmd),
    reason: blockMsg(
      '外部MCPサーバーの追加（攻撃リスク）',
      'AIの拡張機能（MCPサーバー）を追加しようとしています。',
      '悪意あるMCPサーバーはAIの全ての操作を乗っ取れます（CVE-2025-59536）。安全性の評価には専門知識が必要です。',
      '/external-install-check を先に実行してください。またはエンジニアに確認を依頼してください。'
    ),
  },
  {
    // rm -rf 任意のターゲット — ビジネス版は全て BLOCK（エンジニア版は / と ~ のみ BLOCK）
    // ビジネスユーザーは削除対象の重要度を判断できないため、対象を問わず全てブロック
    test: (cmd) => {
      if (!/\brm\b/.test(cmd)) return false;
      return /(?:-[a-zA-Z]*[rf]|--force|--recursive)/i.test(cmd);
    },
    reason: blockMsg(
      'ファイル・フォルダの強制削除',
      '指定したファイルまたはフォルダが削除されます（ゴミ箱には入りません）。',
      '削除後は元に戻せません。削除対象に重要なファイルが含まれているかを判断するには内容の把握が必要です。',
      '削除するファイルをエンジニアに確認してから実行してください。'
    ),
  },

  // ===== ビジネス向け追加パターン =====

  {
    // 顧客・個人情報ファイルへのアクセス・コミット試み
    // AUDIT-FIX: ひらがな表記（こきゃく・かいいん等）、.json拡張子も追加
    test: (cmd) =>
      /(?:cat|head|tail|less|more|grep|awk|sed)\s+[^\n|;&`]*(?:顧客|こきゃく|名簿|めいぼ|個人情報|こじんじょうほう|会員|かいいん|customer|members?|applicants?|candidates?)[^\n|;&`]*\.(?:csv|xlsx?|tsv|json)\b/i.test(cmd) ||
      /git\s+add\s+[^\n|;&`]*(?:顧客|こきゃく|名簿|個人情報|customer|members?)[^\n|;&`]*\.(?:csv|xlsx?|json)/i.test(cmd),
    reason: blockMsg(
      '個人情報ファイルへのアクセス',
      '顧客・会員・個人情報を含む可能性のあるファイルをAIに入力しようとしています。',
      '個人情報保護法では、AIサービスへの個人情報入力が「第三者提供」に該当する可能性があります（個人情報保護委員会 2023年6月注意喚起）。',
      '① ファイルの内容をAIに直接入力しない ② 必要な場合はダミーデータに置き換えてから使用 ③ 法務・コンプライアンス担当者に確認してください'
    ),
  },
  {
    // 財務・給与データへのアクセス
    test: (cmd) =>
      /(?:cat|head|tail|less|more|git\s+add)\s+[^\n|;&`]*(?:給与|salary|payroll|財務|決算|annual.?report|有価証券|目論見書|役員報酬)[^\n|;&`]*\.(?:csv|xlsx?|pdf)\b/i.test(cmd),
    reason: blockMsg(
      '機密財務データへのアクセス',
      '給与・財務データ・未発表決算情報を含む可能性のあるファイルをAIに入力しようとしています。',
      '未公開の財務情報・決算情報のAI入力はインサイダー情報漏洩リスクがあります。上場企業では東証適時開示義務が生じる可能性があります。',
      '① ファイルの入力を中止する ② 法務・コンプライアンス担当者に相談してください'
    ),
  },
  {
    // 機密契約書・法務文書のコミット
    test: (cmd) =>
      /git\s+add\s+[^\n|;&`]*(?:契約|contract|nda|機密保持|秘密保持|confidential)[^\n|;&`]*\.(?:pdf|docx?)\b/i.test(cmd),
    reason: blockMsg(
      '機密契約書のGitコミット試み',
      '契約書・NDA・機密保持契約などの法務文書がGitリポジトリに登録されます。',
      'GitHubなどのリモートリポジトリに公開された場合、機密情報が外部に漏洩します。契約違反・法的責任が生じる可能性があります。',
      '法務文書はGitではなく、契約管理システム（クラウドサイン等）で管理してください。'
    ),
  },
];

// === Risk Classification Patterns ===

const HIGH_RISK_PATTERNS = [
  // ビジネス版: git push（全て）/ git commit / pip install を HIGH に格上げ（エンジニア版は MEDIUM）
  // ビジネスユーザーが「何を push/commit しているか」を確認する習慣をつけるための確認ダイアログ
  /git\s+push/,
  /git\s+commit/,
  /pip\s+install/,
  // MED-5 fix: --force-with-lease is safe, only flag plain --force
  // NOTE: force push to main/master/develop/release/* は Safety Gate で BLOCK 済み
  /git\s+push\s+.*--force(?!-with-lease)/,
  /git\s+push\s+.*-f\b/,
  /git\s+clean\s+-[a-zA-Z]*f/,
  /git\s+branch\s+-D/,
  /DROP\s+(TABLE|DATABASE|INDEX)/i,
  /DELETE\s+FROM/i,
  /TRUNCATE\s+TABLE/i,
  /kill\s+-9/,
  // MED-4 fix: catch chmod a+rwx and 0777 in addition to 777
  /chmod\s+(?:0*777|a[+]rwx|ugo[+]rwx)/,
  /mkfs\b/,
  /dd\s+if=/,
  /shutdown/,
  /reboot/,
  />\s*\/dev\/sd/,
  // HIGH-5: .env file copy/move/encode — .env exfiltration bypass
  /(?:cp|mv|ln)\s+.*\.env\b/,
  /(?:base64|xxd|od|strings|hexdump)\s+.*\.env\b/,
  // Secret exposure: hardcoded secrets in commands
  /(?:curl|wget|http).*(?:Bearer|Basic)\s+[A-Za-z0-9_\-\.]{20,}/i,
  /ANTHROPIC_BASE_URL/,
  /enableAllProjectMcpServers/,
  /curl\s+.*(?:-[dD]\b|--data(?:-[a-z]+)?\b)/,  // curl with POST data flags (-b cookie is excluded)
  /wget\s+.*--post/i,
];

const MEDIUM_RISK_PATTERNS = [
  // git push / git commit / pip install は HIGH に格上げ済み（上記 HIGH_RISK_PATTERNS 参照）
  // npm install -g は Safety Gate で BLOCK 済み
  /git\s+merge/,
  /git\s+rebase/,
  /git\s+checkout\s+\./,
  /git\s+restore\s+\./,
  /npm\s+publish/,
  /npm\s+install(?!\s+-g)/,  // -g は BLOCK済み。通常インストールは MEDIUM
  /docker\s+(build|run|compose)/,
  /curl\s+.*-X\s*(POST|PUT|DELETE|PATCH)/i,
  /ssh\s/,
  /scp\s/,
  /rsync\s/,
  /brew\s+(install|uninstall)/,
  /apt(-get)?\s+(install|remove)/,
];

const LOW_TOOL_NAMES = new Set([
  'Read', 'Glob', 'Grep', 'WebFetch', 'WebSearch',
  'TaskList', 'TaskGet',
]);

/**
 * HIGH リスクパターンに対してビジネスフレンドリーなメッセージを返す
 */
function getHighRiskMessage(cmd) {
  // ビジネス版 HIGH 格上げパターン（エンジニア版は MEDIUM）
  if (/git\s+push/.test(cmd))
    return highMsg(
      'Gitリモートへの送信（push）',
      'コードをリモートリポジトリ（GitHub等）に送信します。',
      '送信後はチームメンバー全員に影響します。間違ったブランチへの送信や、意図しないファイルの公開が起きる可能性があります。',
      '① どのブランチに送るか確認 ② git status でコミット内容を確認 ③ 問題なければ続行'
    );
  if (/git\s+commit/.test(cmd))
    return highMsg(
      'Gitコミット（変更の記録）',
      '変更内容をGitの履歴に記録します。',
      'コミット内容に機密情報（APIキー・個人情報等）が含まれていると、後から完全に除去するのが困難になります。',
      '① git status でどのファイルがステージングされているか確認 ② 問題なければ続行'
    );
  if (/pip\s+install/.test(cmd))
    return highMsg(
      '外部Pythonパッケージのインストール',
      '外部からPythonパッケージをダウンロード・インストールします。',
      'パッケージ名の偽装（slopsquatting）でマルウェアがインストールされる可能性があります。AIが提案したパッケージ名が本物かどうか確認が必要です。',
      '/external-install-check で安全性を確認するか、公式ドキュメントで正式なパッケージ名を確認してください。'
    );
  if (/git\s+add\s+(-A|--all)|git\s+add\s+\.\s*$|git\s+add\s+\*\s*$/.test(cmd))
    return highMsg(
      '全ファイルのステージング',
      '全てのファイルをGitに登録しようとしています。',
      '.envファイルや機密ファイルが誤って含まれる可能性があります。',
      '① 追加するファイルを確認してください ② .gitignoreに機密ファイルが記載されているか確認 ③ 不明な場合はエンジニアに相談'
    );
  if (/git\s+push\s+.*--force|git\s+push\s+.*-f\b/.test(cmd))
    return highMsg(
      'Git開発履歴の強制上書き',
      'チームメンバーの開発履歴が上書きされ、復旧が困難になります。',
      '上場審査ではソースコードの開発履歴が確認されます。強制上書きはIT統制の証跡を破壊します。',
      'エンジニアに相談してください。通常の git push で対応できる場合がほとんどです。'
    );
  if (/git\s+reset\s+--hard/.test(cmd))
    return highMsg(
      'Git変更の強制リセット',
      '未コミットの変更が全て消えます。',
      '保存されていない作業内容が完全に失われます（元に戻せません）。',
      '本当に必要か確認してから実行してください。コミット済みの作業は残ります。'
    );
  if (/git\s+clean\s+-[a-zA-Z]*f/.test(cmd))
    return highMsg(
      '未追跡ファイルの削除',
      '未追跡（Gitで管理されていない）ファイルが削除されます。',
      '新規作成したファイルが消える可能性があります（元に戻せません）。',
      '削除対象のファイルを先に確認してください（git clean -n でドライラン可能）。'
    );
  if (/DROP\s+(TABLE|DATABASE|INDEX)/i.test(cmd))
    return highMsg(
      'データベーステーブル/データの削除',
      'データベースのテーブル・インデックス・データが完全に削除されます。',
      '本番環境で実行すると業務停止になります。バックアップがない場合は復旧不可能です。',
      '① 本番環境ではないか確認 ② バックアップを取得 ③ エンジニアと二重確認してから実行'
    );
  if (/DELETE\s+FROM/i.test(cmd))
    return highMsg(
      'データベースのデータ削除',
      'データベースのデータが削除されます。',
      'WHERE句がない場合、テーブル全件が削除されます（元に戻せません）。',
      '① WHERE句で対象を絞り込む ② 本番環境か確認 ③ バックアップを取ってから実行'
    );
  if (/TRUNCATE\s+TABLE/i.test(cmd))
    return highMsg(
      'テーブル全データの削除',
      'テーブル内の全データが削除されます（元に戻せません）。',
      'DELETE FROMより高速で、ロールバック不可の場合があります。',
      'バックアップを取ってから実行してください。本番環境での実行はエンジニアと確認してください。'
    );
  if (/npx\s+(-y|--yes)/.test(cmd))
    return highMsg(
      '外部パッケージの無検証インストール',
      '外部パッケージをセキュリティ確認なしでインストール・実行します。',
      'AIがパッケージ名を間違えると、偽物のマルウェアパッケージが実行されます（slopsquatting攻撃）。',
      '/external-install-check を先に実行してパッケージの安全性を確認してください。'
    );
  if (/chmod\s+(?:0*777|a[+]rwx|ugo[+]rwx)/.test(cmd))
    return highMsg(
      'ファイル権限の全開放',
      'ファイルの権限を全ユーザーに開放します。',
      '機密ファイルに実行すると、誰でもアクセス・改ざんできる状態になります。',
      '対象ファイルが機密情報を含まないか確認してください。必要な権限設定についてはエンジニアに相談してください。'
    );
  if (/rm\s+.*(-[a-zA-Z]*f|-[a-zA-Z]*r)/.test(cmd))
    return highMsg(
      'ファイル・フォルダの強制削除',
      '指定したファイルまたはフォルダが削除されます（ゴミ箱に入りません）。',
      '削除後は元に戻せません。重要なファイルが含まれる場合は業務に支障が出ます。',
      '削除対象を確認してください。不明な場合はエンジニアに相談してください。'
    );
  if (/docker\s+(?:system|volume|network|container)\s+prune|docker\s+(?:rm|rmi)\s+-f/.test(cmd))
    return highMsg(
      'Docker環境の削除',
      'Dockerコンテナ・イメージ・ボリュームが削除されます。',
      '開発環境の再構築が必要になり、作業時間が失われます。本番に影響する場合もあります。',
      '開発環境か本番環境か確認してから実行してください。エンジニアに相談することをお勧めします。'
    );
  if (/kill\s+-9/.test(cmd))
    return highMsg(
      'プロセスの強制終了',
      '実行中のプログラムを強制終了します。',
      '保存されていないデータが失われる可能性があります。',
      '終了するプロセスが何か確認してから実行してください。'
    );
  if (/curl\s+.*(?:-[dD]\b|--data(?:-[a-z]+)?\b)/.test(cmd))
    return highMsg(
      'データの外部送信（curl POST）',
      'データを外部サーバーに送信します。',
      '送信内容に機密情報・個人情報が含まれていないか確認が必要です。',
      '① 送信内容を確認 ② 送信先のURLが正規のサービスか確認 ③ 不明な場合はエンジニアに相談'
    );
  if (/(?:cp|mv|ln)\s+.*\.env\b|(?:base64|xxd|od|strings|hexdump)\s+.*\.env\b/.test(cmd))
    return highMsg(
      '.envファイルの操作（コピー/移動/エンコード）',
      'シークレットファイルをコピー・移動・エンコードしようとしています。',
      '意図せずシークレット情報が別の場所に複製・露出するリスクがあります。',
      '本当に必要な操作か確認してください。エンジニアに相談することをお勧めします。'
    );
  if (/claude\s+mcp\s+add\b/.test(cmd))
    return highMsg(
      '外部MCPサーバーの追加',
      '外部のMCPサーバー（AIの拡張機能）を追加しようとしています。',
      '悪意あるMCPサーバーはAIの動作を乗っ取れます（CVE-2025-59536）。/external-install-check を先に実行してください。',
      '/external-install-check を先に実行して安全性を確認してください。'
    );

  // デフォルト
  const shortCmd = cmd.substring(0, 100);
  return highMsg(
    '影響範囲の大きい操作',
    `次の操作を実行しようとしています: ${shortCmd}`,
    'この操作は取り消しが難しい可能性があります。',
    '本当に必要な操作か確認してから実行してください。不明な場合はエンジニアに相談してください。'
  );
}

/**
 * ツール名と入力からリスクレベルを判定する
 * @param {string} toolName - ツール名
 * @param {object} toolInput - ツール入力
 * @returns {{ level: string, reason: string, additionalContext?: string }}
 */
function classifyRisk(toolName, toolInput) {
  // Read-only tools are always LOW
  if (LOW_TOOL_NAMES.has(toolName)) {
    return { level: 'LOW', reason: '' };
  }

  // Bash command classification
  if (toolName === 'Bash' && toolInput.command) {
    const cmd = toolInput.command;

    // 0. GlassWorm/Trojan Source: 不可視Unicode文字の検知 (SEC-014)
    if (INVISIBLE_UNICODE_RE.test(cmd)) {
      return { level: 'BLOCK', reason: blockMsg(
        '不可視Unicode文字の検出（GlassWorm/Trojan Source攻撃の疑い）',
        'コマンドに目に見えない制御文字が含まれています。',
        '不可視文字は悪意あるコードを隠すために使われます。400以上のGitHub/npmプロジェクトが被害を受けた「GlassWorm」攻撃と同じ手法です。',
        'コマンドを削除して、エンジニアに報告してください。コマンドの出所を確認してください。'
      )};
    }

    // 1. Safety Gate check (auto-block)
    for (const pattern of SAFETY_GATE_PATTERNS) {
      try {
        if (pattern.test(cmd)) {
          return { level: 'BLOCK', reason: pattern.reason };
        }
      } catch (_e) {
        // Pattern evaluation error, skip
      }
    }

    // 2. HIGH risk check
    for (const pattern of HIGH_RISK_PATTERNS) {
      if (pattern.test(cmd)) {
        return {
          level: 'HIGH',
          reason: getHighRiskMessage(cmd),
        };
      }
    }

    // 3. MEDIUM risk check
    for (const pattern of MEDIUM_RISK_PATTERNS) {
      if (pattern.test(cmd)) {
        const shortCmd = cmd.substring(0, 80);
        return {
          level: 'MEDIUM',
          reason: `🟡 実行前に確認: ${shortCmd}\n\nこの操作は外部への影響があります。問題なければ「続行」を選択してください。`,
        };
      }
    }

    return { level: 'LOW', reason: '' };
  }

  // Write/Edit tools - MEDIUM + file ownership context injection
  if (['Write', 'Edit', 'NotebookEdit'].includes(toolName)) {
    // SEC-014: Write/Edit 内容の不可視Unicode文字チェック
    const contentToCheck = (toolInput.content || '') + (toolInput.new_string || '');
    if (INVISIBLE_UNICODE_RE.test(contentToCheck)) {
      return { level: 'BLOCK', reason: blockMsg(
        '書き込み内容に不可視Unicode文字を検出（GlassWorm/Trojan Source攻撃の疑い）',
        'ファイルに書き込もうとしている内容に目に見えない制御文字が含まれています。',
        '不可視文字はコードレビューで発見できない悪意あるコードを埋め込む手法です。AIがプロンプトインジェクション経由で混入させた可能性があります。',
        '書き込みを中止し、エンジニアに報告してください。'
      )};
    }

    const filePath = toolInput.file_path || toolInput.notebook_path || '';
    return {
      level: 'MEDIUM',
      reason: `🟡 ファイル変更: ${filePath}\n\n機密情報（APIキー・個人情報）を含むファイルでないか確認してください。`,
      additionalContext: filePath
        ? `Editing ${filePath}. Ensure file ownership rules are respected per _common/PARALLEL.md.`
        : undefined,
    };
  }

  // Default: LOW
  return { level: 'LOW', reason: '' };
}

// Main
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const toolName = data.tool_name || '';
    const toolInput = data.tool_input || {};

    const { level, reason, additionalContext } = classifyRisk(toolName, toolInput);

    if (level === 'BLOCK') {
      // Safety Gate: auto-block
      process.stdout.write(JSON.stringify({
        decision: 'block',
        reason: reason,
      }));
    } else if (level === 'LOW') {
      // Silent pass-through + DATA PROTECTION reminder (survives context compression)
      const result = {
        decision: 'approve',
        additionalContext: additionalContext
          ? additionalContext + '\n' + DATA_PROTECTION_REMINDER
          : DATA_PROTECTION_REMINDER,
      };
      process.stdout.write(JSON.stringify(result));
    } else {
      // MEDIUM / HIGH: ask user + DATA PROTECTION reminder
      const indicator = level === 'HIGH' ? '🔴' : '🟡';
      const result = {
        decision: 'ask_user',
        reason: indicator + ' ' + level + ' RISK\n\n' + reason,
        additionalContext: additionalContext
          ? additionalContext + '\n' + DATA_PROTECTION_REMINDER
          : DATA_PROTECTION_REMINDER,
      };
      process.stdout.write(JSON.stringify(result));
    }
  } catch (_e) {
    // Parse error -> approve to avoid blocking
    process.stdout.write(JSON.stringify({ decision: 'approve' }));
  }
});
