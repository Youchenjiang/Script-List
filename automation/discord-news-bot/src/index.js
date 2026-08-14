require('dotenv').config();
const { ActivityType, Client, Events, GatewayIntentBits } = require('discord.js');
const { loadConfig } = require('./config');
const { createPublisher } = require('./publisher');

async function main() {
  const config = loadConfig();
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  let publisher;

  client.once(Events.ClientReady, async (readyClient) => {
    try {
      console.log(`[Bot] Logged in as ${readyClient.user.tag}`);
      readyClient.user.setPresence({
        activities: [{ name: '資安新聞', type: ActivityType.Watching }],
        status: 'online',
      });

      const channel = await readyClient.channels.fetch(config.channelId);
      if (!channel?.isTextBased() || !('send' in channel)) {
        throw new Error(`DISCORD_CHANNEL_ID ${config.channelId} is not a sendable text channel`);
      }

      publisher = createPublisher({ channel, config });
      console.log(`[Bot] State store: ${config.databaseUrl ? 'PostgreSQL' : 'local file'}`);
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
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'ping') {
      await interaction.reply({ content: `Pong! ${client.ws.ping}ms`, ephemeral: true });
      return;
    }

    if (interaction.commandName === 'news_status') {
      const status = publisher?.getStatus();
      const latest = status?.latestResult;
      const text = latest
        ? `執行中：${status.running ? '是' : '否'}\n上次檢查：${latest.at}\n取得 ${latest.checked} 篇，推送 ${latest.published} 篇。`
        : '尚未完成任何新聞檢查。';
      await interaction.reply({ content: text, ephemeral: true });
      return;
    }

    if (interaction.commandName === 'news_now') {
      if (!interaction.memberPermissions?.has('ManageGuild')) {
        await interaction.reply({ content: '需要「管理伺服器」權限。', ephemeral: true });
        return;
      }
      await interaction.deferReply({ ephemeral: true });
      try {
        const result = await runPublisher('command');
        await interaction.editReply(result.skipped
          ? '已有新聞檢查正在執行。'
          : `檢查完成：取得 ${result.checked} 篇，推送 ${result.published} 篇。`);
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
