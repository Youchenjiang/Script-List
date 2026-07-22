# HyRead 電子書文字抓取工具

一個基於 Node.js 的實用工具，用於從 HyRead 電子書平台抓取書籍文字內容，並轉換為 Markdown 格式。

## 功能特點

- **跨域抓取**：使用 CDP `DOM.getDocument({ depth: -1, pierce: true })` 繞過跨域限制，穿透所有 iframe 抓取解密後的文字。
- **自動導航**：從 TOC 目錄面板自動點擊章節按鈕，逐章抓取內容。
- **智慧過濾**：自動過濾掉 CSS、JavaScript、UI 元素等非書本內容。
- **增量存檔**：抓取過程中自動儲存進度，避免中斷後遺失資料。
- **除錯工具**：提供完整的除錯腳本，方便問題排查。

## 環境需求

- [Node.js](https://nodejs.org/) (建議 v16.0.0 以上版本)
- [Google Chrome](https://www.google.com/chrome/) 瀏覽器
- 圖書館帳號（用於登入 HyRead）

## 使用方法

### 1. 啟動 Chrome 遠端除錯模式

```bash
# Windows
Start-Process "chrome.exe" -ArgumentList "--remote-debugging-port=9222"

# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222

# Linux
google-chrome --remote-debugging-port=9222
```

### 2. 登入並打開閱讀器

1. 用開啟的 Chrome 登入圖書館
2. 找到要抓取的書籍
3. 點擊「閱讀」打開閱讀器

### 3. 執行抓取腳本

```bash
node hyread_scraper.js --port=9222 --output=./output
```

### 4. 使用除錯工具

```bash
# 測試連線
node hyread_debug.js connect

# 列出所有 frames
node hyread_debug.js frames

# 列出 TOC 按鈕
node hyread_debug.js toc

# 提取指定章節
node hyread_debug.js extract "第一章"
```

## 檔案說明

| 檔案 | 說明 |
|------|------|
| `hyread_scraper.js` | 主要抓取腳本 |
| `hyread_debug.js` | 除錯工具腳本 |
| `txt2md.js` | TXT 轉 Markdown 工具 |

## 輸出格式

抓取的內容會以兩種格式儲存：

1. **progress.json**：JSON 格式，包含所有章節的標題和內容。
2. **book.txt**：純文字格式，以 `========== 章節標題 ==========` 分隔各章節。

## TXT 轉 Markdown

使用 `txt2md.js` 將抓取的 TXT 轉換為格式化的 Markdown：

```bash
node txt2md.js \
  --input=book.txt \
  --output=book.md \
  --title="書名" \
  --author="作者" \
  --publisher="出版社" \
  --isbn="978XXXXXXXX"
```

## 技術原理

1. **CDP 協議**：透過 Chrome DevTools Protocol 直接操作瀏覽器。
2. **DOM 穿透**：使用 `DOM.getDocument({ depth: -1, pierce: true })` 繞過 iframe 跨域限制。
3. **Frame 檢索**：從多個 frame 中找到含有目標章節內容的 frame。
4. **內容過濾**：使用規則過濾掉 CSS、JavaScript、UI 等非書本內容。

## 注意事項

- 此工具僅供個人學習與研究使用。
- 請遵守圖書館的使用條款與著作權法規。
- 抓取過程中請保持 Chrome 瀏覽器開啟。

## 授權條款

本專案採用 MIT 授權條款 - 詳見 [LICENSE](../../LICENSE) 檔案。
