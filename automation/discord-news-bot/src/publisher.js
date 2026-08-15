const { EmbedBuilder } = require('discord.js');
const { createAiFilter } = require('./ai-filter');
const { fetchNews } = require('./news-feed');
const { createStateStore } = require('./state-store');
const { RESEARCH_AREAS, TECHNOLOGIES, TOPICS } = require('./rule-options');

const RECOMMENDATION_LABELS = {
  must_read: '🔴 必讀',
  recommended: '🟠 建議閱讀',
  skim: '🟡 快速瀏覽',
  skip: '⚪ 可略過',
};
const DIFFICULTY_LABELS = {
  beginner: '入門',
  intermediate: '中階',
  advanced: '進階',
  specialist: '專家',
};
const RELEVANCE_LABELS = { high: '高度', medium: '中度', low: '低度' };
const RELEVANCE_ICONS = { high: '●', medium: '◐', low: '○' };

function optionLabel(options, value) {
  return options.find((option) => option.value === value)?.label || value;
}

function clipped(value, maximum = 1024) {
  const text = String(value || '').trim();
  if (text.length <= maximum) return text;
  return `${text.slice(0, maximum - 1)}…`;
}

function scoreBar(score) {
  return `${'★'.repeat(score)}${'☆'.repeat(5 - score)}`;
}

function hashtag(value) {
  return `#${String(value).replace(/[\s／、・/]+/g, '').replace(/[^\p{L}\p{N}_]/gu, '')}`;
}

function passesDecision(decision, ruleConfig) {
  if (!decision || decision.matches !== true) return false;
  if (!Number.isFinite(decision.confidence)
      || decision.confidence < ruleConfig.confidenceThreshold) return false;
  if (!Array.isArray(decision.evidence)
      || !decision.evidence.some((item) => typeof item === 'string' && item.trim())) return false;
  if (!Array.isArray(decision.matchedExclusions) || decision.matchedExclusions.length > 0) return false;
  if (decision.readingRecommendation === 'skip') return false;
  if (!Array.isArray(decision.matchedCriteria)) return false;
  const allowedTopics = new Set(ruleConfig.topics);
  if (!decision.matchedCriteria.some((criterion) => allowedTopics.has(criterion))) return false;
  if (!Array.isArray(decision.matchedTechnologies)) return false;
  if (!ruleConfig.technologies.includes('any')) {
    const allowedTechnologies = new Set(ruleConfig.technologies);
    if (!decision.matchedTechnologies.some((technology) => allowedTechnologies.has(technology))) {
      return false;
    }
  }

  const allowedSeverities = {
    critical_only: ['critical'],
    high_or_above: ['critical', 'high'],
    medium_or_above: ['critical', 'high', 'medium'],
    any: ['critical', 'high', 'medium', 'low', 'unknown'],
  };
  if (!allowedSeverities[ruleConfig.minimumSeverity]?.includes(decision.severity)) return false;

  const allowedRegions = {
    taiwan_only: ['taiwan'],
    taiwan_priority: ['taiwan', 'global_major'],
    global: ['taiwan', 'global_major', 'other', 'unknown'],
  };
  return allowedRegions[ruleConfig.regionScope]?.includes(decision.regionRelevance) === true;
}

