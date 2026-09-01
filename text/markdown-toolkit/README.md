# Markdown Toolkit

A lightweight, dependency-free utility toolkit for Markdown conversions, parsing, code extraction, and formatting.

## Features

- 📖 **TXT to Markdown (`txt2md`)**:
  - Smart paragraph splitting on punctuation while protecting Chinese / English quotes (`「...」`, `"..."`).
  - Automatic chapter and section detection.
  - Generates YAML frontmatter, book metadata, and Table of Contents (TOC).
- 📄 **PDF to Markdown (`pdf2md`)**:
  - Page-by-page text extraction and formatting (`## Page X`).
  - Automatic PDF metadata extraction (title, author, page count) into YAML frontmatter.
  - Supports single file and directory batch conversion.
- 🌐 **HTML to Markdown (`html2md`)**:
  - Strips noisy scripts, styles, and unwanted UI elements.
  - Converts headings, links, bold/italics, code blocks, lists, blockquotes, and images with captions.
- 💻 **Code Block Extractor (`extract-code`)**:
  - Scans Markdown files for fenced code blocks (e.g. ```` ```python:app.py ```` or standard ```` ```js ````).
  - Automatically exports snippets to standalone files with appropriate file extensions.
- 📑 **TOC Generator (`toc`)**:
  - Automatically generates or updates an anchor-linked Table of Contents based on document heading levels.

---

## Installation & Setup

Node.js (16+) with zero npm dependencies. For PDF conversion:

```bash
cd text/markdown-toolkit
pip install -r requirements.txt
```

---

## Usage

### 1. CLI Usage

```bash
# TXT to Markdown
node bin/cli.js txt2md --input=book.txt --output=book.md --title="Book Title" --author="Author"

# PDF to Markdown
node bin/cli.js pdf2md --input=document.pdf --output=document.md

# HTML to Markdown
node bin/cli.js html2md --input=article.html --output=article.md

# Extract Code Blocks
node bin/cli.js extract-code --input=notes.md --output-dir=./extracted_code

# Generate / Update Table of Contents
node bin/cli.js toc --input=document.md
```

### 2. Programmatic Usage (Node.js API)

```javascript
const {
  txt2md,
  html2md,
  cleanHtmlToMarkdown,
  extractCodeBlocks,
  insertOrUpdateToc
} = require('./src/index');

// Convert HTML string directly to Markdown
const markdown = cleanHtmlToMarkdown('<h1>Title</h1><p>Content</p>');

// Convert TXT file
txt2md('book.txt', 'book.md', { title: 'My Book', author: 'Author' });

// Extract code blocks from Markdown
const extracted = extractCodeBlocks('notes.md', './snippets');
```

---

## Running Tests

```bash
npm test
```
