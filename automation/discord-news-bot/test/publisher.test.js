const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createPublisher, passesDecision } = require('../src/publisher');
const { cloneDefaultRule } = require('../src/rule-options');

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

test('AI filtering only publishes matching articles and reuses cached decisions', async () => {
  const sentMessages = [];
  let evaluations = 0;
  const cached = new Map();
  const savedStates = [];
  const articles = ['reject', 'match'].map((id, index) => ({
    id,
    url: `https://example.com/${id}`,
    title: id,
    summary: `${id} summary`,
    published: new Date(`2026-08-14T0${index + 8}:00:00Z`),
    author: '',
    categories: [],
    imageUrl: '',
  }));
  const stateStore = {
    kind: 'test',
    load: async () => ({ sentIds: savedStates.at(-1)?.sentIds || [], lastCheckedAt: '2026-08-14T07:00:00Z' }),
    save: async (state) => savedStates.push(state),
    getFilterRule: async () => ({ config: cloneDefaultRule(), version: 1 }),
    setFilterRule: async () => {},
    getEvaluation: async (articleId) => cached.get(articleId) || null,
    saveEvaluation: async (articleId, channelId, version, decision) => cached.set(articleId, decision),
    close: async () => {},
  };
  const publisher = createPublisher({
    channel: { send: async (message) => sentMessages.push(message) },
    config: {
      channelId: 'channel-1',
      feedUrl: 'unused',
      sourceName: 'Test',
      lookbackMs: 86_400_000,
      maxArticlesPerRun: 5,
      maxAiEvaluationsPerRun: 10,
      aiFilteringEnabled: true,
      aiApiKey: 'test-key',
      aiBaseUrl: 'https://provider.example/v1',
      aiModel: 'test-model',
    },
    fetchNewsImpl: async () => articles,
    now: () => new Date('2026-08-14T12:00:00Z'),
    stateStore,
    aiFilter: {
      evaluatorId: 'test-evaluator',
      async evaluate(article) {
        evaluations += 1;
        return {
          matches: article.id === 'match',
          confidence: 1,
          severity: 'critical',
          regionRelevance: 'global_major',
          reason: 'test',
          matchedCriteria: ['critical_vulnerability'],
          matchedExclusions: [],
          evidence: ['test evidence'],
        };
      },
    },
  });

  const first = await publisher.run();
  const second = await publisher.run();

  assert.equal(first.evaluated, 2);
  assert.equal(first.rejected, 1);
  assert.equal(first.published, 1);
  assert.equal(second.published, 0);
  assert.equal(evaluations, 2);
  assert.equal(sentMessages.length, 1);
});

test('AI filtering fails closed when no channel rule exists', async () => {
  const sentMessages = [];
  const stateStore = {
    kind: 'test',
    load: async () => ({ sentIds: [], lastCheckedAt: '2026-08-14T07:00:00Z' }),
    save: async () => {},
    getFilterRule: async () => null,
    setFilterRule: async () => {},
    close: async () => {},
  };
  const publisher = createPublisher({
    channel: { send: async (message) => sentMessages.push(message) },
    config: {
      channelId: 'channel-1',
      feedUrl: 'unused',
      sourceName: 'Test',
      lookbackMs: 86_400_000,
      maxArticlesPerRun: 5,
      aiFilteringEnabled: true,
      aiApiKey: 'test-key',
      aiBaseUrl: 'https://provider.example/v1',
      aiModel: 'test-model',
    },
    fetchNewsImpl: async () => [],
    now: () => new Date('2026-08-14T12:00:00Z'),
    stateStore,
    aiFilter: {
      evaluatorId: 'test-evaluator',
      evaluate: async () => { throw new Error('should not run'); },
    },
  });

  const result = await publisher.run();
  assert.equal(result.skipped, true);
  assert.match(result.reason, /規則/);
  assert.equal(sentMessages.length, 0);
});

test('publisher enforces confidence, evidence, topic, and exclusion gates', () => {
  const rule = cloneDefaultRule();
  const valid = {
    matches: true,
    confidence: 0.9,
    severity: 'critical',
    regionRelevance: 'global_major',
    matchedCriteria: ['zero_day'],
    matchedExclusions: [],
    evidence: ['摘要指出漏洞已遭實際利用'],
  };

  assert.equal(passesDecision(valid, rule), true);
  assert.equal(passesDecision({ ...valid, confidence: 0.7 }, rule), false);
  assert.equal(passesDecision({ ...valid, evidence: [] }, rule), false);
  assert.equal(passesDecision({ ...valid, matchedCriteria: ['data_breach'] }, rule), false);
  assert.equal(passesDecision({ ...valid, matchedExclusions: ['advertisement'] }, rule), false);
  assert.equal(passesDecision({ ...valid, severity: 'medium' }, rule), false);
  assert.equal(passesDecision({ ...valid, regionRelevance: 'other' }, rule), false);
});

test('publisher checks the AI provider without reading or writing state', async () => {
  let checks = 0;
  const stateStore = {
    kind: 'test',
    load: async () => { throw new Error('state should not be loaded'); },
    save: async () => { throw new Error('state should not be saved'); },
    close: async () => {},
  };
  const publisher = createPublisher({
    channel: { send: async () => {} },
    config: {
      aiBaseUrl: 'https://provider.example/v1',
      aiModel: 'provider-model',
    },
    stateStore,
    aiFilter: {
      evaluatorId: 'test-evaluator',
      async check() {
        checks += 1;
        return {
          httpStatus: 200,
          decision: { reason: 'Provider response' },
        };
      },
    },
  });

  const result = await publisher.checkAiProvider();
  assert.equal(checks, 1);
  assert.equal(result.ok, true);
  assert.equal(result.httpStatus, 200);
  assert.equal(result.providerMessage, 'Provider response');
  assert.equal(result.endpoint, 'provider.example');
  assert.equal(result.model, 'provider-model');
  assert.equal(result.evaluatorId, 'test-evaluator');
  assert.ok(result.latencyMs >= 0);
});
