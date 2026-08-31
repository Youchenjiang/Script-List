const { createHash } = require('node:crypto');
const { cloneDefaultRule, toAiRule } = require('./rule-options');

const FILTER_CONTRACT_VERSION = 'news-filter-v17';
const GPT_OSS_MIN_REQUEST_INTERVAL_MS = 45_000;
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
    publicSummary: { type: 'string', maxLength: 240 },
    technicalFocus: {
      type: 'array',
      items: { type: 'string', maxLength: 80 },
      maxItems: 4,
    },
    technicalOutcome: { type: 'string', maxLength: 600 },
    attackChainGroups: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', maxLength: 80 },
          steps: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                stage: { type: 'string', maxLength: 80 },
                action: { type: 'string', maxLength: 220 },
                mechanism: { type: 'string', maxLength: 420 },
                result: { type: 'string', maxLength: 260 },
              },
              required: ['stage', 'action', 'mechanism', 'result'],
              additionalProperties: false,
            },
            maxItems: 7,
          },
        },
        required: ['title', 'steps'],
        additionalProperties: false,
      },
      maxItems: 2,
    },
    evidenceBoundaries: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: [
              'confirmed_capability',
              'confirmed_impact',
              'confirmed_exposure',
              'confirmed_victim',
              'not_confirmed',
              'unknown',
            ],
          },
          claim: { type: 'string', maxLength: 300 },
        },
        required: ['status', 'claim'],
        additionalProperties: false,
      },
      maxItems: 6,
    },
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
    'publicSummary',
    'technicalFocus',
    'technicalOutcome',
    'attackChainGroups',
    'evidenceBoundaries',
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

function schemaFor(keys) {
  return {
    type: 'object',
    properties: Object.fromEntries(keys.map((key) => [key, DECISION_SCHEMA.properties[key]])),
    required: [...keys],
    additionalProperties: false,
  };
}

const SCREENING_KEYS = [
  'matches', 'confidence', 'severity', 'regionRelevance', 'reason',
  'readingRecommendation', 'matchedCriteria', 'matchedTechnologies',
  'matchedExclusions', 'evidence',
];
const DETAIL_KEYS = [
  'headline', 'publicSummary', 'technicalFocus', 'technicalOutcome',
  'attackChainGroups', 'evidenceBoundaries', 'exploitationStatus',
  'confirmedConsequences', 'difficulty', 'researchRelevance',
];
const SCREENING_SCHEMA = schemaFor(SCREENING_KEYS);
const DETAIL_SCHEMA = schemaFor(DETAIL_KEYS);

