# PDF to Markdown Converter

A lightweight Python command-line utility to extract text and metadata from PDF files into structured Markdown.

[繁體中文版](README.zh-TW.md)

---

## Installation

```bash
pip install pypdf
```

---

## Usage

```bash
# Convert a PDF document (outputs document.md by default)
python pdf_to_markdown.py document.pdf

# Specify custom output path
python pdf_to_markdown.py document.pdf -o output_notes.md

# Omit page number subheadings
python pdf_to_markdown.py document.pdf --no-pages
```

---

## License

MIT License
