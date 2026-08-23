# Script List - 實用 Python 與 Shell 腳本工具集

[Read English Version](README.md)

[![GitHub](https://img.shields.io/badge/GitHub-Script--List-blue)](https://github.com/Youchenjiang/Script-List)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://www.python.org/downloads/)

> 精選實用的 Python 與 Shell 腳本工具集,用於日常任務自動化。本專案是 [Method-List](https://github.com/Youchenjiang/Method-List) 的姊妹專案,提供可直接使用的工具來補充知識庫。

## 專案簡介

Script List 是一個精選的實用腳本與自動化工具集。作為 Method-List 的姊妹專案:

- **[Method-List](https://github.com/Youchenjiang/Method-List)**: 📚 技術知識庫(文檔)
- **Script-List**: 🛠️ 實用腳本工具(可執行程式)

**Method-List 教你「怎麼做」,Script-List 提供「直接用的工具」。**

## 目錄

- [Script List - 實用 Python 與 Shell 腳本工具集](#script-list---實用-python-與-shell-腳本工具集)
  - [專案簡介](#專案簡介)
  - [目錄](#目錄)
  - [資料夾結構](#資料夾結構)
  - [🚀 快速開始](#-快速開始)
    - [環境需求](#環境需求)
    - [安裝步驟](#安裝步驟)
  - [使用指南](#使用指南)
  - [🤝 參與貢獻](#-參與貢獻)
  - [📜 授權條款](#-授權條款)
  - [🔗 相關專案](#-相關專案)
  - [👤 作者](#-作者)
  - [⭐ 支持專案](#-支持專案)

## 資料夾結構

```
Script-List/
├── README.md
├── README.zh-TW.md
├── LICENSE
├── .gitignore
├── ai/                         # 人工智慧與 LLM 相關工具
│   ├── openai-chat-cli/        # OpenAI 對話工具，支援自訂人設
│   └── A2-Reproduction/        # A2: Agentic Android Analysis 漏洞分析復現
├── automation/                 # 工作流與 GUI 自動化
│   ├── code-split/             # 程式碼分割打包工具
│   ├── discord-news-bot/       # Discord 定時新聞推送機器人
│   ├── tapster/                # 輕量化輸入自動化工具 (打字、長按、連點)
│   └── sync-github-stars/      # GitHub 收藏清單自動歸類與同步工具
├── data/                       # 資料驗證與提取
│   ├── homework-submission-analyzer/ # 學生作業繳交狀態自動統計工具
│   └── image-text-verifier/    # 問卷影像辨識與 CSV 校對修正工具
├── media/                      # 圖片、PDF 與文件處理
│   ├── hyread-scraper/         # HyRead 電子書文字抓取與轉檔工具
│   ├── image-downloader-pdf/   # 圖片下載與 PDF 轉換工具
│   ├── image-to-pdf/           # 圖片轉 PDF 工具
│   ├── mhtml-to-pdf/           # MHTML 轉 PDF 工具 (Google 簡報)
│   ├── pdf-merger/             # PDF 合併工具
│   ├── photo-splitter/         # 學生照片自動分割工具
│   └── ppt-to-pdf/             # PPT 轉 PDF 工具
├── security/                   # 安全性與分析工具
│   ├── password-security-checker/ # 密碼外洩與強度檢查工具
│   ├── frida-apk-tool/         # Android APK 修補與 Frida Hook 工具組
│   ├── cybersec-slide-downloader/ # CYBERSEC 2026 簡報下載器
│   ├── hacker-news-scraper/    # Hacker News 新聞爬取器
│   └── local-https-cert-helper/ # 本地 HTTPS 自簽憑證測試與生成助手
└── text/                       # 文字轉換與編碼
    ├── text-converter-zh/      # 中文簡繁轉換工具
    ├── base64-converter/       # Base64 編解碼工具
    └── hex-to-ascii/           # Hex 轉 ASCII 轉換工具
```

## 🛠️ 可用工具

實用腳本工具（依功能分類）：

### 🤖 AI & LLM 相關
- **OpenAI Chat CLI** ([ai/openai-chat-cli/](ai/openai-chat-cli/)) - OpenAI 對話 API 的命令列介面，支援自訂對話風格。功能包括諸葛亮人設、多語言支援與對話歷史管理。 → [詳細說明](ai/openai-chat-cli/README.md)
- **A2: Agentic Android Analysis** ([ai/A2-Reproduction/](ai/A2-Reproduction/)) - Android 漏洞自動化發現與驗證系統，基於多代理人架構的復現專案。 → [詳細說明](ai/A2-Reproduction/README.md)

### ⚙️ 自動化工具
- **程式碼分割打包工具** ([automation/code-split/](automation/code-split/)) - 將大型專案程式碼自動過濾、分割並打包為多個小文本，方便分批提交給 AI 模型進行對話與分析。 → [詳細說明](automation/code-split/README.zh-TW.md)
- **Discord 新聞推送機器人** ([automation/discord-news-bot/](automation/discord-news-bot/)) - 定時抓取 The Hacker News 並將未推送過的文章送到指定 Discord 頻道，支援持久化去重、排程設定、Embed 與 slash commands。 → [詳細說明](automation/discord-news-bot/README.md)
- **Tapster (輸入自動化工具)** ([automation/tapster/](automation/tapster/)) - 輕量化輸入自動化工具，支援自動打字、按鍵長按、滑鼠連點與錄製重播，提供 GUI 與 CLI。 → [詳細說明](automation/tapster/README.zh-TW.md)
- **GitHub 收藏清單同步工具** ([automation/sync-github-stars/](automation/sync-github-stars/)) - 根據 Markdown 的分類標題，自動將專案收藏並分類至 GitHub 星標收藏清單（Star Lists）中。 → [詳細說明](automation/sync-github-stars/README.zh-TW.md)

### 📊 資料驗證與提取
- **學生作業狀態統計工具** ([data/homework-submission-analyzer/](data/homework-submission-analyzer/)) - 專為 eeclass 作業包設計，能自動解析 PDF 證書、比對姓名並輸出 CSV 統計報表的 Node.js 腳本。 → [詳細說明](data/homework-submission-analyzer/README.zh-TW.md)
- **問卷影像辨識與校對工具** ([data/image-text-verifier/](data/image-text-verifier/)) - 用於將實體問卷掃描圖自動辨識，並與現有 CSV 資料自動比對、偵測風險與修正的工具。 → [詳細說明](data/image-text-verifier/README.zh-TW.md)

### 📁 媒體與文件處理
- **HyRead 電子書文字抓取工具** ([media/hyread-scraper/](media/hyread-scraper/)) - 透過 Chrome DevTools Protocol 穿透 iframe 抓取 HyRead 圖書館電子書文字，並提供 TXT 轉 Markdown 工具。 → [詳細說明](media/hyread-scraper/README.zh-TW.md)
- **Image Downloader & PDF Converter** ([media/image-downloader-pdf/](media/image-downloader-pdf/)) - 批次下載網路圖片並自動合併為 PDF 文件。支援自動偵測與智能排序功能。 → [詳細說明](media/image-downloader-pdf/README.md)
- **MHTML 轉 PDF 轉檔工具** ([media/mhtml-to-pdf/](media/mhtml-to-pdf/)) - 將 Google 簡報匯出的 MHTML 檔案轉換為零留白 16:9 PDF。支援 GUI 選擇器與離線模式。 → [詳細說明](media/mhtml-to-pdf/README.md)
- **PDF 合併工具** ([media/pdf-merger/](media/pdf-merger/)) - 將多個 PDF 檔案按自定義順序合併為單一文件的簡單工具。 → [詳細說明](media/pdf-merger/README.md)
- **圖片轉 PDF 工具** ([media/image-to-pdf/](media/image-to-pdf/)) - 將指定目錄中的所有圖片自動合併為一個 PDF 文件。 → [詳細說明](media/image-to-pdf/README.md)
- **PPT 轉 PDF 工具** ([media/ppt-to-pdf/](media/ppt-to-pdf/)) - 批次將 PowerPoint 簡報 (.pptx) 轉換為 PDF 格式。 → [詳細說明](media/ppt-to-pdf/README.md)
- **學生照片分割工具** ([media/photo-splitter/](media/photo-splitter/)) - 使用人臉偵測技術與名單映射，從團體照中自動提取個人肖像。 → [詳細說明](media/photo-splitter/README.md)

### 🛡️ 安全性工具
- **密碼安全檢查工具** ([security/password-security-checker/](security/password-security-checker/)) - 使用 HIBP API 檢查密碼是否在資料外洩事件中曝光，並提供破解時間估算。 → [詳細說明](security/password-security-checker/README.md)
- **Frida APK 修補工具** ([security/frida-apk-tool/](security/frida-apk-tool/)) - 用於為 Android APK 注入 Frida Hook 進行動態分析與測試的工具組。 → [詳細說明](security/frida-apk-tool/README.md)
- **CYBERSEC 2026 簡報下載器** ([security/cybersec-slide-downloader/](security/cybersec-slide-downloader/)) - 用於從 CYBERSEC 2026 大會 API 爬取與批次下載所有議程簡報的 Node.js 實用工具。 → [詳細說明](security/cybersec-slide-downloader/README.zh-TW.md)
- **Hacker News 新聞爬取器** ([security/hacker-news-scraper/](security/hacker-news-scraper/)) - 用於自動爬取 `thehackernews.com` 最近三週新聞內文並儲存為 Markdown 的 Node.js 實用工具。 → [詳細說明](security/hacker-news-scraper/README.zh-TW.md)
- **本地 HTTPS 自簽憑證測試與生成助手** ([security/local-https-cert-helper/](security/local-https-cert-helper/)) - 一鍵生成本地開發用 HTTPS 憑證 (Root CA & Server Cert) 且提供測試伺服器的實用工具。 → [詳細說明](security/local-https-cert-helper/README.zh-TW.md)

### 📝 文字轉換與編碼
- **文字轉換工具 (簡繁中文)** ([text/text-converter-zh/](text/text-converter-zh/)) - 可選擇性的中文簡繁轉換工具組，提供轉換前審核工作流程與 JSON 設定。 → [詳細說明](text/text-converter-zh/README.md)
- **Base64 轉換工具** ([text/base64-converter/](text/base64-converter/)) - 支援字串與檔案的 Base64 編解碼工具。 → [詳細說明](text/base64-converter/README.md)
- **Hex 轉 ASCII 轉換工具** ([text/hex-to-ascii/](text/hex-to-ascii/)) - 將十六進位字串轉換為對應的 ASCII 文本。 → [詳細說明](text/hex-to-ascii/README.md)

## 🚀 快速開始

### 環境需求

- Python 3.8 或更高版本
- pip(Python 套件管理器)

### 安裝步驟

1. 複製專案:
```bash
git clone https://github.com/Youchenjiang/Script-List.git
cd Script-List
```

2. 進入你想使用的腳本目錄:
```bash
cd category/script-name
```

3. 安裝依賴套件(如需要):
```bash
pip install -r requirements.txt
```

4. 執行腳本:
```bash
python script.py
```

##  使用指南

每個腳本都包含:
- **README.md**: 詳細文檔與使用說明
- **requirements.txt**: 所需 Python 套件清單
- **examples/**: 範例輸入與輸出

請閱讀各腳本的 README 了解具體使用方法。

## 🤝 參與貢獻

歡迎貢獻!以下是參與方式:

1. Fork 本專案
2. 建立新分支 (`git checkout -b feature/amazing-script`)
3. 進行修改
4. 提交變更 (`git commit -m 'Add amazing script'`)
5. 推送到分支 (`git push origin feature/amazing-script`)
6. 建立 Pull Request

## 📜 授權條款

本專案採用 MIT 授權 - 詳見 [LICENSE](LICENSE) 檔案。

## 🔗 相關專案

- [Method-List](https://github.com/Youchenjiang/Method-List) - 技術知識庫與解決方案
- [Clickra](https://github.com/Youchenjiang/Clickra) - Windows 11 現代右鍵選單自訂工具 (已從此倉庫獨立升格為專屬專案)

## 👤 作者

**Youchen Jiang**

- GitHub: [@Youchenjiang](https://github.com/Youchenjiang)

## ⭐ 支持專案

如果這個專案對你有幫助,請給一個 ⭐️!

---

**注意**: 所有腳本均按「現況」提供,不含任何保證。在正式環境中使用前請先檢閱程式碼。
