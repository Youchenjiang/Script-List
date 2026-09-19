const registry = require('../data/news-source-registry.json');

function validateNewsSource(source) {
  const errors = [];
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(source?.id || '')) errors.push('invalid id');
  if (!String(source?.name || '').trim()) errors.push('missing name');
  try {
    if (new URL(source?.url).protocol !== 'https:') errors.push('url must be HTTPS');
  } catch { errors.push('invalid url'); }
  if (!['rss', 'atom'].includes(source?.format)) errors.push('invalid format');
  if (!['zh-TW', 'zh-CN', 'en'].includes(source?.language)) errors.push('invalid language');
  if (!Array.isArray(source?.topics) || source.topics.length === 0) errors.push('missing topics');
  if (!String(source?.sourceProject || '').includes('/')) errors.push('missing source project');
  if (source?.status !== 'observing') errors.push('new sources must start in observation');
  if (source?.delivery !== false) errors.push('observed sources must not publish');
  return errors;
}

function loadNewsSourceRegistry() {
  const ids = new Set();
  return registry.map((source) => {
    const errors = validateNewsSource(source);
    if (ids.has(source.id)) errors.push('duplicate id');
    ids.add(source.id);
    if (errors.length) throw new Error(`Invalid news source ${source.id || '<unknown>'}: ${errors.join(', ')}`);
    return Object.freeze({ ...source, topics: [...source.topics] });
  });
}

module.exports = { loadNewsSourceRegistry, validateNewsSource };
