require('dotenv').config();
const {
  ActivityType,
  Client,
  Events,
  GatewayIntentBits,
  PermissionFlagsBits,
} = require('discord.js');
const { loadConfig } = require('./config');
const { createPublisher } = require('./publisher');
const { formatRuleConfig } = require('./rule-options');
const { createRuleSetupManager } = require('./rule-setup');

async function main() {
  const config = loadConfig();
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  let publisher;
  let ruleSetup;

  client.once(Events.ClientReady, async (readyClient) => {
    try {
      console.log(`[Bot] Logged in as ${readyClient.user.tag}`);
      readyClient.user.setPresence({
        activities: [{ name: '符合規則的資安新聞', type: ActivityType.Watching }],
        status: 'online',
      });

      const channel = await readyClient.channels.fetch(config.channelId);
      if (!channel?.isTextBased() || !('send' in channel)) {
        throw new Error(`DISCORD_CHANNEL_ID ${config.channelId} is not a sendable text channel`);
      }

      publisher = createPublisher({ channel, config });
      ruleSetup = createRuleSetupManager({
        channelId: config.channelId,
        saveRule: (ruleConfig, userId) => publisher.setFilterRule(ruleConfig, userId),
      });
      console.log(`[Bot] State store: ${config.databaseUrl ? 'PostgreSQL' : 'local file'}`);
      console.log(`[Bot] AI filtering: ${config.aiFilteringEnabled ? 'enabled' : 'disabled'}`);
      if (config.pushOnStart) await runPublisher('startup').catch(() => {});
      setInterval(() => {
        void runPublisher('schedule').catch(() => {});
      }, config.pollIntervalMs).unref();
      console.log(`[Bot] Polling every ${config.pollIntervalMs / 60_000} minute(s)`);
    } catch (error) {
      console.error(`[Bot setup] ${error.stack || error.message}`);
      readyClient.destroy();
      process.exitCode = 1;
    }
  });

  async function runPublisher(trigger) {
    try {
      const result = await publisher.run();
      console.log(`[News:${trigger}]`, result);
      return result;
    } catch (error) {
      console.error(`[News:${trigger}] ${error.stack || error.message}`);
      throw error;
    }
  }

  client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) {
      try {
        await ruleSetup?.handle(interaction);
      } catch (error) {
        console.error(`[Rule setup] ${error.stack || error.message}`);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: `規則設定失敗：${error.message}`, ephemeral: true });
        }
      }
      return;
    }
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'ping') {
      await interaction.reply({ content: `Pong! ${client.ws.ping}ms`, ephemeral: true });
      return;
    }

    if (interaction.commandName === 'news_status') {
      const status = publisher?.getStatus();
      const latest = status?.latestResult;
      const text = latest
        ? [
          `執行中：${status.running ? '是' : '否'}`,
          `上次檢查：${latest.at}`,
          `讀取 ${latest.checked} 篇／AI 新判斷 ${latest.evaluated ?? 0} 篇／符合 ${latest.matched ?? 0} 篇／推送 ${latest.published} 篇`,
          latest.reason ? `狀態：${latest.reason}` : null,
        ].filter(Boolean).join('\n')
        : '尚未完成任何一次新聞檢查。';
      await interaction.reply({ content: text, ephemeral: true });
      return;
    }

    if (interaction.commandName === 'news_rule') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({ content: '你需要「管理伺服器」權限。', ephemeral: true });
        return;
      }
      if (interaction.channelId !== config.channelId) {
        await interaction.reply({
          content: `請在指定的新聞頻道 <#${config.channelId}> 設定規則。`,
          ephemeral: true,
        });
        return;
      }
      if (!publisher) {
        await interaction.reply({ content: 'Bot 尚未完成啟動，請稍後再試。', ephemeral: true });
        return;
      }

      const action = interaction.options.getSubcommand();
      if (action === 'setup') {
        await ruleSetup.start(interaction);
        return;
      }

      await interaction.deferReply({ ephemeral: true });
      try {
        if (action === 'show') {
          const rule = await publisher.getFilterRule();
          await interaction.editReply(rule
            ? `目前規則（版本 ${rule.version}）：\n${formatRuleConfig(rule.config)}`
            : '目前沒有規則；AI 新聞推送會保持停止。');
          return;
        }
        if (action === 'clear') {
          await publisher.setFilterRule(null, interaction.user.id);
          await interaction.editReply('已清除規則；AI 新聞推送會保持停止。');
          return;
        }
      } catch (error) {
        await interaction.editReply(`規則操作失敗：${error.message}`);
      }
      return;
    }

    if (interaction.commandName === 'news_ai_check') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({ content: '你需要「管理伺服器」權限。', ephemeral: true });
        return;
      }
      if (!publisher) {
        await interaction.reply({ content: 'Bot 尚未準備完成，請稍後再試。', ephemeral: true });
        return;
      }

      await interaction.deferReply({ ephemeral: true });
      try {
        const result = await publisher.checkAiProvider();
        if (!result.ok) {
          await interaction.editReply(`AI 供應商檢查未執行：${result.reason}`);
          return;
        }
        await interaction.editReply({
          content: [
            'AI 供應商連線成功',
            `HTTP：${result.httpStatus}`,
            `端點：${result.endpoint}`,
            `模型：${result.model}`,
            'Structured Output：通過',
            `供應商訊息：${result.providerMessage}`,
            `耗時：${result.latencyMs} ms`,
          ].join('\n'),
          allowedMentions: { parse: [] },
        });
      } catch (error) {
        await interaction.editReply({
          content: `AI 供應商檢查失敗：${error.message}`,
          allowedMentions: { parse: [] },
        });
      }
      return;
    }

    if (interaction.commandName === 'news_now') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({ content: '你需要「管理伺服器」權限。', ephemeral: true });
        return;
      }
      if (!publisher) {
        await interaction.reply({ content: 'Bot 尚未完成啟動，請稍後再試。', ephemeral: true });
        return;
      }
      await interaction.deferReply({ ephemeral: true });
      try {
        const result = await runPublisher('command');
        await interaction.editReply(result.skipped
          ? `未執行推送：${result.reason}`
          : `檢查完成：讀取 ${result.checked} 篇，符合 ${result.matched ?? result.published} 篇，推送 ${result.published} 篇。`);
      } catch (error) {
        await interaction.editReply(`檢查失敗：${error.message}`);
      }
    }
  });

  let shuttingDown = false;
  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[Bot] Received ${signal}, shutting down`);
    client.destroy();
    await publisher?.close();
  }

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  await client.login(config.token);
}

main().catch((error) => {
  console.error(`[Fatal] ${error.stack || error.message}`);
  process.exitCode = 1;
});
