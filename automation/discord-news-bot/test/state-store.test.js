const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createFileStateStore, createPostgresStateStore } = require('../src/state-store');
const { cloneDefaultRule } = require('../src/rule-options');

test('file state store does not reuse a rule version after clear', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'news-state-'));
  const store = createFileStateStore(path.join(tempDir, 'state.json'));

  assert.equal((await store.setFilterRule('channel-1', cloneDefaultRule(), 'user-1')).version, 1);
  await store.setFilterRule('channel-1', null, 'user-1');
  assert.equal(await store.getFilterRule('channel-1'), null);
  assert.equal((await store.setFilterRule('channel-1', cloneDefaultRule(), 'user-1')).version, 3);
});

test('PostgreSQL state store initializes, saves, and loads state', async () => {
  const calls = [];
  const pool = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.startsWith('SELECT')) {
        return {
          rowCount: 1,
          rows: [{ sent_ids: ['article-1'], last_checked_at: new Date('2026-08-14T12:00:00Z') }],
        };
      }
      return { rowCount: 1, rows: [] };
    },
    async end() {},
  };
  const store = createPostgresStateStore('postgres://unused', pool);

  await store.save({ sentIds: ['article-1', 'article-1'], lastCheckedAt: '2026-08-14T12:00:00Z' });
  const state = await store.load();

  assert.equal(store.kind, 'postgres');
  assert.equal(calls.filter((call) => call.sql.includes('CREATE TABLE')).length, 3);
  const saveCall = calls.find((call) => call.sql.includes('INSERT INTO news_bot_state'));
  assert.deepEqual(JSON.parse(saveCall.params[1]), ['article-1']);
  assert.deepEqual(state, {
    sentIds: ['article-1'],
    lastCheckedAt: '2026-08-14T12:00:00.000Z',
  });
});

test('PostgreSQL state store returns an empty state before first save', async () => {
  const pool = {
    async query(sql) {
      return sql.startsWith('SELECT') ? { rowCount: 0, rows: [] } : { rowCount: 0, rows: [] };
    },
    async end() {},
  };
  const store = createPostgresStateStore('postgres://unused', pool);

  assert.deepEqual(await store.load(), { sentIds: [], lastCheckedAt: null });
});

test('PostgreSQL state store versions rules and caches AI evaluations', async () => {
  const calls = [];
  const pool = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.includes('RETURNING channel_id')) {
        return {
          rowCount: 1,
          rows: [{
            channel_id: 'channel-1',
            rule_config: cloneDefaultRule(),
            version: 2,
            updated_by: 'user-1',
            updated_at: new Date('2026-08-14T12:00:00Z'),
          }],
        };
      }
      if (sql.includes('FROM news_filter_rules WHERE')) {
        return {
          rowCount: 1,
          rows: [{
            channel_id: 'channel-1',
            rule_config: cloneDefaultRule(),
            version: 2,
            updated_by: 'user-1',
            updated_at: new Date('2026-08-14T12:00:00Z'),
          }],
        };
      }
      if (sql.includes('FROM news_article_evaluations')) {
        return {
          rowCount: 1,
          rows: [{
            matches: true,
            confidence: 0.95,
            severity: 'critical',
            region_relevance: 'global_major',
            reason: '符合重大漏洞條件',
            matched_criteria: ['重大漏洞'],
            matched_exclusions: [],
            evidence: ['文章指出重大漏洞'],
            evaluated_at: new Date('2026-08-14T12:01:00Z'),
          }],
        };
      }
      return { rowCount: 1, rows: [] };
    },
    async end() {},
  };
  const store = createPostgresStateStore('postgres://unused', pool);

  const rule = await store.setFilterRule('channel-1', cloneDefaultRule(), 'user-1');
  assert.equal(rule.version, 2);
  assert.deepEqual((await store.getFilterRule('channel-1')).config, cloneDefaultRule());

  const decision = {
    matches: true,
    confidence: 0.95,
    severity: 'critical',
    regionRelevance: 'global_major',
    reason: '符合重大漏洞條件',
    matchedCriteria: ['重大漏洞'],
    matchedExclusions: [],
    evidence: ['文章指出重大漏洞'],
  };
  await store.saveEvaluation('article-1', 'channel-1', 2, decision);
  assert.deepEqual(await store.getEvaluation('article-1', 'channel-1', 2), {
    ...decision,
    evaluatedAt: '2026-08-14T12:01:00.000Z',
  });

  const evaluationSave = calls.find((call) => call.sql.includes('INSERT INTO news_article_evaluations'));
  assert.deepEqual(evaluationSave.params.slice(0, 8), [
    'article-1', 'channel-1', 2, true, 0.95, 'critical', 'global_major',
    '符合重大漏洞條件',
  ]);
});
