require('dotenv').config();
const { PermissionFlagsBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const { loadConfig } = require('./config');

async function main() {
  const config = loadConfig();
  if (!config.clientId || !config.guildId) {
    throw new Error('DISCORD_CLIENT_ID and DISCORD_GUILD_ID are required to deploy commands');
  }

  const commands = [
    new SlashCommandBuilder().setName('ping').setDescription('檢查 Bot 延遲'),
    new SlashCommandBuilder().setName('news_status').setDescription('查看新聞推送狀態'),
    new SlashCommandBuilder()
      .setName('news_now')
      .setDescription('立即檢查並推送最新新聞')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  ].map((command) => command.toJSON());

  const rest = new REST({ version: '10' }).setToken(config.token);
  await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: commands });
  console.log(`[Deploy] Registered ${commands.length} guild command(s)`);
}

main().catch((error) => {
  console.error(`[Deploy] ${error.stack || error.message}`);
  process.exitCode = 1;
});
