/**
 * TXT 轉 Markdown 工具（增強版）
 * 
 * 功能：
 *   1. 自動分段（過長的段落自動換行）
 *   2. 加入頁碼標記
 *   3. 適合電子書閱讀的排版
 *   4. 保留原始段落結構
 * 
 * 用法：
 *   node txt2md.js --input=book.txt --output=book.md --title="書名" --author="作者"
 */

const fs = require('fs');
const path = require('path');

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

/**
 * 自動分段：過長的段落在適當位置換行
 * 注意：不拆散引號（「」）內的內容
 */
function splitLongParagraphs(text, maxChars = 80) {
  const paragraphs = text.split('\n\n');
  const result = [];

  for (const para of paragraphs) {
    if (para.length <= maxChars) {
      result.push(para);
      continue;
    }

    // 檢查是否為引言（以「開頭）
    const isQuote = para.trim().startsWith('「') && (para.includes('」—') || para.includes('」—'));

    if (isQuote) {
      // 引言不拆，保持完整
      result.push(para);
      continue;
    }

    // 在句號、問號、驚嘆號後換行，但「」內的句號不拆
    const sentences = para.split(/(?<=[。！？])(?!」)/);
    let current = '';

    for (const sentence of sentences) {
      if (current.length + sentence.length > maxChars && current.length > 0) {
        result.push(current.trim());
        current = sentence;
      } else {
        current += sentence;
      }
    }

    if (current.trim()) {
      result.push(current.trim());
    }
  }

  return result.join('\n\n');
}

/**
 * 加入頁碼標記（每 N 字插入）
 */
function addPageMarkers(text, interval = 500) {
  const lines = text.split('\n');
  const result = [];
  let charCount = 0;

  for (const line of lines) {
    result.push(line);
    charCount += line.length;

    if (charCount >= interval) {
      result.push(`<!-- page ${Math.floor(charCount / interval)} -->`);
      charCount = 0;
    }
  }

  return result.join('\n');
}

function txt2md(inputPath, outputPath, options = {}) {
  const {
    title = '未命名書籍',
    author = '',
    publisher = '',
    isbn = '',
    splitParagraphs = true,
    maxParagraphChars = 80,
    usePageMarkers = true,
    pageInterval = 500,
  } = options;

  const txt = fs.readFileSync(inputPath, 'utf8');

  // 分割章節
  const parts = txt.split(/\n\n========== /);
  const sections = [];
  const headers = [];

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    const dividerIdx = part.indexOf(' ==========');
    if (dividerIdx > 0) {
      headers.push(part.substring(0, dividerIdx).trim());
      sections.push(part.substring(dividerIdx + 11).trim());
    }
  }

  // 產生 Markdown
  let md = `# ${title}\n\n`;

  if (author || publisher || isbn) {
    md += '> **${author}**\n';
    if (publisher) md += `> ${publisher}\n`;
    if (isbn) md += `> ISBN ${isbn}\n`;
    md += '\n';
  }

  md += '---\n\n';

  // 目錄
  md += '## 目錄\n\n';
  for (const header of headers) {
    md += `- [${header}](#${header.replace(/ /g, '-')})\n`;
  }
  md += '\n---\n\n';

  // 內容
  for (let i = 0; i < headers.length; i++) {
    const title = headers[i];
    let content = sections[i] || '';

    // 清理多餘空白
    content = content.replace(/\n{3,}/g, '\n\n').trim();

    // 自動分段
    if (splitParagraphs) {
      content = splitLongParagraphs(content, maxParagraphChars);
    }

    // 頁碼標記已移除

    md += `## ${title}\n\n`;
    md += content + '\n\n';
    md += '---\n\n';
  }

  fs.writeFileSync(outputPath, md, 'utf8');
  console.log(`已轉換：${outputPath}`);
  console.log(`章節數：${headers.length}`);
  console.log(`大小：${md.length} 字`);

  return { headers, sections };
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
    maxParagraphChars: parseInt(args['max-paragraph-chars'] || '80'),
    addPageMarkers: args['page-markers'] !== 'false',
    pageInterval: parseInt(args['page-interval'] || '500'),
  });
}

module.exports = { txt2md, splitLongParagraphs, addPageMarkers };
