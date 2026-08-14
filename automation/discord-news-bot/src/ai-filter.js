const { createHash } = require('node:crypto');
const { cloneDefaultRule, toAiRule } = require('./rule-options');

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

const DECISION_KEYS = Object.freeze([...DECISION_SCHEMA.required].sort());
const SEVERITIES = new Set(DECISION_SCHEMA.properties.severity.enum);
const REGIONS = new Set(DECISION_SCHEMA.properties.regionRelevance.enum);
const JSON_ONLY_INSTRUCTION = '只輸出符合指定 schema 的 JSON；不得加入 Markdown code fence 或任何說明文字。';
const PROVIDER_CHECK_ARTICLE = Object.freeze({
  id: 'provider-health-check',
  title: 'Critical remote code execution vulnerability actively exploited',
  summary: 'A critical remote code execution vulnerability is actively exploited in the wild.',
  categories: ['Vulnerability'],
  url: 'https://example.invalid/provider-health-check',
  published: new Date('2026-01-01T00:00:00Z'),
});

function isStringArray(value) {
  return Array.isArray(value)
    && value.length <= 5
    && value.every((item) => typeof item === 'string');
}

function validateDecision(decision) {
  if (!decision || typeof decision !== 'object' || Array.isArray(decision)) return false;
  if (JSON.stringify(Object.keys(decision).sort()) !== JSON.stringify(DECISION_KEYS)) return false;
  return typeof decision.matches === 'boolean'
    && Number.isFinite(decision.confidence)
    && decision.confidence >= 0
    && decision.confidence <= 1
    && SEVERITIES.has(decision.severity)
    && REGIONS.has(decision.regionRelevance)
    && typeof decision.reason === 'string'
    && isStringArray(decision.matchedCriteria)
    && isStringArray(decision.matchedExclusions)
    && isStringArray(decision.evidence);
}

function parseDecisionContent(content) {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    const detail = trimmed.replace(/\s+/g, ' ').slice(0, 300);
    throw new Error(`AI endpoint returned invalid JSON content${detail ? `: ${detail}` : ''}`);
  }
}

function extractCompletionContent(message) {
  if (typeof message?.content === 'string') return message.content;
  if (!Array.isArray(message?.content)) return '';
  return message.content
    .filter((part) => part?.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('\n');
}

function emptyCompletionError(payload) {
  const choice = payload?.choices?.[0];
  const details = [];
  if (choice?.finish_reason) details.push(`finish_reason=${choice.finish_reason}`);
  if (typeof choice?.message?.refusal === 'string' && choice.message.refusal.trim()) {
    details.push(`refusal=${choice.message.refusal.trim()}`);
  }
  const preview = JSON.stringify(payload).replace(/\s+/g, ' ').slice(0, 500);
  if (preview) details.push(`response=${preview}`);
  return new Error(`AI endpoint returned no chat completion content${details.length ? `: ${details.join('; ')}` : ''}`);
}

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
      max_tokens: config.aiMaxOutputTokens || 800,
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
  const content = extractCompletionContent(payload?.choices?.[0]?.message);
  if (!content.trim()) throw emptyCompletionError(payload);
  const decision = parseDecisionContent(content);
  if (!validateDecision(decision)) {
    throw new Error('AI endpoint response did not match the required decision schema');
  }
  return { decision, httpStatus: response.status };
}

function createAiFilter(config, fetchImpl = fetch) {
  if (config.aiFilteringEnabled !== true
      || !config.aiApiKey
      || !config.aiBaseUrl
      || !config.aiModel) return null;

  async function evaluate(article, rule) {
    const result = await requestCompletion(config, [
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
            JSON_ONLY_INSTRUCTION,
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
    return result.decision;
  }

  async function check() {
    const result = await requestCompletion(config, [
      {
        role: 'system',
        content: [
          'Evaluate the synthetic article using the supplied rule.',
          'Return only the JSON object required by the schema, without Markdown fences or explanatory text.',
        ].join(' '),
      },
      {
        role: 'user',
        content: JSON.stringify({
          filterRule: toAiRule(cloneDefaultRule()),
          article: {
            title: PROVIDER_CHECK_ARTICLE.title,
            summary: PROVIDER_CHECK_ARTICLE.summary,
            categories: PROVIDER_CHECK_ARTICLE.categories,
            sourceUrl: PROVIDER_CHECK_ARTICLE.url,
            publishedAt: PROVIDER_CHECK_ARTICLE.published.toISOString(),
          },
        }),
      },
    ], fetchImpl);
    return result;
  }

  return {
    evaluatorId: evaluatorId(config),
    evaluate,
    check,
  };
}

module.exports = {
  createAiFilter,
  chatCompletionsUrl,
  DECISION_SCHEMA,
  FILTER_CONTRACT_VERSION,
  extractCompletionContent,
  parseDecisionContent,
  validateDecision,
};
