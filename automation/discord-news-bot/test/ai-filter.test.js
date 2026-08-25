const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createAiFilter, minimumRequestIntervalMs, safeRejectedDecision, validateDecision,
} = require('../src/ai-filter');
const { cloneDefaultRule } = require('../src/rule-options');

function completeDecision(overrides = {}) {
  return {
    matches: true,
    confidence: 0.95,
    severity: 'critical',
    regionRelevance: 'global_major',
    reason: '符合重大漏洞規則',
    readingRecommendation: 'must_read',
    headline: '重大遠端程式碼執行漏洞已遭利用',
    publicSummary: '八月中旬，研究團隊在檢查公開伺服器時發現異常連線，追查後確認攻擊者先利用對外服務的遠端程式碼執行漏洞送入惡意指令，再由服務行程下載並啟動植入程式，最終取得受感染主機的系統權限。調查人員確認異常程序與新增帳號後，已將受感染主機隔離並保存證據。',
    technicalFocus: ['遠端程式碼執行', '服務行程植入'],
    technicalOutcome: '攻擊者完成攻擊鏈後，能以對外服務的執行權限植入惡意程式，並進一步取得受感染主機的系統控制權。',
    attackChainGroups: [{
      title: '漏洞如何轉成系統控制權',
      steps: [
        { stage: '探測入口', action: '攻擊者尋找公開服務', mechanism: '以特製請求確認漏洞端點', result: '找出可接收惡意輸入的伺服器' },
        { stage: '觸發漏洞', action: '攻擊者送入惡意資料', mechanism: '服務錯誤處理輸入並執行指令', result: '攻擊者取得服務行程的程式碼執行能力' },
        { stage: '投放程式', action: '服務行程下載植入程式', mechanism: '惡意指令從遠端位置取得檔案', result: '惡意程式進入受感染主機' },
        { stage: '取得權限', action: '植入程式建立控制管道', mechanism: '程式在主機上啟動並建立帳號', result: '攻擊者取得受感染主機的系統權限' },
      ],
    }],
    evidenceBoundaries: [
      { status: 'confirmed_capability', claim: '漏洞可讓攻擊者在服務行程中執行指令' },
      { status: 'confirmed_victim', claim: '調查已在受感染主機發現惡意程式與新增帳號' },
    ],
    exploitationStatus: 'confirmed_exploitation',
    confirmedConsequences: ['攻擊者已取得受感染主機的系統權限', '受感染主機已遭隔離'],
    difficulty: 'advanced',
    researchRelevance: [{
      area: 'vulnerability_research', relevance: 'high', reason: '包含漏洞技術細節',
    }],
    matchedCriteria: ['critical_vulnerability'],
    matchedTechnologies: ['endpoint_os'],
    matchedExclusions: [],
    evidence: ['摘要指出遠端程式碼執行漏洞'],
    ...overrides,
  };
}

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
              content: JSON.stringify(completeDecision({ confidence: 0.92 })),
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
  assert.equal(request.body.max_tokens, 800);
  assert.equal(request.body.response_format.type, 'json_schema');
  assert.equal(request.body.response_format.json_schema.strict, true);
  assert.equal(request.body.response_format.json_schema.schema.properties.headline.minLength, undefined);
  assert.equal(request.body.response_format.json_schema.schema.properties.publicSummary.minLength, undefined);
  assert.equal(request.body.response_format.json_schema.schema.properties.confirmedConsequences.minItems, undefined);
  assert.match(request.body.messages[1].content, /critical_vulnerability/);
  assert.match(request.body.messages[0].content, /confirmedConsequences/);
  assert.match(request.body.messages[0].content, /不得推演未來/);
  assert.ok(filter.evaluatorId.startsWith('news-filter-v8:'));
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

test('AI filter reserves answer space and lowers reasoning for GPT-OSS models', async () => {
  let request;
  const filter = createAiFilter({
    aiFilteringEnabled: true,
    aiApiKey: 'test-key',
    aiModel: 'openai/gpt-oss-20b',
    aiBaseUrl: 'https://provider.example/v1',
    aiMaxOutputTokens: 800,
  }, async (_url, options) => {
    request = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      async json() {
        return { choices: [{ message: { content: JSON.stringify(completeDecision()) } }] };
      },
    };
  });

  await filter.check();
  assert.equal(request.reasoning_effort, 'low');
  assert.equal(request.max_tokens, 2400);
});

test('AI filter paces GPT-OSS requests below the free token limit', () => {
  assert.equal(minimumRequestIntervalMs({ aiModel: 'openai/gpt-oss-20b' }), 45_000);
  assert.equal(minimumRequestIntervalMs({ aiModel: 'provider-model' }), 0);
});

