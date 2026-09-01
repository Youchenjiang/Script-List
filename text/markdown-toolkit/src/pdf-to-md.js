/**
 * PDF to Markdown Converter Module (Pure Node.js)
 * 
 * Features:
 * - Pure JavaScript / Node.js (via pdfjs-dist)
 * - Page-by-page layout-aware text extraction
 * - Heuristic Table Detection & Reconstruction to Markdown tables (| col1 | col2 |)
 * - Embedded Image Extraction (saving to PNG/JPEG) & Markdown Image Embedding (![Image](path))
 * - YAML Frontmatter generation with PDF metadata
 * - Single file and directory batch conversion
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Dynamic loader for pdfjs-dist legacy build
let pdfjsLibInstance = null;
async function getPdfjs() {
  if (!pdfjsLibInstance) {
    pdfjsLibInstance = await import('pdfjs-dist/legacy/build/pdf.mjs');
  }
  return pdfjsLibInstance;
}

/**
 * Calculates CRC32 for PNG chunks (standard polynomial 0xEDB88320)
 */
function crc32(buf) {
  let crc = 0 ^ -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

const CRC_TABLE = new Int32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[i] = c;
}

/**
 * Creates a PNG buffer from raw RGB or RGBA pixel data using Node.js built-in zlib
 */
function encodePng(width, height, data, channels = 4) {
  const bytesPerPixel = channels === 3 ? 3 : 4;
  const colorType = channels === 3 ? 2 : 6; // 2 = RGB, 6 = RGBA

  // PNG Signature
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // 8-bit depth
  ihdr.writeUInt8(colorType, 9);
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // interlace

  function makeChunk(type, chunkData) {
    const len = chunkData.length;
    const buf = Buffer.alloc(8 + len + 4);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4, 4, 'ascii');
    chunkData.copy(buf, 8);

    const typeAndData = buf.subarray(4, 8 + len);
    const crcVal = crc32(typeAndData);
    buf.writeUInt32BE(crcVal, 8 + len);
    return buf;
  }

  // Scanlines with filter byte 0 (None) at the start of each line
  const rawScanlines = Buffer.alloc(height * (1 + width * bytesPerPixel));
  let srcOffset = 0;
  let dstOffset = 0;

  for (let y = 0; y < height; y++) {
    rawScanlines[dstOffset++] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      if (channels === 3) {
        rawScanlines[dstOffset++] = data[srcOffset] || 0;
        rawScanlines[dstOffset++] = data[srcOffset + 1] || 0;
        rawScanlines[dstOffset++] = data[srcOffset + 2] || 0;
        srcOffset += 3;
      } else {
        rawScanlines[dstOffset++] = data[srcOffset] || 0;
        rawScanlines[dstOffset++] = data[srcOffset + 1] || 0;
        rawScanlines[dstOffset++] = data[srcOffset + 2] || 0;
        rawScanlines[dstOffset++] = data[srcOffset + 3] !== undefined ? data[srcOffset + 3] : 255;
        srcOffset += 4;
      }
    }
  }

  const idatData = zlib.deflateSync(rawScanlines);
  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', idatData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

/**
 * Strict Table Grid Reconstructor for a sequence of lines within a single column
 */
