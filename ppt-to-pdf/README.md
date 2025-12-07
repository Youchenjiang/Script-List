# PPT to PDF Converter

A Python script to batch convert PowerPoint presentations (`.ppt`, `.pptx`) to PDF format.

## Features

- **Batch Processing**: Converts all PowerPoint files in a directory or single files.
- **Smart Skipping**:
  - Skips temporary files (starting with `~$`).
  - Skips files that have already been converted (PDF exists).
- **Interactive**: Displays the count of files to be converted and waits for user confirmation.
- **Clean Output**: Summarizes skipped files to keep the log readable.

## Usage

### Dependencies

Requires Microsoft PowerPoint to be installed.

```bash
pip install -r requirements.txt
```

### Running the Script

```bash
python ppt2pdf.py <path_to_file_or_directory>
```

Example:

```bash
python ppt2pdf.py "C:\My Presentations"
```
