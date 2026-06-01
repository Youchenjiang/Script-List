# Hacker News 新聞爬取器

一個基於 Node.js 的實用腳本，用於自動爬取 `thehackernews.com`，跟隨分頁鏈接，篩選並下載最近三週內的所有新聞報導，並儲存為乾淨的 Markdown 格式文檔。

## 功能特點

- **自動翻頁機制**：自動抓取並跟隨網頁底部的 Blogger "Older Posts" 連結，實現歷史分頁連續抓取。
- **日期智能過濾**：設定爬取時間邊界，一旦遇到早於指定時間（預設為 3 週前）的文章即自動停止翻頁。
- **精準內文提取**：精準定位 `#articlebody` 元素以提取文章主體，剔除廣告與側邊欄，並將 HTML 自動清理與轉換成標準 Markdown（標題、段落、換行）。
- **友善爬取延遲**：每次請求之間設有安全延遲時間（預設為 800 毫秒），保護大會主機，避免 IP 被暫時封鎖。
- **無外部依賴**：完全採用 Node.js 原生模組（`https`、`fs`、`path`），無須執行任何 `npm install` 即可直接執行。

## 環境需求

- [Node.js](https://nodejs.org/) (建議 v16.0.0 以上版本)

## 使用方法

1. 在此目錄下開啟終端機。
2. 執行腳本：
   ```bash
   node hacker_news_scraper.js
   ```
3. 下載的新聞將以 `YYYY-MM-DD - Sanitized_Title.md` 的檔名格式存放在 `news_output/` 目錄中。

## 授權條款

本專案採用 MIT 授權條款 - 詳見 [LICENSE](../../LICENSE) 檔案。
