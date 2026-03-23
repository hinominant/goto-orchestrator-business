'use strict';
/**
 * Four Eyes Test Protocol — 構造テスト
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '../..');

describe('Four Eyes Test Protocol', () => {

  it('_common/FOUR_EYES_TEST.md exists', () => {
    assert.ok(fs.existsSync(path.join(ROOT, '_common/FOUR_EYES_TEST.md')));
  });

  it('defines all 4 perspectives', () => {
    const content = fs.readFileSync(path.join(ROOT, '_common/FOUR_EYES_TEST.md'), 'utf8');
    assert.match(content, /エンジニアの目/);
    assert.match(content, /データの目/);
    assert.match(content, /ユーザーの目/);
    assert.match(content, /壊す人の目/);
  });

  it('defines all 5 agent roles', () => {
    const content = fs.readFileSync(path.join(ROOT, '_common/FOUR_EYES_TEST.md'), 'utf8');
    assert.match(content, /Coverage Auditor/);
    assert.match(content, /SSoT Verifier/);
    assert.match(content, /Flow Tracer/);
    assert.match(content, /User Journey Verifier/);
    assert.match(content, /Failure Pattern Detector/);
  });

  it('references ARIS TST-007', () => {
    const content = fs.readFileSync(path.join(ROOT, '_common/FOUR_EYES_TEST.md'), 'utf8');
    assert.match(content, /TST-007/);
  });

  it('defines 5 completion conditions', () => {
    const content = fs.readFileSync(path.join(ROOT, '_common/FOUR_EYES_TEST.md'), 'utf8');
    assert.match(content, /「できた」の5条件/);
  });

  it('skill file exists', () => {
    assert.ok(fs.existsSync(path.join(ROOT, 'skills/four-eyes-test.md')));
  });

  it('quality-gate references Four Eyes Test as Phase 0', () => {
    const content = fs.readFileSync(path.join(ROOT, 'commands/quality-gate.md'), 'utf8');
    assert.match(content, /Phase 0.*Four Eyes Test/i);
    assert.match(content, /four-eyes-test/);
  });
});
