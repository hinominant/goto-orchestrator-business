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
    test: (cmd) =>
      /python3?\s+-c\s+['"].*(?:urllib|requests|http|socket|subprocess|os\.environ|os\.getenv)/.test(cmd) ||
      /node\s+-e\s+['"].*(?:https?|fetch|axios|net\.Socket|child_process|require\(\s*['"]net['"]\s*\)|net\.connect|process\.env)/.test(cmd),
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
    test: (cmd) =>
      /eval\s+["'`]?\$\((?:curl|wget)/.test(cmd) ||
      /eval\s+["'][^'"]*(?:curl|wget)/.test(cmd),
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
    test: (cmd) =>
      /\b(?:head|tail|tac|less|more|sort)\s+[^\n|;&`]*\.env\b/i.test(cmd),
    reason: blockMsg(
      'シークレットファイルの読み取り試行',
      'シークレットファイル（.env）の内容を読み取ります。',
      'cat .envと同様に、シークレットがAIの入力に含まれる可能性があります。',
      '.envの内容はAIに入力しないでください。必要な場合はエンジニアに相談してください。'
    ),
  },

  // ===== ビジネス向け追加パターン =====

  {
    // 顧客・個人情報ファイルへのアクセス・コミット試み
    test: (cmd) =>
      /(?:cat|head|tail|less|more|grep|awk|sed)\s+[^\n|;&`]*(?:顧客|名簿|個人情報|会員|customer|members?|applicants?|candidates?)[^\n|;&`]*\.(?:csv|xlsx?|tsv)\b/i.test(cmd) ||
      /git\s+add\s+[^\n|;&`]*(?:顧客|名簿|個人情報|customer|members?)[^\n|;&`]*\.(?:csv|xlsx?)/i.test(cmd),
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
  // 外部コンテンツの無検証インストール（サプライチェーン攻撃）
  /npx\s+(-y|--yes)\s+/,
  /claude\s+mcp\s+add\b/,
  // CRIT-3: bulk git staging — may silently include .env files
  /git\s+add\s+(-A|--all)\b/,
  /git\s+add\s+\.\s*$/,
  /git\s+add\s+\*\s*$/,
  /rm\s+.*(-[a-zA-Z]*f|-[a-zA-Z]*r|--force|--recursive)/,
  // MED-5 fix: --force-with-lease is safe, only flag plain --force
  /git\s+push\s+.*--force(?!-with-lease)/,
  /git\s+push\s+.*-f\b/,
  /git\s+reset\s+--hard/,
  /git\s+clean\s+-[a-zA-Z]*f/,
  /git\s+branch\s+-D/,
  /DROP\s+(TABLE|DATABASE|INDEX)/i,
  /DELETE\s+FROM/i,
  /TRUNCATE\s+TABLE/i,
  /docker\s+(rm|rmi)\s+-f/,
  // MED-2: docker system/volume prune — irreversible
  /docker\s+(?:system|volume|network|container)\s+prune/,
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
  /git\s+push/,
  /git\s+commit/,
  /git\s+merge/,
  /git\s+rebase/,
  /git\s+checkout\s+\./,
  /git\s+restore\s+\./,
  /npm\s+publish/,
  /npm\s+install\s+-g/,
  /pip\s+install/,
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
