const test = require('node:test');
const assert = require('node:assert/strict');
const { cleanHtmlToMarkdown } = require('../src/html-to-md');

test('cleanHtmlToMarkdown converts headings, lists, links, bold, code and images', () => {
  const html = `
    <html>
      <body>
        <script>console.log("bad");</script>
        <h1>Article Title</h1>
        <p>This is a <strong>bold</strong> and <em>italic</em> paragraph with a <a href="https://example.com">link</a>.</p>
        <pre><code class="language-javascript">const x = 10;</code></pre>
        <ul>
          <li>Item 1</li>
          <li>Item 2</li>
        </ul>
        <blockquote>A wise quote.</blockquote>
        <img src="https://example.com/pic.png" alt="Sample Picture" />
      </body>
    </html>
  `;

  const md = cleanHtmlToMarkdown(html);

  assert.ok(!md.includes('<script>'));
  assert.ok(md.includes('# Article Title'));
  assert.ok(md.includes('**bold**'));
  assert.ok(md.includes('*italic*'));
  assert.ok(md.includes('[link](https://example.com)'));
  assert.ok(md.includes('```javascript\nconst x = 10;\n```'));
  assert.ok(md.includes('- Item 1'));
  assert.ok(md.includes('- Item 2'));
  assert.ok(md.includes('> A wise quote.'));
  assert.ok(md.includes('![Sample Picture](https://example.com/pic.png)'));
});
