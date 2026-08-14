const { PermissionFlagsBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const { loadConfig } = require('./config');

function buildCommands() {
  return [
    new SlashCommandBuilder().setName('ping').setDescription('檢查 Bot 是否在線'),
    new SlashCommandBuilder().setName('news_status').setDescription('查看新聞推送狀態'),
    new SlashCommandBuilder()
      .setName('news_now')
      .setDescription('立即執行一次新聞檢查')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    new SlashCommandBuilder()
      .setName('news_rule')
      .setDescription('管理這個新聞頻道的 AI 篩選規則')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addSubcommand((subcommand) => subcommand
        .setName('setup')
        .setDescription('由 Bot 逐步引導設定 AI 篩選規則'))
      .addSubcommand((subcommand) => subcommand
        .setName('show')
        .setDescription('顯示目前的 AI 篩選規則'))
      .addSubcommand((subcommand) => subcommand
        .setName('clear')
        .setDescription('清除規則並停止 AI 新聞推送')),
  ].map((command) => command.toJSON());
}

async function main() {
  require('dotenv').config();
  const config = loadConfig();
  if (!config.clientId || !config.guildId) {
    throw new Error('DISCORD_CLIENT_ID and DISCORD_GUILD_ID are required to deploy commands');
  }

  const commands = buildCommands();
  const rest = new REST({ version: '10' }).setToken(config.token);
  await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: commands });
  console.log(`[Deploy] Registered ${commands.length} guild command(s)`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[Deploy] ${error.stack || error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { buildCommands };
