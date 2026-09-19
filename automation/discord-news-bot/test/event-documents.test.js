const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createEventDocuments } = require('../src/event-documents');

test('activity documents persist and remain scoped to a channel in file mode', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'events-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, 'state');
  await createEventDocuments({ filePath }).saveEventDocument('123', { boardId: '456', events: {} });
  assert.deepEqual(await createEventDocuments({ filePath }).loadEventDocument('123'), { boardId: '456', events: {} });
  assert.equal(await createEventDocuments({ filePath }).loadEventDocument('789'), null);
});

test('PostgreSQL activity documents use parameterized channel-scoped writes', async () => {
  const calls = [];
  const store = createEventDocuments({ pool: { query: async (sql, values) => {
    calls.push({ sql, values }); return { rows: [{ document: { boardId: '456' } }] };
  } } });
  await store.saveEventDocument('123', { boardId: '456' });
  assert.deepEqual(await store.loadEventDocument('123'), { boardId: '456' });
  assert.deepEqual(calls[1].values, ['123', '{"boardId":"456"}']);
  assert.deepEqual(calls[2].values, ['123']);
});
