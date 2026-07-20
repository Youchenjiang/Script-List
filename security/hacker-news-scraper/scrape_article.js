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
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
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

// Helper: Extract article image URLs from raw HTML (handles JS-rendered pages)
function extractArticleImages(html, baseUrl) {
  let parsedUrl;
  try { parsedUrl = new URL(baseUrl); } catch { return []; }
  const origin = parsedUrl.origin;
  // Derive base dir from URL (e.g. /security-labs/ for /security-labs/article-name)
  const urlDir = parsedUrl.pathname.replace(/\/[^/]*$/, '/');

  const imgUrls = new Set();

  // 1. <img src="..."> from the full HTML (for SSR pages like thehackernews.com)
  for (const m of html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) {
    const u = m[1];
    if (u.startsWith('data:') || u.endsWith('.svg')) continue;
    imgUrls.add(u);
  }

  // 2. og:image / twitter:image
  for (const m of html.matchAll(/(?:property|name)=["'](og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/gi)) {
    imgUrls.add(m[2]);
  }

  // 3. Markdown image syntax embedded in page data (e.g. __NEXT_DATA__ or CMS JSON)
  //    Pattern: ![alt](/path/to/image.png) or ![alt](https://...) or ![alt](/path "title")
  for (const m of html.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) {
    let raw = m[1].trim();
    // Strip title: ![alt](url "title") → url
    const titleMatch = /^([^\s"]+)(?:\s+"[^"]*")?$/.exec(raw);
    let u = titleMatch ? titleMatch[1] : raw.split(/\s+/)[0];
    if (u.startsWith('data:') || u.endsWith('.svg')) continue;
    if (u.includes('${')) continue;
    // Resolve relative paths (relative to article directory, not root)
    if (u.startsWith('/')) {
      u = origin + urlDir.slice(0, -1) + u;
    } else if (!u.startsWith('http')) {
      u = origin + '/' + u;
    }
    imgUrls.add(u);
  }

  // 4. media:content / enclosure (RSS)
  for (const m of html.matchAll(/<(?:media:content|enclosure)[^>]+url=["']([^"']+)["']/gi)) {
    imgUrls.add(m[1]);
  }

  // Resolve and deduplicate
  const resolved = [];
  const seen = new Set();
  for (let u of imgUrls) {
    if (u.startsWith('//')) u = 'https:' + u;
    const bare = u.split('?')[0];
    if (seen.has(bare)) continue;
    seen.add(bare);
    const lower = bare.toLowerCase();
    // Filter non-article images
    if (lower.includes('logo') || lower.includes('favicon') || lower.includes('icon')) continue;
    if (lower.includes('_next/static') || lower.endsWith('.svg')) continue;
    if (/\/w\d+-h\d+-/.test(lower) || /\/s\d+-e\d+\//.test(lower)) continue;
    if (lower.startsWith('data:')) continue;
    if (u.includes('${')) continue;
    resolved.push(u);
  }

  return resolved;
}

// Helper: Insert images into markdown body at natural break points
function insertImagesIntoMarkdown(bodyMarkdown, images) {
  if (!images.length) return bodyMarkdown;

  let result = bodyMarkdown;
  let imgIdx = 0;

  // Strategy 1: "Below is an example..." followed by empty line
  result = result.replace(/(Below is an example[^:\n]*:)\s*\n(?=\s*\n|$)/g, (match, prefix) => {
    if (imgIdx < images.length) {
      return `${prefix}\n\n![image](${images[imgIdx++]})\n\n`;
    }
    return match;
  });

  // Strategy 2: Empty paragraph between sections (double newline with nothing between)
  result = result.replace(/\n\n\n+/g, (match) => {
    if (imgIdx < images.length) {
      return `\n\n![image](${images[imgIdx++]})\n\n`;
    }
    return match;
  });

  // Strategy 3: Remaining images before ## Conclusion or end of content
  if (imgIdx < images.length) {
    const conclusionIdx = result.indexOf('\n## Conclusion');
    if (conclusionIdx !== -1) {
      let extra = '';
      while (imgIdx < images.length) {
        extra += `\n![image](${images[imgIdx++]})\n\n`;
      }
      result = result.slice(0, conclusionIdx) + '\n' + extra + result.slice(conclusionIdx);
    } else {
      while (imgIdx < images.length) {
        result += `\n\n![image](${images[imgIdx++]})\n`;
      }
    }
  }

  return result;
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
  let authorText = '';
  let bodyMarkdown = '';

  const isTheHackerNews = url.includes('thehackernews.com');
  const isPermiso = url.includes('permiso.io');
  const isSecurelist = url.includes('securelist.com');

  title = extractTitle(html);

  if (isTheHackerNews) {
    console.log('[Scraper] Parsing format: The Hacker News');
    // Extract Date
    const dateMatch = /<span[^>]*class=['"]author['"][^>]*>[\s\S]*?<\/span>[\s\S]*?<span[^>]*class=['"]author['"][^>]*>([\s\S]*?)<\/span>/i.exec(html) || /<div[^>]*class=['"]item-label['"][^>]*>([\s\S]*?)<\/div>/i.exec(html);
    if (dateMatch) {
      dateText = dateMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      const dateObj = new Date(dateText);
      if (!isNaN(dateObj.getTime())) {
        formattedDate = formatDate(dateObj);
      }
    }

    // Extract Body
    const rawBody = extractDivContent(html, /<div[^>]+(?:id|class)=['"]articlebody['"]/i);
    if (rawBody) {
      bodyMarkdown = cleanHtmlToMarkdown(rawBody);
    }
  } else if (isPermiso) {
    console.log('[Scraper] Parsing format: Permiso Blog');
    // Extract Date
    const dateMatch = /"datePublished"\s*:\s*"([^"]+)"/i.exec(html);
    if (dateMatch) {
      const dateObj = new Date(dateMatch[1]);
      if (!isNaN(dateObj.getTime())) {
        formattedDate = formatDate(dateObj);
        dateText = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
    }

    // Extract Body
    const rawBody = extractDivContent(html, /<div[^>]+class=['"]blog-post__body['"]/i);
    if (rawBody) {
      bodyMarkdown = cleanHtmlToMarkdown(rawBody);
    }
  } else if (isSecurelist) {
    console.log('[Scraper] Parsing format: Securelist');
    // Extract Date from JSON-LD
    const dateMatch = /"datePublished"\s*:\s*"([^"]+)"/i.exec(html) || /"dateCreated"\s*:\s*"([^"]+)"/i.exec(html);
    if (dateMatch) {
      const dateObj = new Date(dateMatch[1]);
      if (!isNaN(dateObj.getTime())) {
        formattedDate = formatDate(dateObj);
        dateText = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
    }

    // Extract Author
    const authorMatch = /"author"[^}]*"name"\s*:\s*"([^"]+)"/i.exec(html);
    if (authorMatch) {
      authorText = authorMatch[1];
    }

    // Extract Body - try <article> first, then entry-content
    const rawBody = extractDivContent(html, /<article/i) || extractDivContent(html, /<div[^>]+class=['"]entry-content['"]/i);
    if (rawBody) {
      bodyMarkdown = cleanHtmlToMarkdown(rawBody);
    }
  } else {
    console.log('[Scraper] Parsing format: Generic Article');
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
  }

  if (!bodyMarkdown) {
    console.warn('[Warning] Main article body could not be parsed.');
    bodyMarkdown = '(Main article body content could not be parsed)';
  }

  // Extract article images from raw HTML and insert into markdown
  const articleImages = extractArticleImages(html, url);
  if (articleImages.length > 0) {
    console.log(`[Scraper] Found ${articleImages.length} article images.`);
    bodyMarkdown = insertImagesIntoMarkdown(bodyMarkdown, articleImages);
  }

  // Save the result
  const scrapeDateStr = formatDate(new Date());
  const outputDir = path.join(__dirname, 'news_output', scrapeDateStr);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const sanitizedTitle = title.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim().substring(0, 85);
  const prefix = formattedDate ? `${formattedDate} - ` : '';
  const filename = `${prefix}${sanitizedTitle}.md`;
  
  const fileContent = `# ${title}\n\n${dateText ? `- **Date**: ${dateText}\n` : ''}${authorText ? `- **Author**: ${authorText}\n` : ''}- **URL**: ${url}\n\n---\n\n${bodyMarkdown}\n`;
  const outputPath = path.join(outputDir, filename);

  fs.writeFileSync(outputPath, fileContent, 'utf8');
  console.log(`[Scraper] Success! Article saved to:\n  ${outputPath}`);

  // Trigger automatic translation
  console.log(`[Scraper] Starting automatic translation...`);
  try {
    const { translateFile } = require('./translate_news');
    const parentDir = path.dirname(outputDir);
    const dirName = path.basename(outputDir);
    const destDir = path.join(parentDir, `${dirName} [zh-TW]`);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const { translatedContent, translatedTitle } = await translateFile(outputPath, 'zh-TW');
    
    const datePrefixMatch = /^(\d{4}-\d{2}-\d{2}\s+-\s+)/.exec(filename);
    const datePrefix = datePrefixMatch ? datePrefixMatch[1] : '';
    const sanitizedTitle = translatedTitle.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim().substring(0, 85);
    const destFilename = `${datePrefix}${sanitizedTitle}.md`;
    const destPath = path.join(destDir, destFilename);

    fs.writeFileSync(destPath, translatedContent, 'utf8');
    console.log(`[Scraper] Saved translated version to:\n  ${destPath}`);
  } catch (err) {
    console.error(`[Scraper] [Translate] Failed to translate article: ${err.message}`);
  }
}

main().catch(console.error);
