/**
 * HyRead 除錯工具
 * 
 * 用法：
 *   node hyread_debug.js <command> [options]
 * 
 * Commands：
 *   connect     - 測試 Chrome 連線
 *   pages       - 列出所有頁面
 *   frames      - 列出閱讀器的所有 frames
 *   toc         - 列出 TOC 按鈕
 *   extract     - 提取指定章節的文字
 *   dom         - 搜尋 DOM 裡的文字節點
 *   test        - 測試抓取流程
 */

const puppeteer = require('puppeteer-core');
const delay = ms => new Promise(r => setTimeout(r, ms));

async function connect(port = 9222) {
  return await puppeteer.connect({
    browserURL: `http://127.0.0.1:${port}`,
    defaultViewport: null,
  });
}

async function findReaderPage(browser) {
  const pages = await browser.pages();
  for (const p of pages) {
    if (p.url().includes('openbook2') || p.url().includes('epubreader')) {
      return p;
    }
  }
  return null;
}

// ============================================================
// Commands
// ============================================================

async function cmdConnect(port) {
  try {
    const browser = await connect(port);
    console.log('✓ 連線成功');
    const pages = await browser.pages();
    console.log(`  共 ${pages.length} 個頁面`);
    for (const p of pages) {
      console.log(`  - ${p.url().substring(0, 80)}`);
    }
    await browser.disconnect();
  } catch (e) {
    console.log('✗ 連線失敗:', e.message);
  }
}

async function cmdPages(port) {
  const browser = await connect(port);
  const pages = await browser.pages();
  console.log(`共 ${pages.length} 個頁面：`);
  pages.forEach((p, i) => {
    console.log(`[${i}] ${p.url().substring(0, 100)}`);
  });
  await browser.disconnect();
}

async function cmdFrames(port) {
  const browser = await connect(port);
  const page = await findReaderPage(browser);
  if (!page) {
    console.log('找不到閱讀器頁面');
    await browser.disconnect();
    return;
  }

  const frames = page.frames();
  console.log(`共 ${frames.length} 個 frames：`);
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    try {
      const text = await f.evaluate(() => document.body?.innerText || '');
      const firstLine = text.split('\n')[0]?.trim()?.substring(0, 50) || '';
      console.log(`[${i}] ${text.length}字 | ${firstLine}`);
    } catch (e) {
      console.log(`[${i}] 錯誤: ${e.message.substring(0, 50)}`);
    }
  }
  await browser.disconnect();
}

async function cmdToc(port) {
  const browser = await connect(port);
  const page = await findReaderPage(browser);
  if (!page) {
    console.log('找不到閱讀器頁面');
    await browser.disconnect();
    return;
  }

  // 打開 TOC
  await page.mouse.click(30, 30);
  await delay(800);
  await page.evaluate(() => {
    for (const b of document.querySelectorAll('button')) {
      if (b.innerText?.trim() === '目次') { b.click(); return; }
    }
  });
  await delay(800);

  // 取得按鈕
  const buttons = await page.evaluate(() => {
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

  console.log(`共 ${buttons.length} 個章節按鈕：`);
  buttons.forEach((b, i) => console.log(`[${i}] ${b}`));
  await browser.disconnect();
}

async function cmdExtract(port, chapterTitle) {
  const browser = await connect(port);
  const page = await findReaderPage(browser);
  if (!page) {
    console.log('找不到閱讀器頁面');
    await browser.disconnect();
    return;
  }

  // 打開 TOC
  await page.mouse.click(30, 30);
  await delay(800);
  await page.evaluate(() => {
    for (const b of document.querySelectorAll('button')) {
      if (b.innerText?.trim() === '目次') { b.click(); return; }
    }
  });
  await delay(800);

  // 點擊章節
  await page.evaluate((title) => {
    for (const b of document.querySelectorAll('button')) {
      if (b.innerText?.trim() === title) { b.click(); return; }
    }
  }, chapterTitle);
  await delay(3000);

  // 搜尋所有 frames
  const frames = page.frames();
  for (let i = 0; i < frames.length; i++) {
    try {
      const text = await frames[i].evaluate(() => document.body?.innerText || '');
      if (text.includes(chapterTitle) && text.length > 200) {
        console.log(`✓ Frame ${i} 找到「${chapterTitle}」(${text.length}字)`);
        console.log('前 300 字：');
        console.log(text.substring(0, 300));
        break;
      }
    } catch (e) {}
  }

  await browser.disconnect();
}

async function cmdDom(port) {
  const browser = await connect(port);
  const page = await findReaderPage(browser);
  if (!page) {
    console.log('找不到閱讀器頁面');
    await browser.disconnect();
    return;
  }

  const client = await page.createCDPSession();
  const doc = await client.send('DOM.getDocument', { depth: -1, pierce: true });

  const textNodes = [];
  function walk(node) {
    if (!node) return;
    if (node.nodeName === '#text' && node.nodeValue && node.nodeValue.trim().length > 50) {
      textNodes.push(node.nodeValue.trim());
    }
    if (node.children) for (const c of node.children) walk(c);
    if (node.contentDocument) walk(node.contentDocument);
    if (node.shadowRoots) for (const sr of node.shadowRoots) walk(sr);
  }
  walk(doc.root);

  console.log(`找到 ${textNodes.length} 個文字節點：`);
  textNodes.slice(0, 20).forEach((t, i) => {
    console.log(`[${i}] (${t.length}字) ${t.substring(0, 80)}`);
  });

  await client.detach();
  await browser.disconnect();
}

async function cmdTest(port) {
  console.log('=== HyRead 除錯測試 ===\n');

  console.log('1. 測試連線...');
  await cmdConnect(port);

  console.log('\n2. 測試 Frames...');
  await cmdFrames(port);

  console.log('\n3. 測試 TOC...');
  await cmdToc(port);

  console.log('\n完成！');
}

// ============================================================
// Main
// ============================================================

const args = process.argv.slice(2);
const command = args[0] || 'test';
const port = parseInt(args.find(a => a.startsWith('--port='))?.split('=')[1] || '9222');
const chapter = args[1];

const commands = {
  connect: () => cmdConnect(port),
  pages: () => cmdPages(port),
  frames: () => cmdFrames(port),
  toc: () => cmdToc(port),
  extract: () => cmdExtract(port, chapter),
  dom: () => cmdDom(port),
  test: () => cmdTest(port),
};

if (commands[command]) {
  commands[command]().catch(e => console.error('錯誤:', e.message));
} else {
  console.log('用法：node hyread_debug.js <command> [options]');
  console.log('\nCommands:');
  console.log('  connect     - 測試 Chrome 連線');
  console.log('  pages       - 列出所有頁面');
  console.log('  frames      - 列出閱讀器的所有 frames');
  console.log('  toc         - 列出 TOC 按鈕');
  console.log('  extract <章節> - 提取指定章節的文字');
  console.log('  dom         - 搜尋 DOM 裡的文字節點');
  console.log('  test        - 測試抓取流程');
}
