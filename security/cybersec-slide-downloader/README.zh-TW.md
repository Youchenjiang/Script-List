# CYBERSEC 2026 簡報下載器

一個結合 Node.js 與 Python 的工具，用於動態爬取、批次下載並自動分類 CYBERSEC 2026 臺灣資安大會的所有簡報與附加檔案。

## 功能特點

- **GraphQL 整合**：直接向大會後端 API (`https://ccmsapi.ithome.com.tw`) 查詢完整的議程資料。
- **漸進式下載**：會掃描所有子資料夾，若簡報已被分類歸檔，則自動跳過下載，避免重複抓取已有的簡報。
- **檔名自動淨化**：移除 Windows 檔案系統不支援的特殊字元，自動生成合法且清晰的檔名。
- **併發控制與自動重試**：限制同時下載數量為 5 個，遇到網路逾時或暫時性 HTTP 錯誤時自動重試下載。
- **自動觸發分類**：下載任何新簡報後，自動執行 Python 分類腳本。
- **PDF 內容智慧分類**：使用 Python (`pypdf`) 讀取並分析 PDF 投影片內文，依據關鍵詞及大會單元分類自動將簡報移至 7 個類別目錄。
- **大綱與關鍵詞提取**：過濾掉母片中重複的頁首與頁尾，提取投影片前 5 頁的標題大綱以及前 6 個核心關鍵詞。
- **簡報檢索目錄**：自動更新 [slides_index.md](slides_index.md) 索引檔，包含講師與公司、單元分類、核心關鍵詞、投影片大綱，並提供本地簡報檔案的相對路徑連結。

## 環境需求

- [Node.js](https://nodejs.org/) (建議 v16.0.0 以上版本)
- [uv](https://github.com/astral-sh/uv) (Python 套件管理工具，用於執行分類器)

## 使用方法

1. 在此目錄下開啟終端機。
2. 執行下載腳本：
   ```bash
   node download_slides.js
   ```
   此腳本將自動下載新簡報，接著呼叫 Python 分類器將新簡報歸檔並更新目錄索引。
3. (可選) 手動執行分類與重新索引：
   ```bash
   uv run --with pypdf classify_slides.py
   ```
4. 開啟 [slides_index.md](slides_index.md)，透過關鍵字或講師搜尋簡報，點擊相對路徑連結即可直接開啟 PDF 閱讀。

## 分類資料夾結構

所有下載的簡報都將被整理歸類於 `downloads/` 底下的子資料夾：
- `01_AI_LLM/` — 人工智慧與大型語言模型 (AI & Large Language Models)
- `02_Zero_Trust_Identity/` — 零信任與身分安全 (Zero Trust & Identity Security)
- `03_OT_IoT_Hardware/` — 工控、物聯網與硬體安全 (OT, IoT & Hardware Security)
- `04_CRA_Compliance/` — CRA 合規、資安稽核與治理法規 (CRA, Compliance & GRC Regulations)
- `05_Red_Blue_Attacks/` — 紅藍軍攻防與威脅獵捕 (Red/Blue Team Attack & Penetration)
- `06_Cloud_Network/` — 雲端與網路安全 SASE (Cloud & Network Security SASE)
- `07_Others/` — 綜合大會演講與其他簡報 (General Presentations & Opening Remarks)

## 授權條款

本專案採用 MIT 授權條款 - 詳見 [LICENSE](../../LICENSE) 檔案。
