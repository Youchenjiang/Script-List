#!/usr/bin/env node

/**
 * Markdown Toolkit CLI
 * 
 * Commands:
 *   txt2md       Convert TXT files / ebooks to structured Markdown
 *   html2md      Convert HTML files / markup to clean Markdown
 *   extract-code Extract fenced code blocks from Markdown files
 *   toc          Generate or update Table of Contents in Markdown files
 */

const path = require('path');
const toolkit = require('../src/index');

function parseArgs(args) {
  const options = {};
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const eqIdx = arg.indexOf('=');
      if (eqIdx !== -1) {
        const key = arg.slice(2, eqIdx);
        const val = arg.slice(eqIdx + 1);
        options[key] = val;
      } else {
        const key = arg.slice(2);
        if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
          options[key] = args[i + 1];
          i++;
        } else {
          options[key] = true;
        }
      }
    } else if (arg.startsWith('-')) {
      const key = arg.slice(1);
      if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        options[key] = args[i + 1];
        i++;
      } else {
        options[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }

  return { options, positional };
}

function printHelp() {
  console.log(`
Markdown Toolkit CLI
====================
實用 Markdown 綜合處理工具箱

用法 (Usage):
  mdtool <command> [options]
  node bin/cli.js <command> [options]

指令 (Commands):
  txt2md        將純文字 TXT 檔轉換為排版精美的 Markdown
  pdf2md        將 PDF 文件逐頁解析並轉換為 Markdown（含頁碼與 metadata）
  html2md       將網頁 HTML 清洗並轉換為乾淨的 Markdown
  extract-code  從 Markdown 筆記中提取所有程式碼區塊存成檔案
  toc           自動為 Markdown 檔案產製或更新目錄（Table of Contents）

範例 (Examples):
  # 1. TXT 轉 Markdown
  node bin/cli.js txt2md --input=book.txt --output=book.md --title="書名" --author="作者"

  # 2. PDF 轉 Markdown
  node bin/cli.js pdf2md --input=document.pdf --output=document.md

  # 3. HTML 轉 Markdown
  node bin/cli.js html2md --input=article.html --output=article.md

  # 4. 提取 Markdown 程式碼區塊
  node bin/cli.js extract-code --input=notes.md --output-dir=./extracted_code

  # 5. 生成或更新 Markdown 目錄
  node bin/cli.js toc --input=document.md
`);
}

