/**
 * TXT 轉 Markdown 工具（增強版）
 * 
 * 此工具已模組化並收納於 text/markdown-toolkit。
 * 本檔案作為向下相容代理與便捷 CLI 入口。
 * 
 * 用法：
 *   node txt2md.js --input=book.txt --output=book.md --title="書名" --author="作者"
 */

const path = require('path');
const {
  txt2md,
  splitLongParagraphs,
  parseSections,
  convertTxtToMarkdown
} = require('../../text/markdown-toolkit/src/txt-to-md');

function parseArgs(args) {
  const result = {};
  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, ...value] = arg.slice(2).split('=');
      result[key] = value.join('=');
    }
  }
  return result;
}

// CLI
if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));

  if (!args.input) {
    console.log('用法：node txt2md.js --input=book.txt --output=book.md --title="書名" --author="作者"');
    process.exit(1);
  }

  const inputPath = args.input;
  const outputPath = args.output || inputPath.replace(/\.txt$/, '.md');

  txt2md(inputPath, outputPath, {
    title: args.title || path.basename(inputPath, '.txt'),
    author: args.author || '',
    publisher: args.publisher || '',
    isbn: args.isbn || '',
    splitParagraphs: args['split-paragraphs'] !== 'false',
    maxParagraphChars: parseInt(args['max-paragraph-chars'] || '80', 10),
    includeToc: args.toc !== 'false',
    frontmatter: args.frontmatter !== 'false',
  });
}

module.exports = {
  txt2md,
  splitLongParagraphs,
  parseSections,
  convertTxtToMarkdown
};
