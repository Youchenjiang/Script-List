const https = require('https');
const fs = require('fs');
const path = require('path');

// Helper: Format Date object to YYYY-MM-DD
function formatDate(dateObj) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Configuration
const CONFIG = {
  baseUrl: 'https://thehackernews.com',
  weeksLimit: 2,             // Limit crawling to the last N weeks of articles
  daysLimit: 0,              // Override: if > 0, limits to N days instead of weeks
  delayMs: 800,              // Delay between requests to prevent rate limits
  outputDir: path.join(__dirname, 'news_output', formatDate(new Date()))
};

// Helper: Make HTTP GET Request (handles redirects and status check)
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    }, (res) => {
      // Handle HTTP redirects (301, 302)
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

// Helper: Delay helper
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Helper: Parse date string (e.g. "May 31, 2026") into Date object
function parseDate(dateStr) {
  const match = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}/i.exec(dateStr);
  if (match) {
    return new Date(match[0]);
  }
  return new Date(dateStr);
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

// Helper: Strip HTML tags and format text to clean Markdown (preserves images)
function cleanHtmlToText(html) {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n\n## $1\n\n')
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n\n### $1\n\n')
    .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n\n#### $1\n\n')
    .replace(/<p[^>]*>/gi, '\n\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<\/li>/gi, '\n')
    // Convert <img> to markdown before stripping tags
    .replace(/<img[^>]+>/gi, (match) => {
      const srcMatch = /src=["']([^"']+)["']/i.exec(match);
      const altMatch = /alt=["']([^"']*)["']/i.exec(match);
      const src = srcMatch ? srcMatch[1] : '';
      const alt = altMatch ? altMatch[1] : '';
      if (!src) return '';
      return `\n![${alt}](${src})\n`;
    })
    .replace(/<[^>]+>/g, '') // Strip all remaining tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n') // Normalize multiple newlines
    .trim();
}

async function main() {
  const targetDateLimit = new Date();
  if (CONFIG.daysLimit > 0) {
    targetDateLimit.setDate(targetDateLimit.getDate() - CONFIG.daysLimit);
  } else {
    targetDateLimit.setDate(targetDateLimit.getDate() - (CONFIG.weeksLimit * 7));
  }
  console.log(`[Scraper] Initializing... Target date limit: ${CONFIG.daysLimit > 0 ? CONFIG.daysLimit + ' day(s)' : CONFIG.weeksLimit + ' weeks'} ago (${targetDateLimit.toLocaleDateString()})`);

  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }

  let articlesToFetch = [];
  let reachedLimit = false;

  // Phase 1: Collect article links within target time limit (using Blogger JSON Feed first, fallback to crawl)
  console.log(`[Scraper] Fetching articles list via Blogger JSON Feed...`);
  try {
    const feedUrl = `${CONFIG.baseUrl}/feeds/posts/default?alt=json&redirect=false&max-results=150`;
    const feedDataStr = await fetchUrl(feedUrl);
    const feedObj = JSON.parse(feedDataStr);
    const entries = feedObj.feed.entry || [];
    
    console.log(`[Scraper] Retrieved ${entries.length} feed entries.`);
    for (const entry of entries) {
      const title = entry.title ? entry.title.$t.trim() : 'Untitled';
      const pubDateText = entry.published ? entry.published.$t : '';
      const dateObj = new Date(pubDateText);
      
      if (isNaN(dateObj.getTime())) continue;
      
      if (dateObj < targetDateLimit) {
        console.log(`[Scraper] Reached older post in feed: [${title}] (${dateObj.toDateString()}). Stopping collection.`);
        break;
      }
      
      const altLink = entry.link.find(l => l.rel === 'alternate' && l.type === 'text/html');
      if (!altLink) continue;
      
      let url = altLink.href;
      if (url.startsWith('http://')) {
        url = url.replace('http://', 'https://');
      }
      
      const formattedDate = formatDate(dateObj);
      const dateText = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      
      articlesToFetch.push({ url, title, dateText, formattedDate });
    }
  } catch (err) {
    console.warn(`[Warning] Failed to fetch articles via JSON Feed: ${err.message}. Falling back to HTML pagination crawl.`);
    articlesToFetch = [];
    let currentPageUrl = CONFIG.baseUrl;
    
    while (currentPageUrl && !reachedLimit) {
      console.log(`[Scraper] Fetching listing page: ${currentPageUrl}`);
      let html;
      try {
        html = await fetchUrl(currentPageUrl);
      } catch (err) {
        console.error(`[Error] Failed to fetch list page: ${err.message}`);
        break;
      }

      // Parse story links on this page
      const storyRegex = /<a[^>]*class=['"]story-link['"][^>]*href=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/a>/g;
      let match;
      let countOnPage = 0;

      while ((match = storyRegex.exec(html)) !== null) {
        const url = match[1];
        const innerHtml = match[2];
        
        const titleMatch = /<h2[^>]*class=['"]home-title['"][^>]*>([^<]+)<\/h2>/.exec(innerHtml);
        const title = titleMatch ? titleMatch[1].trim() : 'Untitled';
        
        const dateMatch = /<div[^>]*class=['"]item-label['"][^>]*>([\s\S]*?)<\/div>/.exec(innerHtml);
        let dateText = '';
        if (dateMatch) {
          dateText = dateMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        }

        const dateObj = parseDate(dateText);

        // Skip sponsored/external partner links
        if (!url.includes('thehackernews.com')) continue;

        if (isNaN(dateObj.getTime())) {
          continue;
        }

        if (dateObj < targetDateLimit) {
          reachedLimit = true;
          console.log(`[Scraper] Reached older post: [${title}] (${dateText}). Stopping listing crawl.`);
          break;
        }

        const formattedDate = formatDate(dateObj);
        articlesToFetch.push({ url, title, dateText, formattedDate });
        countOnPage++;
      }

      console.log(`[Scraper] Found ${countOnPage} relevant articles on this page.`);

      if (reachedLimit) break;

      // Extract "Older Posts" pagination URL
      const pagerRegex = /blog-pager-older-link[^>]*href=['"]([^'"]+)['"]/g;
      const pagerMatch = pagerRegex.exec(html);
      currentPageUrl = pagerMatch ? pagerMatch[1].replace(/&amp;/g, '&') : null;

      if (currentPageUrl) {
        await sleep(CONFIG.delayMs);
      }
    }
  }

  console.log(`\n[Scraper] Listing crawl finished. Found ${articlesToFetch.length} articles to download.`);

  // Phase 2: Download each article and save text content as Markdown (parallel batches)
  const BATCH_SIZE = 5;
  let downloaded = 0;
  let downloadFailed = 0;

  async function downloadArticle(article, index) {
    try {
      await sleep(CONFIG.delayMs);
      const artHtml = await fetchUrl(article.url);
      
      // Extract main article body (id="articlebody")
      const rawBody = extractDivContent(artHtml, /<div[^>]+(?:id|class)=['"]articlebody['"]/i);
      let bodyText = '';
      if (rawBody) {
        bodyText = cleanHtmlToText(rawBody);
      }

      if (!bodyText) {
        console.warn(`[Warning] Main body not found for: ${article.title}`);
        bodyText = '(Main article body content could not be parsed)';
      }

      // Format clean markdown file content
      const sanitizedTitle = article.title.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim().substring(0, 85);
      const filename = `${article.formattedDate} - ${sanitizedTitle}.md`;
      const fileContent = `# ${article.title}\n\n- **Date**: ${article.dateText}\n- **URL**: ${article.url}\n\n---\n\n${bodyText}\n`;
      
      fs.writeFileSync(path.join(CONFIG.outputDir, filename), fileContent);
      downloaded++;
      console.log(`[Scraper] (${downloaded + downloadFailed}/${articlesToFetch.length}) Done: ${article.title}`);
    } catch (err) {
      downloadFailed++;
      console.error(`[Error] Failed to download content for [${article.title}]: ${err.message}`);
    }
  }

  for (let i = 0; i < articlesToFetch.length; i += BATCH_SIZE) {
    const batch = articlesToFetch.slice(i, i + BATCH_SIZE);
    console.log(`[Scraper] Batch ${Math.floor(i / BATCH_SIZE) + 1}: downloading ${batch.length} articles...`);
    await Promise.all(batch.map((article, j) => downloadArticle(article, i + j)));
  }

  console.log(`\n[Scraper] Done! Downloaded ${downloaded}/${articlesToFetch.length} articles (${downloadFailed} failed) under: ${CONFIG.outputDir}`);

  // Trigger automatic translation (parallel)
  console.log(`\n[Scraper] Starting automatic translation...`);
  try {
    const { translateFile } = require('./translate_news');
    const parentDir = path.dirname(CONFIG.outputDir);
    const dirName = path.basename(CONFIG.outputDir);
    const destDir = path.join(parentDir, `${dirName} [zh-TW]`);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    // Build a cache of already translated URLs in destDir
    const translatedUrls = new Set();
    if (fs.existsSync(destDir)) {
      const destFiles = fs.readdirSync(destDir).filter(f => f.endsWith('.md'));
      for (const f of destFiles) {
        const filePath = path.join(destDir, f);
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const match = content.match(/-\s+\*\*URL\*\*:\s*([^\s\n]+)/);
          if (match) {
            translatedUrls.add(match[1].trim());
          }
        } catch (err) {}
      }
    }

    const files = fs.readdirSync(CONFIG.outputDir);
    const mdFiles = files.filter(f => f.endsWith('.md') && fs.statSync(path.join(CONFIG.outputDir, f)).isFile());
    
    // Build list of files needing translation
    const toTranslate = [];
    for (let i = 0; i < mdFiles.length; i++) {
      const filename = mdFiles[i];
      const sourcePath = path.join(CONFIG.outputDir, filename);
      
      let sourceUrl = '';
      try {
        const sourceContent = fs.readFileSync(sourcePath, 'utf8');
        const match = sourceContent.match(/-\s+\*\*URL\*\*:\s*([^\s\n]+)/);
        if (match) {
          sourceUrl = match[1].trim();
        }
      } catch (err) {}

      if (sourceUrl && translatedUrls.has(sourceUrl)) {
        continue;
      }
      
      const datePrefixMatch = /^(\d{4}-\d{2}-\d{2}\s+-\s+)/.exec(filename);
      const datePrefix = datePrefixMatch ? datePrefixMatch[1] : '';

      toTranslate.push({ filename, sourcePath, sourceUrl, datePrefix });
    }

    console.log(`[Scraper] [Translate] ${toTranslate.length} files to translate (${mdFiles.length - toTranslate.length} already done).`);

    // Parallel translation in batches of 5
    const TRANSLATE_BATCH = 5;
    let translated = 0;
    const translateFailed = [];

    async function translateOne(item) {
      try {
        const { translatedContent, translatedTitle } = await translateFile(item.sourcePath, 'zh-TW');
        const sanitizedTitle = translatedTitle.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim().substring(0, 85);
        const destFilename = `${item.datePrefix}${sanitizedTitle}.md`;
        const destPath = path.join(destDir, destFilename);
        fs.writeFileSync(destPath, translatedContent, 'utf8');
        translated++;
        if (item.sourceUrl) translatedUrls.add(item.sourceUrl);
      } catch (err) {
        console.error(`[Scraper] [Translate] Error: ${item.filename}: ${err.message}`);
        translateFailed.push(item.filename);
      }
    }

    for (let i = 0; i < toTranslate.length; i += TRANSLATE_BATCH) {
      const batch = toTranslate.slice(i, i + TRANSLATE_BATCH);
      console.log(`[Scraper] [Translate] Batch ${Math.floor(i / TRANSLATE_BATCH) + 1}: ${batch.length} files...`);
      await Promise.all(batch.map(item => translateOne(item)));
    }

    if (translateFailed.length > 0) {
      console.log(`[Scraper] [Translate] Failed (${translateFailed.length}):`);
      for (const f of translateFailed) {
        console.log(`  - ${f}`);
      }
    }
    console.log(`[Scraper] [Translate] Done! Translated ${translated}/${toTranslate.length} files.`);
  } catch (err) {
    console.error(`[Scraper] [Translate] Failed to run translation: ${err.message}`);
  }
}

main().catch(console.error);
