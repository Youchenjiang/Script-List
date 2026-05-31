# CYBERSEC 2026 Slide Downloader

A Node.js script to dynamically scrape and batch-download all presentation slides and files from the CYBERSEC 2026 conference.

## Features

- **GraphQL Integration**: Fetches session details directly from the conference backend API (`https://ccmsapi.ithome.com.tw`).
- **Filename Sanitization**: Sanitizes session titles for Windows OS file name constraints.
- **Concurrency Control**: Downloads up to 5 files concurrently to ensure fast and reliable execution without hitting server limits.
- **Retry Logic**: Automatically retries downloads on network timeout or transient HTTP errors.
- **Download Report**: Outputs a JSON summary (`download_report.json`) of all successful and failed downloads.

## Prerequisites

- [Node.js](https://nodejs.org/) (v16.0.0 or higher recommended)

## Usage

1. Open a terminal in this directory.
2. Run the script:
   ```bash
   node download_slides.js
   ```
3. The downloaded PDFs will be saved under the `downloads/` directory.

## License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.
