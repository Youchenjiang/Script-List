const test = require('node:test');
const assert = require('node:assert/strict');
const { extractHeadings, buildToc, slugify } = require('../src/toc-generator');

test('slugify generates clean URL anchors', () => {
  assert.equal(slugify('Hello World 123'), 'hello-world-123');
  assert.equal(slugify('第一章：快速上手'), '第一章快速上手');
});

test('extractHeadings and buildToc creates nested TOC', () => {
  const md = `
# Title

## Introduction
Content 1

### Background
Content 2

## Methods
Content 3

\`\`\`
## Not a real heading
\`\`\`
`;

  const headings = extractHeadings(md);
  assert.equal(headings.length, 3);
  assert.equal(headings[0].text, 'Introduction');
  assert.equal(headings[1].text, 'Background');
  assert.equal(headings[2].text, 'Methods');

  const toc = buildToc(headings);
  assert.ok(toc.includes('- [Introduction](#introduction)'));
  assert.ok(toc.includes('  - [Background](#background)'));
  assert.ok(toc.includes('- [Methods](#methods)'));
});
