const fs = require('fs');
const path = require('path');
const https = require('https');

// Helper: Format Date object to YYYY-MM-DD
function formatDate(dateObj) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Helper: Translate using Google Mobile Web translation page
function translateGoogleM(text, targetLang = 'zh-TW', retries = 3, delayMs = 1000) {
  return new Promise((resolve, reject) => {
    const url = `https://translate.google.com/m?sl=auto&tl=${targetLang}&q=${encodeURIComponent(text)}`;
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G960F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.138 Mobile Safari/537.36'
      },
      timeout: 15000
    };
    const req = https.get(url, options, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 429) {
        return reject(new Error(`RateLimitedStatus${res.statusCode}`));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP status ${res.statusCode}`));
      }
      let html = '';
      res.on('data', chunk => html += chunk);
      res.on('end', () => {
        const match = html.match(/class="result-container">([\s\S]+?)<\/div>/) || html.match(/class="t0">([\s\S]+?)<\/div>/);
        if (match) {
          let translated = match[1]
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&#39;/g, "'")
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>');
          resolve(translated);
        } else {
          reject(new Error("No match in HTML"));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  }).catch(async (err) => {
    if (err.message.startsWith('RateLimitedStatus') || err.message === 'Request timeout' || err.message === 'No match in HTML') {
      if (retries > 0) {
        console.warn(`[Translate] Google Mobile error/limit (${err.message}). Retrying in ${delayMs}ms... (${retries} left)`);
        await sleep(delayMs);
        return translateGoogleM(text, targetLang, retries - 1, delayMs * 2);
      }
    }
    throw err;
  });
}

// Helper: Translate using Google Free Translate API (gtx)
function translateGoogle(text, targetLang = 'zh-TW', retries = 3, delayMs = 1000) {
  return new Promise((resolve, reject) => {
    const postData = new URLSearchParams();
    postData.append('q', text);
    const postDataString = postData.toString();

    const options = {
      hostname: 'translate.googleapis.com',
      path: `/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postDataString),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 15000
    };

    const req = https.request(options, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 429) {
        return reject(new Error(`RateLimitedStatus${res.statusCode}`));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP status ${res.statusCode}`));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed) && parsed[0]) {
            let translated = '';
            for (const item of parsed[0]) {
              if (item && item[0]) {
                translated += item[0];
              }
            }
            resolve(translated);
          } else {
            reject(new Error('Unexpected JSON structure'));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.write(postDataString);
    req.end();
  }).catch(async (err) => {
    if (err.message.startsWith('RateLimitedStatus') || err.message === 'Request timeout') {
      if (retries > 0) {
        console.warn(`[Translate] Google API error/limit (${err.message}). Retrying in ${delayMs}ms... (${retries} left)`);
        await sleep(delayMs);
        return translateGoogle(text, targetLang, retries - 1, delayMs * 2);
      }
    }
    throw err;
  });
}

// Helper: Translate using MyMemory API (free fallback, keyless)
function translateMyMemory(text, targetLang = 'zh-TW', retries = 3, delayMs = 1000) {
  return new Promise((resolve, reject) => {
    const langpair = `en|${targetLang}`;
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(langpair)}&de=security-news-scraper@yandex.com`;

    const req = https.get(url, (res) => {
      if (res.statusCode === 429) {
        return reject(new Error('MyMemory status 429'));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`MyMemory status ${res.statusCode}`));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed && parsed.responseData && parsed.responseData.translatedText) {
            resolve(parsed.responseData.translatedText);
          } else {
            reject(new Error('Invalid MyMemory response structure'));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('MyMemory timeout'));
    });
  }).catch(async (err) => {
    if (err.message.includes('status 429')) {
      if (retries > 0) {
        console.warn(`[Translate] MyMemory rate limit hit (HTTP 429). Pausing for 15 seconds... (${retries} retries left)`);
        await sleep(15000);
        return translateMyMemory(text, targetLang, retries - 1, delayMs);
      }
    }
    if (retries > 0) {
      console.warn(`[Translate] MyMemory error: ${err.message}. Retrying in ${delayMs}ms... (${retries} left)`);
      await sleep(delayMs);
      return translateMyMemory(text, targetLang, retries - 1, delayMs * 2);
    }
    throw err;
  });
}

