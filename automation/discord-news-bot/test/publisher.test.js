const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const {
  createNewsMessage,
  createPublisher,
  createTechnicalDetailReply,
  newsDetailKey,
  passesDecision,
} = require('../src/publisher');
const { cloneDefaultRule } = require('../src/rule-options');

function richDecision(overrides = {}) {
  return {
    matches: true,
    confidence: 0.95,
    severity: 'critical',
    regionRelevance: 'global_major',
    reason: '符合重大漏洞條件',
    readingRecommendation: 'must_read',
    headline: '重大身分驗證漏洞已遭利用',
    publicSummary: '八月中旬，研究團隊在檢查公開管理介面時發現異常登入，追查後確認攻擊者先利用身分驗證缺陷取得服務存取權，再透過管理介面建立高權限帳號，最終控制受感染伺服器。調查人員確認異常帳號與操作紀錄後，已將受感染伺服器隔離並保存相關證據。',
    technicalFocus: ['身分驗證缺陷', '高權限帳號建立'],
    technicalOutcome: '攻擊者完成攻擊鏈後取得管理權限，並在受感染伺服器建立可持續存取的高權限帳號。',
    attackChainGroups: [{
      title: '驗證缺陷如何轉成管理權限',
      steps: [
        { stage: '鎖定介面', action: '攻擊者探測公開管理介面', mechanism: '以特製請求辨認身分驗證端點', result: '找到可接受惡意輸入的入口' },
        { stage: '繞過檢查', action: '攻擊者送入異常驗證資料', mechanism: '服務錯誤接受未授權的驗證狀態', result: '攻擊者取得管理介面存取權' },
        { stage: '建立帳號', action: '攻擊者新增高權限帳號', mechanism: '利用已取得的管理功能修改帳號資料', result: '產生可持續登入的管理身分' },
        { stage: '控制系統', action: '攻擊者使用新帳號操作伺服器', mechanism: '管理權限允許修改系統設定', result: '受感染伺服器遭攻擊者控制' },
      ],
    }],
    evidenceBoundaries: [
      { status: 'confirmed_capability', claim: '驗證缺陷可讓未授權使用者進入管理介面' },
      { status: 'confirmed_victim', claim: '受感染伺服器已發現攻擊者建立的高權限帳號' },
    ],
    exploitationStatus: 'confirmed_exploitation',
    confirmedConsequences: ['攻擊者已取得管理權限', '攻擊者已建立新帳號'],
    difficulty: 'advanced',
    researchRelevance: [{
      area: 'vulnerability_research', relevance: 'high', reason: '提供漏洞成因資訊',
    }],
    matchedCriteria: ['critical_vulnerability'],
    matchedTechnologies: ['endpoint_os'],
    matchedExclusions: [],
    evidence: ['文章指出漏洞已遭利用'],
    ...overrides,
  };
}

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
  const savedDetails = new Map();
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
    saveNewsDetail: async (detailKey, detail) => savedDetails.set(detailKey, detail),
    getNewsDetail: async (detailKey) => savedDetails.get(detailKey) || null,
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
        return richDecision({ matches: article.id === 'match', confidence: 1 });
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
  assert.equal(savedDetails.size, 1);
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
    readingRecommendation: 'must_read',
    confidence: 0.9,
    severity: 'critical',
    regionRelevance: 'global_major',
    matchedCriteria: ['zero_day'],
    matchedTechnologies: ['endpoint_os'],
    matchedExclusions: [],
    evidence: ['摘要指出漏洞已遭實際利用'],
  };

  assert.equal(passesDecision(valid, rule), true);
  assert.equal(passesDecision({ ...valid, readingRecommendation: 'recommended' }, rule), false);
  assert.equal(passesDecision({ ...valid, confidence: 0.7 }, rule), false);
  assert.equal(passesDecision({ ...valid, evidence: [] }, rule), false);
  assert.equal(passesDecision({ ...valid, matchedCriteria: ['data_breach'] }, rule), false);
  assert.equal(passesDecision({ ...valid, matchedTechnologies: null }, rule), false);
  assert.equal(passesDecision({ ...valid, matchedExclusions: ['advertisement'] }, rule), false);
  assert.equal(passesDecision({ ...valid, severity: 'medium' }, rule), false);
  assert.equal(passesDecision({ ...valid, regionRelevance: 'other' }, rule), false);

  const cloudRule = { ...rule, technologies: ['cloud_containers'] };
  assert.equal(passesDecision(valid, cloudRule), false);
  assert.equal(passesDecision({ ...valid, matchedTechnologies: ['cloud_containers'] }, cloudRule), true);
});

