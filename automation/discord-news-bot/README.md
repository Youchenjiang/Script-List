# Discord 自動新聞推送 Bot

定時抓取 The Hacker News，將最新資安新聞用 Discord Embed 推送到指定頻道。專案沿用 `Script-List/security/hacker-news-scraper` 的 Blogger JSON Feed 抓取方式，以及 `loss-found-app-bot` 的 `discord.js` Bot／slash command 架構。

## 功能

- 預設每 30 分鐘抓取一次新聞
- 只推送指定時間範圍內的新文章，並以 `data/state.json` 永久去重
- 每輪限制推送數量，避免第一次啟動洗版
- `/news_now`：具「管理伺服器」權限者可立即檢查
- `/news_status`：查看上次檢查與推送數量
- `/ping`：檢查 Bot 延遲
- Feed、頻道、週期、回溯時間及單輪上限均可由環境變數設定

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
```

伺服器、頻道 ID 可在 Discord 開啟「開發者模式」後，以右鍵複製。

## 啟動

先註冊 slash commands，再啟動 Bot：

```bash
npm run deploy
npm start
```

若不希望啟動時立刻抓取，將 `PUSH_ON_START=false`。其他設定及預設值可參考 [.env.example](./.env.example)。

## 運作方式

1. 從 Blogger JSON Feed 讀取文章標題、摘要、日期、分類與連結。
2. 僅保留 `LOOKBACK_HOURS` 內且未出現在狀態檔的文章。
3. 按發布時間由舊至新推送，成功送出一篇就立刻寫入狀態，降低中途當機造成重複推送的機率。
4. 透過單一執行鎖避免排程與 `/news_now` 同時重複抓取。

`NEWS_FEED_URL` 目前預期為 Blogger JSON Feed 格式；預設值已指向 The Hacker News。