// Main Translation Router: Try Google Mobile -> Google API -> MyMemory sequentially
async function translateChunk(text, targetLang = 'zh-TW') {
  if (!text || !text.trim()) {
    return text;
  }
  
  // Try Google Mobile first
  try {
    const res = await translateGoogleM(text, targetLang);
    return res;
  } catch (errM) {
    console.warn(`[Translate] Google Mobile failed: ${errM.message}. Falling back to Google API...`);
  }

  // Try Google API second
  try {
    const res = await translateGoogle(text, targetLang);
    return res;
  } catch (errA) {
    console.warn(`[Translate] Google API failed: ${errA.message}. Falling back to MyMemory...`);
  }

  // Try MyMemory third
  try {
    const res = await translateMyMemory(text, targetLang);
    return res;
  } catch (errMy) {
    console.warn(`[Translate] MyMemory failed: ${errMy.message}.`);
    throw new Error('All translation engines failed');
  }
}

// Helper: Group paragraphs into larger chunks of up to maxChunkSize to minimize API requests
function groupParagraphs(content, maxChunkSize = 2000) {
  const blocks = content.split('\n\n');
  const chunks = [];
  
  let currentChunk = [];
  let currentSize = 0;
  let inCodeBlock = false;

  for (let block of blocks) {
    const trimmed = block.trim();
    
    // Code block boundaries
    if (trimmed.startsWith('```')) {
      if (currentChunk.length > 0) {
        chunks.push({ translate: !inCodeBlock, text: currentChunk.join('\n\n') });
        currentChunk = [];
        currentSize = 0;
      }
      inCodeBlock = !inCodeBlock;
      chunks.push({ translate: false, text: block });
      continue;
    }

    if (inCodeBlock) {
      chunks.push({ translate: false, text: block });
      continue;
    }

    // Skip metadata lines we don't want to translate (e.g. date and URL lines)
    if (trimmed.startsWith('- **URL**:') || trimmed.startsWith('- **Date**:')) {
      if (currentChunk.length > 0) {
        chunks.push({ translate: true, text: currentChunk.join('\n\n') });
        currentChunk = [];
        currentSize = 0;
      }
      chunks.push({ translate: false, text: block });
      continue;
    }

    // Normal paragraph text
    const blockSize = Buffer.byteLength(block, 'utf8');
    if (currentSize + blockSize > maxChunkSize && currentChunk.length > 0) {
      chunks.push({ translate: true, text: currentChunk.join('\n\n') });
      currentChunk = [block];
      currentSize = blockSize;
    } else {
      currentChunk.push(block);
      currentSize += blockSize + 2; // +2 for '\n\n'
    }
  }

  if (currentChunk.length > 0) {
    chunks.push({ translate: !inCodeBlock, text: currentChunk.join('\n\n') });
  }

  return chunks;
}

