const { fetchSecurityEvents } = require('./event-feed');

function dateParts(date, timeZone, includeTime = false) {
  const options = {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } : {}),
  };
  return Object.fromEntries(new Intl.DateTimeFormat('en-CA', options)
    .formatToParts(date)
    .filter((part) => part.type !== 'literal')
    .map((part) => [part.type, part.value]));
}

function formatCompactDate(date, timeZone) {
  const parts = dateParts(date, timeZone);
  return `${parts.year}${parts.month}${parts.day}`;
}

function formatCompactDateTime(date, timeZone) {
  const parts = dateParts(date, timeZone, true);
  return `${parts.year}${parts.month}${parts.day} ${parts.hour}:${parts.minute}`;
}

function localHour(date, timeZone) {
  return Number(dateParts(date, timeZone, true).hour);
}

function markdownLinkTitle(value) {
  return String(value || '').replace(/[\[\]]/gu, '').trim().slice(0, 200);
}

function createEventMessage(event, timeZone = 'Asia/Taipei') {
  const dateKey = event.allDay && event.startDate
    ? event.startDate.replaceAll('-', '')
    : formatCompactDate(event.start, timeZone);
  const schedule = event.allDay
    ? `${dateKey}（時間請見活動頁）`
    : `${formatCompactDateTime(event.start, timeZone)}～${formatCompactDateTime(event.finish, timeZone)}（台灣時間）`;
  return {
    content: [
      `[${markdownLinkTitle(event.title)}](${event.url})`,
      `⏱️${dateKey}`,
      `📅 ${schedule}`,
      event.teamSize || null,
    ].filter(Boolean).join('\n'),
    allowedMentions: { parse: [] },
  };
}

function createEventPublisher({
  channel,
  config,
  stateStore,
  fetchEventsImpl = fetchSecurityEvents,
  now = () => new Date(),
}) {
  const stateKey = `security-events:${config.eventChannelId}`;
  let running = false;
  let latestResult = null;

  async function saveCheckpoint(sent, lastCheckedAt) {
    await stateStore.saveNamedState(stateKey, { sentIds: [...sent], lastCheckedAt });
  }

  async function run({ force = false } = {}) {
    if (running) return { skipped: true, reason: '活動檢查正在執行中' };
    running = true;
    try {
      const current = now();
      const state = await stateStore.loadNamedState(stateKey);
      const currentDate = formatCompactDate(current, config.eventTimeZone);
      const previousDate = state.lastCheckedAt
        ? formatCompactDate(new Date(state.lastCheckedAt), config.eventTimeZone)
        : '';
      if (!force && previousDate === currentDate) {
        latestResult = {
          skipped: true,
          reason: '今天已完成活動檢查',
          at: current.toISOString(),
        };
        return latestResult;
      }
      if (!force && localHour(current, config.eventTimeZone) < config.eventScanHour) {
        latestResult = {
          skipped: true,
          reason: `等待每日 ${String(config.eventScanHour).padStart(2, '0')}:00 檢查`,
          at: current.toISOString(),
        };
        return latestResult;
      }

      const { events, errors } = await fetchEventsImpl(config, { now: current });
      const sent = new Set(state.sentIds);
      const pending = events
        .filter((event) => !sent.has(event.id))
        .sort((left, right) => left.start - right.start)
        .slice(0, config.maxEventsPerRun);
      let published = 0;
      for (const event of pending) {
        await channel.send(createEventMessage(event, config.eventTimeZone));
        sent.add(event.id);
        published += 1;
        await saveCheckpoint(sent, state.lastCheckedAt);
      }
      const at = current.toISOString();
      await saveCheckpoint(sent, at);
      latestResult = {
        checked: events.length,
        discovered: events.filter((event) => !state.sentIds.includes(event.id)).length,
        published,
        sourceErrors: errors,
        at,
      };
      return latestResult;
    } finally {
      running = false;
    }
  }

  return {
    run,
    getStatus: () => ({ running, latestResult, stateStore: stateStore.kind }),
  };
}

module.exports = {
  createEventMessage,
  createEventPublisher,
  formatCompactDate,
  formatCompactDateTime,
};
