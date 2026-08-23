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

## Files and Components
 
| File / Directory | Description |
|---|---|
| `hacker_news_scraper.js` | Main scraper script with automatic pagination |
| `scrape_article.js` | Single article fetching utility |
| `translate_news.js` | Article content translation utility to Traditional Chinese |
| `create_digest.js` | Consolidates article directory into a single Markdown digest |
| `score_news.js` | Four-dimensional weighted scoring (Breadth, Novelty, Exploitability, Severity) & ranking |

## Usage

### 1. Scrape Recent Articles
```bash
node hacker_news_scraper.js
```
The downloaded Markdown files will be saved in `news_output/` named as `YYYY-MM-DD - Sanitized_Title.md`.

### 2. Generate Consolidated Digest
```bash
node create_digest.js news_output/ digest.md
```

### 3. Calculate Scores & Ranking
```bash
node score_news.js
```

## License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.