test('AI filter provider check returns HTTP status and provider message', async () => {
  let calls = 0;
  const filter = createAiFilter({
    aiFilteringEnabled: true,
    aiApiKey: 'test-key',
    aiModel: 'provider-model',
    aiBaseUrl: 'https://provider.example/v1',
  }, async () => {
    calls += 1;
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          choices: [{
            message: {
              content: JSON.stringify(completeDecision({
                reason: 'Synthetic check passed',
                evidence: ['The summary states active exploitation'],
              })),
            },
          }],
        };
      },
    };
  });

  const result = await filter.check();
  assert.equal(calls, 1);
  assert.equal(result.httpStatus, 200);
  assert.equal(result.decision.reason, 'Synthetic check passed');
});

test('AI filter accepts a complete JSON decision wrapped in a Markdown fence', async () => {
  const decision = completeDecision({ reason: 'Fenced response', evidence: ['Synthetic evidence'] });
  const filter = createAiFilter({
    aiFilteringEnabled: true,
    aiApiKey: 'test-key',
    aiModel: 'provider-model',
    aiBaseUrl: 'https://provider.example/v1',
  }, async () => ({
    ok: true,
    status: 200,
    async json() {
      return {
        choices: [{ message: { content: `\`\`\`json\n${JSON.stringify(decision)}\n\`\`\`` } }],
      };
    },
  }));

  assert.deepEqual((await filter.check()).decision, decision);
});

test('AI filter preserves invalid model content in parse errors', async () => {
  const filter = createAiFilter({
    aiFilteringEnabled: true,
    aiApiKey: 'test-key',
    aiModel: 'provider-model',
    aiBaseUrl: 'https://provider.example/v1',
  }, async () => ({
    ok: true,
    status: 200,
    async json() {
      return {
        choices: [{ message: { content: 'I cannot produce the requested JSON.' } }],
      };
    },
  }));

  await assert.rejects(filter.check(), /invalid JSON content: I cannot produce/);
});

test('AI filter accepts text content parts from compatible endpoints', async () => {
  const decision = completeDecision({
    matches: false,
    severity: 'unknown',
    regionRelevance: 'unknown',
    reason: 'No match',
    readingRecommendation: 'skip',
    headline: '',
    publicSummary: '',
    technicalFocus: [],
    technicalOutcome: '',
    attackChainGroups: [],
    evidenceBoundaries: [],
    exploitationStatus: 'not_reported',
    confirmedConsequences: [],
    matchedCriteria: [],
    matchedTechnologies: [],
    researchRelevance: [],
  });
  const filter = createAiFilter({
    aiFilteringEnabled: true,
    aiApiKey: 'test-key',
    aiModel: 'provider-model',
    aiBaseUrl: 'https://provider.example/v1',
  }, async () => ({
    ok: true,
    status: 200,
    async json() {
      return {
        choices: [{ message: { content: [{ type: 'text', text: JSON.stringify(decision) }] } }],
      };
    },
  }));

  assert.deepEqual((await filter.check()).decision, decision);
});

test('AI filter preserves finish reason and payload when completion content is empty', async () => {
  const filter = createAiFilter({
    aiFilteringEnabled: true,
    aiApiKey: 'test-key',
    aiModel: 'provider-model',
    aiBaseUrl: 'https://provider.example/v1',
  }, async () => ({
    ok: true,
    status: 200,
    async json() {
      return {
        choices: [{
          finish_reason: 'length',
          message: { content: '', reasoning_content: 'Still reasoning' },
        }],
      };
    },
  }));

  await assert.rejects(filter.check(), /finish_reason=length.*reasoning_content/);
});

test('AI filter rejects provider output that violates the decision schema', async () => {
  const filter = createAiFilter({
    aiFilteringEnabled: true,
    aiApiKey: 'test-key',
    aiModel: 'provider-model',
    aiBaseUrl: 'https://provider.example/v1',
  }, async () => ({
    ok: true,
    status: 200,
    async json() {
      return {
        choices: [{ message: { content: JSON.stringify({ matches: 'yes' }) } }],
      };
    },
  }));

  await assert.rejects(filter.check(), /required decision schema/);
});

