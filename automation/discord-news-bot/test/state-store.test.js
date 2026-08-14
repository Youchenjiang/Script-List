const test = require('node:test');
const assert = require('node:assert/strict');
const { createPostgresStateStore } = require('../src/state-store');

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
  assert.equal(calls.filter((call) => call.sql.includes('CREATE TABLE')).length, 1);
  assert.deepEqual(JSON.parse(calls[1].params[1]), ['article-1']);
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
