# CYBERSEC 2026 Slide Downloader

A Node.js and Python toolset to dynamically scrape, batch-download, and automatically classify all presentation slides and files from the CYBERSEC 2026 conference.

## Features

- **GraphQL Integration**: Fetches session details directly from the conference backend API (`https://ccmsapi.ithome.com.tw`).
- **Incremental Downloader**: Scans subfolders to skip downloading files that are already sorted.
- **Filename Sanitization**: Sanitizes session titles for Windows OS filename constraints.
- **Concurrency Control & Retry Logic**: Downloads up to 5 files concurrently with retry fallback on transient HTTP errors.
- **Auto-run Classification**: Automatically triggers the PDF classifier after downloading new slides.
- **Advanced PDF Classification & Sorting**: Automatically parses PDF slide content using Python (`pypdf`) and categories them into 7 organized subdirectories based on keyword matching and API track metadata.
- **Outline & Keyword Extraction**: Extracts the top 5 page headings and 6 keywords from each PDF using a frequency-based running header filter to remove repetitive master-slide headers.
- **Searchable Markdown Index**: Generates a unified [downloads/slides_index.md](downloads/slides_index.md) file containing speaker names, company details, relative local file links, outlines, and keywords.

## Prerequisites

- [Node.js](https://nodejs.org/) (v16.0.0 or higher recommended)
- [uv](https://github.com/astral-sh/uv) (Python package manager, required for running the classifier)

## Usage

1. Open a terminal in this directory.
2. Run the downloader:
   ```bash
   node download_slides.js
   ```
   This will download any new slides, automatically run the Python classifier, and update the index.
3. (Optional) Rerun the classifier manually at any time:
   ```bash
   uv run --with pypdf classify_slides.py
   ```
4. Open [downloads/slides_index.md](downloads/slides_index.md) to search across all sessions and click the local file links to open the PDFs.

## Categorized Folder Layout

All downloaded slides are sorted into the following subfolders under `downloads/`:
- `01_AI_LLM/` — AI & Large Language Models
- `02_Zero_Trust_Identity/` — Zero Trust & Identity Security
- `03_OT_IoT_Hardware/` — OT, IoT & Hardware Security
- `04_CRA_Compliance/` — CRA, Compliance & GRC Regulations
- `05_Red_Blue_Attacks/` — Red/Blue Team Attack & Penetration
- `06_Cloud_Network/` — Cloud & Network Security SASE
- `07_Others/` — General Presentations & Opening Remarks

## License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.
