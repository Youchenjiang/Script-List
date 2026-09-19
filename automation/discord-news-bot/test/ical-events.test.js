const test = require('node:test');
const assert = require('node:assert/strict');
const {
  fetchIcalEvents, googleCalendarEventUrl, parseIcalDate, parseIcalEvents,
} = require('../src/event-sources/ical');

const source = {
  id: 'club',
  name: 'Security Club',
  calendarUrl: 'https://calendar.google.com/calendar/ical/club/public/basic.ics',
  calendarId: 'club@example.com',
  timeZone: 'Asia/Taipei',
  audience: ['student'],
  includeKeywords: ['資安|Security|CTF'],
};

const calendar = `BEGIN:VCALENDAR\r
BEGIN:VEVENT\r
DTSTART:20261007T103000Z\r
DTEND:20261007T130000Z\r
UID:web-security@example.com\r
DESCRIPTION:從 HTTP 開始\\n練習常見 Web 漏洞\r
LOCATION:EC329\\, Engineering Building\r
SUMMARY:第一次社課 - Web Security\r
STATUS:CONFIRMED\r
END:VEVENT\r
BEGIN:VEVENT\r
DTSTART;VALUE=DATE:20261010\r
DTEND;VALUE=DATE:20261011\r
UID:algorithm@example.com\r
SUMMARY:演算法培訓\r
END:VEVENT\r
BEGIN:VEVENT\r
DTSTART:20261014T183000\r
DTEND:20261014T210000\r
UID:cancelled@example.com\r
SUMMARY:資安課程\r
STATUS:CANCELLED\r
END:VEVENT\r
END:VCALENDAR`;

test('iCalendar parser unfolds fields, filters irrelevant events and creates stable public links', () => {
  const events = parseIcalEvents(calendar, source);
  assert.equal(events.length, 1);
  assert.equal(events[0].id, 'ical:club:web-security@example.com');
  assert.equal(events[0].startsAt.toISOString(), '2026-10-07T10:30:00.000Z');
  assert.equal(events[0].description, '從 HTTP 開始 練習常見 Web 漏洞');
  assert.equal(events[0].location, 'EC329, Engineering Building');
  assert.equal(events[0].kind, 'training');
  assert.equal(events[0].officialUrl, googleCalendarEventUrl('web-security@example.com', 'club@example.com'));
});

test('iCalendar dates support all-day, UTC and TZID values', () => {
  assert.equal(parseIcalDate('20261010', { VALUE: 'DATE' }, 'Asia/Taipei').allDay, true);
  assert.equal(parseIcalDate('20261007T103000Z').date.toISOString(), '2026-10-07T10:30:00.000Z');
  assert.equal(
    parseIcalDate('20261007T183000', { TZID: 'Asia/Taipei' }).date.toISOString(),
    '2026-10-07T10:30:00.000Z',
  );
});

test('iCalendar fetch keeps only events that have not started within the lookahead window', async () => {
  const events = await fetchIcalEvents({
    source,
    start: new Date('2026-09-19T00:00:00Z'),
    finish: new Date('2026-10-08T00:00:00Z'),
    fetchImpl: async (url, options) => {
      assert.equal(url, source.calendarUrl);
      assert.match(options.headers.Accept, /text\/calendar/u);
      return { ok: true, text: async () => calendar };
    },
  });
  assert.equal(events.length, 1);
});
