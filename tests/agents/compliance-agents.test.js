'use strict';
/**
 * 上場審査・個人情報保護・法務エージェント — 構造テスト
 *
 * 検証項目:
 *   - 6エージェント全てのSKILL.mdの存在とfrontmatter
 *   - 各エージェントのreferencesディレクトリの存在
 *   - ペアエージェント間のクロスチェックプロトコル定義
 *   - Dual-Check Protocolセクションの存在（主査のみ）
 *   - Cross-Check Report Formatセクションの存在（副査のみ）
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '../..');

const AGENT_PAIRS = [
  {
    domain: 'IPO/IT統制',
    primary: { name: 'compliance', partner: 'comptroller' },
    secondary: { name: 'comptroller', partner: 'compliance' },
  },
  {
    domain: '個人情報保護',
    primary: { name: 'privacy', partner: 'datashield' },
    secondary: { name: 'datashield', partner: 'privacy' },
  },
  {
    domain: '法務',
    primary: { name: 'counsel', partner: 'advocate' },
    secondary: { name: 'advocate', partner: 'counsel' },
  },
];

const ALL_AGENTS = AGENT_PAIRS.flatMap(p => [p.primary.name, p.secondary.name]);

// ============================================================
// 全6エージェントの存在とfrontmatter
// ============================================================

describe('All 6 compliance agents exist with correct frontmatter', () => {
  for (const name of ALL_AGENTS) {
    it(`${name}/SKILL.md exists`, () => {
      const skillPath = path.join(ROOT, `agents/${name}/SKILL.md`);
      assert.ok(fs.existsSync(skillPath), `agents/${name}/SKILL.md should exist`);
    });

    it(`${name}/SKILL.md has correct frontmatter`, () => {
      const content = fs.readFileSync(path.join(ROOT, `agents/${name}/SKILL.md`), 'utf8');
      assert.match(content, /^---\n/, 'should start with frontmatter');
      const nameRegex = new RegExp(`name:\\s*${name}`, 'i');
      assert.match(content, nameRegex, `frontmatter should have name: ${name}`);
      assert.match(content, /description:/, 'frontmatter should have description');
    });
  }
});

// ============================================================
// referencesディレクトリの存在
// ============================================================

describe('Each agent has references directory', () => {
  for (const name of ALL_AGENTS) {
    it(`${name}/references/ directory exists`, () => {
      const refDir = path.join(ROOT, `agents/${name}/references`);
      assert.ok(fs.existsSync(refDir), `agents/${name}/references/ should exist`);
    });
  }
});

// ============================================================
// 主査のDual-Check Protocol
// ============================================================

describe('Primary agents have Dual-Check Protocol defined', () => {
  for (const pair of AGENT_PAIRS) {
    const { name, partner } = pair.primary;

    it(`${name} defines Dual-Check Protocol section`, () => {
      const content = fs.readFileSync(path.join(ROOT, `agents/${name}/SKILL.md`), 'utf8');
      assert.match(content, /Dual-Check Protocol/i, `${name} should have Dual-Check Protocol section`);
    });

    it(`${name} references ${partner} as cross-check partner`, () => {
      const content = fs.readFileSync(path.join(ROOT, `agents/${name}/SKILL.md`), 'utf8');
      const partnerRegex = new RegExp(partner, 'i');
      assert.match(content, partnerRegex, `${name} should reference ${partner}`);
    });

    it(`${name} has handoff format defined`, () => {
      const content = fs.readFileSync(path.join(ROOT, `agents/${name}/SKILL.md`), 'utf8');
      assert.match(content, /HANDOFF/i, `${name} should define handoff format`);
    });

    it(`${name} has "省略禁止" rule for cross-check`, () => {
      const content = fs.readFileSync(path.join(ROOT, `agents/${name}/SKILL.md`), 'utf8');
      assert.match(content, /省略禁止/, `${name} should enforce mandatory cross-check`);
    });
  }
});

// ============================================================
// 副査のCross-Check Report Format
// ============================================================

describe('Secondary agents have Cross-Check Report Format defined', () => {
  for (const pair of AGENT_PAIRS) {
    const { name, partner } = pair.secondary;

    it(`${name} defines Cross-Check Report Format section`, () => {
      const content = fs.readFileSync(path.join(ROOT, `agents/${name}/SKILL.md`), 'utf8');
      assert.match(content, /Cross-Check Report Format/i, `${name} should have Cross-Check Report Format`);
    });

    it(`${name} references ${partner} as source agent`, () => {
      const content = fs.readFileSync(path.join(ROOT, `agents/${name}/SKILL.md`), 'utf8');
      const partnerRegex = new RegExp(partner, 'i');
      assert.match(content, partnerRegex, `${name} should reference ${partner}`);
    });

    it(`${name} defines APPROVED/RETURNED decision`, () => {
      const content = fs.readFileSync(path.join(ROOT, `agents/${name}/SKILL.md`), 'utf8');
      assert.match(content, /APPROVED/, `${name} should define APPROVED decision`);
      assert.match(content, /RETURNED/, `${name} should define RETURNED decision`);
    });

    it(`${name} has "検証なしに承認しない" rule`, () => {
      const content = fs.readFileSync(path.join(ROOT, `agents/${name}/SKILL.md`), 'utf8');
      assert.match(content, /検証なしに承認しない/, `${name} should enforce independent verification`);
    });
  }
});

// ============================================================
// ドメイン固有コンテンツの確認
// ============================================================

describe('Domain-specific content verification', () => {
  // compliance: J-SOX, ITGC, AI ガバナンス
  it('compliance references J-SOX and ITGC', () => {
    const content = fs.readFileSync(path.join(ROOT, 'agents/compliance/SKILL.md'), 'utf8');
    assert.match(content, /J-SOX/i);
    assert.match(content, /ITGC|IT全般統制/i);
    assert.match(content, /AI.*ガバナンス|AI.*governance/i);
  });

  // privacy: 個人情報保護法, 安全管理措置, 漏えい
  it('privacy references personal info protection law', () => {
    const content = fs.readFileSync(path.join(ROOT, 'agents/privacy/SKILL.md'), 'utf8');
    assert.match(content, /個人情報保護法/);
    assert.match(content, /安全管理措置/);
    assert.match(content, /漏えい/);
    assert.match(content, /第23条|第26条|第28条/);
  });

  // counsel: 法務, 著作権, 契約, 不正競争防止法
  it('counsel references key legal domains', () => {
    const content = fs.readFileSync(path.join(ROOT, 'agents/counsel/SKILL.md'), 'utf8');
    assert.match(content, /著作権/);
    assert.match(content, /不正競争防止法/);
    assert.match(content, /契約/);
    assert.match(content, /OSS|ライセンス/i);
  });

  // datashield: GDPR, 技術的実効性
  it('datashield references GDPR and technical effectiveness', () => {
    const content = fs.readFileSync(path.join(ROOT, 'agents/datashield/SKILL.md'), 'utf8');
    assert.match(content, /GDPR/);
    assert.match(content, /技術的.*実効性|実効性.*技術/);
  });

  // comptroller: 監査法人視点
  it('comptroller references audit firm perspective', () => {
    const content = fs.readFileSync(path.join(ROOT, 'agents/comptroller/SKILL.md'), 'utf8');
    assert.match(content, /監査法人/);
    assert.match(content, /EY|PwC|KPMG|Deloitte/i);
  });

  // advocate: 判例, 行政処分
  it('advocate references case law and administrative actions', () => {
    const content = fs.readFileSync(path.join(ROOT, 'agents/advocate/SKILL.md'), 'utf8');
    assert.match(content, /判例/);
    assert.match(content, /行政処分/);
  });
});

// ============================================================
// DUAL_CHECK 強制プロトコル
// ============================================================

describe('Dual-Check Protocol enforcement', () => {

  it('_common/DUAL_CHECK.md exists', () => {
    const dualCheckPath = path.join(ROOT, '_common/DUAL_CHECK.md');
    assert.ok(fs.existsSync(dualCheckPath), '_common/DUAL_CHECK.md should exist');
  });

  it('DUAL_CHECK.md defines all 3 pairs', () => {
    const content = fs.readFileSync(path.join(ROOT, '_common/DUAL_CHECK.md'), 'utf8');
    assert.match(content, /compliance.*comptroller/i);
    assert.match(content, /privacy.*datashield/i);
    assert.match(content, /counsel.*advocate/i);
  });

  it('DUAL_CHECK.md enforces 単独起動禁止', () => {
    const content = fs.readFileSync(path.join(ROOT, '_common/DUAL_CHECK.md'), 'utf8');
    assert.match(content, /単独起動禁止/);
  });

  // 全6エージェントに「単独起動禁止」が明記されているか
  for (const name of ALL_AGENTS) {
    it(`${name} has 単独起動禁止 warning`, () => {
      const content = fs.readFileSync(path.join(ROOT, `agents/${name}/SKILL.md`), 'utf8');
      assert.match(content, /単独起動禁止/, `${name} should have 単独起動禁止 warning`);
    });

    it(`${name} references DUAL_CHECK.md`, () => {
      const content = fs.readFileSync(path.join(ROOT, `agents/${name}/SKILL.md`), 'utf8');
      assert.match(content, /DUAL_CHECK\.md/, `${name} should reference DUAL_CHECK.md`);
    });
  }

  // 主査の AUTORUN 出力に CrossCheckRequired: true が含まれるか
  for (const pair of AGENT_PAIRS) {
    it(`${pair.primary.name} AUTORUN output includes CrossCheckRequired: true`, () => {
      const content = fs.readFileSync(path.join(ROOT, `agents/${pair.primary.name}/SKILL.md`), 'utf8');
      assert.match(content, /CrossCheckRequired:\s*true/i, `${pair.primary.name} should output CrossCheckRequired: true`);
    });
  }

  // 副査の AUTORUN DependsOn が主査を参照しているか
  for (const pair of AGENT_PAIRS) {
    it(`${pair.secondary.name} AUTORUN DependsOn references ${pair.primary.name}`, () => {
      const content = fs.readFileSync(path.join(ROOT, `agents/${pair.secondary.name}/SKILL.md`), 'utf8');
      const primaryCapitalized = pair.primary.name.charAt(0).toUpperCase() + pair.primary.name.slice(1);
      const regex = new RegExp(`DependsOn:\\s*${primaryCapitalized}`, 'i');
      assert.match(content, regex, `${pair.secondary.name} should DependsOn ${pair.primary.name}`);
    });
  }
});

// ============================================================
// install.sh 登録確認
// ============================================================

describe('install.sh registration', () => {
  it('install.sh ALL_AGENTS contains all 6 new agents', () => {
    const content = fs.readFileSync(path.join(ROOT, 'install.sh'), 'utf8');
    for (const name of ALL_AGENTS) {
      assert.ok(content.includes(name), `install.sh should contain ${name}`);
    }
  });
});
