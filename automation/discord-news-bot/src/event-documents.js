const fs = require('node:fs/promises');
const path = require('node:path');

// Each channel document is replaced under the activity service's single execution queue.
function createEventDocuments({ pool, filePath }) {
  let ready;
  async function initialize() {
    if (!ready) ready = pool.query(`CREATE TABLE IF NOT EXISTS bot_event_documents (
      channel_id TEXT PRIMARY KEY, document JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`).catch((error) => { ready = null; throw error; });
    await ready;
  }
  function filename(channelId) {
    if (!/^\d+$/u.test(channelId)) throw new Error('Invalid event channel id');
    return `${filePath}.events-${channelId}`;
  }
  return {
    async loadEventDocument(channelId) {
      if (pool) {
        await initialize();
        const result = await pool.query('SELECT document FROM bot_event_documents WHERE channel_id = $1', [channelId]);
        return result.rows[0]?.document || null;
      }
      try { return JSON.parse(await fs.readFile(filename(channelId), 'utf8')); }
      catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    },
    async saveEventDocument(channelId, document) {
      if (pool) {
        await initialize();
        await pool.query(`INSERT INTO bot_event_documents (channel_id, document) VALUES ($1, $2::jsonb)
          ON CONFLICT (channel_id) DO UPDATE SET document = EXCLUDED.document, updated_at = NOW()`,
        [channelId, JSON.stringify(document)]);
        return;
      }
      const target = filename(channelId);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(`${target}.tmp`, JSON.stringify(document), 'utf8');
      await fs.rename(`${target}.tmp`, target);
    },
  };
}

module.exports = { createEventDocuments };
