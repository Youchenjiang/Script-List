const test = require('node:test');
const assert = require('node:assert/strict');
const { createRuleSetupManager } = require('../src/rule-setup');

function firstCustomId(message, index = 0) {
  return message.components[0].toJSON().components[index].custom_id;
}

test('rule setup exposes choices and saves recommended settings only after confirmation', async () => {
  const replies = [];
  const updates = [];
  const saved = [];
  const user = { id: 'user-1' };
  const manager = createRuleSetupManager({
    channelId: 'channel-1',
    async saveRule(config, userId) {
      saved.push({ config, userId });
      return { config, version: 1 };
    },
  });
  await manager.start({
    user,
    channelId: 'channel-1',
    reply: async (message) => replies.push(message),
  });

  assert.match(replies[0].content, /關注主題/);
  assert.equal(saved.length, 0);
  const recommendedId = firstCustomId(replies[0]);
  await manager.handle({
    customId: recommendedId,
    user,
    channelId: 'channel-1',
    update: async (message) => updates.push(message),
  });

  assert.match(updates[0].content, /儲存前預覽/);
  assert.equal(saved.length, 0);
  const saveId = firstCustomId(updates[0]);
  await manager.handle({
    customId: saveId,
    user,
    channelId: 'channel-1',
    update: async (message) => updates.push(message),
  });

  assert.equal(saved.length, 1);
  assert.equal(saved[0].userId, 'user-1');
  assert.ok(saved[0].config.topics.length > 0);
  assert.deepEqual(updates[1].components, []);
});

test('custom setup walks through every choice and optional notes modal', async () => {
  let message;
  let modal;
  const user = { id: 'user-2' };
  const base = { user, channelId: 'channel-1' };
  const manager = createRuleSetupManager({
    channelId: 'channel-1',
    saveRule: async (config) => ({ config, version: 1 }),
  });
  await manager.start({ ...base, reply: async (value) => { message = value; } });

  const interact = async (index, values) => {
    const customId = firstCustomId(message, index);
    await manager.handle({
      ...base,
      customId,
      values,
      update: async (value) => { message = value; },
      showModal: async (value) => { modal = value; },
    });
  };

  await interact(1);
  assert.match(message.content, /步驟 1\/6/);
  await interact(0, ['zero_day', 'supply_chain']);
  assert.match(message.content, /步驟 2\/6/);
  await interact(0, ['critical_only']);
  assert.match(message.content, /步驟 3\/6/);
  await interact(0, ['taiwan_only']);
  assert.match(message.content, /步驟 4\/6/);
  await interact(0, ['advertisement']);
  assert.match(message.content, /步驟 5\/6/);
  await interact(0, ['0.90']);
  assert.match(message.content, /步驟 6\/6/);
  await interact(0);
  assert.equal(modal.toJSON().title, 'AI 新聞補充條件');

  const modalCustomId = modal.toJSON().custom_id;
  await manager.handle({
    ...base,
    customId: modalCustomId,
    fields: { getTextInputValue: () => 'CISA KEV 一律推送' },
    update: async (value) => { message = value; },
  });
  assert.match(message.content, /CISA KEV 一律推送/);
  assert.match(message.content, /90%/);
});
