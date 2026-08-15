const path = require('node:path');

function readPositiveInteger(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

function readBoolean(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase())) return true;
  if (['0', 'false', 'no', 'off'].includes(raw.trim().toLowerCase())) return false;
  throw new Error(`${name} must be true or false`);
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function loadConfig() {
  return {
    token: required('DISCORD_TOKEN'),
    clientId: process.env.DISCORD_CLIENT_ID?.trim() || '',
    guildId: process.env.DISCORD_GUILD_ID?.trim() || '',
    channelId: required('DISCORD_CHANNEL_ID'),
    pollIntervalMs: readPositiveInteger('POLL_INTERVAL_MINUTES', 30) * 60_000,
    lookbackMs: readPositiveInteger('LOOKBACK_HOURS', 48) * 60 * 60_000,
    maxArticlesPerRun: readPositiveInteger('MAX_ARTICLES_PER_RUN', 5),
    pushOnStart: readBoolean('PUSH_ON_START', true),
    publishInitialArticles: readBoolean('PUBLISH_INITIAL_ARTICLES', true),
    aiFilteringEnabled: readBoolean('AI_FILTER_ENABLED', true),
    maxAiEvaluationsPerRun: readPositiveInteger('MAX_AI_EVALUATIONS_PER_RUN', 10),
    aiMaxOutputTokens: readPositiveInteger('AI_MAX_OUTPUT_TOKENS', 1600),
    aiApiKey: process.env.AI_API_KEY?.trim() || '',
    aiBaseUrl: process.env.AI_BASE_URL?.trim() || '',
    aiModel: process.env.AI_MODEL?.trim() || '',
    feedUrl: process.env.NEWS_FEED_URL?.trim()
      || 'https://thehackernews.com/feeds/posts/default?alt=json&redirect=false&max-results=50',
    sourceName: process.env.NEWS_SOURCE_NAME?.trim() || 'The Hacker News',
    databaseUrl: process.env.DATABASE_URL?.trim() || '',
    statePath: path.join(__dirname, '..', 'data', 'state.json'),
  };
}

module.exports = { loadConfig, readBoolean, readPositiveInteger };
