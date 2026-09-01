# PDF 轉 Markdown 文字萃取工具 (PDF to Markdown)

輕量化的 Python 命令列小工具，可自動解析 PDF 檔案並將頁面內文與 Metadata 轉換為結構化的 Markdown 文件。

[English Version](README.md)

---

## 安裝需求

```bash
pip install pypdf
```

---

## 使用方式

```bash
# 轉換 PDF 文件（預設自動儲存為 document.md）
python pdf_to_markdown.py document.pdf

# 自訂輸出路徑
python pdf_to_markdown.py document.pdf -o output_notes.md

# 忽略頁碼標題 (## Page N)
python pdf_to_markdown.py document.pdf --no-pages
```

---

## 授權條款

MIT License