function reconstructColumnTablesAndText(lines) {
  if (!lines || lines.length === 0) return '';
  const outputBlocks = [];
  let tableCandidate = [];

  function isStrictTableRow(line) {
    if (line.length < 2) return false;
    const totalChars = line.reduce((acc, it) => acc + (it.str ? it.str.length : 0), 0);
    // Table rows typically have distinct column gaps and compact cells
    let distinctGaps = 0;
    for (let i = 1; i < line.length; i++) {
      const prev = line[i - 1];
      const curr = line[i];
      const gap = curr.x - (prev.x + (prev.width || 0));
      if (gap > 12) {
        distinctGaps++;
      }
    }
    // Must have at least 1 significant gap and not be a long running sentence (> 120 chars per cell on average)
    return distinctGaps >= 1 && totalChars < 200;
  }

  function flushTable(cand) {
    if (cand.length === 0) return;
    if (cand.length >= 2) {
      // Check column consistency across rows
      const colCounts = cand.map(l => l.length);
      const isConsistent = colCounts.every(c => c === colCounts[0]) || cand.length >= 3;

      if (isConsistent) {
        const maxCols = Math.max(...cand.map(l => l.length));
        const mdTableLines = [];

        cand.forEach((line, rowIdx) => {
          const rowCells = line.map(item => item.str.trim().replace(/\|/g, '\\|'));
          while (rowCells.length < maxCols) {
            rowCells.push('');
          }
          mdTableLines.push(`| ${rowCells.join(' | ')} |`);

          if (rowIdx === 0) {
            const sep = Array(maxCols).fill('---');
            mdTableLines.push(`| ${sep.join(' | ')} |`);
          }
        });
        outputBlocks.push(mdTableLines.join('\n'));
        return;
      }
    }

    // If not a valid multi-row table, output as normal text lines
    cand.forEach(line => {
      const lineText = line.map(i => i.str).join(' ').trim();
      if (lineText) outputBlocks.push(lineText);
    });
  }

  for (const line of lines) {
    if (isStrictTableRow(line)) {
      tableCandidate.push(line);
    } else {
      if (tableCandidate.length > 0) {
        flushTable(tableCandidate);
        tableCandidate = [];
      }
      const lineText = line.map(i => i.str).join(' ').trim();
      if (lineText) {
        outputBlocks.push(lineText);
      }
    }
  }

  if (tableCandidate.length > 0) {
    flushTable(tableCandidate);
  }

  return outputBlocks.join('\n\n');
}

/**
 * Clickra-inspired Layout Classifier & Table Reconstructor
 * Detects two-column paper layouts, restructures reading order (Left -> Right),
 * and reconstructs true tabular data into Markdown tables.
 */
function reconstructTablesAndText(textItems) {
  if (!textItems || textItems.length === 0) return '';

  const yTolerance = 4;
  // 1. Group items into physical horizontal lines
  const sortedItems = [...textItems].sort((a, b) => {
    if (Math.abs(b.y - a.y) > yTolerance) {
      return b.y - a.y;
    }
    return a.x - b.x;
  });

  const lines = [];
  let currentLine = [];
  let currentY = null;

  for (const item of sortedItems) {
    if (currentY === null || Math.abs(item.y - currentY) <= yTolerance) {
      currentLine.push(item);
      currentY = item.y;
    } else {
      if (currentLine.length > 0) {
        currentLine.sort((a, b) => a.x - b.x);
        lines.push(currentLine);
      }
      currentLine = [item];
      currentY = item.y;
    }
  }
  if (currentLine.length > 0) {
    currentLine.sort((a, b) => a.x - b.x);
    lines.push(currentLine);
  }

  // 2. Determine horizontal span & check for two-column paper layout
  let minX = Infinity;
  let maxX = -Infinity;
  for (const line of lines) {
    for (const it of line) {
      if (it.x < minX) minX = it.x;
      const right = it.x + (it.width || 0);
      if (right > maxX) maxX = right;
    }
  }

  const pageWidth = maxX - minX;
  const centerX = minX + pageWidth / 2;

  // Check if page has two-column characteristics
  let leftColCount = 0;
  let rightColCount = 0;
  let fullWidthCount = 0;

  for (const line of lines) {
    const lineMinX = line[0].x;
    const lineMaxX = line[line.length - 1].x + (line[line.length - 1].width || 0);
    const lineCenter = (lineMinX + lineMaxX) / 2;

    if (lineMinX < centerX - 20 && lineMaxX > centerX + 20) {
      fullWidthCount++;
    } else if (lineCenter < centerX) {
      leftColCount++;
    } else {
      rightColCount++;
    }
  }

  const isTwoColumnPage = leftColCount > 4 && rightColCount > 4;

  if (!isTwoColumnPage) {
    // Single column page
    return reconstructColumnTablesAndText(lines);
  }

  // 3. Two-Column Page Partitioning:
  // Identify Top Band (Title / Authors / Abstract), Multi-column Body, and Bottom Band
  const topLines = [];
  const leftLines = [];
  const rightLines = [];
  const bottomLines = [];

  let inBody = false;

  for (const line of lines) {
    const lineMinX = line[0].x;
    const lineMaxX = line[line.length - 1].x + (line[line.length - 1].width || 0);
    const lineCenter = (lineMinX + lineMaxX) / 2;
    const isFullWidth = (lineMinX < centerX - 30 && lineMaxX > centerX + 30);

    if (!inBody) {
      if (isFullWidth || (line.length > 1 && line[0].str.length < 30 && lineCenter > centerX - 50 && lineCenter < centerX + 50)) {
        topLines.push(line);
      } else {
        inBody = true;
      }
    }

    if (inBody) {
      if (isFullWidth && lineMaxX - lineMinX > pageWidth * 0.75) {
        if (leftLines.length > 0 || rightLines.length > 0) {
          bottomLines.push(line);
        } else {
          topLines.push(line);
        }
      } else {
        const leftItems = line.filter(it => it.x + (it.width || 0) / 2 < centerX);
        const rightItems = line.filter(it => it.x + (it.width || 0) / 2 >= centerX);

        if (leftItems.length > 0) leftLines.push(leftItems);
        if (rightItems.length > 0) rightLines.push(rightItems);
      }
    }
  }

  // Format each section in proper reading order
  const parts = [];
  if (topLines.length > 0) {
    const topContent = reconstructColumnTablesAndText(topLines);
    if (topContent) parts.push(topContent);
  }
  if (leftLines.length > 0) {
    const leftContent = reconstructColumnTablesAndText(leftLines);
    if (leftContent) parts.push(leftContent);
  }
  if (rightLines.length > 0) {
    const rightContent = reconstructColumnTablesAndText(rightLines);
    if (rightContent) parts.push(rightContent);
  }
  if (bottomLines.length > 0) {
    const bottomContent = reconstructColumnTablesAndText(bottomLines);
    if (bottomContent) parts.push(bottomContent);
  }

  return parts.join('\n\n');
}

