const TOPICS = [
  { value: 'zero_day', label: '零日漏洞', description: '零日漏洞或尚無完整修補的攻擊' },
  { value: 'critical_vulnerability', label: '重大漏洞', description: '重大或高風險漏洞' },
  { value: 'ransomware', label: '勒索軟體', description: '勒索軟體與勒索組織活動' },
  { value: 'data_breach', label: '資料外洩', description: '資料外洩或大規模帳號暴露' },
  { value: 'supply_chain', label: '供應鏈攻擊', description: '軟體、套件或服務供應鏈攻擊' },
  { value: 'apt', label: 'APT／國家級攻擊', description: 'APT 或國家級威脅活動' },
  { value: 'cloud_identity', label: '雲端與身分安全', description: '雲端、身分、存取權與憑證安全' },
  { value: 'malware_campaign', label: '惡意程式活動', description: '具實際影響的惡意程式活動' },
];

const SEVERITIES = [
  { value: 'critical_only', label: '只限重大', description: '只接收具有重大影響證據的事件' },
  { value: 'high_or_above', label: '高風險以上', description: '高風險或重大事件（建議）' },
  { value: 'medium_or_above', label: '中風險以上', description: '中風險、高風險或重大事件' },
  { value: 'any', label: '不限制', description: '不以嚴重程度排除文章' },
];

const REGIONS = [
  { value: 'taiwan_priority', label: '台灣優先', description: '台灣相關，以及全球重大事件（建議）' },
  { value: 'taiwan_only', label: '僅限台灣', description: '必須明確影響台灣' },
  { value: 'global', label: '全球', description: '不限制事件地區' },
];

const EXCLUSIONS = [
  { value: 'advertisement', label: '產品廣告', description: '產品廣告或置入內容' },
  { value: 'event_promotion', label: '活動宣傳', description: '活動、研討會或課程宣傳' },
  { value: 'routine_update', label: '一般產品更新', description: '沒有安全事件的一般產品更新' },
  { value: 'opinion_only', label: '純評論', description: '缺少具體事件或證據的評論' },
  { value: 'research_without_impact', label: '概念性研究', description: '尚未呈現實際風險的研究' },
];

const CONFIDENCE_LEVELS = [
  { value: '0.90', label: '90%・嚴格', description: '推送較少，降低誤判' },
  { value: '0.80', label: '80%・平衡', description: '兼顧精準度與涵蓋率（建議）' },
  { value: '0.70', label: '70%・寬鬆', description: '涵蓋較多，可能增加誤判' },
];

const DEFAULT_RULE = Object.freeze({
  schemaVersion: 1,
  topics: ['zero_day', 'critical_vulnerability', 'ransomware', 'supply_chain'],
  minimumSeverity: 'high_or_above',
  regionScope: 'taiwan_priority',
  exclusions: ['advertisement', 'event_promotion', 'routine_update'],
  confidenceThreshold: 0.8,
  notes: '',
});

function findLabel(options, value) {
  return options.find((option) => option.value === value)?.label || value;
}

function normalizeRuleConfig(input = {}) {
  const topicValues = new Set(TOPICS.map(({ value }) => value));
  const severityValues = new Set(SEVERITIES.map(({ value }) => value));
  const regionValues = new Set(REGIONS.map(({ value }) => value));
  const exclusionValues = new Set(EXCLUSIONS.map(({ value }) => value));
  const confidenceValues = new Set(CONFIDENCE_LEVELS.map(({ value }) => Number(value)));
  const topics = [...new Set(input.topics || [])].filter((value) => topicValues.has(value));
  const exclusions = [...new Set(input.exclusions || [])]
    .filter((value) => exclusionValues.has(value));
  const confidenceThreshold = Number(input.confidenceThreshold);

  if (topics.length === 0) throw new Error('至少要選擇一個新聞主題');
  if (!severityValues.has(input.minimumSeverity)) throw new Error('嚴重程度設定無效');
  if (!regionValues.has(input.regionScope)) throw new Error('地區範圍設定無效');
  if (!confidenceValues.has(confidenceThreshold)) throw new Error('AI 信心門檻設定無效');

  return {
    schemaVersion: 1,
    topics,
    minimumSeverity: input.minimumSeverity,
    regionScope: input.regionScope,
    exclusions,
    confidenceThreshold,
    notes: String(input.notes || '').trim().slice(0, 1000),
  };
}

function cloneDefaultRule() {
  return normalizeRuleConfig(DEFAULT_RULE);
}

function formatRuleConfig(config) {
  const rule = normalizeRuleConfig(config);
  return [
    `主題：${rule.topics.map((value) => findLabel(TOPICS, value)).join('、')}`,
    `嚴重度：${findLabel(SEVERITIES, rule.minimumSeverity)}`,
    `地區：${findLabel(REGIONS, rule.regionScope)}`,
    `排除：${rule.exclusions.length
      ? rule.exclusions.map((value) => findLabel(EXCLUSIONS, value)).join('、')
      : '不排除'}`,
    `AI 信心門檻：${Math.round(rule.confidenceThreshold * 100)}%`,
    `補充條件：${rule.notes || '無'}`,
  ].join('\n');
}

function toAiRule(config) {
  const rule = normalizeRuleConfig(config);
  return {
    topics: rule.topics.map((value) => ({
      id: value,
      description: TOPICS.find((option) => option.value === value).description,
    })),
    minimumSeverity: {
      id: rule.minimumSeverity,
      description: SEVERITIES.find((option) => option.value === rule.minimumSeverity).description,
    },
    regionScope: {
      id: rule.regionScope,
      description: REGIONS.find((option) => option.value === rule.regionScope).description,
    },
    exclusions: rule.exclusions.map((value) => ({
      id: value,
      description: EXCLUSIONS.find((option) => option.value === value).description,
    })),
    notes: rule.notes,
  };
}

module.exports = {
  CONFIDENCE_LEVELS,
  DEFAULT_RULE,
  EXCLUSIONS,
  REGIONS,
  SEVERITIES,
  TOPICS,
  cloneDefaultRule,
  formatRuleConfig,
  normalizeRuleConfig,
  toAiRule,
};
