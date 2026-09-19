const test = require('node:test');
const assert = require('node:assert/strict');
const { loadEventSourceRegistry, validateEventSource } = require('../src/event-source-registry');

test('event source registry activates only verified KKTIX feeds', () => {
  const sources = loadEventSourceRegistry();
  const organizers = sources.filter(({ mode }) => mode !== 'recurring_watch');
  assert.equal(organizers.length, 11);
  assert.ok(organizers.every(({ homepage }) => homepage.startsWith('https://')));
  assert.deepEqual(organizers.filter(({ status }) => status === 'active').map(({ id }) => id), ['hitcon', 'devcore-meet', 'twcsa']);
  assert.ok(organizers.filter(({ status }) => status === 'active').every(({ feedUrl }) => feedUrl.includes('.kktix.cc/events.atom')));
  assert.deepEqual(organizers.map(({ id }) => id), [
    'ais3', 'hitcon', 'devcore-meet', 'devcore-conf', 'teamt5',
    'cybersec', 'nics', 'scist', 'bamboofox', 'balsn', 'twcsa',
  ]);
});

test('recurring watches provide check months without pretending they are event dates', () => {
  const recurring = loadEventSourceRegistry().filter(({ mode }) => mode === 'recurring_watch');
  assert.deepEqual(recurring.map(({ id }) => id), ['ais3-myfirstctf-cycle', 'ais3-eof-cycle', 'golden-shield-cycle']);
  assert.ok(recurring.every(({ usualAnnouncementMonths }) => usualAnnouncementMonths.length > 0));
  assert.ok(recurring.every((source) => !Object.hasOwn(source, 'startsAt') && !Object.hasOwn(source, 'endsAt')));
});

test('event source validation rejects unsafe or incomplete registry entries', () => {
  const errors = validateEventSource({
    id: 'Bad ID', name: '', homepage: 'http://example.com', sourceProject: '', mode: 'html_scrape',
    status: 'active', region: 'US', language: [], audience: [], usualAnnouncementMonths: [0, 13],
  });
  assert.ok(errors.length >= 9);
});
