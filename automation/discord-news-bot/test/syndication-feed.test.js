const test = require('node:test');
const assert = require('node:assert/strict');
const { fetchSyndicationFeed, parseSyndicationFeed } = require('../src/syndication-feed');
const { loadNewsSourceRegistry, validateNewsSource } = require('../src/news-source-registry');

test('RSS 2.0 parser normalizes content, categories and canonical links', () => {
  const articles = parseSyndicationFeed(`<?xml version="1.0"?><rss version="2.0"><channel><item>
    <guid>rss-1</guid><title>Exploit &amp; analysis</title><link>http://example.com/post</link>
    <description><![CDATA[Short <b>summary</b>]]></description><content:encoded><![CDATA[Full <b>technical</b> text<img src="https://example.com/a.png">]]></content:encoded>
    <pubDate>Fri, 18 Sep 2026 04:00:00 GMT</pubDate><dc:creator>Alice</dc:creator><category>Research</category>
  </item></channel></rss>`);
  assert.equal(articles.length, 1);
  assert.equal(articles[0].url, 'https://example.com/post');
  assert.equal(articles[0].title, 'Exploit & analysis');
  assert.equal(articles[0].analysisText, 'Full technical text');
  assert.equal(articles[0].contentDepth, 'feed_content');
  assert.deepEqual(articles[0].categories, ['Research']);
  assert.equal(articles[0].imageUrl, 'https://example.com/a.png');
});

test('Atom parser selects the alternate HTML link and supports summary-only entries', () => {
  const articles = parseSyndicationFeed(`<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><entry>
    <id>tag:example.com,2026:1</id><title type="text">Detection research</title>
    <link rel="self" href="https://example.com/feed/1"/><link rel="alternate" type="text/html" href="https://example.com/research/1"/>
    <updated>2026-09-18T04:00:00Z</updated><summary type="html">Attack &amp;amp; detection</summary>
    <author><name>Bob</name></author><category term="Blue Team"/>
  </entry></feed>`);
  assert.equal(articles.length, 1);
  assert.equal(articles[0].url, 'https://example.com/research/1');
  assert.equal(articles[0].summary, 'Attack & detection');
  assert.equal(articles[0].contentDepth, 'summary_only');
  assert.equal(articles[0].author, 'Bob');
  assert.deepEqual(articles[0].categories, ['Blue Team']);
});

test('syndication fetch preserves provider HTTP status', async () => {
  await assert.rejects(fetchSyndicationFeed('https://example.com/feed', async () => ({ ok: false, status: 429 })), /example\.com returned HTTP 429/u);
});

test('news source registry is curated, unique and disabled for delivery', () => {
  const sources = loadNewsSourceRegistry();
  assert.equal(sources.length, 9);
  assert.equal(new Set(sources.map(({ id }) => id)).size, sources.length);
  assert.ok(sources.every(({ status, delivery }) => status === 'observing' && delivery === false));
  assert.equal(sources.find(({ id }) => id === 'ctftime-rss-fallback').purpose, 'event_fallback');
});

test('news source validation rejects insecure auto-publishing entries', () => {
  const errors = validateNewsSource({ id: 'Bad ID', name: '', url: 'http://example.com', format: 'html', language: 'xx', topics: [], sourceProject: '', status: 'core', delivery: true });
  assert.ok(errors.length >= 9);
});