async function main() {
  const rawArgs = process.argv.slice(2);
  if (rawArgs.length === 0 || rawArgs.includes('--help') || rawArgs.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  const command = rawArgs[0];
  const { options, positional } = parseArgs(rawArgs.slice(1));

  const input = options.input || options.i || positional[0];
  const output = options.output || options.o || positional[1];

  switch (command) {
    case 'txt2md': {
      if (!input) {
        console.error('錯誤：請指定輸入檔案 --input=<path>');
        process.exit(1);
      }
      const res = toolkit.txt2md(input, output, {
        title: options.title,
        author: options.author,
        publisher: options.publisher,
        isbn: options.isbn,
        splitParagraphs: options['split-paragraphs'] !== 'false',
        maxParagraphChars: parseInt(options['max-chars'] || options['maxParagraphChars'] || '80', 10),
        includeToc: options.toc !== 'false',
        frontmatter: options.frontmatter !== 'false',
      });
      console.log(`✔ 轉換成功：${res.outputPath}`);
      console.log(`  章節數：${res.sectionCount}`);
      console.log(`  文字量：${res.characterCount} 字`);
      break;
    }

    case 'pdf2md': {
      if (!input) {
        console.error('錯誤：請指定輸入檔案 --input=<path>');
        process.exit(1);
      }
      const fs = require('fs');
      const stat = fs.statSync(input);

      if (stat.isDirectory()) {
        const globPattern = (dir) => {
          const files = [];
          for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, item.name);
            if (item.isDirectory() && (options.recursive || options.r)) {
              files.push(...globPattern(full));
            } else if (item.isFile() && item.name.toLowerCase().endsWith('.pdf')) {
              files.push(full);
            }
          }
          return files;
        };

        const pdfList = globPattern(input);
        console.log(`找到 ${pdfList.length} 個 PDF 檔案，開始轉換...`);
        for (const pdfFile of pdfList) {
          const rel = path.relative(input, pdfFile);
          const isInline = options['external-images'] !== true && options['inline-images'] !== 'false';
          const res = await toolkit.pdf2md(pdfFile, targetOut, {
            extractImages: options['extract-images'] !== 'false',
            inlineImages: isInline,
            saveFiles: options['save-files'] === true || Boolean(options['image-dir']),
            detectTables: options['detect-tables'] !== 'false',
            includePageMarkers: options['no-page-markers'] !== true && options['no-pages'] !== true,
            includeMetadata: options['no-metadata'] !== true,
            password: options.password,
          });
          console.log(`✔ [${res.totalPages} 頁] ${path.basename(pdfFile)} -> ${res.outputPath} (${res.extractedImages.length} 張圖片${isInline ? ' - 已內嵌 Base64' : ''})`);
        }
        console.log('批次處理完成！');
      } else {
        const isInline = options['external-images'] !== true && options['inline-images'] !== 'false';
        const res = await toolkit.pdf2md(input, output, {
          title: options.title,
          extractImages: options['extract-images'] !== 'false',
          inlineImages: isInline,
          saveFiles: options['save-files'] === true || Boolean(options['image-dir']),
          detectTables: options['detect-tables'] !== 'false',
          includePageMarkers: options['no-page-markers'] !== true && options['no-pages'] !== true,
          includeMetadata: options['no-metadata'] !== true,
          imageDir: options['image-dir'],
          password: options.password,
        });
        console.log(`✔ 轉換成功：${res.outputPath}`);
        console.log(`  標題：${res.title}`);
        console.log(`  頁數：${res.totalPages} 頁`);
        console.log(`  萃取圖片：${res.extractedImages.length} 張（${isInline ? '直接內嵌 Base64 Data URI' : '儲存於外部目錄'}）`);
        console.log(`  文字量：${res.characterCount} 字`);
      }
      break;
    }

    case 'html2md': {
      if (!input) {
        console.error('錯誤：請指定輸入檔案 --input=<path>');
        process.exit(1);
      }
      const res = toolkit.html2md(input, output);
      console.log(`✔ 轉換成功：${res.outputPath}`);
      console.log(`  總字數：${res.characterCount} 字`);
      break;
    }

    case 'extract-code': {
      if (!input) {
        console.error('錯誤：請指定輸入檔案 --input=<path>');
        process.exit(1);
      }
      const outDir = options['output-dir'] || options.outDir || output;
      const res = toolkit.extractCodeBlocks(input, outDir, {
        dryRun: options['dry-run'] === true,
      });
      console.log(`✔ 提取完成：從 ${input} 提取了 ${res.extractedCount} 個代碼區塊`);
      res.blocks.forEach(b => {
        console.log(`  - [${b.language || 'text'}] -> ${b.savedPath}`);
      });
      break;
    }

    case 'toc': {
      if (!input) {
        console.error('錯誤：請指定輸入檔案 --input=<path>');
        process.exit(1);
      }
      const res = toolkit.insertOrUpdateToc(input, {
        minDepth: parseInt(options['min-depth'] || '2', 10),
        maxDepth: parseInt(options['max-depth'] || '4', 10),
        dryRun: options['dry-run'] === true,
      });
      console.log(`✔ 目錄更新成功：${res.markdownPath}`);
      console.log(`  共索引 ${res.headingsCount} 個標題`);
      break;
    }

    default:
      console.error(`未知指令：${command}`);
      printHelp();
      process.exit(1);
  }
}

if (require.main === module) {
  main();
}
