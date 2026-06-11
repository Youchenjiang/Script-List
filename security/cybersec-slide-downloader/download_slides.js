const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const API_URL = 'https://ccmsapi.ithome.com.tw';
const SESSIONS_QUERY = `
query gets($language: AvailableLang) {
    getProject: cybersec2026(lang: $language) {
        sessions {
            id
            title
            slides {
                id
                title
                supply
                slide_file {
                    url
                }
            }
            downloads {
                id
                title
                file {
                    url
                }
            }
        }
    }
}
`;

// Helper to sanitize filename for Windows filesystem
function sanitizeFilename(name) {
  // Remove Windows forbidden characters: \ / : * ? " < > |
  let sanitized = name.replace(/[\\/:*?"<>|]/g, '_');
  // Trim spaces and dots
  sanitized = sanitized.trim().replace(/^\.+|\.+$/g, '');
  // Limit length to avoid path length issues (max 120 chars)
  if (sanitized.length > 120) {
    sanitized = sanitized.substring(0, 117) + '...';
  }
  return sanitized || 'Untitled_Session';
}

// Helper to recursively find all file names already present in downloads/ subdirectories
function getExistingFiles(dir) {
  const files = new Set();
  if (!fs.existsSync(dir)) return files;
  
  function walk(currentDir) {
    const list = fs.readdirSync(currentDir);
    list.forEach((file) => {
      const fullPath = path.join(currentDir, file);
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        walk(fullPath);
      } else {
        files.add(file);
      }
    });
  }
  
  walk(dir);
  return files;
}

function postRequest(url, data) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const postData = JSON.stringify(data);
    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve(body));
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function downloadFile(url, dest, retries = 3) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    }, (res) => {
      // Handle redirects (e.g. 301, 302)
      if (res.statusCode === 301 || res.statusCode === 302) {
        downloadFile(res.headers.location, dest, retries).then(resolve).catch(reject);
        return;
      }

      if (res.statusCode !== 200) {
        if (retries > 0) {
          console.log(`  [Retry] Failed status ${res.statusCode} for URL: ${url}. Retrying... (${retries} left)`);
          setTimeout(() => {
            downloadFile(url, dest, retries - 1).then(resolve).catch(reject);
          }, 1000);
        } else {
          reject(new Error(`Status Code: ${res.statusCode}`));
        }
        return;
      }

      const fileStream = fs.createWriteStream(dest);
      res.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });

      fileStream.on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    }).on('error', (err) => {
      if (retries > 0) {
        console.log(`  [Retry] Network error for URL: ${url}. Retrying... (${retries} left)`);
        setTimeout(() => {
          downloadFile(url, dest, retries - 1).then(resolve).catch(reject);
        }, 1000);
      } else {
        reject(err);
      }
    });
  });
}

