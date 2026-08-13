const { EmbedBuilder } = require('discord.js');
const { fetchNews } = require('./news-feed');
const { loadState, saveState } = require('./state-store');

function createNewsEmbed(article, sourceName) {
  const embed = new EmbedBuilder()
    .setColor(0xD93025)
    .setTitle(article.title.slice(0, 256))
    .setURL(article.url)
    .setDescription(article.summary || '點擊標題閱讀完整內容。')
    .setTimestamp(article.published)
    .setFooter({ text: sourceName });

  if (article.author) embed.setAuthor({ name: article.author.slice(0, 256) });
  if (article.categories.length) {
    embed.addFields({ name: '分類', value: article.categories.join('・').slice(0, 1024) });
  }
  if (article.imageUrl) embed.setImage(article.imageUrl);
  return embed;
}

function createPublisher({ channel, config, fetchNewsImpl = fetchNews, now = () => new Date() }) {
  let running = false;
  let latestResult = null;

  async function run({ force = false } = {}) {
    if (running) return { skipped: true, reason: 'A fetch is already running' };
    running = true;

    try {
      const state = await loadState(config.statePath);
      const articles = await fetchNewsImpl(config.feedUrl);
      const cutoff = now().getTime() - config.lookbackMs;
      const sent = new Set(state.sentIds);
      const eligible = articles
        .filter((article) => force || article.published.getTime() >= cutoff)
        .filter((article) => !sent.has(article.id))
        .sort((a, b) => a.published - b.published);
      const pending = eligible.slice(-config.maxArticlesPerRun);
      const isFirstRun = !state.lastCheckedAt;

      let published = 0;
      for (const article of pending) {
        await channel.send({ embeds: [createNewsEmbed(article, config.sourceName)] });
        sent.add(article.id);
        published += 1;
        await saveState(config.statePath, {
          sentIds: [...sent],
          lastCheckedAt: state.lastCheckedAt,
        });
      }

      // On the first successful run, older eligible items beyond the delivery cap
      // are recorded as seen. This prevents a fresh installation from draining the
      // entire historical backlog over the next several polling cycles.
      if (isFirstRun) {
        for (const article of eligible) sent.add(article.id);
      }
      await saveState(config.statePath, {
        sentIds: [...sent],
        lastCheckedAt: now().toISOString(),
      });

      latestResult = { checked: articles.length, published, at: now().toISOString() };
      return latestResult;
    } finally {
      running = false;
    }
  }

  return { run, getStatus: () => ({ running, latestResult }) };
}

module.exports = { createNewsEmbed, createPublisher };
