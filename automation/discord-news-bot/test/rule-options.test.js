const test = require('node:test');
const assert = require('node:assert/strict');
const {
  cloneDefaultRule,
  formatRuleConfig,
  normalizeRuleConfig,
} = require('../src/rule-options');

test('recommended rule is valid and has a readable summary', () => {
  const rule = cloneDefaultRule();
  assert.equal(rule.confidenceThreshold, 0.8);
  assert.match(formatRuleConfig(rule), /零日漏洞/);
  assert.match(formatRuleConfig(rule), /80%/);
});

test('rule normalization rejects missing topics and unknown options', () => {
  assert.throws(() => normalizeRuleConfig({
    ...cloneDefaultRule(),
    topics: [],
  }), /至少/);
  assert.throws(() => normalizeRuleConfig({
    ...cloneDefaultRule(),
    regionScope: 'unknown',
  }), /地區/);
});