/**
 * Extract embedded images from a PDF page
 */
async function extractPageImages(page, pageNum, outputDir, baseName, options = {}) {
  const { inlineImages = true, saveFiles = false } = options;
  const images = [];
  const ops = await page.getOperatorList();
  const pdfjs = await getPdfjs();
  const OPS = pdfjs.OPS;

  let imgIdx = 1;

  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i];

    if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) {
      const imgName = args[0];
      try {
        let imgObj = null;
        if (page.objs && page.objs.has(imgName)) {
          imgObj = page.objs.get(imgName);
        }

        if (imgObj && imgObj.data && imgObj.width && imgObj.height) {
          const channels = imgObj.data.length / (imgObj.width * imgObj.height);
          const pngBuffer = encodePng(imgObj.width, imgObj.height, imgObj.data, channels >= 4 ? 4 : 3);
          const base64 = pngBuffer.toString('base64');
          const dataUri = `data:image/png;base64,${base64}`;

          let savePath = null;
          const filename = `${baseName}_p${pageNum}_img${imgIdx}.png`;

          if (saveFiles && outputDir) {
            fs.mkdirSync(outputDir, { recursive: true });
            savePath = path.join(outputDir, filename);
            fs.writeFileSync(savePath, pngBuffer);
          }

          images.push({
            page: pageNum,
            filename,
            path: savePath,
            base64,
            dataUri,
            width: imgObj.width,
            height: imgObj.height,
          });
          imgIdx++;
        }
      } catch (err) {
        // Silently skip corrupted image stream
      }
    }
  }

  return images;
}

/**
 * Convert a PDF file to Markdown with table reconstruction and image embedding
 */
