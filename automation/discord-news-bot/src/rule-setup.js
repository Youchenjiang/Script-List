const { randomUUID } = require('node:crypto');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const {
  CONFIDENCE_LEVELS,
  EXCLUSIONS,
  REGIONS,
  SEVERITIES,
  TOPICS,
  cloneDefaultRule,
  formatRuleConfig,
  normalizeRuleConfig,
} = require('./rule-options');

const SESSION_TTL_MS = 10 * 60_000;
const PREFIX = 'newsrule';

function actionId(session, action) {
  return `${PREFIX}:${session.id}:${action}`;
}

function optionBuilders(options, selected = []) {
  const defaults = new Set(selected);
  return options.map((option) => new StringSelectMenuOptionBuilder()
    .setLabel(option.label)
    .setDescription(option.description)
    .setValue(option.value)
    .setDefault(defaults.has(option.value)));
}

function selectRow(session, action, placeholder, options, selected, { min = 1, max = 1 } = {}) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(actionId(session, action))
    .setPlaceholder(placeholder)
    .setMinValues(min)
    .setMaxValues(max)
    .addOptions(optionBuilders(options, selected));
  return new ActionRowBuilder().addComponents(menu);
}

function buttonRow(buttons) {
  return new ActionRowBuilder().addComponents(buttons.map((button) => new ButtonBuilder()
    .setCustomId(button.customId)
    .setLabel(button.label)
    .setStyle(button.style)));
}

function overview(session) {
  return {
    content: [
      '**AI 新聞規則設定**',
      '接下來可設定：關注主題、嚴重程度、地區、排除內容、AI 信心門檻與補充條件。',
      '你可以直接使用建議設定，或由 Bot 一步一步列出選項。',
    ].join('\n'),
    components: [buttonRow([
      { customId: actionId(session, 'recommended'), label: '使用建議設定', style: ButtonStyle.Success },
      { customId: actionId(session, 'custom'), label: '逐步自訂', style: ButtonStyle.Primary },
      { customId: actionId(session, 'cancel'), label: '取消', style: ButtonStyle.Secondary },
    ])],
  };
}

function topicsStep(session) {
  return {
    content: '**步驟 1/6：想接收哪些新聞主題？**\n可複選；每個選項都附有說明。',
    components: [selectRow(
      session,
      'topics',
      '選擇一個或多個主題',
      TOPICS,
      session.draft.topics,
      { min: 1, max: TOPICS.length },
    )],
  };
}

function severityStep(session) {
  return {
    content: '**步驟 2/6：最低嚴重程度？**\nAI 只能依文章中的明確證據判斷，不會猜測 CVSS。',
    components: [selectRow(
      session,
      'severity',
      '選擇嚴重程度',
      SEVERITIES,
      [session.draft.minimumSeverity],
    )],
  };
}

function regionStep(session) {
  return {
    content: '**步驟 3/6：關注哪些地區？**',
    components: [selectRow(
      session,
      'region',
      '選擇地區範圍',
      REGIONS,
      [session.draft.regionScope],
    )],
  };
}

function exclusionsStep(session) {
  const options = [
    ...EXCLUSIONS,
    { value: 'none', label: '不排除任何類型', description: '略過所有預設排除項目' },
  ];
  const selected = session.draft.exclusions.length ? session.draft.exclusions : ['none'];
  return {
    content: '**步驟 4/6：要排除哪些內容？**\n可複選；選擇「不排除」會清空其他排除項目。',
    components: [selectRow(
      session,
      'exclusions',
      '選擇要排除的內容',
      options,
      selected,
      { min: 1, max: options.length },
    )],
  };
}

function confidenceStep(session) {
  return {
    content: '**步驟 5/6：AI 判斷至少要多有把握？**',
    components: [selectRow(
      session,
      'confidence',
      '選擇信心門檻',
      CONFIDENCE_LEVELS,
      [session.draft.confidenceThreshold.toFixed(2)],
    )],
  };
}

function notesStep(session) {
  return {
    content: '**步驟 6/6：是否加入補充條件？**\n這是選填項目，主要規則仍由前面的結構化選項控制。',
    components: [buttonRow([
      { customId: actionId(session, 'add_notes'), label: '新增補充條件', style: ButtonStyle.Primary },
      { customId: actionId(session, 'skip_notes'), label: '略過', style: ButtonStyle.Secondary },
      { customId: actionId(session, 'cancel'), label: '取消', style: ButtonStyle.Danger },
    ])],
  };
}

