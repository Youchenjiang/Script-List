const { ActionRowBuilder, AttachmentBuilder } = require('discord.js');
const { currentEvents, compactEvent, fingerprint, button } = require('./event-board');
const { eventStartTime } = require('./event-model');

function weekKey(now, timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now).map(({ type, value }) => [type, value]));
  const day = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
  day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7);
  return day.toISOString().slice(0, 10);
}

function weeklyData(state, config, now) {
  const limit = now.getTime() + 28 * 86400000;
  const entries = currentEvents(state, now).filter(({ event, stale }) => !stale
    && (eventStartTime(event) <= limit
      || event.deadlines.some(({ at }) => at.getTime() >= now.getTime() && at.getTime() <= limit)));
  const signature = fingerprint({ entries: entries.map(({ key, event }) => ({ key, event })), partial: Boolean(state.sourceErrors?.length) });
  const week = weekKey(now, config.eventTimeZone);
  let content = `**資安活動週報｜${week}**\n未來四週活動及報名期限\n`;
  if (state.sourceErrors?.length) content += '部分來源暫時無法更新；本期僅列已確認活動。\n';
  const complete = [];
  let shown = 0;
  for (const { event } of entries) {
    const text = compactEvent(event, config.eventTimeZone, now);
    complete.push(text);
    if (content.length + text.length <= 1700) { content += `\n${text}\n`; shown += 1; }
  }
  content += `\n共 ${entries.length} 場${shown < entries.length ? `，完整清單見附件及活動總表` : ''}。`;
  const payload = {
    content, allowedMentions: { parse: [] }, attachments: [],
    components: [new ActionRowBuilder().addComponents(button('events:view:all:0', '完整活動總表'))],
    files: shown < entries.length
      ? [new AttachmentBuilder(Buffer.from(complete.join('\n\n'), 'utf8'), { name: `activities-${week}.md` })] : [],
  };
  return { week, signature, payload, count: entries.length };
}

async function publishWeekly({ state, channel, config, now, save }) {
  if (config.eventWeeklyEnabled === false) return 0;
  const next = weeklyData(state, config, now);
  const previous = state.weekly;
  if (previous?.signature === next.signature) return 0;
  if (!next.count && previous?.week !== next.week) return 0;
  let message;
  if (previous?.week === next.week && previous.messageId) {
    try { message = await channel.messages.fetch(previous.messageId); }
    catch (error) { if (error.code !== 10008) throw error; }
  }
  if (message) await message.edit(next.payload);
  else message = await channel.send(next.payload);
  state.weekly = { week: next.week, signature: next.signature, messageId: message.id };
  await save(state);
  return previous?.week === next.week ? 0 : 1;
}

module.exports = { weekKey, weeklyData, publishWeekly };
