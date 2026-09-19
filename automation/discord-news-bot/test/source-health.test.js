const test = require('node:test');
const assert = require('node:assert/strict');
const {
  initialSourceHealth, recordSourceFailure, recordSourceSuccess, recoverSource, shouldFetchSource,
} = require('../src/source-health');
const { createSourceObserver } = require('../src/source-observer');

test('source health quarantines seven consecutive failures and requires explicit recovery', () => {
  let health = initialSourceHealth({ id: 'example', status: 'observing' }, new Date('2026-01-01T00:00:00Z'));
  for (let index = 0; index < 7; index += 1) health = recordSourceFailure(health, new Error('HTTP 500'), new Date(`2026-01-0${index + 1}T00:00:00Z`));
  assert.equal(health.status, 'quarantined');
  assert.equal(health.consecutiveFailures, 7);
  assert.equal(shouldFetchSource(health), false);
  health = recordSourceSuccess(health, [{ id: 'new', published: new Date('2026-01-08T00:00:00Z') }], new Date('2026-01-08T00:00:00Z'));
  assert.equal(health.status, 'quarantined');
  assert.equal(recoverSource(health, new Date('2026-01-09T00:00:00Z')).status, 'observing');
});

test('source health marks feeds stale when their newest article is ninety days old', () => {
  const health = initialSourceHealth({ id: 'example', status: 'observing' }, new Date('2026-01-01T00:00:00Z'));
  const result = recordSourceSuccess(health, [{ id: 'old', published: new Date('2026-01-01T00:00:00Z') }], new Date('2026-04-02T00:00:00Z'));
  assert.equal(result.status, 'stale');
  assert.equal(shouldFetchSource(result), false);
});

test('source observer checks only the configured batch and never publishes articles', async () => {
  const values = new Map();
  const fetched = [];
  const observer = createSourceObserver({
    config: { maxSourcesPerRun: 2 },
    stateStore: {
      loadSourceHealth: async (id) => values.get(id) || null,
      saveSourceHealth: async (id, health) => values.set(id, health),
    },
    fetchFeed: async (url) => {
      fetched.push(url);
      return [{ id: url, published: new Date('2026-09-19T00:00:00Z') }];
    },
    now: () => new Date('2026-09-19T01:00:00Z'),
  });
  const result = await observer.run();
  assert.deepEqual({ checked: result.checked, succeeded: result.succeeded, failed: result.failed }, { checked: 2, succeeded: 2, failed: 0 });
  assert.equal(fetched.length, 2);
  assert.equal(values.size, 2);
});

test('file state store persists source health independently', async () => {
  const fs = require('node:fs/promises');
  const os = require('node:os');
  const path = require('node:path');
  const { createFileStateStore } = require('../src/state-store');
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'source-health-'));
  const store = createFileStateStore(path.join(directory, 'state.json'));
  const health = { sourceId: 'example', status: 'observing', consecutiveFailures: 0 };
  await store.saveSourceHealth('example', health);
  assert.deepEqual(await store.loadSourceHealth('example'), health);
  assert.deepEqual(await store.load(), { sentIds: [], lastCheckedAt: null });
});
