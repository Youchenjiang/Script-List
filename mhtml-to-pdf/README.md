# MHTML to PDF Converter

A specialized automation tool to convert MHTML files (typically exported from Google Slides) into high-quality A4 PDF documents with proper layout and background graphics.

## Description

When exporting Google Slides as MHTML (using "Save as Webpage" or similar methods), printing the resulting file often results in:
- Missing background images (Google Slides uses CSS backgrounds for slide content).
- Incorrect page breaks (multiple slides overlapping or clipped).
- Alignment issues on A4 paper.

This script uses **Playwright** to automate a headless Chromium browser, injects corrective CSS, and ensures every slide is perfectly centered on its own A4 page.

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

Simply run the script and provide the path to your `.mhtml` file:

```bash
python mhtml2pdf.py "path/to/your/presentation.mhtml"
```

### Options

- `--output`, `-o`: Specify a custom output path for the PDF. Defaults to the same name as the input file.

```bash
python mhtml2pdf.py input.mhtml -o output_presentation.pdf
```

## How it Works

The script performs the following steps:
1. Launches a headless Chromium browser.
2. Loads the MHTML file as a local file URI.
3. Injects a custom `@media print` CSS block that:
   - Sets the page size to `A4 landscape`.
   - Forces `.slide` elements to have `break-after: page`.
   - Centers content and ensures background graphics are enabled.
4. Uses the browser's native print-to-PDF engine to generate the document.
