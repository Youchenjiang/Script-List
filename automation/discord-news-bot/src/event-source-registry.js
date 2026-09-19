const registry = require('../data/event-source-registry.json');

const MODES = new Set(['official_page', 'kktix_listing', 'recurring_watch']);
const STATUSES = new Set(['candidate', 'active', 'paused']);

function validHttpsUrl(value) {
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}

function validateEventSource(source) {
  const errors = [];
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(source?.id || '')) errors.push('invalid id');
  if (!String(source?.name || '').trim()) errors.push('missing name');
  if (!validHttpsUrl(source?.homepage)) errors.push('homepage must be HTTPS');
  if (!String(source?.sourceProject || '').includes('/')) errors.push('missing source project');
  if (!MODES.has(source?.mode)) errors.push('invalid mode');
  if (!STATUSES.has(source?.status)) errors.push('invalid status');
  if (source?.region !== 'TW') errors.push('unsupported region');
  if (!Array.isArray(source?.language) || source.language.length === 0) errors.push('missing language');
  if (!Array.isArray(source?.audience) || source.audience.length === 0) errors.push('missing audience');
  if (!Array.isArray(source?.usualAnnouncementMonths)
      || source.usualAnnouncementMonths.some((month) => !Number.isInteger(month) || month < 1 || month > 12)) {
    errors.push('invalid announcement months');
  }
  if (source?.mode === 'recurring_watch' && source.usualAnnouncementMonths.length === 0) errors.push('recurring source needs announcement months');
  if (source?.mode === 'kktix_listing') {
    if (!validHttpsUrl(source.feedUrl)) errors.push('KKTIX source needs an HTTPS feed');
    else if (!new URL(source.feedUrl).hostname.endsWith('.kktix.cc')) errors.push('KKTIX feed must use kktix.cc');
  }
  if (source?.status === 'active' && source?.mode !== 'kktix_listing') errors.push('only verified structured sources can be active');
  return errors;
}

function loadEventSourceRegistry() {
  const ids = new Set();
  return registry.map((source) => {
    const errors = validateEventSource(source);
    if (ids.has(source.id)) errors.push('duplicate id');
    ids.add(source.id);
    if (errors.length) throw new Error(`Invalid event source ${source.id || '<unknown>'}: ${errors.join(', ')}`);
    return Object.freeze({ ...source, language: [...source.language], audience: [...source.audience], usualAnnouncementMonths: [...source.usualAnnouncementMonths] });
  });
}

module.exports = { loadEventSourceRegistry, validateEventSource };
