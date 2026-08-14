const test = require('node:test');
const assert = require('node:assert/strict');
const { buildCommands } = require('../src/deploy-commands');

test('Discord command definition exposes guided rule setup', () => {
  const commands = buildCommands();
  const ruleCommand = commands.find((command) => command.name === 'news_rule');
  assert.ok(ruleCommand);
  assert.deepEqual(ruleCommand.options.map((option) => option.name), ['setup', 'show', 'clear']);
});
