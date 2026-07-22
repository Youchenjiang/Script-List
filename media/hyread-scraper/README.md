# HyRead eBook Text Scraper

A Node.js utility for extracting text content from HyRead eBook platform and converting it to Markdown format.

## Features

- **Cross-origin extraction**: Uses CDP `DOM.getDocument({ depth: -1, pierce: true })` to bypass cross-origin restrictions and extract decrypted text from all iframes.
- **Auto navigation**: Automatically clicks chapter buttons in the TOC panel to extract content chapter by chapter.
- **Smart filtering**: Automatically filters out CSS, JavaScript, UI elements, and other non-book content.
- **Incremental saving**: Automatically saves progress during extraction to prevent data loss on interruption.
- **Debug tools**: Includes comprehensive debugging scripts for troubleshooting.

## Requirements

- [Node.js](https://nodejs.org/) (v16.0.0 or later recommended)
- [Google Chrome](https://www.google.com/chrome/) browser
- Library account (for HyRead login)

## Usage

### 1. Start Chrome with remote debugging

```bash
# Windows
Start-Process "chrome.exe" -ArgumentList "--remote-debugging-port=9222"

# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222

# Linux
google-chrome --remote-debugging-port=9222
```

### 2. Login and open reader

1. Login to your library using the opened Chrome
2. Find the book you want to extract
3. Click "Read" to open the reader

### 3. Run the scraper

```bash
node hyread_scraper.js --port=9222 --output=./output
```

### 4. Use debug tools

```bash
# Test connection
node hyread_debug.js connect

# List all frames
node hyread_debug.js frames

# List TOC buttons
node hyread_debug.js toc

# Extract specific chapter
node hyread_debug.js extract "Chapter 1"
```

## File Description

| File | Description |
|------|-------------|
| `hyread_scraper.js` | Main scraping script |
| `hyread_debug.js` | Debug utility script |
| `txt2md.js` | TXT to Markdown converter |

## Output Format

Extracted content is saved in two formats:

1. **progress.json**: JSON format containing all chapter titles and content.
2. **book.txt**: Plain text format with chapters separated by `========== Chapter Title ==========`.

## TXT to Markdown

Use `txt2md.js` to convert extracted TXT to formatted Markdown:

```bash
node txt2md.js \
  --input=book.txt \
  --output=book.md \
  --title="Book Title" \
  --author="Author" \
  --publisher="Publisher" \
  --isbn="978XXXXXXXX"
```

## Technical Details

1. **CDP Protocol**: Directly controls the browser via Chrome DevTools Protocol.
2. **DOM Penetration**: Uses `DOM.getDocument({ depth: -1, pierce: true })` to bypass iframe cross-origin restrictions.
3. **Frame Inspection**: Finds the frame containing target chapter content among multiple frames.
4. **Content Filtering**: Uses rules to filter out CSS, JavaScript, UI, and other non-book content.

## Notes

- This tool is for personal learning and research purposes only.
- Please comply with library terms of use and copyright regulations.
- Keep the Chrome browser open during the extraction process.

## License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.
