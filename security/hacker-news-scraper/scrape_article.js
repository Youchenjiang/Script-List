const https = require('https');
const fs = require('fs');
const path = require('path');

// Helper: Make HTTP GET Request (handles redirects and status check)
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP status ${res.statusCode} for URL: ${url}`));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// Helper: Balanced HTML Div extractor
function extractDivContent(html, searchRegExp) {
  const startIdx = html.search(searchRegExp);
  if (startIdx === -1) return null;
  
  const startTagEnd = html.indexOf('>', startIdx);
  if (startTagEnd === -1) return null;
  
  const lowerHtml = html.toLowerCase();
  let openDivs = 1;
  let pos = startTagEnd + 1;
  const limit = html.length;
  
  while (pos < limit && openDivs > 0) {
    const nextOpen = lowerHtml.indexOf('<div', pos);
    const nextClose = lowerHtml.indexOf('</div>', pos);
    
    if (nextClose === -1) {
      break;
    }
    
    if (nextOpen !== -1 && nextOpen < nextClose) {
      openDivs++;
      pos = nextOpen + 4;
    } else {
      openDivs--;
      if (openDivs === 0) {
        return html.slice(startTagEnd + 1, nextClose);
      }
      pos = nextClose + 6;
    }
  }
  
  return null;
}

// Helper: Format Date object to YYYY-MM-DD
function formatDate(dateObj) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper: Extract article title from HTML page
function extractTitle(html) {
  // 1. Try og:title metadata
  const ogTitleMatch = /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i.exec(html) || /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i.exec(html);
  if (ogTitleMatch) return ogTitleMatch[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
  
  // 2. Try h1 with class containing "title" or "headline"
  const titleClassMatch = /<h1[^>]+class=["'][^"']*(?:title|headline)[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  if (titleClassMatch) return titleClassMatch[1].replace(/<[^>]+>/g, '').trim();
  
  // 3. Try standard h1, excluding generic phrases
  const h1Regex = /<h1[^>]*>([\s\S]*?)<\/h1>/gi;
  let h1Match;
  while ((h1Match = h1Regex.exec(html)) !== null) {
    const text = h1Match[1].replace(/<[^>]+>/g, '').trim();
    if (text && !/hear\s+ye/i.test(text) && !/subscribe/i.test(text) && !/menu/i.test(text)) {
      return text;
    }
  }
  
  // 4. Try title tag
  const titleTagMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (titleTagMatch) {
    let text = titleTagMatch[1].replace(/<[^>]+>/g, '').trim();
    // Remove site suffixes like " | SiteName"
    const suffixIdx = text.search(/\s+[\-|\|]\s+/);
    if (suffixIdx !== -1) {
      text = text.substring(0, suffixIdx).trim();
    }
    return text;
  }
  
  return 'Untitled';
}

// Helper: Convert HTML tags and format text to clean Markdown
function cleanHtmlToMarkdown(html) {
  if (!html) return '';
  
  let md = html;
  
  // Remove HTML comments
  md = md.replace(/<!--[\s\S]*?-->/g, '');
  
  // Clean headers
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '# $1\n\n');
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '## $1\n\n');
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '### $1\n\n');
  md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '#### $1\n\n');
  
  // Clean bold and italics
  md = md.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**');
  md = md.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*');
  md = md.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*');
  
  // Clean spans (keep inner text)
  md = md.replace(/<span[^>]*>([\s\S]*?)<\/span>/gi, '$1');
  
  // Parse links
  md = md.replace(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');
  
  // Parse images
  md = md.replace(/<img[^>]+>/gi, (match) => {
    const srcMatch = /src=["']([^"']+)["']/i.exec(match);
    const altMatch = /alt=["']([^"']*)["']/i.exec(match);
    const src = srcMatch ? srcMatch[1] : '';
    const alt = altMatch ? altMatch[1] : 'image';
    // Clean HubSpot resize parameters
    const cleanSrc = src.split('?')[0];
    return `\n![${alt}](${cleanSrc})\n`;
  });
  
  // List items
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');
  md = md.replace(/<ul[^>]*>/gi, '\n');
  md = md.replace(/<\/ul>/gi, '\n');
  md = md.replace(/<ol[^>]*>/gi, '\n');
  md = md.replace(/<\/ol>/gi, '\n');
  
  // Paragraphs and breaks
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n');
  md = md.replace(/<br\s*\/?>/gi, '\n');
  
  // Code and blockquotes
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '> $1\n\n');
  md = md.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '\n```\n$1\n```\n');
  md = md.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '\n```\n$1\n```\n');
  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');
  
  // Strip other leftover HTML tags
  md = md.replace(/<[^>]+>/g, '');
  
  // Convert basic HTML entities
  md = md
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
    
  // Normalize multiple newlines
  md = md.replace(/\n{3,}/g, '\n\n');
  
  return md.trim();
}

async function main() {
  let url = process.argv[2];
  if (!url) {
    console.error('Usage: node scrape_article.js <URL>');
    process.exit(1);
  }
  if (url.startsWith('http://')) {
    url = url.replace('http://', 'https://');
  }

  console.log(`[Scraper] Fetching content from: ${url}`);
  let html;
  try {
    html = await fetchUrl(url);
  } catch (err) {
    console.error(`[Error] Failed to fetch URL: ${err.message}`);
    process.exit(1);
  }

  let title = 'Untitled';
  let dateText = '';
  let formattedDate = '';
  let bodyMarkdown = '';

  console.log('[Scraper] Parsing format: Generic Article');
  title = extractTitle(html);

  const dateMatch = /"datePublished"\s*:\s*"([^"]+)"/i.exec(html) || /"dateCreated"\s*:\s*"([^"]+)"/i.exec(html);
  if (dateMatch) {
    const dateObj = new Date(dateMatch[1]);
    if (!isNaN(dateObj.getTime())) {
      formattedDate = formatDate(dateObj);
      dateText = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  }

  // Fallback to <article> or search for body divs
  const rawBody = extractDivContent(html, /<article/i) || extractDivContent(html, /<div[^>]+(?:id|class)=['"](?:post-body|entry-content|content|main-content)['"]/i);
  if (rawBody) {
    bodyMarkdown = cleanHtmlToMarkdown(rawBody);
  } else {
    // Last resort: strip whole body
    const bodyMatch = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html);
    if (bodyMatch) {
      bodyMarkdown = cleanHtmlToMarkdown(bodyMatch[1]);
    }
  }

  if (!bodyMarkdown) {
    console.warn('[Warning] Main article body could not be parsed.');
    bodyMarkdown = '(Main article body content could not be parsed)';
  }

  // Save the result
  const outputDir = path.join(__dirname, 'news_output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const sanitizedTitle = title.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim().substring(0, 85);
  const prefix = formattedDate ? `${formattedDate} - ` : '';
  const filename = `${prefix}${sanitizedTitle}.md`;
  
  const fileContent = `# ${title}\n\n${dateText ? `- **Date**: ${dateText}\n` : ''}- **URL**: ${url}\n\n---\n\n${bodyMarkdown}\n`;
  const outputPath = path.join(outputDir, filename);

  fs.writeFileSync(outputPath, fileContent, 'utf8');
  console.log(`[Scraper] Success! Article saved to:\n  ${outputPath}`);
}

main().catch(console.error);
