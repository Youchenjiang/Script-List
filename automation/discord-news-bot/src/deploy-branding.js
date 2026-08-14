const path = require('node:path');
const { Client, GatewayIntentBits } = require('discord.js');

const BOT_NAME = 'Cyber News Sentinel';
const AVATAR_PATH = path.join(__dirname, '..', 'assets', 'cyber-news-sentinel-avatar.png');

async function main() {
  require('dotenv').config();
  if (!process.env.DISCORD_TOKEN) throw new Error('DISCORD_TOKEN is required to deploy branding');

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  try {
    await client.login(process.env.DISCORD_TOKEN);
    await client.user.edit({ username: BOT_NAME, avatar: AVATAR_PATH });
    console.log(`[Branding] Updated bot to ${BOT_NAME}`);
  } finally {
    client.destroy();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[Branding] ${error.stack || error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { AVATAR_PATH, BOT_NAME };