function preview(session) {
  return {
    content: `**儲存前預覽**\n${formatRuleConfig(session.draft)}\n\n確認後才會取代目前規則。`,
    components: [buttonRow([
      { customId: actionId(session, 'save'), label: '確認儲存', style: ButtonStyle.Success },
      { customId: actionId(session, 'back'), label: '返回修改', style: ButtonStyle.Primary },
      { customId: actionId(session, 'cancel'), label: '取消', style: ButtonStyle.Secondary },
    ])],
  };
}

function notesModal(session) {
  const input = new TextInputBuilder()
    .setCustomId('notes')
    .setLabel('補充條件')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('例如：CISA 已知遭利用漏洞一律推送')
    .setMaxLength(1000)
    .setRequired(false);
  if (session.draft.notes) input.setValue(session.draft.notes);
  return new ModalBuilder()
    .setCustomId(actionId(session, 'notes_modal'))
    .setTitle('AI 新聞補充條件')
    .addComponents(new ActionRowBuilder().addComponents(input));
}

function createRuleSetupManager({ channelId, saveRule }) {
  const sessions = new Map();

  function createSession(interaction) {
    for (const [id, existing] of sessions) {
      if (existing.userId === interaction.user.id) sessions.delete(id);
    }
    const session = {
      id: randomUUID(),
      userId: interaction.user.id,
      channelId: interaction.channelId,
      expiresAt: Date.now() + SESSION_TTL_MS,
      draft: cloneDefaultRule(),
    };
    sessions.set(session.id, session);
    const timer = setTimeout(() => sessions.delete(session.id), SESSION_TTL_MS);
    timer.unref();
    return session;
  }

  function resolveSession(interaction) {
    const [prefix, sessionId, action] = interaction.customId.split(':');
    if (prefix !== PREFIX) return null;
    const session = sessions.get(sessionId);
    if (!session || session.expiresAt <= Date.now()) {
      sessions.delete(sessionId);
      return { expired: true, action };
    }
    if (session.userId !== interaction.user.id || session.channelId !== interaction.channelId) {
      return { forbidden: true, action };
    }
    return { session, action };
  }

  async function rejectInvalidSession(interaction, resolved) {
    const content = resolved?.forbidden
      ? '這個設定流程屬於另一位使用者。'
      : '設定流程已逾時，請重新執行 `/news_rule setup`。';
    await interaction.reply({ content, flags: MessageFlags.Ephemeral });
  }

  return {
    async start(interaction) {
      if (interaction.channelId !== channelId) {
        await interaction.reply({
          content: `請在指定的新聞頻道 <#${channelId}> 設定規則。`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const session = createSession(interaction);
      await interaction.reply({ ...overview(session), flags: MessageFlags.Ephemeral });
    },

    async handle(interaction) {
      if (!interaction.customId?.startsWith(`${PREFIX}:`)) return false;
      const resolved = resolveSession(interaction);
      if (!resolved?.session) {
        await rejectInvalidSession(interaction, resolved);
        return true;
      }
      const { session, action } = resolved;

      if (action === 'recommended') {
        session.draft = cloneDefaultRule();
        await interaction.update(preview(session));
      } else if (action === 'custom' || action === 'back') {
        await interaction.update(topicsStep(session));
      } else if (action === 'topics') {
        session.draft.topics = [...interaction.values];
        await interaction.update(severityStep(session));
      } else if (action === 'severity') {
        [session.draft.minimumSeverity] = interaction.values;
        await interaction.update(regionStep(session));
      } else if (action === 'region') {
        [session.draft.regionScope] = interaction.values;
        await interaction.update(exclusionsStep(session));
      } else if (action === 'exclusions') {
        session.draft.exclusions = interaction.values.includes('none')
          ? []
          : [...interaction.values];
        await interaction.update(confidenceStep(session));
      } else if (action === 'confidence') {
        session.draft.confidenceThreshold = Number(interaction.values[0]);
        await interaction.update(notesStep(session));
      } else if (action === 'add_notes') {
        await interaction.showModal(notesModal(session));
      } else if (action === 'skip_notes') {
        session.draft.notes = '';
        await interaction.update(preview(session));
      } else if (action === 'notes_modal') {
        session.draft.notes = interaction.fields.getTextInputValue('notes').trim();
        await interaction.update(preview(session));
      } else if (action === 'save') {
        const rule = await saveRule(normalizeRuleConfig(session.draft), interaction.user.id);
        sessions.delete(session.id);
        await interaction.update({
          content: `已儲存規則版本 ${rule.version}。\n${formatRuleConfig(rule.config)}`,
          components: [],
        });
      } else if (action === 'cancel') {
        sessions.delete(session.id);
        await interaction.update({ content: '已取消設定，原有規則沒有變更。', components: [] });
      }
      return true;
    },
  };
}

module.exports = { createRuleSetupManager };
