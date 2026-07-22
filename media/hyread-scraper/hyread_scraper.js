/**
 * HyRead 電子書文字抓取工具
 * 
 * 使用方式：
 *   node hyread_scraper.js [options]
 * 
 * 前置條件：
 *   1. Chrome 以 --remote-debugging-port=9222 啟動
 *   2. 已登入圖書館並打開閱讀器頁面
 * 
 * 核心原理：
 *   - CDP DOM.getDocument({ depth: -1, pierce: true }) 繞過跨域
 *   - 穿透所有 iframe 抓到解密後的文字
 *   - 從 TOC 按鈕導航到各章節
 */

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const delay = ms => new Promise(r => setTimeout(r, ms));

// ============================================================
// 工具函數
// ============================================================

/**
 * 連接到已開啟的 Chrome
 */
async function connectBrowser(port = 9222) {
  return await puppeteer.connect({
    browserURL: `http://127.0.0.1:${port}`,
    defaultViewport: null,
  });
}

/**
 * 找到閱讀器頁面
 */
async function findReaderPage(browser) {
  const pages = await browser.pages();
  for (const p of pages) {
    if (p.url().includes('openbook2') || p.url().includes('epubreader')) {
      return p;
    }
  }
  return null;
}

/**
 * 打開 TOC 目錄面板
 */
async function openTOC(page) {
  // 點擊左上角選單按鈕
  await page.mouse.click(30, 30);
  await delay(800);
  // 點擊「目次」按鈕
  await page.evaluate(() => {
    for (const b of document.querySelectorAll('button')) {
      if (b.innerText?.trim() === '目次') { b.click(); return; }
    }
  });
  await delay(800);
}

/**
 * 點擊 TOC 裡的章節按鈕
 */
async function clickChapterButton(page, title) {
  return await page.evaluate((btnTitle) => {
    for (const b of document.querySelectorAll('button')) {
      if (b.innerText?.trim() === btnTitle) {
        b.click();
        return true;
      }
    }
    return false;
  }, title);
}

/**
 * 從所有 frame 中提取文字，找含有關鍵字的那個
 * 
 * 核心：CDP DOM.getDocument(pierce: true) 繞過跨域
 */
async function extractContentFromFrames(page, keyword) {
  // 方法 1：用 Puppeteer frames API
  const frames = page.frames();
  for (const f of frames) {
    try {
      const text = await f.evaluate(() => document.body?.innerText || '');
      if (keyword) {
        if (text.includes(keyword) && text.length > 200) {
          return text;
        }
      } else {
        if (text.length > 200) {
          return text;
        }
      }
    } catch (e) {}
  }
  return null;
}

/**
 * 過濾掉非書本內容（CSS、JS、UI 等）
 */
function filterBookText(text) {
  return text.split('\n').filter(t => {
    t = t.trim();
    if (t.length < 5) return false;
    if (t.includes('{') && t.includes('}')) return false;
    if (t.includes('!important')) return false;
    if (t.includes('window.')) return false;
    if (t.includes('documentMode')) return false;
    if (t.includes('noscript')) return false;
    if (t.includes('閱讀方向')) return false;
    if (t.includes('輕觸顯示')) return false;
    if (t.includes('You need to enable')) return false;
    if (t.includes('閱讀結束')) return false;
    if (t.includes('全文') && t.includes('本章')) return false;
    if (t.includes('封面') && t.includes('結束') && t.includes('章節')) return false;
    return true;
  }).join('\n');
}

/**
 * 增量存檔
 */
function saveProgress(chapters, outputDir) {
  const jsonPath = path.join(outputDir, 'progress.json');
  const txtPath = path.join(outputDir, 'book.txt');
  
  fs.writeFileSync(jsonPath, JSON.stringify(chapters, null, 2), 'utf8');
  
  let txt = '';
  chapters.forEach(ch => {
    txt += '\n\n========== ' + ch.title + ' ==========\n\n' + ch.text;
  });
  fs.writeFileSync(txtPath, txt, 'utf8');
}

// ============================================================
// 主流程
// ============================================================

async function scrapeBook(options = {}) {
  const {
    port = 9222,
    outputDir = '.',
    chaptersToScrape = null, // null = 自動從 TOC 取得
    waitAfterClick = 3000,
  } = options;

  // 連接
  const browser = await connectBrowser(port);
  const page = await findReaderPage(browser);
  if (!page) {
    console.log('找不到閱讀器頁面');
    await browser.disconnect();
    return;
  }

  // 取得 TOC 按鈕列表
  await openTOC(page);
  const buttonTitles = await page.evaluate(() => {
    const results = [];
    const skip = ['目次', '書籤', '註記', '資訊', '結束'];
    for (const b of document.querySelectorAll('button')) {
      const t = b.innerText?.trim();
      if (t && t.length > 2 && !skip.includes(t)) {
        results.push(t);
      }
    }
    return results;
  });

  console.log('找到 ' + buttonTitles.length + ' 個章節按鈕');

  // 如果沒有指定章節，用 TOC 列表
  const targets = chaptersToScrape || buttonTitles;

  // 逐章抓取
  const allChapters = [];
  const startTime = Date.now();

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    console.log('[' + (i+1) + '/' + targets.length + '] ' + target);

    // 打開 TOC
    await openTOC(page);

    // 點擊
    const clicked = await clickChapterButton(page, target);
    if (!clicked) {
      console.log('  找不到按鈕，跳過');
      continue;
    }

    // 等待內容載入
    await delay(waitAfterClick);

    // 從所有 frame 提取內容
    const content = await extractContentFromFrames(page, null);
    if (content) {
      const filtered = filterBookText(content);
      if (filtered.length > 20) {
        const isDup = allChapters.some(c => c.text === filtered);
        if (!isDup) {
          allChapters.push({ title: target, text: filtered });
          saveProgress(allChapters, outputDir);
          console.log('  ✓ ' + filtered.length + ' 字');
        } else {
          console.log('  (重複)');
        }
      }
    }
  }

  // 統計
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log('\n=== 完成 ===');
  console.log('共 ' + allChapters.length + ' 章');
  let total = 0;
  allChapters.forEach((ch, i) => {
    total += ch.text.length;
    console.log((i+1) + '. ' + ch.title + ' (' + ch.text.length + '字)');
  });
  console.log('總字數: ' + total);
  console.log('耗時: ' + elapsed + ' 秒');

  await browser.disconnect();
  return allChapters;
}

// ============================================================
// CLI 入口
// ============================================================

if (require.main === module) {
  const args = process.argv.slice(2);
  const port = parseInt(args.find(a => a.startsWith('--port='))?.split('=')[1] || '9222');
  const output = args.find(a => a.startsWith('--output='))?.split('=')[1] || './output';

  if (!fs.existsSync(output)) {
    fs.mkdirSync(output, { recursive: true });
  }

  scrapeBook({ port, outputDir: output })
    .then(() => console.log('完成!'))
    .catch(e => console.error('錯誤:', e.message));
}

module.exports = { scrapeBook, connectBrowser, findReaderPage, openTOC, extractContentFromFrames, filterBookText };
