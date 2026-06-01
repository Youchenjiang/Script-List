# Hacker News Scraper

A Node.js utility script to dynamically crawl `thehackernews.com`, follow pagination, filter articles from the last 3 weeks, and save their full text as Markdown documents.

## Features

- **Automatic Pagination**: Dynamically follows the Blogger "Older Posts" links to fetch past articles.
- **Date Filtering**: Automatically stops crawling when encountering posts older than the configured limit (default: 3 weeks).
- **Clean Content Extraction**: Extracts clean main article body from `#articlebody` and converts HTML elements into Markdown formats (headings, paragraphs, line breaks).
- **Polite Crawling**: Built-in delay (default: 800ms) between page fetches to protect servers and avoid IP bans.
- **Zero Dependencies**: Powered entirely by Node.js native modules (`https`, `fs`, `path`).

## Prerequisites

- [Node.js](https://nodejs.org/) (v16.0.0 or higher recommended)

## Usage

1. Open a terminal in this directory.
2. Run the script:
   ```bash
   node hacker_news_scraper.js
   ```
3. The downloaded Markdown files will be saved in the `news_output/` directory, named in the format: `YYYY-MM-DD - Sanitized_Title.md`.

## License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.
