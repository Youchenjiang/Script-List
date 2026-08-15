const test = require('node:test');
const assert = require('node:assert/strict');
const {
  cloneDefaultRule,
  formatRuleConfig,
  normalizeRuleConfig,
  toAiRule,
} = require('../src/rule-options');

test('recommended rule is valid and has a readable summary', () => {
  const rule = cloneDefaultRule();
  assert.equal(rule.confidenceThreshold, 0.8);
  assert.deepEqual(rule.technologies, ['any']);
  assert.match(formatRuleConfig(rule), /零日漏洞/);
  assert.match(formatRuleConfig(rule), /80%/);
  assert.match(formatRuleConfig(rule), /不限技術領域/);
});

test('rule normalization rejects missing topics and unknown options', () => {
  assert.throws(() => normalizeRuleConfig({
    ...cloneDefaultRule(),
    topics: [],
  }), /至少/);
  assert.throws(() => normalizeRuleConfig({
    ...cloneDefaultRule(),
    technologies: [],
  }), /技術領域/);
  assert.throws(() => normalizeRuleConfig({
    ...cloneDefaultRule(),
    regionScope: 'unknown',
  }), /地區/);
});

test('legacy rules default to unrestricted technologies', () => {
  const legacy = { ...cloneDefaultRule() };
  delete legacy.technologies;
  assert.deepEqual(normalizeRuleConfig(legacy).technologies, ['any']);
});

test('rules separate event types from technologies and migrate the legacy identity topic', () => {
  const rule = normalizeRuleConfig({
    ...cloneDefaultRule(),
    topics: ['cloud_identity'],
    technologies: ['identity_access', 'cloud_containers'],
  });
  assert.deepEqual(rule.topics, ['identity_compromise']);
  assert.deepEqual(rule.technologies, ['identity_access', 'cloud_containers']);
  assert.deepEqual(
    toAiRule(rule).technologies.map(({ id }) => id),
    ['identity_access', 'cloud_containers'],
  );
});
