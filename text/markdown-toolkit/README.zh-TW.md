# Markdown Toolkit (Markdown 實用工具箱)

輕量、零外部依賴的 Markdown 綜合處理工具箱，支援格式轉換、網頁清洗、代碼區塊提取與目錄產製。

## 主要功能

- 📖 **純文字轉 Markdown (`txt2md`)**：
  - 智慧斷句與段落排版，**嚴格保護引號（「...」）內的對話不被拆散**。
  - 自動識別章節標題（如 `========== 第一章 ==========`、`第X章`、`Chapter X`）。
  - 自動生成 YAML Frontmatter 元資料、書籍資訊與章節目錄（TOC）。
- 📄 **PDF 轉 Markdown (`pdf2md`)**：
  - 逐頁解析 PDF 內容並格式化為 Markdown 頁面區塊（`## Page X`）。
  - 自動擷取 PDF 詮釋資料（標題、作者、頁數）並生成 Frontmatter。
  - 支援單檔轉換與資料夾批次遞迴處理。
- 🌐 **HTML 轉 Markdown (`html2md`)**：
  - 自動過濾 `script`、`style` 等網頁雜訊。
  - 保留標題、連結、粗體、斜體、代碼區塊、清單、引用區塊與圖片語法（`![alt](src)`）。
- 💻 **Markdown 程式碼區塊提取 (`extract-code`)**：
  - 自動掃描 Markdown 檔案中的代碼區塊（如 <code>```python:app.py</code> 或一般代碼區塊）。
  - 自動依照標記檔名或語言副檔名批次提取為獨立原始碼檔案。
- 📑 **目錄產製與更新 (`toc`)**：
  - 掃描 Markdown 各級標題，自動生成或更新帶有錨點連結的目錄。

---

## 環境需求

* [Node.js](https://nodejs.org/) v16.0.0 以上版本。
* 若需使用 PDF 轉檔功能：需安裝 `pypdf`（`pip install -r requirements.txt`）。

---

## 使用方式

### 1. CLI 命令行模式

```bash
# 1. 純文字轉 Markdown 排版
node bin/cli.js txt2md --input=book.txt --output=book.md --title="書名" --author="作者"

# 2. PDF 轉 Markdown
node bin/cli.js pdf2md --input=document.pdf --output=document.md

# 3. HTML 網頁轉 Markdown
node bin/cli.js html2md --input=article.html --output=article.md

# 4. 提取 Markdown 筆記中的代碼區塊
node bin/cli.js extract-code --input=notes.md --output-dir=./extracted_code

# 5. 生成或更新 Markdown 目錄
node bin/cli.js toc --input=document.md
```

### 2. Node.js 程式庫調用

```javascript
const {
  txt2md,
  html2md,
  cleanHtmlToMarkdown,
  extractCodeBlocks,
  insertOrUpdateToc
} = require('./src/index');

// 直接清洗 HTML 字串為 Markdown
const md = cleanHtmlToMarkdown('<h1>標題</h1><p>內文...</p>');

// 轉換 TXT 檔案
txt2md('book.txt', 'book.md', { title: '書名', author: '作者' });

// 從 Markdown 提取所有程式碼檔案
const result = extractCodeBlocks('notes.md', './output_dir');
```

---

## 執行單元測試

```bash
npm test
```