const DECISION_KEYS = Object.freeze([...DECISION_SCHEMA.required].sort());
const SEVERITIES = new Set(DECISION_SCHEMA.properties.severity.enum);
const REGIONS = new Set(DECISION_SCHEMA.properties.regionRelevance.enum);
const RECOMMENDATIONS = new Set(DECISION_SCHEMA.properties.readingRecommendation.enum);
const DIFFICULTIES = new Set(DECISION_SCHEMA.properties.difficulty.enum);
const EXPLOITATION_STATUSES = new Set(DECISION_SCHEMA.properties.exploitationStatus.enum);
const RELEVANCE_LEVELS = new Set(['high', 'medium', 'low']);
const EVIDENCE_BOUNDARY_STATUSES = new Set(
  DECISION_SCHEMA.properties.evidenceBoundaries.items.properties.status.enum,
);
const JSON_ONLY_INSTRUCTION = '只輸出符合指定 schema 的 JSON；不得加入 Markdown code fence 或任何說明文字。';
const PLAIN_JSON_SHAPE_INSTRUCTION = [
  '供應商未套用 JSON Schema；你仍必須嚴格使用下列頂層結構，所有鍵都必須出現且不得新增、巢狀化或改名：',
  '{"matches":false,"confidence":0,"severity":"unknown","regionRelevance":"unknown","reason":"繁體中文理由","readingRecommendation":"skip","headline":"","publicSummary":"","technicalFocus":[],"technicalOutcome":"","attackChainGroups":[],"evidenceBoundaries":[],"exploitationStatus":"not_reported","confirmedConsequences":[],"difficulty":"intermediate","researchRelevance":[],"matchedCriteria":[],"matchedTechnologies":[],"matchedExclusions":[],"evidence":[]}',
  'readingRecommendation 必須直接是 must_read、recommended、skim、skip 其中一個字串，不能是物件、布林值、null 或 none。',
  'must_read 時 attackChainGroups 使用 [{"title":"繁體中文標題","steps":[{"stage":"階段","action":"動作","mechanism":"機制","result":"結果"}]}]。',
  'must_read 時 evidenceBoundaries 使用 [{"status":"confirmed_capability","claim":"繁體中文事實"}]；status 只可使用 schema 列出的值。',
].join('\n');
const SCREENING_PLAIN_JSON_INSTRUCTION = [
  '供應商未套用 JSON Schema；只可輸出下列十個頂層鍵，所有鍵都必須出現且不得新增、巢狀化或改名：',
  '{"matches":false,"confidence":0,"severity":"unknown","regionRelevance":"unknown","reason":"繁體中文理由","readingRecommendation":"skip","matchedCriteria":[],"matchedTechnologies":[],"matchedExclusions":[],"evidence":[]}',
  'readingRecommendation 只可使用 must_read、recommended、skim、skip；regionRelevance 只可使用 taiwan、global_major、other、unknown。',
].join('\n');
const DETAIL_PLAIN_JSON_INSTRUCTION = [
  '供應商未套用 JSON Schema；只可輸出下列十個頂層鍵，所有鍵都必須出現且不得新增、巢狀化或改名：',
  '{"headline":"繁體中文標題","publicSummary":"繁體中文事件敘事","technicalFocus":[],"technicalOutcome":"繁體中文技術結果","attackChainGroups":[{"title":"繁體中文標題","steps":[{"stage":"階段","action":"動作","mechanism":"機制","result":"結果"}]}],"evidenceBoundaries":[{"status":"confirmed_capability","claim":"繁體中文事實"}],"exploitationStatus":"not_reported","confirmedConsequences":[],"difficulty":"intermediate","researchRelevance":[]}',
  'attackChainGroups 整體至少四步；evidenceBoundaries 至少兩項；confirmedConsequences 至少一項。',
].join('\n');
const PROVIDER_CHECK_ARTICLE = Object.freeze({
  id: 'provider-health-check',
  title: '公開管理介面的重大身分驗證漏洞已遭利用',
  summary: [
    '2026 年 1 月，研究人員在公開管理介面發現異常登入。',
    '攻擊者先探測驗證端點，再送入帶有偽造管理員宣告的特製權杖；服務錯誤信任宣告並建立管理工作階段。',
    '攻擊者接著利用管理功能建立新的高權限帳號，並以該帳號修改系統設定。',
    '調查人員已在受感染伺服器確認異常帳號與設定變更，隨後隔離主機並撤銷帳號。',
  ].join(''),
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

function hasGenericPublicCopy(value) {
  return /^(?:本文|本篇|這篇(?:文章|報導)|該(?:文章|報導)|此(?:文章|報導))\s*(?:介紹|說明|探討|分析|報導)/u.test(value.trim())
    || /值得關注|可能造成(?:重大)?影響|資安風險(?:日益)?(?:升高|增加)|企業(?:與組織)?應(?:立即)?(?:注意|關注)|提醒我們/u.test(value);
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
    && typeof decision.publicSummary === 'string'
    && decision.publicSummary.length <= 240
    && isStringArray(decision.technicalFocus, 4)
    && decision.technicalFocus.every((item) => item.length <= 80)
    && typeof decision.technicalOutcome === 'string'
    && decision.technicalOutcome.length <= 600
    && isAttackChainGroups(decision.attackChainGroups)
    && isEvidenceBoundaries(decision.evidenceBoundaries)
    && EXPLOITATION_STATUSES.has(decision.exploitationStatus)
    && isStringArray(decision.confirmedConsequences, 4)
    && DIFFICULTIES.has(decision.difficulty)
    && isResearchRelevance(decision.researchRelevance)
    && isStringArray(decision.matchedCriteria)
    && isStringArray(decision.matchedTechnologies)
    && isStringArray(decision.matchedExclusions)
    && isStringArray(decision.evidence);

  if (!validShape) return false;
  if (decision.readingRecommendation !== 'must_read') {
    return decision.headline === ''
      && decision.publicSummary === ''
      && decision.technicalFocus.length === 0
      && decision.technicalOutcome === ''
      && decision.attackChainGroups.length === 0
      && decision.evidenceBoundaries.length === 0
      && decision.confirmedConsequences.length === 0;
  }

  return isChineseDisplayText(decision.headline)
    && decision.headline.trim().length >= 4
    && isChineseDisplayText(decision.publicSummary, { narrative: true })
    && decision.publicSummary.trim().length >= 90
    && !hasGenericPublicCopy(decision.publicSummary)
    && decision.technicalFocus.length >= 1
    && decision.technicalFocus.every((item) => isChineseDisplayText(item))
    && isChineseDisplayText(decision.technicalOutcome)
    && decision.technicalOutcome.trim().length >= 30
    && decision.attackChainGroups.length >= 1
    && decision.attackChainGroups.reduce((count, group) => count + group.steps.length, 0) >= 4
    && decision.attackChainGroups.every((group) => isChineseDisplayText(group.title)
      && group.steps.every((step) => [step.stage, step.action, step.mechanism, step.result]
        .every((text) => isChineseDisplayText(text))))
    && decision.evidenceBoundaries.length >= 2
    && decision.evidenceBoundaries.every((item) => isChineseDisplayText(item.claim))
    && decision.confirmedConsequences.length >= 1;
}

function isAttackChainGroups(value) {
  return Array.isArray(value)
    && value.length <= 2
    && value.every((group) => group
      && typeof group === 'object'
      && !Array.isArray(group)
      && JSON.stringify(Object.keys(group).sort()) === JSON.stringify(['steps', 'title'])
      && typeof group.title === 'string'
      && group.title.length <= 80
      && Array.isArray(group.steps)
      && group.steps.length >= 2
      && group.steps.length <= 7
      && group.steps.every((step) => step
        && typeof step === 'object'
        && !Array.isArray(step)
        && JSON.stringify(Object.keys(step).sort())
          === JSON.stringify(['action', 'mechanism', 'result', 'stage'])
        && typeof step.stage === 'string'
        && step.stage.length <= 80
        && typeof step.action === 'string'
        && step.action.length <= 220
        && typeof step.mechanism === 'string'
        && step.mechanism.length <= 420
        && typeof step.result === 'string'
        && step.result.length <= 260));
}

function isEvidenceBoundaries(value) {
  return Array.isArray(value)
    && value.length <= 6
    && value.every((item) => item
      && typeof item === 'object'
      && !Array.isArray(item)
      && JSON.stringify(Object.keys(item).sort()) === JSON.stringify(['claim', 'status'])
      && EVIDENCE_BOUNDARY_STATUSES.has(item.status)
      && typeof item.claim === 'string'
      && item.claim.length <= 300);
}

function safeRejectedDecision() {
  return {
    matches: false,
    confidence: 0,
    severity: 'unknown',
    regionRelevance: 'unknown',
    reason: 'AI 回覆格式不完整，已由程式安全拒絕',
    readingRecommendation: 'skip',
    headline: '',
    publicSummary: '',
    technicalFocus: [],
    technicalOutcome: '',
    attackChainGroups: [],
    evidenceBoundaries: [],
    exploitationStatus: 'not_reported',
    confirmedConsequences: [],
    difficulty: 'intermediate',
    researchRelevance: [],
    matchedCriteria: [],
    matchedTechnologies: [],
    matchedExclusions: [],
    evidence: [],
  };
}

function parseDecisionContent(content) {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    const firstBrace = candidate.indexOf('{');
    const lastBrace = candidate.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
      } catch {
        // Preserve the original provider output in the error below.
      }
    }
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

function minimumRequestIntervalMs(config) {
  return /gpt-oss/iu.test(config.aiModel) ? GPT_OSS_MIN_REQUEST_INTERVAL_MS : 0;
}

function isExplicitRawRejection(content) {
  return /^\s*(?:```(?:json)?\s*)?\{\s*"matches"\s*:\s*false(?:\s*[,}])/iu.test(content);
}

function isExplicitParsedRejection(decision) {
  return decision?.matches === false
    || ['recommended', 'skim', 'skip', 'none'].includes(decision?.readingRecommendation);
}

function normalizeKnownAliases(decision) {
  if (!decision || typeof decision !== 'object' || Array.isArray(decision)) return decision;
  const normalized = { ...decision };
  if (normalized.regionRelevance === 'global') normalized.regionRelevance = 'global_major';
  if (normalized.readingRecommendation === 'none') normalized.readingRecommendation = 'skip';
  if (typeof normalized.confidence === 'string' && normalized.confidence.trim() !== '') {
    const numericConfidence = Number(normalized.confidence);
    if (Number.isFinite(numericConfidence)) normalized.confidence = numericConfidence;
  }
  if (Number.isFinite(normalized.confidence)
      && normalized.confidence > 1
      && normalized.confidence <= 100) {
    normalized.confidence /= 100;
  }
  ['matchedCriteria', 'matchedTechnologies', 'matchedExclusions', 'evidence'].forEach((key) => {
    if (Array.isArray(normalized[key]) && normalized[key].every((item) => typeof item === 'string')) {
      normalized[key] = normalized[key].slice(0, 5);
    }
  });
  ['technicalFocus', 'confirmedConsequences'].forEach((key) => {
    if (Array.isArray(normalized[key]) && normalized[key].every((item) => typeof item === 'string')) {
      normalized[key] = normalized[key].slice(0, 4);
    }
  });
  if (Array.isArray(normalized.attackChainGroups)) {
    normalized.attackChainGroups = normalized.attackChainGroups.slice(0, 2).map((group) => {
      if (!group || typeof group !== 'object' || Array.isArray(group)) return group;
      return {
        title: group.title,
        steps: Array.isArray(group.steps)
          ? group.steps.slice(0, 7).map((step) => {
            if (!step || typeof step !== 'object' || Array.isArray(step)) return step;
            return {
              stage: step.stage,
              action: step.action,
              mechanism: step.mechanism,
              result: step.result,
            };
          })
          : group.steps,
      };
    });
  }
  if (Array.isArray(normalized.evidenceBoundaries)) {
    normalized.evidenceBoundaries = normalized.evidenceBoundaries.slice(0, 6).map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
      return {
        status: item.status === 'confirmed_entry' ? 'confirmed_exposure' : item.status,
        claim: item.claim,
      };
    });
  }
  if (Array.isArray(normalized.researchRelevance)) {
    normalized.researchRelevance = normalized.researchRelevance.slice(0, 10).map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
      return { area: item.area, relevance: item.relevance, reason: item.reason };
    });
  }
  return normalized;
}

function hasExactKeys(value, keys) {
  return value
    && typeof value === 'object'
    && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

function validateScreening(decision) {
  return hasExactKeys(decision, SCREENING_KEYS)
    && typeof decision.matches === 'boolean'
    && Number.isFinite(decision.confidence)
    && decision.confidence >= 0
    && decision.confidence <= 1
    && SEVERITIES.has(decision.severity)
    && REGIONS.has(decision.regionRelevance)
    && typeof decision.reason === 'string'
    && RECOMMENDATIONS.has(decision.readingRecommendation)
    && isStringArray(decision.matchedCriteria)
    && isStringArray(decision.matchedTechnologies)
    && isStringArray(decision.matchedExclusions)
    && isStringArray(decision.evidence);
}

function validateScreeningForRule(decision, ruleConfig) {
  if (!validateScreening(decision)) return false;
  if (!decision.matches) return true;
  return decision.readingRecommendation === 'must_read'
    && decision.confidence >= ruleConfig.confidenceThreshold
    && decision.severity !== 'unknown'
    && decision.matchedCriteria.length > 0
    && decision.evidence.length > 0;
}

function validateDetail(detail) {
  if (!hasExactKeys(detail, DETAIL_KEYS)) return false;
  return validateDecision({
    matches: true,
    confidence: 1,
    severity: 'high',
    regionRelevance: 'global_major',
    reason: '文章符合必讀條件',
    readingRecommendation: 'must_read',
    matchedCriteria: ['critical_vulnerability'],
    matchedTechnologies: [],
    matchedExclusions: [],
    evidence: ['文章提供可核對的事件證據'],
    ...detail,
  });
}

function validationSummary(decision, keys) {
  if (!decision || typeof decision !== 'object' || Array.isArray(decision)) return 'root:not_object';
  const expected = new Set(keys);
  const issues = [
    ...keys.filter((key) => !(key in decision)).map((key) => `missing:${key}`),
    ...Object.keys(decision).filter((key) => !expected.has(key)).map((key) => `unexpected:${key}`),
  ];
  if ('regionRelevance' in decision && !REGIONS.has(decision.regionRelevance)) {
    issues.push(`regionRelevance:${String(decision.regionRelevance)}`);
  }
  if ('readingRecommendation' in decision && !RECOMMENDATIONS.has(decision.readingRecommendation)) {
    issues.push(`readingRecommendation:${String(decision.readingRecommendation)}`);
  }
  if ('matches' in decision && typeof decision.matches !== 'boolean') {
    issues.push(`matches:type=${typeof decision.matches}`);
  }
  if ('confidence' in decision && (!Number.isFinite(decision.confidence)
    || decision.confidence < 0 || decision.confidence > 1)) {
    issues.push(`confidence:${String(decision.confidence)}`);
  }
  if ('severity' in decision && !SEVERITIES.has(decision.severity)) {
    issues.push(`severity:${String(decision.severity)}`);
  }
  if ('reason' in decision && typeof decision.reason !== 'string') {
    issues.push(`reason:type=${typeof decision.reason}`);
  }
  ['matchedCriteria', 'matchedTechnologies', 'matchedExclusions', 'evidence'].forEach((key) => {
    if (key in decision && !isStringArray(decision[key])) issues.push(`${key}:invalid`);
  });
  if ('publicSummary' in decision && (typeof decision.publicSummary !== 'string'
    || decision.publicSummary.length < 90 || decision.publicSummary.length > 240)) {
    issues.push(`publicSummary:length=${typeof decision.publicSummary === 'string' ? decision.publicSummary.length : 'invalid'}`);
  }
  if ('attackChainGroups' in decision && !isAttackChainGroups(decision.attackChainGroups)) {
    issues.push('attackChainGroups:invalid');
  }
  if ('evidenceBoundaries' in decision && !isEvidenceBoundaries(decision.evidenceBoundaries)) {
    if (!Array.isArray(decision.evidenceBoundaries)) {
      issues.push(`evidenceBoundaries:type=${typeof decision.evidenceBoundaries}`);
    } else {
      issues.push(`evidenceBoundaries:count=${decision.evidenceBoundaries.length}`);
      decision.evidenceBoundaries.forEach((item, index) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          issues.push(`evidenceBoundaries[${index}]:not_object`);
        } else if (!EVIDENCE_BOUNDARY_STATUSES.has(item.status)) {
          issues.push(`evidenceBoundaries[${index}].status:${String(item.status)}`);
        } else if (typeof item.claim !== 'string' || item.claim.length > 300) {
          issues.push(`evidenceBoundaries[${index}].claim:invalid`);
        }
      });
    }
  }
  return issues.slice(0, 12).join(', ') || 'content_constraints_failed';
}

function createRequestScheduler(config) {
  const intervalMs = minimumRequestIntervalMs(config);
  let nextRequestAt = 0;
  return async function beforeRequest() {
    const delay = Math.max(nextRequestAt - Date.now(), 0);
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    nextRequestAt = Date.now() + intervalMs;
  };
}

async function sendCompletion(config, messages, fetchImpl, {
  beforeRequest,
  strictSchema,
  schema = DECISION_SCHEMA,
  schemaName = 'news_filter_decision',
  plainJsonInstruction = PLAIN_JSON_SHAPE_INSTRUCTION,
  maxOutputTokens,
}) {
  await beforeRequest();
  const usesGptOss = /gpt-oss/iu.test(config.aiModel);
  const requestMessages = strictSchema
    ? messages
    : messages.map((message, index) => (index === 0
      ? { ...message, content: `${message.content}\n${plainJsonInstruction}` }
      : message));
  const body = {
    model: config.aiModel,
    messages: requestMessages,
    max_tokens: maxOutputTokens || (usesGptOss
      ? Math.max(config.aiMaxOutputTokens || 800, 2400)
      : config.aiMaxOutputTokens || 800),
  };
  if (usesGptOss) body.reasoning_effort = 'low';
  if (strictSchema) {
    body.response_format = {
      type: 'json_schema',
      json_schema: {
        name: schemaName,
        strict: true,
        schema,
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
    signal: AbortSignal.timeout(usesGptOss ? 45_000 : 20_000),
  });
}

function retryDelayMs(detail) {
  const match = detail.match(/try again in\s+(\d+(?:\.\d+)?)s/iu);
  if (!match) return 0;
  return Math.min(Math.max(Math.ceil(Number(match[1]) * 1000), 1), 20_000);
}

async function sendWithRateLimitRetry(config, messages, fetchImpl, options) {
  let response = await sendCompletion(config, messages, fetchImpl, options);
  if (response.ok) return { response, detail: '' };

  let detail = (await response.text()).replace(/\s+/g, ' ').slice(0, 300);
  const delay = response.status === 429 ? retryDelayMs(detail) : 0;
  if (delay === 0) return { response, detail };

  await new Promise((resolve) => setTimeout(resolve, delay));
  response = await sendCompletion(config, messages, fetchImpl, options);
  detail = response.ok ? '' : (await response.text()).replace(/\s+/g, ' ').slice(0, 300);
  return { response, detail };
}

async function requestCompletion(
  config,
  messages,
  fetchImpl,
  providerState,
  {
    allowSafeRejection = false,
    schema = DECISION_SCHEMA,
    schemaName = 'news_filter_decision',
    plainJsonInstruction = PLAIN_JSON_SHAPE_INSTRUCTION,
    validator = validateDecision,
    expectedKeys = DECISION_SCHEMA.required,
    ignoredKeys = [],
    maxOutputTokens,
    retryMalformed = true,
  } = {},
) {
  let { response, detail } = await sendWithRateLimitRetry(
    config,
    messages,
    fetchImpl,
    {
      beforeRequest: providerState.beforeRequest,
      strictSchema: providerState.strictSchema,
      schema,
      schemaName,
      plainJsonInstruction,
      maxOutputTokens,
    },
  );

  if (!response.ok) {
    const structuredOutputFailed = providerState.strictSchema
      && response.status === 400
      && /json_validate_failed|failed to validate json|generated json does not match/iu.test(detail);
    if (!structuredOutputFailed) {
      throw new Error(`AI endpoint returned HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
    }

    providerState.strictSchema = false;
    ({ response, detail } = await sendWithRateLimitRetry(
      config,
      messages,
      fetchImpl,
      {
        beforeRequest: providerState.beforeRequest,
        strictSchema: false,
        schema,
        schemaName,
        plainJsonInstruction,
        maxOutputTokens,
      },
    ));
    if (!response.ok) {
      throw new Error(`AI endpoint returned HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
    }
  }
  const payload = await response.json();
  const content = extractCompletionContent(payload?.choices?.[0]?.message);
  if (!content.trim()) {
    const error = emptyCompletionError(payload);
    if (allowSafeRejection) {
      return { decision: safeRejectedDecision(), httpStatus: response.status, warning: error.message };
    }
    throw error;
  }
  if (allowSafeRejection && isExplicitRawRejection(content)) {
    return { decision: safeRejectedDecision(), httpStatus: response.status };
  }
  let decision;
  try {
    decision = normalizeKnownAliases(parseDecisionContent(content));
    if (decision && typeof decision === 'object' && !Array.isArray(decision)) {
      ignoredKeys.forEach((key) => { delete decision[key]; });
    }
  } catch (error) {
    if (allowSafeRejection && retryMalformed) {
      providerState.strictSchema = false;
      return requestCompletion(config, messages, fetchImpl, providerState, {
        allowSafeRejection,
        schema,
        schemaName,
        plainJsonInstruction,
        validator,
        expectedKeys,
        ignoredKeys,
        maxOutputTokens,
        retryMalformed: false,
      });
    }
    if (allowSafeRejection) {
      return { decision: safeRejectedDecision(), httpStatus: response.status, warning: error.message };
    }
    throw error;
  }
  if (allowSafeRejection && isExplicitParsedRejection(decision)) {
    return { decision: safeRejectedDecision(), httpStatus: response.status };
  }
  if (!validator(decision)) {
    if (allowSafeRejection && retryMalformed) {
      providerState.strictSchema = false;
      return requestCompletion(config, messages, fetchImpl, providerState, {
        allowSafeRejection,
        schema,
        schemaName,
        plainJsonInstruction,
        validator,
        expectedKeys,
        ignoredKeys,
        maxOutputTokens,
        retryMalformed: false,
      });
    }
    if (allowSafeRejection) {
      return {
        decision: safeRejectedDecision(),
        httpStatus: response.status,
        warning: `AI endpoint response did not match the required decision schema (${validationSummary(decision, expectedKeys)})`,
      };
    }
    throw new Error('AI endpoint response did not match the required decision schema');
  }
  return { decision, httpStatus: response.status };
}

function createAiFilter(config, fetchImpl = fetch) {
  if (config.aiFilteringEnabled !== true
      || !config.aiApiKey
      || !config.aiBaseUrl
      || !config.aiModel) return null;
  const providerState = {
    beforeRequest: createRequestScheduler(config),
    strictSchema: true,
  };

  async function evaluate(article, rule) {
    const articlePayload = {
      title: article.title,
      summary: article.summary,
      content: article.analysisText || article.summary,
      contentDepth: article.contentDepth || 'summary_only',
      categories: article.categories,
      sourceUrl: article.url,
      publishedAt: article.published.toISOString(),
    };
    const screeningResult = await requestCompletion(config, [
        {
          role: 'system',
          content: [
            '你是嚴格的資安新聞篩選器。這一步只判斷是否值得推送，不撰寫新聞文案。',
            '只能根據提供的標題、文章內容、分類與規則判斷，不可猜測文章未提及的內容。',
            '規則不明確或證據不足時，matches 必須為 false。',
            'matchedCriteria、matchedTechnologies 與 matchedExclusions 只能填入規則中提供的 id。',
            'matchedCriteria 描述事件類型；matchedTechnologies 描述文章明確影響的技術領域。',
            '技術規則為 any 時仍須辨識明確技術，但不可將 any 放入 matchedTechnologies。',
            '沒有明確證據時 severity 或 regionRelevance 必須使用 unknown。',
            'evidence 必須是文章資料中可核對的簡短依據，不得捏造。',
            'researchRelevance 只能使用規則提供的研究方向 id；僅列出確實相關的方向。',
            'readingRecommendation 只有在文章提供足夠具體事實，可以完整交代一次重要資安事件時才使用 must_read。',
            'matches 為 true 時，readingRecommendation 必須是 must_read，confidence 必須達到規則的 confidenceThreshold，severity 不得為 unknown，且 matchedCriteria 與 evidence 均不得為空；否則 matches 必須為 false。',
            'must_read 必須具備明確證據，且至少符合以下一項：正在遭利用或造成重大影響；提出可實作的新技術或防禦方法；直接改變研究方向的重要背景。',
            '一般漏洞公告、產品宣傳、重複報導、增量更新或缺少技術內容的文章不得標為 must_read。',
            '所有自然語言欄位使用繁體中文。',
            JSON_ONLY_INSTRUCTION,
          ].join('\n'),
        },
        {
          role: 'user',
          content: JSON.stringify({ filterRule: toAiRule(rule.config), article: articlePayload }),
        },
    ], fetchImpl, providerState, {
      allowSafeRejection: true,
      schema: SCREENING_SCHEMA,
      schemaName: 'news_screening_decision',
      plainJsonInstruction: SCREENING_PLAIN_JSON_INSTRUCTION,
      validator: (decision) => validateScreeningForRule(decision, rule.config),
      expectedKeys: SCREENING_KEYS,
      ignoredKeys: DETAIL_KEYS,
      maxOutputTokens: 800,
    });
    if (screeningResult.warning) {
      console.warn(`[AI filter] ${article.id} screening: ${screeningResult.warning}`);
    }
    const screening = screeningResult.decision;
    if (!screening.matches || screening.readingRecommendation !== 'must_read') {
      return safeRejectedDecision();
    }

    const detailResult = await requestCompletion(config, [
        {
          role: 'system',
          content: [
            '你是資安讀書會編輯。篩選器已判定文章必讀；這一步只根據文章與篩選結果撰寫完整事件敘事與技術細節。',
            '不可猜測文章未提及的內容，不得把能力存在誤寫成已有受害者。',
            'headline 使用自然的繁體中文新聞標題，不照抄英文標題。',
            'must_read 的 confirmedConsequences 至少列出一項文章明確證實的結果，例如後門實際具備的能力、已遭入侵的組織、被竊取的資料、服務中斷，或事件公開後已完成的撤回與封鎖。不得填入預測。',
            'exploitationStatus 只能依文章明說的狀態判斷；文章明確表示尚無成功利用證據時才用 no_confirmed_exploitation，沒有交代就用 not_reported。',
            'publicSummary 寫成 90 至 180 個繁體中文字、最多三句的公開敘事，不使用列點、標題或欄位名稱。',
            '直接從事件中最反常、最具畫面的技術動作切入；使用文章提供的產品、組織、研究者、元件與攻擊動作等具體名稱，不得以「受影響設備」「特製請求」「相關單位」取代原文已有的明確資訊。',
            '使用具體主詞與強動詞，把「誰對什麼做了什麼、系統如何處理、最後實際發生什麼」接成因果。可在符合原文時自然使用「本該……卻……」「不需要……只要……就……」等對比，但不得每篇硬套同一句型。',
            '不得以「本文介紹」「這篇報導說明」開場，不得使用「值得關注」「可能造成影響」「資安風險日益增加」「企業應注意」等空泛套話。',
            '摘要可以有張力，但不得使用「震撼」「史上最嚴重」等標題黨詞彙，也不得添加原文沒有的動機、受害者、範圍或結果。',
            '接著交代關鍵技術機制、confirmedConsequences 中的實際結果，以及事件當下已確認的收尾；原文沒有交代的部分直接省略。',
            '後門或漏洞已證實具備的能力必須明確寫出；同時要區分「具備入侵能力」與「已有受害者」兩件事。',
            '不得推演未來可能影響的對象或範圍，不得提供處置建議、研究建議、閱讀價值或防禦清單。',
            '若 exploitationStatus 是 no_confirmed_exploitation，敘事必須明確寫出尚無已知成功利用；若是 not_reported，則不得聲稱沒有受害者。',
            'publicSummary 不得重複 headline，也不得另外寫「值得讀」「閱讀判斷」「摘要」等標籤。',
            'technicalFocus 填入一至四個可供成員判斷研究關聯的具體技術焦點，例如「建置腳本植入」或「SSH 憑證解析」，不得填入「重大漏洞」「網路安全」等泛用標籤。',
            'technicalOutcome 開頭直接說明攻擊鏈完成後實際造成什麼結果、以何種權限或能力呈現；不得只寫風險或可能影響。',
            'attackChainGroups 依文章證據將攻擊鏈拆成一至兩段因果相連的鏈，例如「後門如何進入套件」與「攻擊者如何遠端觸發」。不得把不同階段混在同一個模糊段落。',
            '每個 chain group 至少兩步，整體至少四步。每一步的 stage 是具體階段名稱；action 寫誰做了什麼；mechanism 寫輸入如何被處理、利用哪個元件或條件；result 寫該步驟產生並交給下一步的結果。',
            '每一步只寫足以接起因果關係的一至兩句，避免重複背景或在不同欄位改寫同一件事。',
            '攻擊鏈必須從文章能證實的最早入口一路寫到已確認的技術結果，不可跳過載入、觸發、驗證或執行等文章明確交代的中間環節，也不可用一般性資安知識補洞。',
            'evidenceBoundaries 明確區分已證實能力、已確認進入或曝露的環境、已確認受害者、明確尚未確認的事項，以及文章沒有交代的未知事項。claim 不得把能力存在誤寫成已有受害者。',
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
            article: articlePayload,
            screeningDecision: screening,
          }),
        },
    ], fetchImpl, providerState, {
      allowSafeRejection: true,
      schema: DETAIL_SCHEMA,
      schemaName: 'news_editorial_detail',
      plainJsonInstruction: DETAIL_PLAIN_JSON_INSTRUCTION,
      validator: validateDetail,
      expectedKeys: DETAIL_KEYS,
      maxOutputTokens: 2400,
    });
    if (detailResult.warning) {
      console.warn(`[AI filter] ${article.id} detail: ${detailResult.warning}`);
      return safeRejectedDecision();
    }
    const decision = { ...screening, ...detailResult.decision };
    if (!validateDecision(decision)) {
      console.warn(`[AI filter] ${article.id} merged: AI endpoint response did not match the required decision schema (${validationSummary(decision, DECISION_SCHEMA.required)})`);
      return safeRejectedDecision();
    }
    return decision;
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
    ], fetchImpl, providerState);
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
  minimumRequestIntervalMs,
  parseDecisionContent,
  safeRejectedDecision,
  validateDecision,
};
