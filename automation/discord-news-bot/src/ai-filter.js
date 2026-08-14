const { createHash } = require('node:crypto');
const { toAiRule } = require('./rule-options');

const FILTER_CONTRACT_VERSION = 'news-filter-v1';
const DECISION_SCHEMA = {
  type: 'object',
  properties: {
    matches: { type: 'boolean' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    severity: {
      type: 'string',
      enum: ['critical', 'high', 'medium', 'low', 'unknown'],
    },
    regionRelevance: {
      type: 'string',
      enum: ['taiwan', 'global_major', 'other', 'unknown'],
    },
    reason: { type: 'string' },
    matchedCriteria: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 5,
    },
    matchedExclusions: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 5,
    },
    evidence: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 5,
    },
  },
  required: [
    'matches',
    'confidence',
    'severity',
    'regionRelevance',
    'reason',
    'matchedCriteria',
    'matchedExclusions',
    'evidence',
  ],
  additionalProperties: false,
};

function chatCompletionsUrl(baseUrl) {
  const normalized = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return new URL('chat/completions', normalized).toString();
}

function evaluatorId(config) {
  const fingerprint = createHash('sha256')
    .update(`${FILTER_CONTRACT_VERSION}\n${config.aiBaseUrl}\n${config.aiModel}`)
    .digest('hex')
    .slice(0, 24);
  return `${FILTER_CONTRACT_VERSION}:${fingerprint}`;
}

async function requestCompletion(config, messages, fetchImpl) {
  const response = await fetchImpl(chatCompletionsUrl(config.aiBaseUrl), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${config.aiApiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: config.aiModel,
      messages,
      max_tokens: 300,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'news_filter_decision',
          strict: true,
          schema: DECISION_SCHEMA,
        },
      },
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    const detail = (await response.text()).replace(/\s+/g, ' ').slice(0, 300);
    throw new Error(`AI endpoint returned HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
  }
  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('AI endpoint returned no chat completion content');
  }
  return JSON.parse(content);
}

function createAiFilter(config, fetchImpl = fetch) {
  if (config.aiFilteringEnabled !== true
      || !config.aiApiKey
      || !config.aiBaseUrl
      || !config.aiModel) return null;

  return {
    evaluatorId: evaluatorId(config),
    async evaluate(article, rule) {
      return requestCompletion(config, [
        {
          role: 'system',
          content: [
            '你是嚴格的資安新聞篩選器。',
            '只能根據提供的標題、摘要、分類與規則判斷，不可猜測文章未提及的內容。',
            '規則不明確或證據不足時，matches 必須為 false。',
            'matchedCriteria 與 matchedExclusions 只能填入規則中提供的 id。',
            '沒有明確證據時 severity 或 regionRelevance 必須使用 unknown。',
            'evidence 必須是文章資料中可核對的簡短依據，不得捏造。',
            'reason 與 evidence 使用繁體中文，保持簡短。',
          ].join('\n'),
        },
        {
          role: 'user',
          content: JSON.stringify({
            filterRule: toAiRule(rule.config),
            article: {
              title: article.title,
              summary: article.summary,
              categories: article.categories,
              sourceUrl: article.url,
              publishedAt: article.published.toISOString(),
            },
          }),
        },
      ], fetchImpl);
    },
  };
}

module.exports = {
  createAiFilter,
  chatCompletionsUrl,
  DECISION_SCHEMA,
  FILTER_CONTRACT_VERSION,
};
