const fs = require('node:fs/promises');
const path = require('node:path');
const { Pool } = require('pg');

const MAX_HISTORY = 2_000;
const CREATE_STATE_TABLE = `
  CREATE TABLE IF NOT EXISTS news_bot_state (
    state_key TEXT PRIMARY KEY,
    sent_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    last_checked_at TIMESTAMPTZ
  )
`;

async function loadState(filePath) {
  try {
    const data = JSON.parse(await fs.readFile(filePath, 'utf8'));
    return {
      sentIds: Array.isArray(data.sentIds) ? data.sentIds : [],
      lastCheckedAt: data.lastCheckedAt || null,
    };
  } catch (error) {
    if (error.code === 'ENOENT') return { sentIds: [], lastCheckedAt: null };
    throw new Error(`Unable to read state file: ${error.message}`);
  }
}

async function saveState(filePath, state) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const normalized = {
    sentIds: [...new Set(state.sentIds)].slice(-MAX_HISTORY),
    lastCheckedAt: state.lastCheckedAt,
  };
  const temporaryPath = `${filePath}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
  await fs.rename(temporaryPath, filePath);
}

function createFileStateStore(filePath) {
  return {
    kind: 'file',
    load: () => loadState(filePath),
    save: (state) => saveState(filePath, state),
    close: async () => {},
  };
}

function createPostgresStateStore(databaseUrl, pool = new Pool({ connectionString: databaseUrl })) {
  let initialized = false;

  async function initialize() {
    if (initialized) return;
    await pool.query(CREATE_STATE_TABLE);
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