test('AI filter safely rejects malformed article evaluations and caches a valid decision', async () => {
  const filter = createAiFilter({
    aiFilteringEnabled: true,
    aiApiKey: 'test-key',
    aiModel: 'provider-model',
    aiBaseUrl: 'https://provider.example/v1',
  }, async () => ({
    ok: true,
    status: 200,
    async json() {
      return { choices: [{ message: { content: JSON.stringify({ matches: 'yes' }) } }] };
    },
  }));
  const originalWarn = console.warn;
  let warning = '';
  console.warn = (message) => { warning = message; };
  let decision;
  try {
    decision = await filter.evaluate({
      id: 'malformed-article',
      title: 'Malformed provider output',
      summary: 'Summary',
      categories: [],
      url: 'https://example.com/article',
      published: new Date('2026-08-25T00:00:00Z'),
    }, { config: cloneDefaultRule() });
  } finally {
    console.warn = originalWarn;
  }

  assert.deepEqual(decision, safeRejectedDecision());
  assert.equal(validateDecision(decision), true);
  assert.match(warning, /malformed-article.*required decision schema/);
});

test('AI filter rejects English, list-formatted, and encoded public copy', () => {
  assert.equal(validateDecision(completeDecision({ headline: 'Critical security update' })), false);
  assert.equal(validateDecision(completeDecision({
    publicSummary: '- 攻擊者正在利用漏洞。\n- 文章提供防禦方式，能協助研究者安排曝險檢查。',
  })), false);
  assert.equal(validateDecision(completeDecision({
    publicSummary: '攻擊者正在利用漏洞&amp;#x20;入侵公開系統，文章提供防禦方式與偵測線索，能協助研究者安排曝險檢查。',
  })), false);
  assert.equal(validateDecision(completeDecision({ confirmedConsequences: [] })), false);
  assert.equal(validateDecision(completeDecision({ exploitationStatus: 'assumed_safe' })), false);
});

test('AI filter accepts empty public copy for an article that will not be published', () => {
  assert.equal(validateDecision(completeDecision({
    matches: false,
    readingRecommendation: 'skip',
    headline: '',
    publicSummary: '',
    technicalFocus: [],
    technicalOutcome: '',
    attackChainGroups: [],
    evidenceBoundaries: [],
    exploitationStatus: 'not_reported',
    confirmedConsequences: [],
    researchRelevance: [],
    matchedCriteria: [],
    matchedTechnologies: [],
    evidence: [],
  })), true);
});

test('AI filter still requires complete public copy for must-read articles', () => {
  assert.equal(validateDecision(completeDecision({ headline: '' })), false);
  assert.equal(validateDecision(completeDecision({ publicSummary: '' })), false);
  assert.equal(validateDecision(completeDecision({ confirmedConsequences: [] })), false);
});

test('AI filter preserves provider HTTP errors and response messages', async () => {
  const filter = createAiFilter({
    aiFilteringEnabled: true,
    aiApiKey: 'test-key',
    aiModel: 'provider-model',
    aiBaseUrl: 'https://provider.example/v1',
  }, async () => ({
    ok: false,
    status: 429,
    text: async () => '{"error":"rate limit reached"}',
  }));

  await assert.rejects(filter.check(), /HTTP 429.*rate limit reached/);
});

test('AI filter retries locally validated JSON when strict generation fails', async () => {
  const requests = [];
  const filter = createAiFilter({
    aiFilteringEnabled: true,
    aiApiKey: 'test-key',
    aiModel: 'provider-model',
    aiBaseUrl: 'https://provider.example/v1',
  }, async (_url, options) => {
    requests.push(JSON.parse(options.body));
    if (requests.length === 1) {
      return {
        ok: false,
        status: 400,
        text: async () => '{"error":{"code":"json_validate_failed","message":"Failed to validate JSON"}}',
      };
    }
    return {
      ok: true,
      status: 200,
      async json() {
        return { choices: [{ message: { content: JSON.stringify(completeDecision()) } }] };
      },
    };
  });

  const result = await filter.check();
  assert.equal(result.httpStatus, 200);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].response_format.type, 'json_schema');
  assert.equal(requests[1].response_format, undefined);
  assert.equal(validateDecision(result.decision), true);

  await filter.check();
  assert.equal(requests.length, 3);
  assert.equal(requests[2].response_format, undefined);
});

test('AI filter retries once after an explicit provider rate-limit delay', async () => {
  let calls = 0;
  const filter = createAiFilter({
    aiFilteringEnabled: true,
    aiApiKey: 'test-key',
    aiModel: 'provider-model',
    aiBaseUrl: 'https://provider.example/v1',
  }, async () => {
    calls += 1;
    if (calls === 1) {
      return {
        ok: false,
        status: 429,
        text: async () => '{"error":{"message":"Please try again in 0.001s"}}',
      };
    }
    return {
      ok: true,
      status: 200,
      async json() {
        return { choices: [{ message: { content: JSON.stringify(completeDecision()) } }] };
      },
    };
  });

  assert.equal((await filter.check()).httpStatus, 200);
  assert.equal(calls, 2);
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
