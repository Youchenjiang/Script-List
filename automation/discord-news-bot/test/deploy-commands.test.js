const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { AVATAR_PATH, BOT_NAME } = require('../src/deploy-branding');
const { buildCommands } = require('../src/deploy-commands');

test('Discord command definition exposes guided rule setup', () => {
  const commands = buildCommands();
  assert.ok(commands.some((command) => command.name === 'news_ai_check'));
  const ruleCommand = commands.find((command) => command.name === 'news_rule');
  assert.ok(ruleCommand);
  assert.deepEqual(ruleCommand.options.map((option) => option.name), ['setup', 'show', 'clear']);
});

test('Discord branding uses the bundled Cyber News Sentinel avatar', () => {
  assert.equal(BOT_NAME, 'Cyber News Sentinel');
  assert.equal(fs.existsSync(AVATAR_PATH), true);
});
