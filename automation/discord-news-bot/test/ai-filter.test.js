const test = require('node:test');
const assert = require('node:assert/strict');
const { createAiFilter } = require('../src/ai-filter');
const { cloneDefaultRule } = require('../src/rule-options');

test('AI filter requests a strict structured decision', async () => {
  let request;
  const client = {
    responses: {
      async create(payload) {
        request = payload;
        return {
          output_text: JSON.stringify({
            matches: true,
            confidence: 0.92,
            severity: 'critical',
            regionRelevance: 'global_major',
            reason: '符合重大漏洞規則',
            matchedCriteria: ['critical_vulnerability'],
            matchedExclusions: [],
            evidence: ['摘要指出遠端程式碼執行漏洞'],
          }),
        };
      },
    },
  };
  const filter = createAiFilter({
    aiFilteringEnabled: true,
    openaiApiKey: 'test-key',
    openaiModel: 'gpt-test',
    openaiBaseUrl: '',
  }, client);

  const decision = await filter.evaluate({
    title: 'Critical vulnerability',
    summary: 'A critical remote code execution vulnerability.',
    categories: ['Vulnerability'],
    url: 'https://example.com/article',
    published: new Date('2026-08-14T12:00:00Z'),
  }, { config: cloneDefaultRule() });

  assert.equal(decision.matches, true);
  assert.equal(request.model, 'gpt-test');
  assert.equal(request.text.format.type, 'json_schema');
  assert.equal(request.text.format.strict, true);
  assert.match(request.input[1].content, /critical_vulnerability/);
  assert.deepEqual(request.text.format.schema.required, [
    'matches',
    'confidence',
    'severity',
    'regionRelevance',
    'reason',
    'matchedCriteria',
    'matchedExclusions',
    'evidence',
  ]);
});

test('AI filter is unavailable when filtering or the API key is missing', () => {
  assert.equal(createAiFilter({ aiFilteringEnabled: false, openaiApiKey: 'key' }), null);
  assert.equal(createAiFilter({ aiFilteringEnabled: true, openaiApiKey: '' }), null);
});
