const { createHash } = require('node:crypto');
const { cloneDefaultRule, toAiRule } = require('./rule-options');

const FILTER_CONTRACT_VERSION = 'news-filter-v3';
const SCORE_SCHEMA = {
  type: 'object',
  properties: {
    practicalValue: { type: 'integer', minimum: 1, maximum: 5 },
    technicalDepth: { type: 'integer', minimum: 1, maximum: 5 },
    novelty: { type: 'integer', minimum: 1, maximum: 5 },
    discussionValue: { type: 'integer', minimum: 1, maximum: 5 },
  },
  required: ['practicalValue', 'technicalDepth', 'novelty', 'discussionValue'],
  additionalProperties: false,
};
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
    readingRecommendation: {
      type: 'string',
      enum: ['must_read', 'recommended', 'skim', 'skip'],
    },
    difficulty: {
      type: 'string',
      enum: ['beginner', 'intermediate', 'advanced', 'specialist'],
    },
    summaryBullets: {
      type: 'array',
      items: { type: 'string' },
      minItems: 2,
      maxItems: 4,
    },
    whyRead: { type: 'string' },
    prerequisites: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 4,
    },
    researchRelevance: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          area: { type: 'string' },
          relevance: { type: 'string', enum: ['high', 'medium', 'low'] },
          reason: { type: 'string' },
        },
        required: ['area', 'relevance', 'reason'],
        additionalProperties: false,
      },
      maxItems: 10,
    },
    discussionQuestions: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 2,
    },
    scores: SCORE_SCHEMA,
    matchedCriteria: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 5,
    },
    matchedTechnologies: {
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
    'readingRecommendation',
    'difficulty',
    'summaryBullets',
    'whyRead',
    'prerequisites',
    'researchRelevance',
    'discussionQuestions',
    'scores',
    'matchedCriteria',
    'matchedTechnologies',
    'matchedExclusions',
    'evidence',
  ],
  additionalProperties: false,
};

const DECISION_KEYS = Object.freeze([...DECISION_SCHEMA.required].sort());
const SEVERITIES = new Set(DECISION_SCHEMA.properties.severity.enum);
const REGIONS = new Set(DECISION_SCHEMA.properties.regionRelevance.enum);
const RECOMMENDATIONS = new Set(DECISION_SCHEMA.properties.readingRecommendation.enum);
const DIFFICULTIES = new Set(DECISION_SCHEMA.properties.difficulty.enum);
const RELEVANCE_LEVELS = new Set(['high', 'medium', 'low']);
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

function isScore(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (JSON.stringify(Object.keys(value).sort())
      !== JSON.stringify(SCORE_SCHEMA.required.slice().sort())) return false;
  return SCORE_SCHEMA.required.every((key) => Number.isInteger(value[key])
    && value[key] >= 1 && value[key] <= 5);
}

function isResearchRelevance(value) {
  return Array.isArray(value)
    && value.length <= 10
    && value.every((item) => item
      && typeof item === 'object'
      && !Array.isArray(item)
      && JSON.stringify(Object.keys(item).sort()) === JSON.stringify(['area', 'reason', 'relevance'])
      && typeof item.area === 'string'
      && RELEVANCE_LEVELS.has(item.relevance)
      && typeof item.reason === 'string');
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
    && RECOMMENDATIONS.has(decision.readingRecommendation)
    && DIFFICULTIES.has(decision.difficulty)
    && isStringArray(decision.summaryBullets)
    && decision.summaryBullets.length >= 2
    && typeof decision.whyRead === 'string'
    && isStringArray(decision.prerequisites)
    && isResearchRelevance(decision.researchRelevance)
    && isStringArray(decision.discussionQuestions)
    && isScore(decision.scores)
    && isStringArray(decision.matchedCriteria)
    && isStringArray(decision.matchedTechnologies)
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
      max_tokens: config.aiMaxOutputTokens || 1600,
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
            '你是嚴格的資安新聞篩選器與資安讀書會編輯。',
            '只能根據提供的標題、文章內容、分類與規則判斷，不可猜測文章未提及的內容。',
            '規則不明確或證據不足時，matches 必須為 false。',
            'matchedCriteria、matchedTechnologies 與 matchedExclusions 只能填入規則中提供的 id。',
            'matchedCriteria 描述事件類型；matchedTechnologies 描述文章明確影響的技術領域。',
            '技術規則為 any 時仍須辨識明確技術，但不可將 any 放入 matchedTechnologies。',
            '沒有明確證據時 severity 或 regionRelevance 必須使用 unknown。',
            'evidence 必須是文章資料中可核對的簡短依據，不得捏造。',
            'researchRelevance 只能使用規則提供的研究方向 id；僅列出確實相關的方向。',
            'summaryBullets 要讓成員快速掌握事件、技術重點與影響，不得只是改寫標題。',
            'whyRead 說明投入閱讀時間能得到什麼；資訊不足時應明確說明限制。',
            'difficulty 依理解文章所需的先備知識判斷；prerequisites 列出必要知識。',
            'scores 的每一項使用 1 到 5 分；不得因 matches=true 就一律給高分。',
            'discussionQuestions 必須能促進技術討論，最多兩題。',
            '所有自然語言欄位使用繁體中文，保持具體而簡短。',
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
              content: article.analysisText || article.summary,
              contentDepth: article.contentDepth || 'summary_only',
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
            content: PROVIDER_CHECK_ARTICLE.summary,
            contentDepth: 'summary_only',
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