async function main() {
  const downloadsDir = path.join(__dirname, 'downloads');
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
  }

  console.log('1. Fetching session metadata from CYBERSEC 2026 API...');
  let responseText;
  try {
    responseText = await postRequest(API_URL, {
      query: SESSIONS_QUERY,
      variables: { language: 'tw' }
    });
  } catch (err) {
    console.error('Failed to connect to the CYBERSEC API:', err.message);
    process.exit(1);
  }

  let result;
  try {
    result = JSON.parse(responseText);
  } catch (err) {
    console.error('Failed to parse API response as JSON:', err.message);
    process.exit(1);
  }

  const sessions = result.data?.getProject?.sessions;
  if (!sessions) {
    console.error('No sessions found in the API response.');
    process.exit(1);
  }

  console.log(`Found ${sessions.length} total sessions.`);

  const existingFiles = getExistingFiles(downloadsDir);
  let skippedCount = 0;

  // Extract all files (slides and downloads)
  const downloadQueue = [];
  sessions.forEach((session) => {
    if (session.slides && session.slides.length > 0) {
      session.slides.forEach((slide, idx) => {
        if (slide.slide_file && slide.slide_file.url) {
          const suffix = session.slides.length > 1 ? `_part${idx + 1}` : '';
          const filename = sanitizeFilename(`[${session.id}]${suffix} ${session.title}`) + '.pdf';
          if (existingFiles.has(filename)) {
            skippedCount++;
            return;
          }
          downloadQueue.push({
            id: session.id,
            sessionTitle: session.title,
            type: 'slide',
            url: slide.slide_file.url,
            filename: filename,
            dest: path.join(downloadsDir, filename)
          });
        }
      });
    }

    if (session.downloads && session.downloads.length > 0) {
      session.downloads.forEach((dl, idx) => {
        if (dl.file && dl.file.url) {
          // Skip "Add to Calendar" links/buttons
          if (dl.title && dl.title.toLowerCase().includes('add to calendar')) {
            return;
          }
          if (dl.file.url.includes('addcal.io')) {
            return;
          }

          const suffix = session.downloads.length > 1 ? `_dl${idx + 1}` : '_dl';
          // Extract extension from url or fallback to .pdf
          let ext = '.pdf';
          try {
            const urlPath = new URL(dl.file.url).pathname;
            const parsedExt = path.extname(urlPath);
            if (parsedExt) ext = parsedExt;
          } catch (_) {}
          const filename = sanitizeFilename(`[${session.id}]${suffix} ${session.title}`) + ext;
          if (existingFiles.has(filename)) {
            skippedCount++;
            return;
          }
          downloadQueue.push({
            id: session.id,
            sessionTitle: session.title,
            type: 'download',
            url: dl.file.url,
            filename: filename,
            dest: path.join(downloadsDir, filename)
          });
        }
      });
    }
  });

  const totalFiles = downloadQueue.length;
  console.log(`Found ${totalFiles} new files to download (skipped ${skippedCount} already downloaded).`);

  // Concurrent downloader with limit
  const CONCURRENCY_LIMIT = 5;
  let activeDownloads = 0;
  let completed = 0;
  let succeeded = 0;
  let failed = 0;
  const report = [];

  return new Promise((resolve) => {
    function startNext() {
      if (downloadQueue.length === 0) {
        if (activeDownloads === 0) {
          console.log('\n--- Download Summary ---');
          console.log(`Total attempted: ${totalFiles}`);
          console.log(`Succeeded: ${succeeded}`);
          console.log(`Failed: ${failed}`);
          
          fs.writeFileSync(
            path.join(__dirname, 'download_report.json'),
            JSON.stringify({
              totalAttempted: totalFiles,
              succeeded,
              failed,
              downloads: report
            }, null, 2)
          );
          console.log(`Report written to download_report.json.`);
          resolve();
        }
        return;
      }

      while (activeDownloads < CONCURRENCY_LIMIT && downloadQueue.length > 0) {
        const item = downloadQueue.shift();
        activeDownloads++;
        console.log(`[Downloading ${++completed}/${totalFiles}] (${item.type}) ${item.filename}`);

        downloadFile(item.url, item.dest)
          .then(() => {
            succeeded++;
            report.push({
              id: item.id,
              sessionTitle: item.sessionTitle,
              type: item.type,
              filename: item.filename,
              url: item.url,
              status: 'success'
            });
          })
          .catch((err) => {
            failed++;
            console.error(`  [Error] Failed to download ${item.filename}: ${err.message}`);
            report.push({
              id: item.id,
              sessionTitle: item.sessionTitle,
              type: item.type,
              filename: item.filename,
              url: item.url,
              status: 'failed',
              error: err.message
            });
          })
          .finally(() => {
            activeDownloads--;
            startNext();
          });
      }
    }

    startNext();
  });
}

main()
  .then(() => {
    console.log('\n2. Auto-running PDF classifier and sorter...');
    try {
      execSync('uv run --with pypdf classify_slides.py', { cwd: __dirname, stdio: 'inherit' });
      console.log('Classifier finished successfully.');
    } catch (err) {
      console.error('Failed to run classifier:', err.message);
    }
  })
  .catch(console.error);