// Helper: Translate a markdown file block-by-block to preserve layout and code blocks
async function translateFile(filePath, targetLang = 'zh-TW') {
  const content = fs.readFileSync(filePath, 'utf8');
  
  const chunks = groupParagraphs(content);
  const translatedChunks = [];
  
  let translatedTitleText = '';
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (!chunk.translate) {
      translatedChunks.push(chunk.text);
      continue;
    }
    
    // Minor delay between chunks
    await sleep(300);
    const translated = await translateChunk(chunk.text, targetLang);
    translatedChunks.push(translated);
    
    // Extract translated title from the first translated chunk containing '#'
    if (i === 0 || (i === 1 && !chunks[0].translate)) {
      const lines = translated.split('\n');
      const titleLine = lines.find(l => l.trim().startsWith('#'));
      if (titleLine) {
        translatedTitleText = titleLine.replace(/^#\s*/, '').trim();
      }
    }
  }

  // Fallback to original title if translation failed
  if (!translatedTitleText) {
    const lines = content.split('\n');
    const titleLine = lines.find(l => l.trim().startsWith('#'));
    if (titleLine) {
      translatedTitleText = titleLine.replace(/^#\s*/, '').trim();
    }
  }
  
  return {
    translatedContent: translatedChunks.join('\n\n'),
    translatedTitle: translatedTitleText || 'Untitled'
  };
}

async function main() {
  const dirPath = process.argv[2] || path.join(__dirname, 'news_output', formatDate(new Date()));
  if (!fs.existsSync(dirPath)) {
    console.error(`[Translate] Error: Directory does not exist: ${dirPath}`);
    process.exit(1);
  }

  // Create the [zh-TW] sister directory
  const parentDir = path.dirname(dirPath);
  const dirName = path.basename(dirPath);
  const destDir = path.join(parentDir, `${dirName} [zh-TW]`);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  // Cleanup: Delete any files in destDir that do not contain Chinese characters
  console.log(`[Translate] Checking for failed translations to clean up in: ${destDir}`);
  if (fs.existsSync(destDir)) {
    const destFiles = fs.readdirSync(destDir);
    for (const f of destFiles) {
      if (f.endsWith('.md')) {
        // If the filename contains no Chinese characters, it's an English fallback
        if (!/[\u4e00-\u9fa5]/.test(f)) {
          const failedFilePath = path.join(destDir, f);
          console.log(`[Translate] Cleaning up failed English translation file: ${failedFilePath}`);
          fs.unlinkSync(failedFilePath);
        }
      }
    }
  }

  // Build a cache of URLs of already translated files in destDir
  const translatedUrls = new Set();
  if (fs.existsSync(destDir)) {
    const destFiles = fs.readdirSync(destDir).filter(f => f.endsWith('.md'));
    for (const f of destFiles) {
      const filePath = path.join(destDir, f);
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        // Regex to match: - **URL**: <link>
        const match = content.match(/-\s+\*\*URL\*\*:\s*([^\s\n]+)/);
        if (match) {
          translatedUrls.add(match[1].trim());
        }
      } catch (err) {
        console.warn(`[Translate] Error reading translated file ${f} for URL caching: ${err.message}`);
      }
    }
  }
  console.log(`[Translate] Cached ${translatedUrls.size} already translated URLs.`);

  console.log(`[Translate] Scanning directory: ${dirPath}`);
  const files = fs.readdirSync(dirPath);
  // Filter only markdown files and ignore folders (like 'zh-TW')
  const mdFiles = files.filter(f => f.endsWith('.md') && fs.statSync(path.join(dirPath, f)).isFile());

  console.log(`[Translate] Found ${mdFiles.length} markdown files to translate.`);

  for (let i = 0; i < mdFiles.length; i++) {
    const filename = mdFiles[i];
    const sourcePath = path.join(dirPath, filename);
    
    // Read the source file to extract its URL
    let sourceUrl = '';
    try {
      const sourceContent = fs.readFileSync(sourcePath, 'utf8');
      const match = sourceContent.match(/-\s+\*\*URL\*\*:\s*([^\s\n]+)/);
      if (match) {
        sourceUrl = match[1].trim();
      }
    } catch (err) {
      console.error(`[Translate] Error reading source file ${filename}: ${err.message}`);
      continue;
    }

    if (sourceUrl && translatedUrls.has(sourceUrl)) {
      console.log(`[Translate] (${i + 1}/${mdFiles.length}) Skipping (already translated by URL): ${filename}`);
      continue;
    }

    // Get the original date prefix (e.g. "2026-06-13 - ")
    const datePrefixMatch = /^(\d{4}-\d{2}-\d{2}\s+-\s+)/.exec(filename);
    const datePrefix = datePrefixMatch ? datePrefixMatch[1] : '';

    console.log(`[Translate] (${i + 1}/${mdFiles.length}) Translating: ${filename}...`);
    try {
      const { translatedContent, translatedTitle } = await translateFile(sourcePath, 'zh-TW');
      
      const sanitizedTitle = translatedTitle.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim().substring(0, 85);
      const destFilename = `${datePrefix}${sanitizedTitle}.md`;
      const destPath = path.join(destDir, destFilename);

      fs.writeFileSync(destPath, translatedContent, 'utf8');
      console.log(`[Translate] Saved translated version to: ${destPath}`);
      if (sourceUrl) {
        translatedUrls.add(sourceUrl);
      }
    } catch (err) {
      console.error(`[Translate] Error translating ${filename}: ${err.message}`);
    }
    // Delay between files to be polite to the translation API
    await sleep(2500);
  }

  console.log('[Translate] All translations finished.');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  translateChunk,
  translateFile
};
