# Discord 自動新聞推送 Bot

定時抓取 The Hacker News，由 AI 依 Discord 頻道中設定的規則篩選，再將符合條件的資安新聞用 Discord Embed 推送到指定頻道。專案沿用 `Script-List/security/hacker-news-scraper` 的 Blogger JSON Feed 抓取方式，以及 `loss-found-app-bot` 的 `discord.js` Bot／slash command 架構。

互動式規則設定的使用流程、欄位與判斷契約請見 [Discord AI 新聞規則設定規格](./docs/ai-rule-setup-spec.md)。

## 功能

- 預設每 30 分鐘抓取一次新聞
- 由 AI 根據頻道規則判斷，只推送符合條件的文章
- 將「事件類型」與「技術領域」分開設定，例如只接收影響雲端／容器的零日或供應鏈事件
- 以頻道共用研究方向標示每篇文章對漏洞研究、威脅情報、偵測工程等領域的關聯
- 只推送真正需要投入時間閱讀的文章，不在訊息中重複顯示「必讀」判斷
- 以自然的繁體中文標題與單段敘事，按時間順序交代事件背景、技術效果、已確認後果與收尾
- 頁尾簡短標示難度與主要研究方向，並保留最多三個中文 hashtag 供 Discord 搜尋
- 只處理指定時間範圍內的新文章，並永久保存推送及判斷紀錄
- 每輪限制推送數量，避免第一次啟動洗版
- `/news_rule setup`：由 Bot 列出選項並逐步設定篩選規則
- `/news_rule show`：任何頻道成員都可公開查看目前規則
- `/news_rule clear`：清除規則並停止推送
- `/news_now`：具「管理伺服器」權限者可立即檢查
- `/news_ai_check`：實際測試 AI 供應商連線與結構化輸出
- `/news_status`：查看上次檢查與推送數量
- `/ping`：檢查 Bot 延遲
- Feed、頻道、週期、回溯時間及單輪上限均可由環境變數設定
- 雲端環境可使用 PostgreSQL 保存去重狀態，本機則自動使用 JSON 檔案

## 安裝

需求：Node.js 18 以上。

```bash
npm install
Copy-Item .env.example .env
```

