const fs = require('fs');
const path = require('path');

// ============================================================
// 新聞彙整器：把一個新聞輸出目錄（英文或 [zh-TW]）整理成單一總表 Markdown
// 用法: node create_digest.js <輸入目錄> [輸出檔案] [AI摘要JSON]
//   AI摘要JSON: 可選，[{url, summary}] 格式；提供時以 AI 摘要取代導言摘要
// ============================================================

function parseFilenameDate(filename) {
  // Filename format: YYYY-MM-DD - Title.md
  const m = /^(\d{4})-(\d{2})-(\d{2})\s+-/.exec(filename);
  if (!m) return null;
  return new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00`);
}

function extractTitle(content) {
  const m = content.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : 'Untitled';
}

function extractDateText(content) {
  const m = content.match(/-\s+\*\*Date\*\*:\s*(.+)$/m);
  return m ? m[1].trim() : '';
}

function extractUrl(content) {
  const m = content.match(/-\s+\*\*URL\*\*:\s*(\S+)/);
  return m ? m[1].trim() : '';
}

// Extract the lead paragraph(s) after the metadata block as the summary.
function extractLead(content, maxLen = 220) {
  const lines = content.split('\n');
  let inMeta = true;
  const paras = [];
  let current = [];

  const flush = () => {
    if (current.length > 0) {
      paras.push(current.join(' '));
      current = [];
    }
  };

  for (const line of lines) {
    const t = line.trim();
    if (t === '---') { inMeta = false; continue; }
    if (inMeta && (t.startsWith('#') || t.startsWith('- **'))) continue;
    if (t.startsWith('#')) continue;                 // headings
    if (t.startsWith('![') || t.startsWith('](')) continue; // images
    if (!t) { flush(); if (paras.length > 0) break; continue; }
    current.push(t);
  }
  flush();

  let text = paras[0] || '';
  // Clean markdown artifacts, keep it readable
  text = text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*_]/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

  if (text.length > maxLen) {
    text = text.slice(0, maxLen).trimEnd() + '…';
  }
  return text;
}

// Export helpers so other scripts (e.g. AI summary generation) can reuse them
module.exports = {
  parseFilenameDate,
  extractTitle,
  extractDateText,
  extractUrl,
  extractLead
};

async function main() {
  const inputDir = process.argv[2];
  const summariesJson = process.argv[4];
  const aiSummaries = new Map();
  if (summariesJson) {
    if (!fs.existsSync(summariesJson)) {
      console.error(`[Digest] AI summaries file not found: ${summariesJson}`);
      process.exit(1);
    }
    const entries = JSON.parse(fs.readFileSync(summariesJson, 'utf8'));
    for (const e of entries) {
      if (e && e.url && e.summary) aiSummaries.set(e.url, e.summary);
    }
    console.log(`[Digest] Loaded ${aiSummaries.size} AI summaries.`);
  }
  if (!inputDir || !fs.existsSync(inputDir)) {
    console.error('Usage: node create_digest.js <input-directory> [output-file]');
    console.error('Input directory does not exist.');
    process.exit(1);
  }

  const files = fs.readdirSync(inputDir)
    .filter(f => f.endsWith('.md') && fs.statSync(path.join(inputDir, f)).isFile());

  const articles = [];
  let aiUsed = 0;
  for (const filename of files) {
    const content = fs.readFileSync(path.join(inputDir, filename), 'utf8');
    const dateObj = parseFilenameDate(filename);
    if (!dateObj) continue;
    const url = extractUrl(content);
    const aiSummary = aiSummaries.get(url);
    if (aiSummary) aiUsed++;
    articles.push({
      filename,
      dateObj,
      title: extractTitle(content),
      dateText: extractDateText(content),
      url,
      summary: aiSummary || extractLead(content),
      isAiSummary: !!aiSummary
    });
  }
  if (summariesJson) {
    console.log(`[Digest] ${aiUsed}/${articles.length} articles have AI summaries (others fall back to lead).`);
  }

  // Sort by date descending, then by title
  articles.sort((a, b) => b.dateObj - a.dateObj || a.title.localeCompare(b.title, 'zh-Hant'));

  if (articles.length === 0) {
    console.error(`[Digest] No dated markdown files found in: ${inputDir}`);
    process.exit(1);
  }

  const firstDate = articles[articles.length - 1].dateObj;
  const lastDate = articles[0].dateObj;
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const fmtShort = d => `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const lines = [];
  lines.push(`# 資安新聞彙整（${fmt(firstDate)} ~ ${fmt(lastDate)}）`);
  lines.push('');
  lines.push(`- **篇數**：${articles.length} 篇`);
  lines.push(`- **來源**：The Hacker News`);
  lines.push(`- **語言**：繁體中文`);
  lines.push(`- **摘要**：${summariesJson ? 'AI 濃縮版' : '新聞導言'}（${articles.filter(a => a.isAiSummary).length}/${articles.length} 篇）`);
  lines.push(`- **產生時間**：${fmt(new Date())}`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## 一覽表');
  lines.push('');
  lines.push('| # | 日期 | 標題 | 原文連結 |');
  lines.push('|---|------|------|----------|');
  articles.forEach((a, i) => {
    const titleCell = a.title.replace(/\|/g, '\\|');
    lines.push(`| ${i + 1} | ${fmt(a.dateObj)} | [${titleCell}](${a.url}) | [連結](${a.url}) |`);
  });
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## 摘要');
  lines.push('');
  articles.forEach((a, i) => {
    lines.push(`### ${i + 1}. ${a.title}`);
    lines.push('');
    lines.push(`- **日期**：${a.dateText || fmt(a.dateObj)}`);
    lines.push(`- **原文**：[${a.url}](${a.url})`);
    lines.push(`- **摘要**：${a.summary || '（無摘要）'}`);
    lines.push('');
  });

  const outputFile = process.argv[3] || path.join(
    path.dirname(inputDir),
    `新聞彙整 ${fmt(lastDate)}.md`
  );
  fs.writeFileSync(outputFile, lines.join('\n'), 'utf8');
  console.log(`[Digest] Done! ${articles.length} articles -> ${outputFile}`);
}

if (require.main === module) {
  main().catch(console.error);
}
