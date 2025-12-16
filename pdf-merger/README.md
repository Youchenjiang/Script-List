# PDF Merger

A simple Python script to merge multiple PDF files into a single PDF document.

## Prerequisites

- Python 3.x
- `pypdf` library

## Installation

```bash
pip install -r requirements.txt
```

## Usage

```bash
python merge_pdf.py [options] <input_files_or_directories>
```

### Arguments

- `inputs`: One or more PDF files or directories containing PDF files.
- `-o OUTPUT`, `--output OUTPUT`: Specify the output filename (default: `merged.pdf`).

### Examples

**Merge two specific files:**

```bash
python merge_pdf.py file1.pdf file2.pdf
```

**Merge all PDFs in a directory:**

```bash
python merge_pdf.py ./my_pdfs/
```

**Merge files and a directory, and save to a custom name:**

```bash
python merge_pdf.py cover.pdf ./chapters/ -o final_report.pdf
```
