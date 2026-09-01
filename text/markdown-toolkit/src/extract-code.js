/**
 * Extract Code Blocks from Markdown Module
 * 
 * Parses markdown documents for fenced code blocks (```lang:path ... ```)
 * and extracts them into separate files or collects them in memory.
 */

const fs = require('fs');
const path = require('path');

/**
 * Parses markdown content and finds all fenced code blocks
 */
function parseCodeBlocks(markdownContent) {
  const blocks = [];
  const lines = markdownContent.split('\n');

  let inBlock = false;
  let currentLang = '';
  let currentFilename = '';
  let currentCode = [];
  let blockStartLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^```(\w+)?(?::([^\s]+))?\s*$/);

    if (match && !inBlock) {
      inBlock = true;
      currentLang = match[1] || '';
      currentFilename = match[2] || '';
      currentCode = [];
      blockStartLine = i + 1;
    } else if (line.trim() === '```' && inBlock) {
      inBlock = false;
      blocks.push({
        language: currentLang,
        filename: currentFilename,
        code: currentCode.join('\n'),
        startLine: blockStartLine,
        endLine: i + 1,
      });
      currentLang = '';
      currentFilename = '';
      currentCode = [];
    } else if (inBlock) {
      currentCode.push(line);
    }
  }

  return blocks;
}

/**
 * Extract code blocks to target directory
 */
function extractCodeBlocks(markdownPath, outputDir, options = {}) {
  const content = fs.readFileSync(markdownPath, 'utf8');
  const blocks = parseCodeBlocks(content);
  const results = [];

  const baseDir = outputDir || path.dirname(markdownPath);
  fs.mkdirSync(baseDir, { recursive: true });

  const extMap = {
    javascript: 'js',
    js: 'js',
    typescript: 'ts',
    ts: 'ts',
    python: 'py',
    py: 'py',
    sh: 'sh',
    bash: 'sh',
    powershell: 'ps1',
    ps1: 'ps1',
    json: 'json',
    yaml: 'yaml',
    yml: 'yml',
    html: 'html',
    css: 'css',
    c: 'c',
    cpp: 'cpp',
    csharp: 'cs',
    cs: 'cs',
    go: 'go',
    rust: 'rs',
    rs: 'rs',
    sql: 'sql',
  };

  const filePrefix = path.basename(markdownPath, path.extname(markdownPath));

  blocks.forEach((block, index) => {
    let targetFileName = block.filename;
    if (!targetFileName) {
      const ext = extMap[block.language.toLowerCase()] || (block.language ? block.language.toLowerCase() : 'txt');
      targetFileName = `${filePrefix}_snippet_${index + 1}.${ext}`;
    }

    const targetFilePath = path.join(baseDir, targetFileName);
    if (!options.dryRun) {
      fs.mkdirSync(path.dirname(targetFilePath), { recursive: true });
      fs.writeFileSync(targetFilePath, block.code + '\n', 'utf8');
    }

    results.push({
      ...block,
      savedPath: targetFilePath,
      fileName: targetFileName,
    });
  });

  return {
    sourceFile: markdownPath,
    extractedCount: results.length,
    outputDirectory: baseDir,
    blocks: results,
  };
}

module.exports = {
  parseCodeBlocks,
  extractCodeBlocks,
};
