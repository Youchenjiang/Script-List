const { createHash } = require('node:crypto');
const { cloneDefaultRule, toAiRule } = require('./rule-options');

const FILTER_CONTRACT_VERSION = 'news-filter-v6';
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
    headline: { type: 'string', maxLength: 80 },
    narrativeSummary: { type: 'string', maxLength: 420 },
    exploitationStatus: {
      type: 'string',
      enum: [
        'confirmed_exploitation',
        'attempted_exploitation',
        'no_confirmed_exploitation',
        'not_reported',
      ],
    },
    confirmedConsequences: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 4,
    },
    difficulty: {
      type: 'string',
      enum: ['beginner', 'intermediate', 'advanced', 'specialist'],
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
    'headline',
    'narrativeSummary',
    'exploitationStatus',
    'confirmedConsequences',
    'difficulty',
    'researchRelevance',
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
const EXPLOITATION_STATUSES = new Set(DECISION_SCHEMA.properties.exploitationStatus.enum);
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

function isStringArray(value, maxItems = 5) {
  return Array.isArray(value)
    && value.length <= maxItems
    && value.every((item) => typeof item === 'string');
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

function isChineseDisplayText(value, { narrative = false } = {}) {
  return typeof value === 'string'
    && /[\u3400-\u9fff]/u.test(value)
    && !/&(?:#x?[0-9a-f]+|[a-z]+);/iu.test(value)
    && (!narrative || (!/[\r\n]/u.test(value) && !/^\s*[-*•]\s+/mu.test(value)));
}

function validateDecision(decision) {
  if (!decision || typeof decision !== 'object' || Array.isArray(decision)) return false;
  if (JSON.stringify(Object.keys(decision).sort()) !== JSON.stringify(DECISION_KEYS)) return false;
  const validShape = typeof decision.matches === 'boolean'
    && Number.isFinite(decision.confidence)
    && decision.confidence >= 0
    && decision.confidence <= 1
    && SEVERITIES.has(decision.severity)
    && REGIONS.has(decision.regionRelevance)
    && typeof decision.reason === 'string'
    && RECOMMENDATIONS.has(decision.readingRecommendation)
    && typeof decision.headline === 'string'
    && decision.headline.length <= 80
    && typeof decision.narrativeSummary === 'string'
    && decision.narrativeSummary.length <= 420
    && EXPLOITATION_STATUSES.has(decision.exploitationStatus)
    && isStringArray(decision.confirmedConsequences, 4)
    && DIFFICULTIES.has(decision.difficulty)
    && isResearchRelevance(decision.researchRelevance)
    && isStringArray(decision.matchedCriteria)
    && isStringArray(decision.matchedTechnologies)
    && isStringArray(decision.matchedExclusions)
    && isStringArray(decision.evidence);

  if (!validShape) return false;
  if (decision.readingRecommendation !== 'must_read') return true;

  return isChineseDisplayText(decision.headline)
    && decision.headline.trim().length >= 4
    && isChineseDisplayText(decision.narrativeSummary, { narrative: true })
    && decision.narrativeSummary.trim().length >= 40
    && decision.confirmedConsequences.length >= 1;
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

async function sendCompletion(config, messages, fetchImpl, { strictSchema }) {
  const body = {
    model: config.aiModel,
    messages,
    max_tokens: config.aiMaxOutputTokens || 800,
  };
  if (strictSchema) {
    body.response_format = {
      type: 'json_schema',
      json_schema: {
        name: 'news_filter_decision',
        strict: true,
        schema: DECISION_SCHEMA,
      },
    };
  }

  return fetchImpl(chatCompletionsUrl(config.aiBaseUrl), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${config.aiApiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
}

async function requestCompletion(config, messages, fetchImpl) {
  let response = await sendCompletion(config, messages, fetchImpl, { strictSchema: true });

  if (!response.ok) {
    const detail = (await response.text()).replace(/\s+/g, ' ').slice(0, 300);
    const structuredOutputFailed = response.status === 400
      && /json_validate_failed|failed to validate json|generated json does not match/iu.test(detail);
    if (!structuredOutputFailed) {
      throw new Error(`AI endpoint returned HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
    }

    response = await sendCompletion(config, messages, fetchImpl, { strictSchema: false });
    if (!response.ok) {
      const fallbackDetail = (await response.text()).replace(/\s+/g, ' ').slice(0, 300);
      throw new Error(`AI endpoint returned HTTP ${response.status}${fallbackDetail ? `: ${fallbackDetail}` : ''}`);
    }
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
            'readingRecommendation 只有在文章提供足夠具體事實，可以完整交代一次重要資安事件時才使用 must_read。',
            'must_read 必須具備明確證據，且至少符合以下一項：正在遭利用或造成重大影響；提出可實作的新技術或防禦方法；直接改變研究方向的重要背景。',
            '一般漏洞公告、產品宣傳、重複報導、增量更新或缺少技術內容的文章不得標為 must_read。',
            'readingRecommendation 不是 must_read 時，headline 與 narrativeSummary 必須是空字串，confirmedConsequences 必須是空陣列；不要替不會推送的文章撰寫公開文案。',
            '只有 must_read 才填寫 headline、narrativeSummary 與 confirmedConsequences。headline 使用自然的繁體中文新聞標題，不照抄英文標題。',
            'must_read 的 confirmedConsequences 至少列出一項文章明確證實的結果，例如後門實際具備的能力、已遭入侵的組織、被竊取的資料、服務中斷，或事件公開後已完成的撤回與封鎖。不得填入預測。',
            'exploitationStatus 只能依文章明說的狀態判斷；文章明確表示尚無成功利用證據時才用 no_confirmed_exploitation，沒有交代就用 not_reported。',
            'narrativeSummary 只寫一個連貫段落，不使用列點、標題或欄位名稱，並依事件發生順序敘述。',
            '開頭先用文章提供的時間、人物或組織、地點或系統，以及事件背景建立場景；缺少的資訊直接省略，不得以「某人」「某公司」代替或自行補寫。',
            '接著寫發現或攻擊經過、關鍵技術機制、confirmedConsequences 中的實際結果，以及事件當下已確認的收尾。',
            '後門或漏洞已證實具備的能力必須明確寫出；同時要區分「具備入侵能力」與「已有受害者」兩件事。',
            '不得推演未來可能影響的對象或範圍，不得提供處置建議、研究建議、閱讀價值或防禦清單。',
            '若 exploitationStatus 是 no_confirmed_exploitation，敘事必須明確寫出尚無已知成功利用；若是 not_reported，則不得聲稱沒有受害者。',
            'narrativeSummary 不得重複 headline，也不得另外寫「值得讀」「閱讀判斷」「摘要」等標籤。',
            '除產品名稱、漏洞編號與沒有通行中文譯名的技術縮寫外，所有自然語言欄位一律使用繁體中文，不得中英逐句混雜。',
            '不得輸出 HTML entity，例如 &#x20;、&nbsp; 或 &amp;。',
            'difficulty 依理解文章所需的技術背景判斷。',
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
          '依提供的規則評估合成資安新聞，所有自然語言欄位使用繁體中文。',
          '只回傳符合 schema 的 JSON，不得加入 Markdown code fence 或說明文字。',
        ].join('\n'),
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