function createNewsEmbed(article, sourceName, decision = null, ruleConfig = null) {
  const embed = new EmbedBuilder()
    .setColor(0xD93025)
    .setTitle(article.title.slice(0, 256))
    .setURL(article.url)
    .setDescription(decision?.summaryBullets?.length
      ? clipped(decision.summaryBullets.map((item) => `- ${item}`).join('\n'), 1200)
      : article.summary || '此文章沒有摘要。')
    .setTimestamp(article.published)
    .setFooter({ text: sourceName });

  if (article.author) embed.setAuthor({ name: article.author.slice(0, 256) });
  if (decision) {
    const recommendation = RECOMMENDATION_LABELS[decision.readingRecommendation]
      || decision.readingRecommendation;
    const difficulty = DIFFICULTY_LABELS[decision.difficulty] || decision.difficulty;
    const contentBasis = article.contentDepth === 'feed_content' ? 'Feed 文章內容' : '來源摘要';
    embed.setColor({ must_read: 0xD93025, recommended: 0xF29900, skim: 0xF2C94C }[
      decision.readingRecommendation
    ] || 0x6B7280);
    embed.addFields({
      name: '閱讀判斷',
      value: `${recommendation}｜難度：${difficulty}｜AI 信心：${Math.round(decision.confidence * 100)}%\n分析依據：${contentBasis}`,
    });
    if (decision.whyRead) {
      embed.addFields({ name: '為什麼值得讀', value: clipped(decision.whyRead, 700) });
    }
    const selectedAreas = new Set(ruleConfig?.researchAreas || []);
    const relevance = (decision.researchRelevance || [])
      .filter((item) => selectedAreas.size === 0 || selectedAreas.has(item.area))
      .map((item) => `${RELEVANCE_ICONS[item.relevance] || '○'} **${optionLabel(RESEARCH_AREAS, item.area)}：${RELEVANCE_LABELS[item.relevance] || item.relevance}相關** — ${item.reason}`)
      .join('\n');
    if (relevance) embed.addFields({ name: '讀書會研究方向', value: clipped(relevance, 1000) });
    if (decision.scores) {
      embed.addFields({
        name: '閱讀價值',
        value: [
          `實務價值 ${scoreBar(decision.scores.practicalValue)}`,
          `技術深度 ${scoreBar(decision.scores.technicalDepth)}`,
          `新穎程度 ${scoreBar(decision.scores.novelty)}`,
          `討論價值 ${scoreBar(decision.scores.discussionValue)}`,
        ].join('\n'),
        inline: true,
      });
    }
    embed.addFields({
      name: '先備知識',
      value: clipped(
        decision.prerequisites?.length ? decision.prerequisites.join('、') : '無特別要求',
        500,
      ),
      inline: true,
    });
    if (decision.discussionQuestions?.length) {
      embed.addFields({
        name: '讀書會討論',
        value: clipped(
          decision.discussionQuestions.map((item, index) => `${index + 1}. ${item}`).join('\n'),
          700,
        ),
      });
    }
  } else if (article.categories.length) {
    embed.addFields({ name: '分類', value: article.categories.join('、').slice(0, 1024) });
  }
  if (article.imageUrl) embed.setImage(article.imageUrl);
  return embed;
}

function createNewsMessage(article, sourceName, decision, ruleConfig) {
  if (!decision) return { embeds: [createNewsEmbed(article, sourceName)] };
  const tags = new Set([
    hashtag(RECOMMENDATION_LABELS[decision.readingRecommendation]?.replace(/^\S+\s/, '')
      || decision.readingRecommendation),
    hashtag(DIFFICULTY_LABELS[decision.difficulty] || decision.difficulty),
    ...(decision.matchedCriteria || []).map((value) => hashtag(optionLabel(TOPICS, value))),
    ...(decision.matchedTechnologies || []).map((value) => hashtag(optionLabel(TECHNOLOGIES, value))),
    ...(decision.researchRelevance || [])
      .filter((item) => item.relevance !== 'low')
      .map((item) => hashtag(optionLabel(RESEARCH_AREAS, item.area))),
  ]);
  return {
    content: [...tags].filter((value) => value !== '#').join(' ').slice(0, 2000),
    embeds: [createNewsEmbed(article, sourceName, decision, ruleConfig)],
    allowedMentions: { parse: [] },
  };
}

