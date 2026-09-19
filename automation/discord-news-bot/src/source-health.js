const FAILURE_LIMIT = 7;
const STALE_AFTER_MS = 90 * 24 * 60 * 60_000;

function iso(value) { return value instanceof Date ? value.toISOString() : new Date(value).toISOString(); }

function initialSourceHealth(source, now = new Date()) {
  return {
    sourceId: source.id,
    status: source.status || 'observing',
    firstObservedAt: iso(now),
    lastCheckedAt: null,
    lastSuccessfulAt: null,
    lastMeaningfulAt: null,
    lastArticleId: null,
    consecutiveFailures: 0,
    lastError: '',
  };
}

function latestArticle(articles) {
  return [...articles].filter((article) => Number.isFinite(new Date(article.published).getTime()))
    .sort((left, right) => new Date(right.published) - new Date(left.published))[0] || null;
}

function recordSourceSuccess(previous, articles, now = new Date()) {
  const current = { ...previous };
  const latest = latestArticle(articles);
  const meaningful = latest && latest.id !== current.lastArticleId;
  const ageAnchor = meaningful ? new Date(latest.published) : new Date(current.lastMeaningfulAt || current.firstObservedAt);
  const stale = now.getTime() - ageAnchor.getTime() >= STALE_AFTER_MS;
  return {
    ...current,
    status: current.status === 'quarantined' ? 'quarantined' : stale ? 'stale' : current.status,
    lastCheckedAt: iso(now),
    lastSuccessfulAt: iso(now),
    lastMeaningfulAt: meaningful ? iso(latest.published) : current.lastMeaningfulAt,
    lastArticleId: meaningful ? latest.id : current.lastArticleId,
    consecutiveFailures: 0,
    lastError: '',
  };
}

function recordSourceFailure(previous, error, now = new Date()) {
  const failures = (previous.consecutiveFailures || 0) + 1;
  return {
    ...previous,
    status: failures >= FAILURE_LIMIT ? 'quarantined' : previous.status,
    lastCheckedAt: iso(now),
    consecutiveFailures: failures,
    lastError: String(error?.message || error || 'Unknown source error').slice(0, 500),
  };
}

function shouldFetchSource(health) { return !['quarantined', 'stale', 'paused'].includes(health.status); }

function recoverSource(previous, now = new Date()) {
  return { ...previous, status: 'observing', consecutiveFailures: 0, lastError: '', lastCheckedAt: iso(now) };
}

module.exports = { FAILURE_LIMIT, STALE_AFTER_MS, initialSourceHealth, recordSourceFailure, recordSourceSuccess, recoverSource, shouldFetchSource };
