const OpenAI = require('openai');
const { toAiRule } = require('./rule-options');

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

function createAiFilter(config, client) {
  if (config.aiFilteringEnabled !== true || !config.openaiApiKey) return null;

  const openai = client || new OpenAI({
    apiKey: config.openaiApiKey,
    ...(config.openaiBaseUrl ? { baseURL: config.openaiBaseUrl } : {}),
    timeout: 20_000,
    maxRetries: 2,
  });

  return {
    async evaluate(article, rule) {
      const response = await openai.responses.create({
        model: config.openaiModel,
        input: [
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
        ],
        max_output_tokens: 300,
        text: {
          format: {
            type: 'json_schema',
            name: 'news_filter_decision',
            strict: true,
            schema: DECISION_SCHEMA,
          },
        },
      });

      if (!response.output_text) throw new Error('OpenAI returned no filter decision');
      return JSON.parse(response.output_text);
    },
  };
}

module.exports = { createAiFilter, DECISION_SCHEMA };
