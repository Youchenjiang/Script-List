/**
 * Table of Contents (TOC) Generator Module
 * 
 * Scans markdown headings and generates or updates a clean TOC.
 */

const fs = require('fs');

/**
 * Generate GitHub-style anchor slug from heading text
 */
function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\u4e00-\u9fa5\s-]/g, '')
    .replace(/[\s\t]+/g, '-');
}

/**
 * Extract headings from markdown content
 */
function extractHeadings(markdownContent, options = {}) {
  const minDepth = options.minDepth || 2;
  const maxDepth = options.maxDepth || 4;

  const lines = markdownContent.split('\n');
  const headings = [];
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const depth = match[1].length;
      const text = match[2].trim();

      if (depth >= minDepth && depth <= maxDepth && text !== '目錄' && text.toLowerCase() !== 'table of contents') {
        headings.push({
          depth,
          text,
          slug: slugify(text),
          lineIndex: i,
        });
      }
    }
  }

  return headings;
}

/**
 * Build Markdown Table of Contents string
 */
function buildToc(headings, options = {}) {
  if (headings.length === 0) return '';

  const minDepth = Math.min(...headings.map(h => h.depth));
  const lines = ['## 目錄\n'];

  headings.forEach(h => {
    const indentLevel = Math.max(0, h.depth - minDepth);
    const indent = '  '.repeat(indentLevel);
    lines.push(`${indent}- [${h.text}](#${h.slug})`);
  });

  return lines.join('\n') + '\n\n---\n';
}

/**
 * Insert or update TOC in a markdown file
 */
function insertOrUpdateToc(markdownPath, options = {}) {
  const content = fs.readFileSync(markdownPath, 'utf8');
  const headings = extractHeadings(content, options);
  const tocString = buildToc(headings, options);

  let updatedContent = content;
  const tocPattern = /## 目錄\n[\s\S]*?---\n/i;

  if (tocPattern.test(content)) {
    updatedContent = content.replace(tocPattern, tocString);
  } else {
    // Insert after title / frontmatter / preamble
    const lines = content.split('\n');
    let insertLine = 0;

    // Check frontmatter
    if (lines[0] && lines[0].trim() === '---') {
      const secondFence = lines.slice(1).findIndex(l => l.trim() === '---');
      if (secondFence !== -1) {
        insertLine = secondFence + 2;
      }
    }

    // Check title `# `
    for (let i = insertLine; i < lines.length; i++) {
      if (lines[i].startsWith('# ')) {
        insertLine = i + 1;
        break;
      }
    }

    const before = lines.slice(0, insertLine).join('\n');
    const after = lines.slice(insertLine).join('\n').replace(/^\n+/, '');
    updatedContent = `${before}\n\n${tocString}\n${after}`;
  }

  if (!options.dryRun) {
    fs.writeFileSync(markdownPath, updatedContent, 'utf8');
  }

  return {
    markdownPath,
    headingsCount: headings.length,
    toc: tocString,
  };
}

module.exports = {
  extractHeadings,
  buildToc,
  insertOrUpdateToc,
  slugify,
};
