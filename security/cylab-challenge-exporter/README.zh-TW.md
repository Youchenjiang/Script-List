# CyLab Security Academy 全站題目匯出與刷題進度產生器

專為 [CyLab Security Academy](https://learn.cylabacademy.org)（前身為 picoCTF）設計的全站資安題目匯出、資料分析與 Markdown 刷題進度表產生器。

## 功能特點

- **瀏覽器 Session 題目導出器 (`export_challenges.js`)**：直接在瀏覽器 F12 Console 貼上執行，自動使用當前登入 Session 權限，完美繞過 Cloudflare 防護與 HTTP 403 阻擋。
- **Learning Paths & Topics 自動爬蟲 (`export_learning_paths.js`)**：利用同源 Popup 子視窗（成功繞過 `X-Frame-Options` 限制）自動遍歷所有 Learning Path 內頁，解析 React DOM 並匯出完整的 Markdown 階層清單 (`CyLab_Learning_Paths_and_Topics_YYYY-MM-DD.md`)。
- **全自動分頁連線抓取**：自動發送分頁請求，一次性完整撈取全站數百題題目。
- **雙重格式匯出**：同時產生原始 `JSON`（供程式分析）與帶有 UTF-8 BOM 的 `CSV` 檔案（可直接使用 Excel 開啟且中文絕不亂碼）。
- **離線 Markdown 刷題清單產生器 (`process_challenges.py`)**：自動解析匯出的 JSON，按領域分類與難易度分組，生成帶有勾選框 (`[x]`/`[ ]`) 的進度統計清單。

## 架構說明：為什麼採用混合式雙工具架構？

像 CyLab Academy 這樣的資安學習平台，前面設有 Cloudflare 防禦機制與 Session 驗證。任何獨立執行的連線工具（如 Python `requests` 或 `urllib`）在沒有登入 Session 與驗證 Token 的情況下直接打 API 都會被回傳 HTTP 403 阻擋。

因此，本工具組採用安全的兩階段雙工具架構：
1. **`export_challenges.js`**：運行在已通過 Cloudflare 驗證的瀏覽器 Console 中，負責將資料完整下載為 JSON 檔案。
2. **`process_challenges.py`**：本機離線執行，負責讀取 JSON 並生成進度圖表與 Markdown 筆記清單。

```
[ 已登入瀏覽器 (learn.cylabacademy.org) ] 
        │
        ▼ (在 F12 Console 執行 export_challenges.js)
 [ cylab_challenges_YYYY-MM-DD.json ]
        │
        ▼ (執行 python process_challenges.py)
 [ challenges_checklist.md ] (格式化 Markdown 刷題筆記清單)
```

## 快速開始

### 步驟 1：使用瀏覽器 Console 導出資料
1. 開啟並登入 [https://learn.cylabacademy.org/library](https://learn.cylabacademy.org/library)。
2. 按 `F12` 開啟開發者工具，並切換到 **Console (主控台)** 頁籤。
3. 複製 [export_challenges.js](export_challenges.js) 中的所有程式碼，貼入 Console 後按 `Enter`。
4. 瀏覽器將會自動下載以下兩個檔案：
   - `cylab_challenges_YYYY-MM-DD.json`
   - `CyLab_Challenges_YYYY-MM-DD.csv`

### 步驟 2：產生進度清單與統計圖表
在本機執行 Python 處理工具解析導出的 JSON 檔案：

```bash
python process_challenges.py --input cylab_challenges_YYYY-MM-DD.json
```

或是省略 `--input`，程式會自動搜尋當前目錄最新導出的 JSON 檔案：

```bash
python process_challenges.py
```

執行後即會在目錄下產生 `challenges_checklist.md`，內含領域分類統計表與可勾選的題目清單（`[x]` 代表已解答，`[ ]` 代表未完成）。

## 產出預覽 (`challenges_checklist.md`)

```markdown
# CyLab Security Academy Challenge Progress & Checklist

- **Total Challenges**: 512
- **Solved**: 128 / 512 (25.0%)

## Category Summary

| Category | Solved | Total | Completion |
| :--- | :---: | :---: | :---: |
| Artificial Intelligence | 5 | 10 | 50.0% |
| Cryptography | 30 | 100 | 30.0% |
| Web Exploitation | 40 | 120 | 33.3% |

---

## Challenge Checklist

### 📂 Cryptography (30/100)

- [x] **Basic Mod 26** — 100 pts | Diff: 1 *(picoCTF 2022)*
- [ ] **Mod 26** — 100 pts | Diff: 1 *(picoCTF 2021)*
```

## 授權條款

本專案採用 MIT 授權條款 - 詳見 [LICENSE](../../LICENSE) 檔案。
