# GitHub 收藏清單自動歸類與同步工具

一個基於 Node.js 寫成的自動化工具，用於將您在 Markdown 參考列表中記錄的 GitHub 專案，自動同步並依分類標題整理至您的 GitHub 個人 **「收藏清單」(Star Lists)** 中。

## 功能特點

1. **標題層級自動對應**：讀取 `README.zh-TW.md` 中的主分類標題（如 `## AI 智慧代理`）與子分類標題（如 `### 自主代理`），並自動合併為 GitHub 的清單名稱（如 `[AI] 自主代理`）。
2. **自動建立清單**：若您在 GitHub 尚未建立該清單，程式將會自動呼叫 GraphQL API 建立該清單。
3. **安全合併更新**：將專案安全歸類到目標清單中，不會移除或覆蓋該專案先前已有的其他收藏清單關聯。
4. **遞迴解析本地連結**：若列表中連結了本地的其餘 `.md` 子文件，本工具會自動遞迴讀取並將內部的 GitHub 專案一併歸類整理。
5. **靜默自動清理**：同步完成後會自動偵測並刪除您 profile 下所有空的不正確自訂清單（例如拼錯或因格式解析錯誤建立的空清單）。
6. **零外部依賴**：完全基於原生 Node.js 的 `fetch` 及 `readline` API 開發，不需安裝任何 `npm` 依賴套件。

---

## 🚀 快速開始

### 1. 準備 GitHub Personal Access Token (PAT)

本工具使用 GitHub GraphQL API 代表您的帳號執行操作，因此需要一組 Token。
1. 前往 [GitHub Tokens 設定頁面 (Classic)](https://github.com/settings/tokens)。
2. 點擊 **Generate new token (classic)**。
3. 勾選以下兩個項目：
   - [x] **`repo`** (用於解析並存取您列表中的公開與私人專案)
   - [x] **`user`** (用於讀取、建立與編輯您個人的自訂收藏清單)
4. 點擊 **Generate token** 並複製它。

---

### 2. 執行方式

您可以選擇將 Token 暫存在同目錄下的 `.env` 檔案中（格式為 `GITHUB_TOKEN=您的Token`），或是設定為環境變數 `GITHUB_TOKEN`，也可以在啟動時依提示輸入。

#### 互動式模式（推薦）
本模式會顯示選單，讓您選擇是要僅比對狀態、執行同步，還是退出：

```bash
node sync-github-stars.js
```

#### 一鍵靜默同步模式（適合自動化排程）
如果您已經設定好 `.env` 或 `GITHUB_TOKEN` 環境變數，可以直接使用此命令進行一鍵完整同步：

```bash
# 自動建立清單、點擊 Star 並歸類所有專案，最後清理多餘的空清單
node sync-github-stars.js --sync
```

#### 一鍵狀態檢查模式
如果您只想比對目前 GitHub 上有哪些專案還沒歸類，但不執行任何寫入：

```bash
node sync-github-stars.js --check
```

---

## 📂 專案結構與文件相依

此腳本預設會尋找相對於腳本位置的下述 Markdown 檔案：
`../../../Method-List/resources/github/README.zh-TW.md`

它會自動根據標題結構：
* `## [大分類]` $\rightarrow$ 映射至簡短標籤（如：`[AI]`, `[資安]`, `[開發工具]`, `[文檔GUI]`, `[影音AI]`, `[DL/金融]`）
* `### [小分類]` $\rightarrow$ 組合為 `[大分類標籤] 小分類` 清單。