到 [Discord Developer Portal](https://discord.com/developers/applications) 建立 Application 與 Bot，邀請時勾選 `bot`、`applications.commands` scope，並給予目標頻道的 View Channel、Send Messages、Embed Links 權限。

編輯 `.env`：

```dotenv
DISCORD_TOKEN=機器人權杖
DISCORD_CLIENT_ID=Application_ID
DISCORD_GUILD_ID=測試伺服器_ID
DISCORD_CHANNEL_ID=新聞頻道_ID
AI_BASE_URL=供應商的_OpenAI_相容端點
AI_API_KEY=供應商的_API_Key
AI_MODEL=供應商的模型_ID
```

伺服器、頻道 ID 可在 Discord 開啟「開發者模式」後，以右鍵複製。

## 啟動

先註冊 slash commands，再啟動 Bot：

```bash
npm run deploy
npm run deploy:branding
npm start
```

`npm run deploy:branding` 會將 Bot 顯示名稱更新為 `Cyber News Sentinel`，並套用專案內的資安新聞守望者頭像。Discord 對 Bot 使用者名稱變更有較嚴格的頻率限制，不應在每次服務啟動時執行。

若不希望啟動時立刻抓取，將 `PUSH_ON_START=false`。其他設定及預設值可參考 [.env.example](./.env.example)。

啟動後，具「管理伺服器」權限者需在指定新聞頻道執行：

```text
/news_rule setup
```

Bot 會先顯示所有設定面向，管理者可直接採用建議設定，或依序選擇事件類型、技術領域、讀書會共用研究方向、嚴重度、地區、排除內容與信心門檻；只有最後確認後才會儲存。設定流程只對管理者顯示，儲存後 Bot 會在頻道公開張貼版本與完整規則。舊版規則缺少技術領域或研究方向時會自動補上安全的預設值。

沒有規則、缺少任何 AI 連線設定或 AI 判斷失敗時，Bot 採取預設拒絕，不會直接推送未篩選的文章。每輪最多新判斷 `MAX_AI_EVALUATIONS_PER_RUN=10` 篇；精簡判斷每次回覆預設允許 `AI_MAX_OUTPUT_TOKENS=800` tokens。此值是輸出上限，不代表每次都會消耗相同數量。`gpt-oss` 推理模型會自動使用 `reasoning_effort=low`、保留至少 1,200 tokens，並將請求間隔設為 26 秒，避免預設中等推理耗盡輸出空間或在免費 8,000 TPM 配額內集中送出過多請求。

Bot 使用通用的 OpenAI-compatible `chat/completions` 協定，不綁定特定供應商。更換服務時只需修改 `AI_BASE_URL`、`AI_API_KEY`、`AI_MODEL`。所選模型必須支援 `response_format` 的 JSON Schema structured outputs，例如：

```dotenv
# Google Gemini
AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
AI_MODEL=gemini-3.5-flash-lite

# Groq
AI_BASE_URL=https://api.groq.com/openai/v1/

# OpenRouter
AI_BASE_URL=https://openrouter.ai/api/v1/
```

實際免費額度、模型 ID 與 structured outputs 支援會隨供應商調整，應以供應商文件為準。

部署後，具「管理伺服器」權限者可執行 `/news_ai_check`。Bot 會送出一筆合成新聞測試請求，確認端點、API key、模型及 structured output 契約皆可使用，並顯示供應商回傳的 HTTP status 與訊息。若相容端點明確以 `json_validate_failed` 拒絕 strict structured output，Bot 會自動重試純 JSON、記住該執行個體不支援 strict generation，並在本地執行完全相同的嚴格 schema 驗證；若 `HTTP 429` 訊息明確提供等待秒數，Bot 最多等待 20 秒後重試一次。部分端點若將完整 JSON 包在 Markdown code fence 中，Bot 也會移除此外層後再驗證。定時評估若收到空白、無效 JSON 或不符合 schema 的內容，會記錄警告並轉成信心值為零的安全拒絕結果，避免同一篇文章無限消耗免費額度；`/news_ai_check` 仍會嚴格回報錯誤。結果只對執行者顯示，不會顯示 API key，也不會讀寫新聞狀態或推送文章；測試與自動重試仍可能計入供應商用量。

## PostgreSQL 與雲端部署

設定 `DATABASE_URL` 後，Bot 會自動建立 `news_bot_state`、`news_filter_rules`、`news_article_evaluations` 資料表，保存已推送文章、以 Discord 伺服器／頻道識別的共用規則、研究方向及完整閱讀卡快取。部署新版時會以可重複執行的 migration 補齊欄位；未設定資料庫時則使用本機 JSON 檔案。

第一次從既有本機 Bot 搬到雲端時，建議設定：

```dotenv
DATABASE_URL=postgresql://user:password@host:5432/news_bot
PUBLISH_INITIAL_ARTICLES=false
```

`PUBLISH_INITIAL_ARTICLES=false` 只會在空白狀態庫的第一次檢查生效：Bot 會將現有文章標記為已看過但不推送，後續新文章仍會正常發送，可避免搬遷時重複推送。

在 Northflank 可建立 PostgreSQL addon，透過 Secret Group 將 addon 的內部連線 URI alias 為 `DATABASE_URL`。Bot Service 不需要公開 port；Build Context 設為 `/automation/discord-news-bot`，啟動指令使用 `npm start`。

## 運作方式

1. 從 Blogger JSON Feed 讀取文章標題、摘要、可取得的文章內容、日期、分類與連結；顯示摘要與 AI 分析內容分開限制長度。
2. 僅保留 `LOOKBACK_HOURS` 內且未出現在狀態檔的文章。
3. 使用目前頻道規則與文章資料呼叫 AI，一次取得符合／拒絕判斷及結構化研究閱讀卡。
4. AI 結果會依「文章、頻道、規則版本、Base URL、模型、判斷契約版本」快取；更新規則或切換供應商／模型後會重新判斷。
5. 只推送符合規則且判定為 `must_read` 的文章；公開訊息不顯示判斷名稱，只呈現中文標題、單段敘事、難度、主要研究方向與最多三個中文標籤。
6. 透過單一執行鎖避免排程與 `/news_now` 同時重複抓取。

`NEWS_FEED_URL` 目前預期為 Blogger JSON Feed 格式；預設值已指向 The Hacker News。
