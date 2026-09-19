const { MessageFlags } = require('discord.js');
const { fetchSecurityEvents } = require('./event-feed');
const { isEligibleEvent } = require('./event-eligibility');
const { normalizeEventRecord, eventEndTime } = require('./event-model');
const { formatCompactDate, createEventMessage } = require('./event-publisher');
const { keyFor, boardMessage } = require('./event-board');

function createEventService({ channel, config, stateStore, fetchEventsImpl = fetchSecurityEvents, now = () => new Date() }) {
  let queue = Promise.resolve();
  let latestResult = null;
  let running = false;
  function exclusive(action) {
    const next = queue.then(action);
    queue = next.catch(() => {});
    return next;
  }
  const load = async () => (await stateStore.loadEventDocument(config.eventChannelId))
    || { events: {}, subscriptions: {}, boardId: null, lastCheckedAt: null };
  const save = (state) => stateStore.saveEventDocument(config.eventChannelId, state);
  async function updateBoard(state) {
    const payload = boardMessage(state, { timeZone: config.eventTimeZone, now: now() });
    let message;
    if (state.boardId) {
      try { message = await channel.messages.fetch(state.boardId); }
      catch (error) { if (error.code !== 10008) throw error; }
    }
    if (message) await message.edit(payload);
    else {
      message = await channel.send({ ...payload, flags: MessageFlags.SuppressNotifications });
      state.boardId = message.id;
      await save(state);
    }
    try { if (!message.pinned) await message.pin(); }
    catch (error) { return `活動總表無法置頂：${error.message}`; }
    return null;
  }
  async function run({ force = false } = {}) {
    if (running) return { skipped: true, reason: '活動檢查正在執行中' };
    running = true;
    try {
      return await exclusive(async () => {
        const current = now();
        const state = await load();
        const today = formatCompactDate(current, config.eventTimeZone);
        const hour = Number(new Intl.DateTimeFormat('en', { timeZone: config.eventTimeZone, hour: '2-digit', hourCycle: 'h23' }).format(current));
        if (!force && (state.lastCompletedAt && formatCompactDate(new Date(state.lastCompletedAt), config.eventTimeZone) === today
          || hour < config.eventScanHour)) return { skipped: true, reason: '等待每日活動更新', at: current.toISOString() };
        const { events, errors } = await fetchEventsImpl(config, { now: current });
        const old = state.events || {};
        const updated = {};
        // A partial outage must not erase otherwise valid activities.
        if (errors.length) for (const [key, record] of Object.entries(old)) {
          const event = normalizeEventRecord(record.event);
          if (event && isEligibleEvent(event) && eventEndTime(event) >= current.getTime()) updated[key] = { ...record, stale: true };
        }
        for (const raw of events) {
          const event = normalizeEventRecord(raw);
          if (!event || !isEligibleEvent(event) || eventEndTime(event) < current.getTime()) continue;
          const aliasKey = Object.keys(old).find((key) => old[key].event.aliases?.some((id) => event.aliases.includes(id)));
          updated[aliasKey || keyFor(event)] = { event, verifiedAt: current.toISOString(), stale: false };
        }
        state.events = updated;
        state.lastCheckedAt = current.toISOString();
        await save(state);
        const boardError = await updateBoard(state);
        state.lastCompletedAt = current.toISOString();
        await save(state);
        latestResult = { checked: events.length, discovered: Object.keys(updated).filter((key) => !old[key]).length,
          published: 0, boardId: state.boardId, sourceErrors: [...errors, ...(boardError ? [boardError] : [])], at: state.lastCheckedAt };
        return latestResult;
      });
    } finally { running = false; }
  }
  async function handle(interaction) {
    if (!interaction.customId?.startsWith('events:')) return false;
    if (interaction.channelId !== config.eventChannelId || interaction.guildId !== channel.guild.id) {
      await interaction.reply({ content: '請從活動頻道使用此功能。', flags: MessageFlags.Ephemeral });
      return true;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await exclusive(async () => {
      const state = await load();
      const [, action, filter, page] = interaction.customId.split(':');
      if (action === 'view') {
        await interaction.editReply(boardMessage(state, { timeZone: config.eventTimeZone, now: now(), filter, page: Number(page) }));
      } else if (action === 'select') {
        const event = normalizeEventRecord(state.events[interaction.values[0]]?.event);
        await interaction.editReply(event ? createEventMessage(event, config.eventTimeZone, now()) : { content: '活動已結束或不再列入總表。' });
      }
    });
    return true;
  }
  return { run, handle, getStatus: () => ({ running, latestResult, stateStore: stateStore.kind }) };
}

module.exports = { createEventService };
