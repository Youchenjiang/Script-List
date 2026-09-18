const test = require('node:test');
const assert = require('node:assert/strict');
const { createEventMessage, createEventPublisher } = require('../src/event-publisher');

function sampleEvent() {
  return {
    id: 'ctftime:3504',
    title: 'Holmes CTF 2026: The Reichenbach Directive',
    url: 'https://ctf.hackthebox.com/event/details/holmes-3504',
    start: new Date('2026-09-18T04:00:00Z'),
    finish: new Date('2026-09-22T09:00:00Z'),
    allDay: false,
    teamSize: '5人',
  };
}

test('event announcement follows the compact format and converts to Taiwan time', () => {
  const message = createEventMessage(sampleEvent(), 'Asia/Taipei');
  assert.equal(message.content, [
    '[Holmes CTF 2026: The Reichenbach Directive](https://ctf.hackthebox.com/event/details/holmes-3504)',
    '⏱️20260918',
    '📅 20260918 12:00～20260922 17:00（台灣時間）',
    '5人',
  ].join('\n'));
  assert.deepEqual(message.allowedMentions, { parse: [] });
});

test('event publisher runs once per local day and persists deduplication state', async () => {
  const sentMessages = [];
  let savedState = { sentIds: [], lastCheckedAt: null };
  const stateStore = {
    kind: 'memory',
    loadNamedState: async () => ({ ...savedState, sentIds: [...savedState.sentIds] }),
    saveNamedState: async (_key, state) => { savedState = { ...state, sentIds: [...state.sentIds] }; },
  };
  const config = {
    eventChannelId: 'events',
    eventTimeZone: 'Asia/Taipei',
    eventScanHour: 9,
    maxEventsPerRun: 5,
  };
  const publisher = createEventPublisher({
    channel: { send: async (message) => sentMessages.push(message) },
    config,
    stateStore,
    now: () => new Date('2026-09-18T04:30:00Z'),
    fetchEventsImpl: async () => ({ events: [sampleEvent()], errors: [] }),
  });

  assert.equal((await publisher.run()).published, 1);
  assert.equal((await publisher.run()).skipped, true);
  assert.equal((await publisher.run({ force: true })).published, 0);
  assert.equal(sentMessages.length, 1);
  assert.deepEqual(savedState.sentIds, ['ctftime:3504']);
});

test('event publisher waits until the configured local scan hour', async () => {
  const publisher = createEventPublisher({
    channel: { send: async () => { throw new Error('should not publish'); } },
    config: {
      eventChannelId: 'events',
      eventTimeZone: 'Asia/Taipei',
      eventScanHour: 9,
      maxEventsPerRun: 5,
    },
    stateStore: {
      kind: 'memory',
      loadNamedState: async () => ({ sentIds: [], lastCheckedAt: null }),
      saveNamedState: async () => {},
    },
    now: () => new Date('2026-09-17T23:30:00Z'),
    fetchEventsImpl: async () => { throw new Error('should not fetch'); },
  });

  const result = await publisher.run();
  assert.equal(result.skipped, true);
  assert.match(result.reason, /09:00/u);
});
