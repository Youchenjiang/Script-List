const test = require('node:test');
const assert = require('node:assert/strict');
const {
  fetchCtfTimeEvents,
  fetchOwaspEvents,
  parseTeamSize,
} = require('../src/event-feed');

test('event feed extracts CTF team sizes without treating participant count as a limit', () => {
  assert.equal(parseTeamSize('Team Size: 1–4 Members'), '1～4人');
  assert.equal(parseTeamSize('Teams of 5 players compete together'), '5人');
  assert.equal(parseTeamSize('Open to everyone with 500 registered participants'), '');
});

test('CTFtime source requests a bounded window and normalizes official event links', async () => {
  let requestedUrl = '';
  const events = await fetchCtfTimeEvents({
    baseUrl: 'https://ctftime.test/api/v1/events/',
    start: new Date('2026-09-18T00:00:00Z'),
    finish: new Date('2026-10-18T00:00:00Z'),
    fetchImpl: async (url) => {
      requestedUrl = String(url);
      return {
        ok: true,
        text: async () => JSON.stringify([{
          id: 3504,
          title: 'Holmes CTF 2026',
          start: '2026-09-18T04:00:00Z',
          finish: '2026-09-22T09:00:00Z',
          url: 'https://ctf.hackthebox.com/event/details/holmes-3504',
          ctftime_url: 'https://ctftime.org/event/3504/',
          description: 'Team Size: 5 Members',
          participants: 900,
          onsite: false,
        }]),
      };
    },
  });

  assert.match(requestedUrl, /limit=100/u);
  assert.match(requestedUrl, /start=1789689600/u);
  assert.equal(events[0].url, 'https://ctf.hackthebox.com/event/details/holmes-3504');
  assert.equal(events[0].teamSize, '5人');
  assert.equal(events[0].kind, 'ctf');
});

test('OWASP source parses the official events data file', async () => {
  const events = await fetchOwaspEvents({
    url: 'https://example.test/events.yml',
    fetchImpl: async () => ({
      ok: true,
      text: async () => `
- category: AppSec Days
  events:
  - name: OWASP 25th Anniversary Virtual Conference
    start-date: 2026-09-22
    dates: September 22, 2026
    url: https://owasp.example/event
    optional-text: A virtual community event.
`,
    }),
  });

  assert.equal(events.length, 1);
  assert.equal(events[0].title, 'OWASP 25th Anniversary Virtual Conference');
  assert.equal(events[0].kind, 'conference');
  assert.equal(events[0].startDate, '2026-09-22');
});
