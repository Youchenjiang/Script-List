/**
 * HTML to Markdown Converter Module
 * 
 * Converts raw HTML into clean, well-formatted Markdown.
 * Strips script, style, ad tags, and navigation blocks.
 */

const fs = require('fs');
const path = require('path');

function decodeHtmlEntities(text) {
  if (!text) return '';
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function cleanHtmlToMarkdown(html, options = {}) {
  if (!html) return '';

  let text = html;

  // 1. Remove script, style, noscript, svg, iframe, nav, footer, header
  text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  text = text.replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '');
  text = text.replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '');
  text = text.replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '');

  // 2. Headings
  text = text.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n\n# $1\n\n');
  text = text.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n\n## $1\n\n');
  text = text.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n\n### $1\n\n');
  text = text.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n\n#### $1\n\n');
  text = text.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '\n\n##### $1\n\n');
  text = text.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '\n\n###### $1\n\n');

  // 3. Pre & Code blocks
  text = text.replace(/<pre[^>]*><code(?: class="[^"]*language-([^"\s]+)[^"]*")?[^>]*>([\s\S]*?)<\/code><\/pre>/gi, (match, lang, code) => {
    return `\n\n\`\`\`${lang || ''}\n${decodeHtmlEntities(code).trim()}\n\`\`\`\n\n`;
  });
  text = text.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (match, code) => {
    return `\n\n\`\`\`\n${decodeHtmlEntities(code).trim()}\n\`\`\`\n\n`;
  });
  text = text.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (match, code) => {
    return `\`${decodeHtmlEntities(code).trim()}\``;
  });

  // 4. Images: <img ... src="..." alt="..." />
  text = text.replace(/<img\b(?=[^>]*\bsrc=["']([^"']+)["'])?(?=[^>]*\balt=["']([^"']*)["'])?[^>]*>/gi, (match, src, alt) => {
    if (!src) {
      const srcMatch = match.match(/src=["']([^"']+)["']/i);
      src = srcMatch ? srcMatch[1] : '';
    }
    if (!alt) {
      const altMatch = match.match(/alt=["']([^"']*)["']/i);
      alt = altMatch ? altMatch[1] : '';
    }
    return src ? `\n\n![${alt || 'image'}](${src})\n\n` : '';
  });

  // 5. Links: <a href="...">...</a>
  text = text.replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (match, href, anchorText) => {
    const cleanAnchor = anchorText.replace(/<[^>]+>/g, '').trim();
    if (!cleanAnchor) return '';
    return `[${cleanAnchor}](${href})`;
  });

  // 6. Blockquotes
  text = text.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (match, quote) => {
    const lines = quote.replace(/<[^>]+>/g, '').trim().split('\n');
    return '\n\n' + lines.map(line => `> ${line.trim()}`).join('\n') + '\n\n';
  });

  // 7. Lists
  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (match, item) => {
    const cleanItem = item.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1').replace(/<[^>]+>/g, '').trim();
    return `\n- ${cleanItem}`;
  });
  text = text.replace(/<\/(?:ul|ol)>/gi, '\n\n');

  // 8. Paragraphs & Line breaks
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n\n$1\n\n');
  text = text.replace(/<hr\s*\/?>/gi, '\n\n---\n\n');

  // 9. Bold & Italic (ensure word boundaries so <body> or <button> is not matched as <b>)
  text = text.replace(/<(?:strong\b|b\b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, '**$1**');
  text = text.replace(/<(?:em\b|i\b)[^>]*>([\s\S]*?)<\/(?:em|i)>/gi, '*$1*');

  // 10. Strip remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // 11. Decode entities
  text = decodeHtmlEntities(text);

  // 12. Normalize whitespace
  text = text
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text + '\n';
}

function html2md(inputPath, outputPath, options = {}) {
  const html = fs.readFileSync(inputPath, 'utf8');
  const markdown = cleanHtmlToMarkdown(html, options);

  const targetPath = outputPath || inputPath.replace(/\.[^.]+$/, '.md');
  fs.mkdirSync(path.dirname(path.resolve(targetPath)), { recursive: true });
  fs.writeFileSync(targetPath, markdown, 'utf8');

  return {
    markdown,
    outputPath: targetPath,
    characterCount: markdown.length,
  };
}

module.exports = {
  cleanHtmlToMarkdown,
  html2md,
  decodeHtmlEntities,
};
