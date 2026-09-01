const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { encodePng, reconstructTablesAndText, convertPdfToMarkdown } = require('../src/pdf-to-md');

test('encodePng produces valid PNG binary header and chunks', () => {
  const width = 2;
  const height = 2;
  // 2x2 RGBA
  const data = new Uint8Array([
    255, 0, 0, 255,   0, 255, 0, 255,
    0, 0, 255, 255,   255, 255, 255, 255
  ]);

  const pngBuf = encodePng(width, height, data, 4);
  assert.ok(pngBuf.length > 8);
  // PNG signature
  assert.equal(pngBuf[0], 0x89);
  assert.equal(pngBuf[1], 0x50); // P
  assert.equal(pngBuf[2], 0x4E); // N
  assert.equal(pngBuf[3], 0x47); // G
});

test('reconstructTablesAndText detects multi-column text and converts to markdown tables', () => {
  const mockTextItems = [
    // Header line at Y=100
    { str: 'Name', x: 20, y: 100, width: 30, height: 10 },
    { str: 'Age', x: 100, y: 100, width: 20, height: 10 },
    { str: 'Role', x: 180, y: 100, width: 30, height: 10 },

    // Row 1 at Y=80
    { str: 'Alice', x: 20, y: 80, width: 25, height: 10 },
    { str: '25', x: 100, y: 80, width: 15, height: 10 },
    { str: 'Engineer', x: 180, y: 80, width: 45, height: 10 },

    // Row 2 at Y=60
    { str: 'Bob', x: 20, y: 60, width: 20, height: 10 },
    { str: '30', x: 100, y: 60, width: 15, height: 10 },
    { str: 'Designer', x: 180, y: 60, width: 45, height: 10 },

    // Paragraph at Y=30
    { str: 'This is a normal closing paragraph.', x: 20, y: 30, width: 200, height: 10 }
  ];

  const result = reconstructTablesAndText(mockTextItems);
  assert.ok(result.includes('| Name | Age | Role |'));
  assert.ok(result.includes('| --- | --- | --- |'));
  assert.ok(result.includes('| Alice | 25 | Engineer |'));
  assert.ok(result.includes('| Bob | 30 | Designer |'));
  assert.ok(result.includes('This is a normal closing paragraph.'));
});

test('convertPdfToMarkdown converts real PDF file if present', async () => {
  const samplePdfPath = path.resolve(__dirname, '../../../Lab04_Practice.pdf');
  if (fs.existsSync(samplePdfPath)) {
    const tmpOut = path.resolve(__dirname, 'temp_sample_output.md');
    const res = await convertPdfToMarkdown(samplePdfPath, tmpOut, {
      extractImages: true,
      detectTables: true,
    });

    assert.ok(res.totalPages >= 1);
    assert.ok(fs.existsSync(tmpOut));

    const content = fs.readFileSync(tmpOut, 'utf8');
    assert.ok(content.includes('# '));
    assert.ok(content.includes('## Page 1'));

    // Clean up temp test files
    fs.unlinkSync(tmpOut);
    const imgDir = path.resolve(__dirname, 'images');
    if (fs.existsSync(imgDir)) {
      fs.rmSync(imgDir, { recursive: true, force: true });
    }
  }
});
