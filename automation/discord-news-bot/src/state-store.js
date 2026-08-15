const fs = require('node:fs/promises');
const path = require('node:path');
const { Pool } = require('pg');
const { normalizeRuleConfig } = require('./rule-options');

const MAX_HISTORY = 2_000;
const MAX_EVALUATIONS = 5_000;
const CREATE_STATE_TABLE = `
  CREATE TABLE IF NOT EXISTS news_bot_state (
    state_key TEXT PRIMARY KEY,
    sent_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    last_checked_at TIMESTAMPTZ
  )
`;
const CREATE_RULES_TABLE = `
  CREATE TABLE IF NOT EXISTS news_filter_rules (
    channel_id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL DEFAULT '',
    rule_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    version INTEGER NOT NULL DEFAULT 1,
    updated_by TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;
const CREATE_EVALUATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS news_article_evaluations (
    article_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    guild_id TEXT NOT NULL DEFAULT '',
    rule_version INTEGER NOT NULL,
    matches BOOLEAN NOT NULL,
    confidence DOUBLE PRECISION NOT NULL,
    severity TEXT NOT NULL,
    region_relevance TEXT NOT NULL,
    reason TEXT NOT NULL,
    matched_criteria JSONB NOT NULL DEFAULT '[]'::jsonb,
    matched_technologies JSONB NOT NULL DEFAULT '[]'::jsonb,
    matched_exclusions JSONB NOT NULL DEFAULT '[]'::jsonb,
    evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
    reading_card JSONB NOT NULL DEFAULT '{}'::jsonb,
    evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (article_id, channel_id, rule_version)
  )
`;
const ADD_EVALUATION_TECHNOLOGIES_COLUMN = `
  ALTER TABLE news_article_evaluations
  ADD COLUMN IF NOT EXISTS matched_technologies JSONB NOT NULL DEFAULT '[]'::jsonb
`;
const ADD_RULE_GUILD_COLUMN = `
  ALTER TABLE news_filter_rules
  ADD COLUMN IF NOT EXISTS guild_id TEXT NOT NULL DEFAULT ''
`;
const ADD_EVALUATION_GUILD_COLUMN = `
  ALTER TABLE news_article_evaluations
  ADD COLUMN IF NOT EXISTS guild_id TEXT NOT NULL DEFAULT ''
`;
const ADD_EVALUATION_READING_CARD_COLUMN = `
  ALTER TABLE news_article_evaluations
  ADD COLUMN IF NOT EXISTS reading_card JSONB NOT NULL DEFAULT '{}'::jsonb
`;

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw new Error(`Unable to read state file: ${error.message}`);
  }
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  await fs.rename(temporaryPath, filePath);
}

async function loadState(filePath) {
  const data = await readJson(filePath, {});
  return {
    sentIds: Array.isArray(data.sentIds) ? data.sentIds : [],
    lastCheckedAt: data.lastCheckedAt || null,
  };
}

async function saveState(filePath, state) {
  await writeJson(filePath, {
    sentIds: [...new Set(state.sentIds)].slice(-MAX_HISTORY),
    lastCheckedAt: state.lastCheckedAt,
  });
}

