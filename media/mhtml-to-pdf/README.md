# MHTML to PDF Converter

A specialized automation tool to convert MHTML files (typically exported from Google Slides) into high-quality PDF documents with proper layout and background graphics.

## Description

When exporting Google Slides as MHTML (using "Save as Webpage" or similar methods), printing the resulting file often results in:
- Missing background images (Google Slides uses CSS backgrounds for slide content).
- Incorrect page breaks (multiple slides overlapping or clipped).
- Excessive whitespace and misaligned content.

This script uses **Playwright** to automate a headless Chromium browser, injects corrective CSS, and ensures every slide is exported with zero whitespace in its native 16:9 aspect ratio (or optionally scaled to A4 landscape).

## Prerequisites

- Python 3.8+
- [Playwright](https://playwright.dev/python/)

## Installation

1. Install the required Python packages:
   ```bash
   pip install -r requirements.txt
   ```

2. Install the Chromium browser engine:
   ```bash
   playwright install chromium
   ```

## Usage

### GUI Mode (Recommended)

Simply run the script without any arguments — a file selection dialog will appear:

```bash
python mhtml2pdf.py
```

### CLI Mode

Provide the path to your `.mhtml` file directly:

```bash
python mhtml2pdf.py "path/to/your/presentation.mhtml"
```

### Options

| Option | Description |
|---|---|
| `--output`, `-o` | Custom output path for the PDF. Defaults to the same name as the input file. |
| `--paper`, `-p` | Paper format: `16:9` (default, zero whitespace) or `A4` (landscape, for printing). |

```bash
# Export as 16:9 full-bleed (default)
python mhtml2pdf.py input.mhtml

# Export as A4 landscape for printing
python mhtml2pdf.py input.mhtml --paper a4

# Custom output path
python mhtml2pdf.py input.mhtml -o output.pdf
```

## How it Works

The script performs the following steps:
1. Launches a headless Chromium browser in **offline mode**.
2. Loads the MHTML file as a local file URI.
3. Injects a custom `@media print` CSS block that:
   - Forces `.slide` elements to have fixed 960×540 dimensions with `break-after: page`.
   - Centers content and ensures background graphics are enabled via `print-color-adjust: exact`.
4. Uses the browser's native print-to-PDF engine to generate the document:
   - **16:9 mode**: Sets page size to exactly 960×540px for zero-whitespace output.
   - **A4 mode**: Uses A4 landscape with a 1.168× scale factor to fill the page width.