test('publisher renders a concise public card with useful technical metadata', () => {
  const article = {
    url: 'https://example.com/article',
    title: 'Critical OAuth vulnerability',
    summary: 'Original summary',
    published: new Date('2026-08-14T08:00:00Z'),
    author: 'Researcher',
    categories: ['Security'],
    imageUrl: '',
    contentDepth: 'feed_content',
  };
  const rule = cloneDefaultRule();
  const message = createNewsMessage(article, 'Test', richDecision({
    matchedTechnologies: ['identity_access'],
    researchRelevance: [{
      area: 'cloud_identity_security', relevance: 'high', reason: '涉及 OAuth 權杖驗證',
    }],
  }), rule, 'detail-key');
  const embed = message.embeds[0].toJSON();

  assert.equal(message.content, undefined);
  assert.equal(embed.title, '重大身分驗證漏洞已遭利用');
  assert.match(embed.description, /研究團隊.*發現.*攻擊者先利用/);
  assert.match(embed.fields[0].value, /身分驗證缺陷/);
  assert.equal(embed.fields[1].value, '進階');
  assert.equal(embed.footer.text, '來源：Test');
  const components = message.components[0].toJSON().components;
  assert.equal(components[0].custom_id, 'news_detail:detail-key');
  assert.equal(components[0].label, '查看技術細節');
  assert.equal(components[1].url, article.url);
  assert.equal(embed.author, undefined);
});

test('publisher omits research metadata when there is no clear shared relevance', () => {
  const article = {
    url: 'https://example.com/article', title: 'Security news', summary: 'Summary',
    published: new Date('2026-08-14T08:00:00Z'), author: '', categories: [], imageUrl: '',
    contentDepth: 'summary_only',
  };
  const message = createNewsMessage(article, 'Test', richDecision({
    researchRelevance: [],
  }), cloneDefaultRule(), 'detail-key');
  const embed = message.embeds[0].toJSON();

  assert.doesNotMatch(embed.footer.text, /相關：/);
});

test('technical detail reply presents a complete ordered chain without creating a thread', () => {
  const decision = richDecision();
  const reply = createTechnicalDetailReply({
    ...decision,
    articleUrl: 'https://example.com/article',
    sourceName: 'Test',
  });
  const embeds = reply.embeds.map((embed) => embed.toJSON());

  assert.ok(reply.flags);
  assert.match(embeds[0].description, /最後造成的結果.*管理權限/s);
  assert.match(embeds[0].fields[2].value, /漏洞研究與利用.*漏洞成因資訊/);
  assert.match(embeds[0].fields[3].value, /已證實能力/);
  assert.match(embeds[1].description, /1｜鎖定介面/);
  assert.match(embeds[1].description, /動作：.*探測公開管理介面/);
  assert.match(embeds[1].description, /機制：.*身分驗證端點/);
  assert.match(embeds[1].description, /結果：.*惡意輸入的入口/);
  assert.equal(reply.components[0].toJSON().components[0].url, 'https://example.com/article');
});

test('news detail keys are stable, short, and scoped to the rule version', () => {
  const first = newsDetailKey('evaluation', 'channel', 1);
  assert.equal(first, newsDetailKey('evaluation', 'channel', 1));
  assert.notEqual(first, newsDetailKey('evaluation', 'channel', 2));
  assert.equal(first.length, 24);
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
