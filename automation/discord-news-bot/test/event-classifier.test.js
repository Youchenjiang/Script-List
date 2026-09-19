const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyEvent } = require('../src/event-classifier');

function event(overrides = {}) {
  return {
    title: 'Security event',
    description: '',
    kind: 'competition',
    directions: [],
    topics: [],
    level: 'unspecified',
    participation: 'unspecified',
    evidence: {},
    ...overrides,
  };
}

test('classifier requires attack and detection evidence for inferred purple-team events', () => {
  const result = classifyEvent(event({
    description: 'Use Atomic Red Team for adversary emulation and detection validation.',
  }));
  assert.deepEqual(result.directions, ['purple']);
  assert.match(result.evidence.directions, /Atomic Red Team/iu);
  assert.match(result.evidence.directions, /detection validation/iu);
});

test('classifier keeps independent red and blue tracks separate from purple teaming', () => {
  const result = classifyEvent(event({
    description: 'Includes penetration testing and incident response tracks.',
  }));
  assert.deepEqual(result.directions, ['red', 'blue']);
});

test('classifier does not label a generic CTF as red team', () => {
  const result = classifyEvent(event({
    title: 'Example CTF 2026',
    description: 'Challenges include Web, Pwn, Reverse, Crypto, and Forensics.',
  }));
  assert.deepEqual(result.directions, ['unspecified']);
  assert.deepEqual(result.topics, ['web', 'pwn', 'reverse', 'crypto', 'forensics']);
});

test('classifier recognizes broad conferences, explicit levels, and participation', () => {
  const result = classifyEvent(event({
    title: 'Security Community Conference',
    kind: 'conference',
    description: 'Beginner-friendly individual registration with cloud security sessions.',
  }));
  assert.deepEqual(result.directions, ['general']);
  assert.equal(result.level, 'beginner');
  assert.equal(result.participation, 'individual');
  assert.deepEqual(result.topics, ['cloud']);
});
