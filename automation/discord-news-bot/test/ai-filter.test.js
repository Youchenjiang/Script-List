const test = require('node:test');
const assert = require('node:assert/strict');
const { createAiFilter } = require('../src/ai-filter');
const { cloneDefaultRule } = require('../src/rule-options');

test('AI filter uses a generic chat completions endpoint and strict JSON schema', async () => {
  let request;
  const fetchImpl = async (url, options) => {
    request = { url, options, body: JSON.parse(options.body) };
    return {
      ok: true,
      async json() {
        return {
          choices: [{
            message: {
              content: JSON.stringify({
                matches: true,
                confidence: 0.92,
                severity: 'critical',
                regionRelevance: 'global_major',
                reason: '符合重大漏洞規則',
                matchedCriteria: ['critical_vulnerability'],
                matchedExclusions: [],
                evidence: ['摘要指出遠端程式碼執行漏洞'],
              }),
            },
          }],
        };
      },
    };
  };
  const filter = createAiFilter({
    aiFilteringEnabled: true,
    aiApiKey: 'test-key',
    aiModel: 'provider-model',
    aiBaseUrl: 'https://provider.example/v1',
  }, fetchImpl);

  const decision = await filter.evaluate({
    title: 'Critical vulnerability',
    summary: 'A critical remote code execution vulnerability.',
    categories: ['Vulnerability'],
    url: 'https://example.com/article',
    published: new Date('2026-08-14T12:00:00Z'),
  }, { config: cloneDefaultRule() });

  assert.equal(decision.matches, true);
  assert.equal(request.url, 'https://provider.example/v1/chat/completions');
  assert.equal(request.options.headers.authorization, 'Bearer test-key');
  assert.equal(request.body.model, 'provider-model');
  assert.equal(request.body.response_format.type, 'json_schema');
  assert.equal(request.body.response_format.json_schema.strict, true);
  assert.match(request.body.messages[1].content, /critical_vulnerability/);
  assert.ok(filter.evaluatorId.startsWith('news-filter-v1:'));
});

test('AI filter fingerprint changes with endpoint or model', () => {
  const base = { aiFilteringEnabled: true, aiApiKey: 'key' };
  const first = createAiFilter({
    ...base,
    aiBaseUrl: 'https://one.example/v1',
    aiModel: 'model-a',
  });
  const second = createAiFilter({
    ...base,
    aiBaseUrl: 'https://two.example/v1',
    aiModel: 'model-a',
  });
  const third = createAiFilter({
    ...base,
    aiBaseUrl: 'https://one.example/v1',
    aiModel: 'model-b',
  });

  assert.notEqual(first.evaluatorId, second.evaluatorId);
  assert.notEqual(first.evaluatorId, third.evaluatorId);
});

test('AI filter is unavailable when a required generic setting is missing', () => {
  const complete = {
    aiFilteringEnabled: true,
    aiApiKey: 'key',
    aiBaseUrl: 'https://provider.example/v1',
    aiModel: 'model',
  };
  assert.equal(createAiFilter({ ...complete, aiFilteringEnabled: false }), null);
  assert.equal(createAiFilter({ ...complete, aiApiKey: '' }), null);
  assert.equal(createAiFilter({ ...complete, aiBaseUrl: '' }), null);
  assert.equal(createAiFilter({ ...complete, aiModel: '' }), null);
});
