const test = require('node:test');
const assert = require('node:assert/strict');
const {
  fetchTaiwanDeadlineEvents,
  normalizeTaiwanDeadlineEvent,
  parseTaiwanDateRange,
} = require('../src/event-sources/taiwan-deadlines');

test('Taiwan deadline parser converts unambiguous event dates to Taipei time', () => {
  const range = parseTaiwanDateRange('May 16 09:30 - May 16 17:30', 2026);
  assert.equal(range.start.toISOString(), '2026-05-16T01:30:00.000Z');
  assert.equal(range.end.toISOString(), '2026-05-16T09:30:00.000Z');
  assert.equal(range.allDay, false);
  assert.equal(parseTaiwanDateRange('Sep 2026 - Aug 2027', 2026), null);
});

test('Taiwan deadline normalizer preserves multiple deadlines without inventing their purpose', () => {
  const event = normalizeTaiwanDeadlineEvent({
    name: 'AIS3 新型態資安暑期課程',
    year: 2026,
    date: 'Jul 20 - Jul 26',
    description: '邀請具資安實務經驗之專家授課。',
    link: 'https://ais3.org/',
    deadline: ['2026-05-02 18:00', '2026-05-31 18:00'],
    timezone: 'Asia/Taipei',
    place: 'Hsinchu, Taiwan',
    tags: ['EDU', 'ONSITE'],
    comment: '第一個期限為 Pre-exam 報名截止，第二個為甄選資料繳交截止',
  });

  assert.equal(event.kind, 'training');
  assert.equal(event.attendance, 'onsite');
  assert.equal(event.startsAt.toISOString(), '2026-07-19T16:00:00.000Z');
  assert.equal(event.deadlines.length, 2);
  assert.deepEqual(event.deadlines.map(({ kind }) => kind), ['unknown', 'unknown']);
});

test('Taiwan deadline source keeps current events and drops expired history', async () => {
  const events = await fetchTaiwanDeadlineEvents({
    url: 'https://example.test/conferences.yml',
    start: new Date('2026-04-01T00:00:00Z'),
    finish: new Date('2026-08-01T00:00:00Z'),
    fetchImpl: async () => ({
      ok: true,
      text: async () => `
- name: 初階資安攻防演練(AIS3 MyFirstCTF)
  year: 2026
  date: May 16 09:30 - May 16 17:30
  description: 為初學者舉辦的 CTF 競賽。
  link: https://ais3.org/mfctf/
  deadline:
    - "2026-04-19 17:00"
  timezone: Asia/Taipei
  place: Hsinchu, Taiwan
  tags: [EDU, ONSITE]
- name: Old Event
  year: 2024
  date: May 1
  link: https://example.test/old
  deadline:
    - "2024-04-01 12:00"
  timezone: Asia/Taipei
`,
    }),
  });

  assert.equal(events.length, 1);
  assert.match(events[0].title, /MyFirstCTF/u);
  assert.equal(events[0].deadlines[0].kind, 'unknown');
  assert.deepEqual(events[0].audience, []);
});
