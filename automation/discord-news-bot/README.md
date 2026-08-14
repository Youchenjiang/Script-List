# Discord 自動新聞推送 Bot

定時抓取 The Hacker News，由 AI 依 Discord 頻道中設定的規則篩選，再將符合條件的資安新聞用 Discord Embed 推送到指定頻道。專案沿用 `Script-List/security/hacker-news-scraper` 的 Blogger JSON Feed 抓取方式，以及 `loss-found-app-bot` 的 `discord.js` Bot／slash command 架構。

互動式規則設定的使用流程、欄位與判斷契約請見 [Discord AI 新聞規則設定規格](./docs/ai-rule-setup-spec.md)。

## 功能

- 預設每 30 分鐘抓取一次新聞
- 由 AI 根據頻道規則判斷，只推送符合條件的文章
- 只處理指定時間範圍內的新文章，並永久保存推送及判斷紀錄
- 每輪限制推送數量，避免第一次啟動洗版
- `/news_rule setup`：由 Bot 列出選項並逐步設定篩選規則
- `/news_rule show`：查看目前規則
- `/news_rule clear`：清除規則並停止推送
- `/news_now`：具「管理伺服器」權限者可立即檢查
- `/news_status`：查看上次檢查與推送數量
- `/ping`：檢查 Bot 延遲
- Feed、頻道、週期、回溯時間及單輪上限均可由環境變數設定
- 雲端環境可使用 PostgreSQL 保存去重狀態，本機則自動使用 JSON 檔案

## 安裝

需求：Node.js 22 以上（OpenAI SDK 需求）。

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
OPENAI_API_KEY=OpenAI_API_Key
```

伺服器、頻道 ID 可在 Discord 開啟「開發者模式」後，以右鍵複製。

## 啟動

先註冊 slash commands，再啟動 Bot：

```bash
npm run deploy
npm start
```

若不希望啟動時立刻抓取，將 `PUSH_ON_START=false`。其他設定及預設值可參考 [.env.example](./.env.example)。

啟動後，具「管理伺服器」權限者需在指定新聞頻道執行：

```text
/news_rule setup
```

Bot 會先顯示所有設定面向，使用者可直接採用建議設定，或依序選擇主題、嚴重度、地區、排除內容與信心門檻；只有最後確認後才會儲存。

沒有規則、缺少 `OPENAI_API_KEY` 或 AI 判斷失敗時，Bot 採取預設拒絕，不會直接推送未篩選的文章。`OPENAI_MODEL` 預設為 `gpt-5.4-nano`；每輪最多新判斷 `MAX_AI_EVALUATIONS_PER_RUN=10` 篇，OpenAI API 使用量會另外計費。

## PostgreSQL 與雲端部署

設定 `DATABASE_URL` 後，Bot 會自動建立 `news_bot_state`、`news_filter_rules`、`news_article_evaluations` 資料表，保存已推送文章、頻道規則及 AI 判斷快取。未設定時則使用本機 JSON 檔案。

第一次從既有本機 Bot 搬到雲端時，建議設定：

```dotenv
DATABASE_URL=postgresql://user:password@host:5432/news_bot
PUBLISH_INITIAL_ARTICLES=false
```

`PUBLISH_INITIAL_ARTICLES=false` 只會在空白狀態庫的第一次檢查生效：Bot 會將現有文章標記為已看過但不推送，後續新文章仍會正常發送，可避免搬遷時重複推送。

在 Northflank 可建立 PostgreSQL addon，透過 Secret Group 將 addon 的內部連線 URI alias 為 `DATABASE_URL`。Bot Service 不需要公開 port；Build Context 設為 `/automation/discord-news-bot`，啟動指令使用 `npm start`。

## 運作方式

1. 從 Blogger JSON Feed 讀取文章標題、摘要、日期、分類與連結。
2. 僅保留 `LOOKBACK_HOURS` 內且未出現在狀態檔的文章。
3. 使用目前頻道規則與文章資料呼叫 AI，取得固定格式的符合／拒絕判斷。
4. AI 結果會依「文章、頻道、規則版本」快取；更新規則會增加版本，使近期文章可按新規則重新判斷。
5. 只推送符合規則的文章，成功送出一篇就立刻保存狀態，降低中途當機造成重複推送的機率。
6. 透過單一執行鎖避免排程與 `/news_now` 同時重複抓取。

`NEWS_FEED_URL` 目前預期為 Blogger JSON Feed 格式；預設值已指向 The Hacker News。