function createPublisher({
  channel,
  config,
  fetchNewsImpl = fetchNews,
  now = () => new Date(),
  stateStore = createStateStore(config),
  aiFilter = createAiFilter(config),
}) {
  let running = false;
  let latestResult = null;

  async function saveCheckpoint(sent, lastCheckedAt) {
    await stateStore.save({ sentIds: [...sent], lastCheckedAt });
  }

  async function runFiltered(articles, eligible, state, sent) {
    const at = now().toISOString();
    const rule = await stateStore.getFilterRule(config.channelId, config.guildId);
    if (!rule) {
      await saveCheckpoint(sent, at);
      return {
        checked: articles.length,
        evaluated: 0,
        matched: 0,
        published: 0,
        rejected: 0,
        errors: 0,
        skipped: true,
        reason: '尚未設定新聞篩選規則',
        at,
      };
    }
    if (!aiFilter) {
      await saveCheckpoint(sent, at);
      return {
        checked: articles.length,
        evaluated: 0,
        matched: 0,
        published: 0,
        rejected: 0,
        errors: 0,
        skipped: true,
        reason: 'AI 篩選未啟用或缺少 AI_BASE_URL、AI_API_KEY、AI_MODEL',
        ruleVersion: rule.version,
        at,
      };
    }

    let evaluated = 0;
    let matched = 0;
    let published = 0;
    let rejected = 0;
    let errors = 0;
    const evaluationCap = config.maxAiEvaluationsPerRun || 10;

    for (const article of eligible) {
      const evaluationId = `${aiFilter.evaluatorId}:${article.id}`;
      let decision = await stateStore.getEvaluation(evaluationId, config.channelId, rule.version);
      if (!decision) {
        if (evaluated >= evaluationCap) continue;
        try {
          decision = await aiFilter.evaluate(article, rule);
          evaluated += 1;
          await stateStore.saveEvaluation(
            evaluationId,
            config.channelId,
            rule.version,
            decision,
            config.guildId,
          );
        } catch (error) {
          evaluated += 1;
          errors += 1;
          console.error(`[AI filter] ${article.id}: ${error.message}`);
          continue;
        }
      }

      if (!passesDecision(decision, rule.config)) {
        rejected += 1;
        continue;
      }
      matched += 1;
      if (published >= config.maxArticlesPerRun) continue;

      await channel.send(createNewsMessage(article, config.sourceName, decision, rule.config));
      sent.add(article.id);
      published += 1;
      await saveCheckpoint(sent, state.lastCheckedAt);
    }

    await saveCheckpoint(sent, at);
    return {
      checked: articles.length,
      evaluated,
      matched,
      published,
      rejected,
      errors,
      ruleVersion: rule.version,
      at,
    };
  }

  async function runLegacy(articles, eligible, state, sent, isFirstRun) {
    const pending = eligible.slice(-config.maxArticlesPerRun);
    let published = 0;
    for (const article of pending) {
      await channel.send({ embeds: [createNewsEmbed(article, config.sourceName)] });
      sent.add(article.id);
      published += 1;
      await saveCheckpoint(sent, state.lastCheckedAt);
    }

    if (isFirstRun) {
      for (const article of eligible) sent.add(article.id);
    }
    const at = now().toISOString();
    await saveCheckpoint(sent, at);
    return { checked: articles.length, published, at };
  }

  async function run({ force = false } = {}) {
    if (running) return { skipped: true, reason: '新聞檢查正在執行中' };
    running = true;

    try {
      const state = await stateStore.load();
      const articles = await fetchNewsImpl(config.feedUrl);
      const cutoff = now().getTime() - config.lookbackMs;
      const sent = new Set(state.sentIds);
      const eligible = articles
        .filter((article) => force || article.published.getTime() >= cutoff)
        .filter((article) => !sent.has(article.id))
        .sort((a, b) => a.published - b.published);
      const isFirstRun = !state.lastCheckedAt;

      if (isFirstRun && config.publishInitialArticles === false) {
        for (const article of eligible) sent.add(article.id);
        const at = now().toISOString();
        await saveCheckpoint(sent, at);
        latestResult = {
          checked: articles.length,
          evaluated: 0,
          matched: 0,
          published: 0,
          rejected: 0,
          errors: 0,
          initialSync: true,
          at,
        };
        return latestResult;
      }

      latestResult = config.aiFilteringEnabled === true
        ? await runFiltered(articles, eligible, state, sent)
        : await runLegacy(articles, eligible, state, sent, isFirstRun);
      return latestResult;
    } finally {
      running = false;
    }
  }

  async function checkAiProvider() {
    if (!aiFilter) {
      return {
        ok: false,
        reason: 'AI 篩選未啟用，或缺少 AI_BASE_URL、AI_API_KEY、AI_MODEL',
      };
    }

    const startedAt = Date.now();
    const checkResult = await aiFilter.check();
    return {
      ok: true,
      httpStatus: checkResult.httpStatus,
      providerMessage: checkResult.decision.reason.slice(0, 500) || '(空白)',
      endpoint: new URL(config.aiBaseUrl).host,
      model: config.aiModel,
      latencyMs: Date.now() - startedAt,
      evaluatorId: aiFilter.evaluatorId,
    };
  }

  return {
    run,
    checkAiProvider,
    getFilterRule: () => stateStore.getFilterRule(config.channelId, config.guildId),
    setFilterRule: (ruleConfig, updatedBy) => (
      stateStore.setFilterRule(config.channelId, ruleConfig, updatedBy, config.guildId)
    ),
    close: () => stateStore.close(),
    getStatus: () => ({ running, latestResult, stateStore: stateStore.kind }),
  };
}

module.exports = { createNewsEmbed, createNewsMessage, createPublisher, passesDecision };
