const { createHash } = require('node:crypto');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
} = require('discord.js');
const { createAiFilter } = require('./ai-filter');
const { decodeHtml, fetchNews } = require('./news-feed');
const { createStateStore } = require('./state-store');
const { RESEARCH_AREAS } = require('./rule-options');

const DIFFICULTY_LABELS = {
  beginner: '入門',
  intermediate: '中階',
  advanced: '進階',
  specialist: '專家',
};

function clipped(value, maximum = 1024) {
  const text = String(value || '').trim();
  if (text.length <= maximum) return text;
  return `${text.slice(0, maximum - 1)}…`;
}

function narrativeText(value) {
  return decodeHtml(String(value || '')
    .replace(/^\s*(?:摘要|閱讀判斷|為什麼值得讀)\s*[：:]\s*/u, '')
    .replace(/^\s*[-*•]\s+/gmu, ''));
}

function optionLabel(options, value) {
  return options.find((option) => option.value === value)?.label || value;
}

function passesDecision(decision, ruleConfig) {
  if (!decision || decision.matches !== true) return false;
  if (!Number.isFinite(decision.confidence)
      || decision.confidence < ruleConfig.confidenceThreshold) return false;
  if (!Array.isArray(decision.evidence)
      || !decision.evidence.some((item) => typeof item === 'string' && item.trim())) return false;
  if (!Array.isArray(decision.matchedExclusions) || decision.matchedExclusions.length > 0) return false;
  if (decision.readingRecommendation !== 'must_read') return false;
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
  const difficulty = DIFFICULTY_LABELS[decision?.difficulty] || decision?.difficulty;
  const embed = new EmbedBuilder()
    .setColor(0xD93025)
    .setTitle(clipped(decodeHtml(decision?.headline || article.title), 256))
    .setURL(article.url)
    .setDescription(clipped(
      narrativeText(decision?.publicSummary || article.summary || '此文章沒有摘要。'),
      1200,
    ))
    .setTimestamp(article.published)
    .setFooter({ text: decision ? `來源：${sourceName}` : sourceName });

  if (decision) {
    embed.addFields(
      {
        name: '技術焦點',
        value: clipped((decision.technicalFocus || []).join('、') || '原文未提供', 1024),
      },
      { name: '閱讀門檻', value: difficulty || '未判定', inline: true },
    );
  }

  if (!decision && article.author) embed.setAuthor({ name: article.author.slice(0, 256) });
  if (!decision && article.categories.length) {
    embed.addFields({ name: '分類', value: article.categories.join('、').slice(0, 1024) });
  }
  if (article.imageUrl) embed.setImage(article.imageUrl);
  return embed;
}

function newsDetailKey(evaluationId, channelId, ruleVersion) {
  return createHash('sha256')
    .update(`${evaluationId}\n${channelId}\n${ruleVersion}`)
    .digest('base64url')
    .slice(0, 24);
}

function createNewsMessage(article, sourceName, decision, ruleConfig, detailKey = '') {
  if (!decision) return { embeds: [createNewsEmbed(article, sourceName)] };
  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`news_detail:${detailKey}`)
      .setLabel('查看技術細節')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setLabel('閱讀原文')
      .setStyle(ButtonStyle.Link)
      .setURL(article.url),
  );
  return {
    embeds: [createNewsEmbed(article, sourceName, decision, ruleConfig)],
    components: [buttons],
    allowedMentions: { parse: [] },
  };
}

const BOUNDARY_LABELS = {
  confirmed_capability: '已證實能力',
  confirmed_exposure: '已確認曝露',
  confirmed_victim: '已確認受害',
  not_confirmed: '尚未確認',
  unknown: '原文未交代',
};

function renderAttackChainGroup(group, startAt) {
  return group.steps.map((step, index) => [
    `**${startAt + index}｜${narrativeText(step.stage)}**`,
    `**動作：**${narrativeText(step.action)}`,
    `**機制：**${narrativeText(step.mechanism)}`,
    `**結果：**${narrativeText(step.result)}`,
  ].join('\n')).join('\n\n');
}

function createTechnicalDetailReply(detail) {
  const difficulty = DIFFICULTY_LABELS[detail.difficulty] || detail.difficulty || '未判定';
  const boundaryText = (detail.evidenceBoundaries || [])
    .map((item) => `**${BOUNDARY_LABELS[item.status] || item.status}：**${narrativeText(item.claim)}`)
    .join('\n');
  const researchText = (detail.researchRelevance || [])
    .filter((item) => item.relevance !== 'low')
    .map((item) => `**${optionLabel(RESEARCH_AREAS, item.area)}：**${narrativeText(item.reason)}`)
    .join('\n');
  const overview = new EmbedBuilder()
    .setColor(0xD93025)
    .setTitle(clipped(detail.headline || '技術細節', 256))
    .setDescription(clipped(`**最後造成的結果**\n${narrativeText(detail.technicalOutcome)}`, 1000))
    .addFields(
      {
        name: '技術焦點',
        value: clipped((detail.technicalFocus || []).join('、') || '原文未提供', 1024),
      },
      { name: '閱讀門檻', value: difficulty, inline: true },
      ...(researchText ? [{ name: '研究關聯', value: clipped(researchText, 1024) }] : []),
      { name: '證據邊界', value: clipped(boundaryText || '原文未交代', 1024) },
    )
    .setFooter({ text: clipped(`來源：${detail.sourceName || '原始報導'}`, 2048) });

  let stepNumber = 1;
  const chainEmbeds = (detail.attackChainGroups || []).map((group) => {
    const description = renderAttackChainGroup(group, stepNumber);
    stepNumber += group.steps.length;
    return new EmbedBuilder()
      .setColor(0x2F3136)
      .setTitle(clipped(group.title, 256))
      .setDescription(clipped(description, 1800));
  });
  const components = detail.articleUrl
    ? [new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('閱讀原文')
        .setStyle(ButtonStyle.Link)
        .setURL(detail.articleUrl),
    )]
    : [];
  return {
    embeds: [overview, ...chainEmbeds],
    components,
    flags: MessageFlags.Ephemeral,
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

      const detailKey = newsDetailKey(evaluationId, config.channelId, rule.version);
      await stateStore.saveNewsDetail(detailKey, {
        headline: decision.headline,
        technicalFocus: decision.technicalFocus,
        technicalOutcome: decision.technicalOutcome,
        attackChainGroups: decision.attackChainGroups,
        evidenceBoundaries: decision.evidenceBoundaries,
        difficulty: decision.difficulty,
        researchRelevance: decision.researchRelevance,
        articleUrl: article.url,
        sourceName: config.sourceName,
        publishedAt: article.published.toISOString(),
      }, config.channelId, config.guildId);
      await channel.send(createNewsMessage(
        article,
        config.sourceName,
        decision,
        rule.config,
        detailKey,
      ));
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
    getNewsDetail: (detailKey) => stateStore.getNewsDetail(detailKey, config.channelId),
    close: () => stateStore.close(),
    getStatus: () => ({ running, latestResult, stateStore: stateStore.kind }),
  };
}

module.exports = {
  createNewsEmbed,
  createNewsMessage,
  createPublisher,
  createTechnicalDetailReply,
  newsDetailKey,
  passesDecision,
};
