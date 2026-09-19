const { loadNewsSourceRegistry } = require('./news-source-registry');
const { fetchSyndicationFeed } = require('./syndication-feed');
const { initialSourceHealth, recordSourceFailure, recordSourceSuccess, shouldFetchSource } = require('./source-health');

function createSourceObserver({ config, stateStore, fetchFeed = fetchSyndicationFeed, now = () => new Date() }) {
  let running = false;
  let latestResult = null;

  async function run() {
    if (running) return { skipped: true, reason: '來源觀察正在執行中' };
    running = true;
    try {
      const current = now();
      const candidates = [];
      for (const source of loadNewsSourceRegistry()) {
        const health = await stateStore.loadSourceHealth(source.id) || initialSourceHealth(source, current);
        if (shouldFetchSource(health)) candidates.push({ source, health });
      }
      candidates.sort((left, right) => {
        const leftTime = left.health.lastCheckedAt ? new Date(left.health.lastCheckedAt).getTime() : 0;
        const rightTime = right.health.lastCheckedAt ? new Date(right.health.lastCheckedAt).getTime() : 0;
        return leftTime - rightTime;
      });
      const selected = candidates.slice(0, config.maxSourcesPerRun);
      const failures = [];
      let succeeded = 0;
      for (const { source, health } of selected) {
        try {
          const articles = await fetchFeed(source.url);
          await stateStore.saveSourceHealth(source.id, recordSourceSuccess(health, articles, current));
          succeeded += 1;
        } catch (error) {
          await stateStore.saveSourceHealth(source.id, recordSourceFailure(health, error, current));
          failures.push({ sourceId: source.id, message: error.message });
        }
      }
      latestResult = { checked: selected.length, succeeded, failed: failures.length, failures, at: current.toISOString() };
      return latestResult;
    } finally { running = false; }
  }

  return { run, getStatus: () => ({ running, latestResult }) };
}

module.exports = { createSourceObserver };