async function convertPdfToMarkdown(pdfPath, outputPath, options = {}) {
  const {
    title,
    includePageMarkers = true,
    includeMetadata = true,
    extractImages = true,
    inlineImages = true,
    saveFiles = false,
    detectTables = true,
    imageDir,
    password,
  } = options;

  const pdfjs = await getPdfjs();
  const pdfData = new Uint8Array(fs.readFileSync(pdfPath));
  const baseName = path.basename(pdfPath, path.extname(pdfPath));

  const targetOutputPath = outputPath || pdfPath.replace(/\.[^.]+$/, '.md');
  const targetDir = path.dirname(path.resolve(targetOutputPath));
  fs.mkdirSync(targetDir, { recursive: true });

  const effectiveImageDir = imageDir ? path.resolve(imageDir) : path.join(targetDir, 'images');

  const loadingTask = pdfjs.getDocument({
    data: pdfData,
    useSystemFonts: true,
    disableFontFace: true,
    password: password || undefined,
  });

  let pdfDoc;
  try {
    pdfDoc = await loadingTask.promise;
  } catch (err) {
    if (err && (err.name === 'PasswordException' || String(err).includes('PasswordException') || err.code === 1)) {
      throw new Error(`PDF 檔案受密碼保護，請透過 --password 參數提供開啟密碼 (檔案: ${path.basename(pdfPath)})`);
    }
    throw err;
  }
  const totalPages = pdfDoc.numPages;
  const meta = (await pdfDoc.getMetadata().catch(() => ({}))) || {};
  const info = meta.info || {};

  const docTitle = title || info.Title || baseName;
  const docAuthor = info.Author || '';
  const docCreator = info.Creator || '';

  const mdSections = [];

  // YAML Frontmatter
  if (includeMetadata) {
    let fm = '---\n';
    fm += `title: "${docTitle.replace(/"/g, '\\"')}"\n`;
    if (docAuthor) fm += `author: "${docAuthor.replace(/"/g, '\\"')}"\n`;
    if (docCreator) fm += `creator: "${docCreator.replace(/"/g, '\\"')}"\n`;
    fm += `pages: ${totalPages}\n`;
    fm += `source: "${path.basename(pdfPath)}"\n`;
    fm += '---\n\n';
    mdSections.push(fm);
  }

  mdSections.push(`# ${docTitle}\n\n`);
  if (docAuthor) mdSections.push(`> **作者**：${docAuthor}\n`);
  mdSections.push(`> **總頁數**：${totalPages} 頁\n\n---\n\n`);

  let allExtractedImages = [];

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();

    // Map text items with coordinates
    const items = textContent.items
      .filter(it => it.str && it.str.trim().length > 0)
      .map(it => ({
        str: it.str,
        x: it.transform ? it.transform[4] : 0,
        y: it.transform ? it.transform[5] : 0,
        width: it.width || 0,
        height: it.height || 0,
      }));

    let pageText = '';
    if (detectTables) {
      pageText = reconstructTablesAndText(items);
    } else {
      pageText = items.map(i => i.str).join(' ').trim();
    }

    if (includePageMarkers) {
      mdSections.push(`## Page ${pageNum}\n\n`);
    }

    if (pageText) {
      mdSections.push(`${pageText}\n\n`);
    }

    // Extract & Embed Images
    if (extractImages) {
      const pageImages = await extractPageImages(page, pageNum, effectiveImageDir, baseName, {
        inlineImages: inlineImages !== false,
        saveFiles: saveFiles === true || Boolean(imageDir),
      });

      if (pageImages.length > 0) {
        allExtractedImages = allExtractedImages.concat(pageImages);
        for (const img of pageImages) {
          if (inlineImages !== false) {
            // Direct Base64 inline embedding
            mdSections.push(`![Page ${pageNum} Image](${img.dataUri})\n\n`);
          } else if (img.path) {
            // External file link
            const relPath = path.relative(targetDir, img.path).replace(/\\/g, '/');
            mdSections.push(`![Page ${pageNum} Image](${relPath})\n\n`);
          }
        }
      }
    }

    if (pageNum < totalPages) {
      mdSections.push('---\n\n');
    }
  }

  const finalMarkdown = mdSections.join('').trim() + '\n';
  fs.writeFileSync(targetOutputPath, finalMarkdown, 'utf8');

  return {
    title: docTitle,
    totalPages,
    outputPath: targetOutputPath,
    characterCount: finalMarkdown.length,
    extractedImages: allExtractedImages,
  };
}

module.exports = {
  convertPdfToMarkdown,
  pdf2md: convertPdfToMarkdown,
  reconstructTablesAndText,
  encodePng,
};
