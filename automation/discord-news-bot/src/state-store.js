const fs = require('node:fs/promises');
const path = require('node:path');

const MAX_HISTORY = 2_000;

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

module.exports = { loadState, saveState };