function createFileStateStore(filePath) {
  const filtersPath = `${filePath}.filters`;

  async function loadFilters() {
    const data = await readJson(filtersPath, {});
    return {
      rules: data.rules && typeof data.rules === 'object' ? data.rules : {},
      evaluations: data.evaluations && typeof data.evaluations === 'object'
        ? data.evaluations
        : {},
    };
  }

  return {
    kind: 'file',
    load: () => loadState(filePath),
    save: (state) => saveState(filePath, state),
    async getFilterRule(channelId) {
      const rule = (await loadFilters()).rules[channelId];
      return rule?.config?.topics?.length
        ? { ...rule, config: normalizeRuleConfig(rule.config) }
        : null;
    },
    async setFilterRule(channelId, ruleConfig, updatedBy, guildId = '') {
      const data = await loadFilters();
      const config = ruleConfig ? normalizeRuleConfig(ruleConfig) : {};
      const previous = data.rules[channelId];
      const rule = {
        channelId,
        guildId,
        config,
        version: (previous?.version || 0) + 1,
        updatedBy,
        updatedAt: new Date().toISOString(),
      };
      data.rules[channelId] = rule;
      await writeJson(filtersPath, data);
      return ruleConfig ? rule : null;
    },
    async getEvaluation(articleId, channelId, ruleVersion) {
      const data = await loadFilters();
      return data.evaluations[`${articleId}\u0000${channelId}\u0000${ruleVersion}`] || null;
    },
    async saveEvaluation(articleId, channelId, ruleVersion, decision) {
      const data = await loadFilters();
      const key = `${articleId}\u0000${channelId}\u0000${ruleVersion}`;
      data.evaluations[key] = { ...decision, evaluatedAt: new Date().toISOString() };
      const entries = Object.entries(data.evaluations).slice(-MAX_EVALUATIONS);
      data.evaluations = Object.fromEntries(entries);
      await writeJson(filtersPath, data);
    },
    close: async () => {},
  };
}

