const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createPublisher } = require('../src/publisher');

test('publisher sends unseen articles once and saves state', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'news-bot-'));
  const sentMessages = [];
  const article = {
    id: 'one', url: 'https://example.com/one', title: 'One', summary: 'Summary',
    published: new Date('2026-08-14T08:00:00Z'), author: '', categories: [], imageUrl: '',
  };
  const config = {
    statePath: path.join(tempDir, 'state.json'), feedUrl: 'unused', sourceName: 'Test',
    lookbackMs: 86_400_000, maxArticlesPerRun: 5,
  };
  const publisher = createPublisher({
    channel: { send: async (message) => sentMessages.push(message) },
    config,
    fetchNewsImpl: async () => [article],
    now: () => new Date('2026-08-14T12:00:00Z'),
  });

  assert.equal((await publisher.run()).published, 1);
  assert.equal((await publisher.run()).published, 0);
  assert.equal(sentMessages.length, 1);
});

test('first run does not leak capped backlog into later polling cycles', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'news-bot-'));
  const sentMessages = [];
  const articles = ['oldest', 'middle', 'newest'].map((id, index) => ({
    id, url: `https://example.com/${id}`, title: id, summary: '',
    published: new Date(`2026-08-14T0${index + 7}:00:00Z`), author: '', categories: [], imageUrl: '',
  }));
  const config = {
    statePath: path.join(tempDir, 'state.json'), feedUrl: 'unused', sourceName: 'Test',
    lookbackMs: 86_400_000, maxArticlesPerRun: 2,
  };
  const publisher = createPublisher({
    channel: { send: async (message) => sentMessages.push(message) },
    config,
    fetchNewsImpl: async () => articles,
    now: () => new Date('2026-08-14T12:00:00Z'),
  });

  assert.equal((await publisher.run()).published, 2);
  assert.equal((await publisher.run()).published, 0);
  assert.equal(sentMessages.length, 2);
});

test('publisher can mark initial articles as seen without sending them', async () => {
  const sentMessages = [];
  const savedStates = [];
  const stateStore = {
    kind: 'test',
    load: async () => ({ sentIds: [], lastCheckedAt: null }),
    save: async (state) => savedStates.push(state),
    close: async () => {},
  };
  const article = {
    id: 'existing', url: 'https://example.com/existing', title: 'Existing', summary: '',
    published: new Date('2026-08-14T08:00:00Z'), author: '', categories: [], imageUrl: '',
  };
  const publisher = createPublisher({
    channel: { send: async (message) => sentMessages.push(message) },
    config: {
      feedUrl: 'unused', sourceName: 'Test', lookbackMs: 86_400_000,
      maxArticlesPerRun: 5, publishInitialArticles: false,
    },
    fetchNewsImpl: async () => [article],
    now: () => new Date('2026-08-14T12:00:00Z'),
    stateStore,
  });

  assert.equal((await publisher.run()).published, 0);
  assert.equal(sentMessages.length, 0);
  assert.deepEqual(savedStates.at(-1).sentIds, ['existing']);
});
