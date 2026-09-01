/**
 * Markdown Toolkit - Unified Module Exports
 */

const txtToMd = require('./txt-to-md');
const pdfToMd = require('./pdf-to-md');
const htmlToMd = require('./html-to-md');
const extractCode = require('./extract-code');
const tocGenerator = require('./toc-generator');

module.exports = {
  // TXT -> MD
  txt2md: txtToMd.txt2md,
  convertTxtToMarkdown: txtToMd.convertTxtToMarkdown,
  splitLongParagraphs: txtToMd.splitLongParagraphs,
  parseSections: txtToMd.parseSections,

  // PDF -> MD
  pdf2md: pdfToMd.pdf2md,
  convertPdfToMarkdown: pdfToMd.convertPdfToMarkdown,
  reconstructTablesAndText: pdfToMd.reconstructTablesAndText,
  encodePng: pdfToMd.encodePng,

  // HTML -> MD
  html2md: htmlToMd.html2md,
  cleanHtmlToMarkdown: htmlToMd.cleanHtmlToMarkdown,
  decodeHtmlEntities: htmlToMd.decodeHtmlEntities,

  // Code extraction
  extractCodeBlocks: extractCode.extractCodeBlocks,
  parseCodeBlocks: extractCode.parseCodeBlocks,

  // TOC
  extractHeadings: tocGenerator.extractHeadings,
  buildToc: tocGenerator.buildToc,
  insertOrUpdateToc: tocGenerator.insertOrUpdateToc,
  slugify: tocGenerator.slugify,
};
