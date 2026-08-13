const test = require('node:test');
const assert = require('node:assert/strict');
const { decodeHtml, parseBloggerFeed } = require('../src/news-feed');

test('decodeHtml removes markup and decodes entities', () => {
  assert.equal(decodeHtml('<b>A&amp;B</b> &#x1F680;'), 'A&B 🚀');
});

test('parseBloggerFeed normalizes valid entries and ignores invalid ones', () => {
  const articles = parseBloggerFeed({ feed: { entry: [
    {
      id: { $t: 'post-1' },
      title: { $t: 'Security &amp; AI' },
      published: { $t: '2026-08-14T08:00:00Z' },
      summary: { $t: '<p>Hello world</p><img src="https://example.com/image.jpg">' },
      link: [{ rel: 'alternate', type: 'text/html', href: 'http://example.com/post' }],
      author: [{ name: { $t: 'Reporter' } }],
      category: [{ term: 'Security' }],
    },
    { title: { $t: 'No link' }, published: { $t: '2026-08-14T08:00:00Z' } },
  ] } });

  assert.equal(articles.length, 1);
  assert.equal(articles[0].title, 'Security & AI');
  assert.equal(articles[0].url, 'https://example.com/post');
  assert.equal(articles[0].imageUrl, 'https://example.com/image.jpg');
});
