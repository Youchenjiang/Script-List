const test = require('node:test');
const assert = require('node:assert/strict');
const { isEligibleEvent } = require('../src/event-eligibility');

test('student calendars require public access and a security topic', () => {
  const event = { sourceId: 'ical:bamboofox', title: 'Web Security 工作坊' };
  assert.equal(isEligibleEvent(event), false);
  assert.equal(isEligibleEvent({ ...event, description: '對外開放，歡迎校外參加' }), true);
  assert.equal(isEligibleEvent({ ...event, description: '不對外開放' }), false);
  assert.equal(isEligibleEvent({ ...event, title: 'Git Workshop', description: '公開報名' }), false);
  assert.equal(isEligibleEvent({ ...event, sourceId: 'ical:scist' }), false);
});

test('routine club activities are excluded across sources', () => {
  for (const title of ['第一次社課 - Web Security', '社團迎新', '社團博覽會', '資安助教時間', '資安內部培訓']) {
    assert.equal(isEligibleEvent({ sourceId: 'kktix:example', title, description: '公開報名' }), false);
  }
  assert.equal(isEligibleEvent({ sourceId: 'ctftime', title: 'Example CTF' }), true);
  assert.equal(isEligibleEvent({ sourceId: 'kktix:example', title: '資安社群小聚' }), true);
});
