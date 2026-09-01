const test = require('node:test');
const assert = require('node:assert/strict');
const { splitLongParagraphs, parseSections, convertTxtToMarkdown } = require('../src/txt-to-md');

test('splitLongParagraphs splits long sentences at boundaries while preserving quotes', () => {
  const quote = '「這是一段非常長的引號對話內容，即使裡面包含了句號。也不應該在中間被強行切開。」';
  const res = splitLongParagraphs(quote, 30);
  assert.equal(res, quote);

  const longText = '這是第一句話。這是第二句話，內容很長很長很長很長很長很長很長很長很長很長。這是第三句話！這是第四句話？';
  const splitRes = splitLongParagraphs(longText, 25);
  assert.ok(splitRes.includes('\n\n'));
});

test('parseSections parses HyRead delimiter chapters', () => {
  const text = `
========== 第一章：導論 ==========
這是第一章的內容。

========== 第二章：實踐 ==========
這是第二章的內容。
`;
  const { headers, sections } = parseSections(text);
  assert.equal(headers.length, 2);
  assert.equal(headers[0], '第一章：導論');
  assert.equal(sections[0], '這是第一章的內容。');
  assert.equal(headers[1], '第二章：實踐');
});

test('convertTxtToMarkdown generates frontmatter, toc and markdown structure', () => {
  const text = `
========== 第一章 ==========
第一章內文。

========== 第二章 ==========
第二章內文。
`;
  const result = convertTxtToMarkdown(text, {
    title: '測試書籍',
    author: '張三',
    publisher: '開源出版社',
    isbn: '978-0-123456-47-2',
  });

  assert.ok(result.markdown.includes('title: "測試書籍"'));
  assert.ok(result.markdown.includes('author: "張三"'));
  assert.ok(result.markdown.includes('## 目錄'));
  assert.ok(result.markdown.includes('## 第一章'));
  assert.ok(result.markdown.includes('## 第二章'));
  assert.equal(result.sectionCount, 2);
});