function normalizeRule(row) {
  if (!row) return null;
  return {
    channelId: row.channel_id,
    guildId: row.guild_id || '',
    config: normalizeRuleConfig(row.rule_config),
    version: row.version,
    updatedBy: row.updated_by,
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function normalizeEvaluation(row) {
  if (!row) return null;
  return {
    ...(row.reading_card && typeof row.reading_card === 'object' ? row.reading_card : {}),
    matches: row.matches,
    confidence: row.confidence,
    severity: row.severity,
    regionRelevance: row.region_relevance,
    reason: row.reason,
    matchedCriteria: Array.isArray(row.matched_criteria) ? row.matched_criteria : [],
    matchedTechnologies: Array.isArray(row.matched_technologies) ? row.matched_technologies : [],
    matchedExclusions: Array.isArray(row.matched_exclusions) ? row.matched_exclusions : [],
    evidence: Array.isArray(row.evidence) ? row.evidence : [],
    evaluatedAt: new Date(row.evaluated_at).toISOString(),
  };
}

function createPostgresStateStore(databaseUrl, pool = new Pool({ connectionString: databaseUrl })) {
  let initialized = false;

  async function initialize() {
    if (initialized) return;
    await pool.query(CREATE_STATE_TABLE);
    await pool.query(CREATE_RULES_TABLE);
    await pool.query(CREATE_EVALUATIONS_TABLE);
    await pool.query(ADD_EVALUATION_TECHNOLOGIES_COLUMN);
    await pool.query(ADD_RULE_GUILD_COLUMN);
    await pool.query(ADD_EVALUATION_GUILD_COLUMN);
    await pool.query(ADD_EVALUATION_READING_CARD_COLUMN);
    initialized = true;
  }

  return {
    kind: 'postgres',
    async load() {
      await initialize();
      const result = await pool.query(
        'SELECT sent_ids, last_checked_at FROM news_bot_state WHERE state_key = $1',
        ['default'],
      );
      if (result.rowCount === 0) return { sentIds: [], lastCheckedAt: null };
      const row = result.rows[0];
      return {
        sentIds: Array.isArray(row.sent_ids) ? row.sent_ids : [],
        lastCheckedAt: row.last_checked_at ? new Date(row.last_checked_at).toISOString() : null,
      };
    },
    async save(state) {
      await initialize();
      const sentIds = [...new Set(state.sentIds)].slice(-MAX_HISTORY);
      await pool.query(
        `INSERT INTO news_bot_state (state_key, sent_ids, last_checked_at)
         VALUES ($1, $2::jsonb, $3)
         ON CONFLICT (state_key) DO UPDATE SET
           sent_ids = EXCLUDED.sent_ids,
           last_checked_at = EXCLUDED.last_checked_at`,
        ['default', JSON.stringify(sentIds), state.lastCheckedAt],
      );
    },
    async getFilterRule(channelId, guildId = '') {
      await initialize();
      const result = await pool.query(
        `SELECT channel_id, guild_id, rule_config, version, updated_by, updated_at
         FROM news_filter_rules
         WHERE channel_id = $1 AND (guild_id = $2 OR guild_id = '')
         ORDER BY CASE WHEN guild_id = $2 THEN 0 ELSE 1 END
         LIMIT 1`,
        [channelId, guildId],
      );
      const rule = normalizeRule(result.rows[0]);
      return rule?.config?.topics?.length ? rule : null;
    },
    async setFilterRule(channelId, ruleConfig, updatedBy, guildId = '') {
      await initialize();
      const config = ruleConfig ? normalizeRuleConfig(ruleConfig) : {};
      const result = await pool.query(
        `INSERT INTO news_filter_rules (channel_id, guild_id, rule_config, version, updated_by)
         VALUES ($1, $2, $3::jsonb, 1, $4)
         ON CONFLICT (channel_id) DO UPDATE SET
           guild_id = EXCLUDED.guild_id,
           rule_config = EXCLUDED.rule_config,
           version = news_filter_rules.version + 1,
           updated_by = EXCLUDED.updated_by,
           updated_at = NOW()
         RETURNING channel_id, guild_id, rule_config, version, updated_by, updated_at`,
        [channelId, guildId, JSON.stringify(config), updatedBy],
      );
      return ruleConfig ? normalizeRule(result.rows[0]) : null;
    },
    async getEvaluation(articleId, channelId, ruleVersion) {
      await initialize();
      const result = await pool.query(
        `SELECT matches, confidence, severity, region_relevance, reason,
                matched_criteria, matched_technologies, matched_exclusions,
                evidence, reading_card, evaluated_at
         FROM news_article_evaluations
         WHERE article_id = $1 AND channel_id = $2 AND rule_version = $3`,
        [articleId, channelId, ruleVersion],
      );
      return normalizeEvaluation(result.rows[0]);
    },
    async saveEvaluation(articleId, channelId, ruleVersion, decision, guildId = '') {
      await initialize();
      await pool.query(
        `INSERT INTO news_article_evaluations
           (article_id, channel_id, guild_id, rule_version, matches, confidence, severity,
            region_relevance, reason, matched_criteria, matched_technologies,
            matched_exclusions, evidence, reading_card)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb, $14::jsonb)
         ON CONFLICT (article_id, channel_id, rule_version) DO UPDATE SET
           guild_id = EXCLUDED.guild_id,
           matches = EXCLUDED.matches,
           confidence = EXCLUDED.confidence,
           severity = EXCLUDED.severity,
           region_relevance = EXCLUDED.region_relevance,
           reason = EXCLUDED.reason,
           matched_criteria = EXCLUDED.matched_criteria,
           matched_technologies = EXCLUDED.matched_technologies,
           matched_exclusions = EXCLUDED.matched_exclusions,
           evidence = EXCLUDED.evidence,
           reading_card = EXCLUDED.reading_card,
           evaluated_at = NOW()`,
        [
          articleId,
          channelId,
          guildId,
          ruleVersion,
          decision.matches,
          decision.confidence,
          decision.severity,
          decision.regionRelevance,
          decision.reason,
          JSON.stringify(decision.matchedCriteria),
          JSON.stringify(decision.matchedTechnologies),
          JSON.stringify(decision.matchedExclusions),
          JSON.stringify(decision.evidence),
          JSON.stringify(decision),
        ],
      );
    },
    close: () => pool.end(),
  };
}

function createStateStore(config) {
  return config.databaseUrl
    ? createPostgresStateStore(config.databaseUrl)
    : createFileStateStore(config.statePath);
}

module.exports = {
  createFileStateStore,
  createPostgresStateStore,
  createStateStore,
  loadState,
  saveState,
};
