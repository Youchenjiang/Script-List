/**
 * TXT to Markdown Converter Module
 * 
 * Supports:
 * - Smart paragraph splitting while protecting quotes (「...」, "...", “...”)
 * - Chapter auto-detection (e.g., '========== Chapter ==========', '第X章', 'Chapter X')
 * - Frontmatter generation (YAML metadata)
 * - Auto Table of Contents (TOC)
 */

const fs = require('fs');
const path = require('path');

/**
 * Split long paragraphs at punctuation without breaking within quotes
 */
function splitLongParagraphs(text, maxChars = 80) {
  if (!text) return '';
  const paragraphs = text.split(/\n\s*\n/);
  const result = [];

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    if (trimmed.length <= maxChars) {
      result.push(trimmed);
      continue;
    }

    // Check if entire paragraph is a standalone quote
    const isFullQuote = (trimmed.startsWith('「') && (trimmed.endsWith('」') || trimmed.includes('」—'))) ||
                        (trimmed.startsWith('“') && trimmed.endsWith('”')) ||
                        (trimmed.startsWith('"') && trimmed.endsWith('"'));

    if (isFullQuote && trimmed.length <= maxChars * 1.5) {
      result.push(trimmed);
      continue;
    }

    // Split on sentence boundaries: 。！？!? followed by end quote or normal boundary
    const sentences = trimmed.split(/(?<=[。！？!?])(?![」”'"])/);
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
 * Detect chapters and split into sections
 */
function parseSections(text) {
  // Case 1: HyRead / delimiter style: \n\n========== Title ==========
  if (text.includes('========== ')) {
    const parts = text.split(/\n+========== /);
    const headers = [];
    const sections = [];

    // Preface / preamble if present
    const preamble = parts[0].trim();
    if (preamble && !preamble.startsWith('==========')) {
      headers.push('前言');
      sections.push(preamble);
    }

    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      const dividerIdx = part.indexOf(' ==========');
      if (dividerIdx > 0) {
        headers.push(part.substring(0, dividerIdx).trim());
        sections.push(part.substring(dividerIdx + 11).trim());
      } else {
        sections.push(part.trim());
      }
    }

    if (headers.length > 0) {
      return { headers, sections };
    }
  }

  // Case 2: Standard chapter headings (e.g. 第X章, Chapter X)
  const lines = text.split('\n');
  const headers = [];
  const sections = [];
  let currentHeader = '本文';
  let currentLines = [];

  const chapterRegex = /^(?:第[0-9一二三四五六七八九十百千]+[章節回卷篇部]\s*.*|Chapter\s+\d+.*|#+\s+.+)$/i;

  for (const line of lines) {
    const trimmed = line.trim();
    if (chapterRegex.test(trimmed)) {
      if (currentLines.length > 0) {
        headers.push(currentHeader);
        sections.push(currentLines.join('\n').trim());
        currentLines = [];
      }
      currentHeader = trimmed.replace(/^#+\s*/, '');
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.length > 0) {
    headers.push(currentHeader);
    sections.push(currentLines.join('\n').trim());
  }

  return { headers, sections };
}

/**
 * Convert TXT content to formatted Markdown string
 */
function convertTxtToMarkdown(content, options = {}) {
  const {
    title = '未命名文件',
    author = '',
    publisher = '',
    isbn = '',
    date = '',
    splitParagraphs = true,
    maxParagraphChars = 80,
    includeToc = true,
    frontmatter = true,
  } = options;

  let md = '';

  // YAML Frontmatter
  if (frontmatter) {
    md += '---\n';
    md += `title: "${title.replace(/"/g, '\\"')}"\n`;
    if (author) md += `author: "${author.replace(/"/g, '\\"')}"\n`;
    if (publisher) md += `publisher: "${publisher.replace(/"/g, '\\"')}"\n`;
    if (isbn) md += `isbn: "${isbn}"\n`;
    if (date) md += `date: "${date}"\n`;
    md += '---\n\n';
  }

  md += `# ${title}\n\n`;

  if (author || publisher || isbn) {
    if (author) md += `> **作者**：${author}\n`;
    if (publisher) md += `> **出版/來源**：${publisher}\n`;
    if (isbn) md += `> **ISBN**：${isbn}\n`;
    md += '\n';
  }

  const { headers, sections } = parseSections(content);

  // Table of Contents
  if (includeToc && headers.length > 1) {
    md += '## 目錄\n\n';
    for (const header of headers) {
      const slug = header.toLowerCase().replace(/[\s\t]+/g, '-').replace(/[^\w\u4e00-\u9fa5-]/g, '');
      md += `- [${header}](#${slug || 'section'})\n`;
    }
    md += '\n---\n\n';
  }

  // Sections content
  for (let i = 0; i < headers.length; i++) {
    const secTitle = headers[i];
    let secContent = sections[i] || '';

    secContent = secContent.replace(/\n{3,}/g, '\n\n').trim();

    if (splitParagraphs) {
      secContent = splitLongParagraphs(secContent, maxParagraphChars);
    }

    if (headers.length > 1 || secTitle !== '本文') {
      md += `## ${secTitle}\n\n`;
    }
    md += secContent + '\n\n';

    if (i < headers.length - 1) {
      md += '---\n\n';
    }
  }

  return {
    markdown: md.trim() + '\n',
    headers,
    sectionCount: headers.length,
    characterCount: md.length,
  };
}

/**
 * File-based conversion helper
 */
function txt2md(inputPath, outputPath, options = {}) {
  const content = fs.readFileSync(inputPath, 'utf8');
  const effectiveTitle = options.title || path.basename(inputPath, path.extname(inputPath));
  const result = convertTxtToMarkdown(content, { ...options, title: effectiveTitle });

  const targetPath = outputPath || inputPath.replace(/\.[^.]+$/, '.md');
  fs.mkdirSync(path.dirname(path.resolve(targetPath)), { recursive: true });
  fs.writeFileSync(targetPath, result.markdown, 'utf8');

  return {
    ...result,
    outputPath: targetPath,
  };
}

module.exports = {
  convertTxtToMarkdown,
  txt2md,
  splitLongParagraphs,
  parseSections,
};
