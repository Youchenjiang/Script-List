# 外部資安活動與 RSS 專案研究

研究日期：2026-09-19

本文件記錄可供 `discord-news-bot` 借鑑的外部開源專案，目的不是複製整個倉庫，而是辨識每個專案可提供的資料、分類方法與實作概念，並決定它應進入「活動雷達」、「新聞雷達」或「來源探索」哪一層。

## 研究原則

1. 活動公告必須具有可驗證的活動名稱、官方連結與時間；缺少關鍵欄位時只能列為候選，不能直接推送。
2. 報名截止時間與活動舉辦時間是不同欄位，不得混用。
3. 主辦單位名錄、學習資源清單與 RSS 訂閱清單不是活動資料源；它們只能協助尋找應監控的官方入口。
4. 紅隊、藍隊、紫隊、綜合、適合程度與參與人數，必須由活動頁面的明確內容推導。證據不足時顯示未知，不用名稱硬猜。
5. 外部來源可能過期、失效或被接管。新增來源前要檢查 HTTPS、回應格式、重新導向、更新時間與內容品質。
6. 優先使用官方 API、官方資料檔、RSS 或 iCal；只有沒有結構化來源時才解析 HTML。
7. 尊重各倉庫授權。沒有明確授權的倉庫只參考公開資訊與設計概念，不複製程式碼或整包資料。

## 結論摘要

| 專案 | 主要內容 | 在本 Bot 中的角色 | 優先度 |
| --- | --- | --- | --- |
| [stwater20/taiwan-security-deadlines](https://github.com/stwater20/taiwan-security-deadlines) | 臺灣資安活動與報名期限 | 結構化活動來源 | 最高 |
| [Ice1187/TW-Security-and-CTF-Resource](https://github.com/Ice1187/TW-Security-and-CTF-Resource) | 臺灣資安社群、CTF、培訓與活動索引 | 主辦單位與活動入口名冊 | 高 |
| [goodjack/awesome-cs-training](https://github.com/goodjack/awesome-cs-training) | 臺灣學生資訊培訓與競賽資源 | 學生族群與週期性活動補充名冊 | 中 |
| [r0eXpeR/Security_RSS](https://github.com/r0eXpeR/Security_RSS) | 少量分類資安 RSS | 新聞來源候選清單 | 低 |
| [Han0nly/SecurityRSS](https://github.com/Han0nly/SecurityRSS) | 安全組織、媒體與研究者 OPML | 新聞來源候選與 OPML 匯入參考 | 中 |
| [arch3rPro/SecurityRSS](https://github.com/arch3rPro/SecurityRSS) | 完整、精簡與微信分類 OPML | 分級來源包與健康狀態設計參考 | 中 |
| [weiyongsheng1124/MoltbotAP-security](https://github.com/weiyongsheng1124/MoltbotAP-security) | Telegram 每日資安新聞 Bot | 排程與多來源推送流程比較 | 低 |

## 具體引入規格（決策版）

本節是實作清單，不是可能性分析。除非後續測試發現來源已失效，實作應依照這裡的範圍進行。

實作狀態（2026-09-19）：

- 標準活動模型、可解釋分類、Taiwan Security Deadlines adapter、跨來源去重與新公告格式已完成。
- 臺灣主辦單位名冊中，HITCON、DEVCORE 與台灣數位安全聯盟已通過 KKTIX Atom／JSON-LD 實際驗證；SCIST 與 BambooFox 已通過官方公開 iCal 驗證。這 5 個來源均為 `active`，其餘入口與 3 個週期活動仍為 `candidate`。
- 9 個 RSS／Atom 來源已登錄為 `observing`且 `delivery:false`，通用 parser 已完成，但尚未接入新聞推送。
- 來源健康狀態與分批觀察器已完成，且 `SOURCE_OBSERVATION_ENABLED` 預設為 `false`。

### 最終決策矩陣

| 專案 | 要引入的資料或設計 | 導入位置 | 不引入的內容 |
| --- | --- | --- | --- |
| `awesome-cs-training` | 三個學生向資安週期事件的監控種子、學生受眾欄位 | `data/event-source-registry.json` | 非資安競程、教材、工具與歷史日期 |
| `taiwan-security-deadlines` | `conferences.yml` 正式來源、deadline 與線上／實體資訊 | `src/event-sources/taiwan-deadlines.js` | 將 iCal deadline 誤作活動開始時間 |
| `TW-Security-and-CTF-Resource` | 臺灣主辦單位名冊、技術主題詞彙、十個優先監控入口 | `data/event-source-registry.json`、`src/event-classifier.js` | README 直接轉成活動、Facebook／Discord 登入爬蟲 |
| `r0eXpeR/Security_RSS` | 五個高訊號 RSS 候選 | `data/news-source-registry.json` | RSSHub 端點與整份 README |
| `Han0nly/SecurityRSS` | 三個官方 RSS 候選、OPML 匯入後需審核的流程 | `data/news-source-registry.json`、來源維護工具 | 整包 OPML、自動啟用舊 HTTP feed |
| `arch3rPro/SecurityRSS` | Lite／Full 分層概念、來源健康與淘汰欄位、一個研究來源候選 | `src/source-health.js`、新聞來源登錄檔 | 378 個完整包、微信包、以 `online` 當永久有效 |
| `MoltbotAP-security` | 語言欄位與來源 adapter 介面檢查項 | 共用來源介面 | 原始程式碼、Telegram 傳送層、HTML 爬蟲 |

### 第一階段：確定要直接上線的活動來源

新增以下正式來源：

```text
source id: taiwan-security-deadlines
fetch URL: https://raw.githubusercontent.com/stwater20/taiwan-security-deadlines/main/_data/conferences.yml
format: YAML
default timezone: Asia/Taipei
trust: curated_with_official_links
delivery: enabled
```

實作檔案：

- `src/event-sources/taiwan-deadlines.js`：下載、解析及正規化 YAML。
- `test/taiwan-deadlines.test.js`：欄位映射、跨年、複數 deadline、錯誤資料與歷史資料測試。
- `src/event-feed.js`：把新 adapter 加入現有 `Promise.allSettled`，維持單一來源失敗不阻斷其他來源。
- `src/config.js`：加入 `TAIWAN_DEADLINES_ENABLED` 與 `TAIWAN_DEADLINES_URL`。
- `.env.example` 與 README：說明開關及預設 URL。
- `package.json`：加入維護中的 YAML parser；不再用規則不足的逐行自製解析器處理此來源。

預設設定：

```dotenv
TAIWAN_DEADLINES_ENABLED=true
TAIWAN_DEADLINES_URL=https://raw.githubusercontent.com/stwater20/taiwan-security-deadlines/main/_data/conferences.yml
```

#### YAML 欄位映射

| 外部欄位 | 內部欄位 | 處理規則 |
| --- | --- | --- |
| `name` + `year` | `title` | 顯示名稱已含年份時不重複附加 |
| `description` | `description` | 保存原文供分類及公告摘要使用 |
| `link` | `officialUrl` | 必須是 HTTP(S)，公告一律使用此連結 |
| `date` | `dateText` | 永遠保存；只有可無歧義解析時才建立開始與結束時間 |
| `deadline[]` | `deadlines[]` | 全部保存，不只取第一筆 |
| `timezone` | `timeZone` | 缺少時保留 unknown；2026 臺灣資料才可依來源規範使用 `Asia/Taipei` |
| `place` | `location` | 原樣保存並清理空白 |
| `tags` | `attendance`、`eventTags` | `ONLINE`、`ONSITE` 同時存在為 hybrid |
| `comment` | `deadlineNote` | 只作補充，不強行把每句對應到特定 deadline |

#### 納入與排除規則

納入條件：

- `name`、`year`、`link` 與至少一個 deadline 有效。
- 至少一個 deadline 尚未過期，或活動日期能確定仍未結束。
- 官方連結使用 HTTP(S)。
- 年份不得早於目前年份，除非能確定活動跨年且尚未結束。

排除條件：

- 所有 deadline 已過期且活動時間也已結束。
- 只有自由文字日期、所有 deadline 已過期，無法證明活動仍有效。
- 連結缺失、日期無法解析且沒有未來 deadline。
- 同一官方 URL、同一年與近似名稱已由其他來源收錄。

#### deadline 顯示規則

- 公告只顯示最近一個尚未到期的 deadline。
- `comment` 明確寫出「報名」、「甄選」、「投稿」或「繳交」時，分別標示對應用途。
- 無法確定用途時只寫「最近期限」，不擅自稱為報名截止。
- 首次公告後不因第二個 deadline 再次發送；未來若要做提醒，必須另立提醒功能與狀態鍵。

### 第二階段：確定要寫入的臺灣監控名單

新增 `data/event-source-registry.json`。首批資料不是直接活動，而是需要定期尋找新公告的官方入口。

#### 從 TW-Security-and-CTF-Resource 引入

| ID | 組織／活動 | 官方入口 | 監控目的 | 初始模式 |
| --- | --- | --- | --- | --- |
| `ais3` | AIS3 系列 | `https://ais3.org/` | AIS3、Junior、MyFirstCTF、Pre-exam、EOF | `official_page` |
| `hitcon` | HITCON | `https://hitcon.org/` | 年會、CTF、Training | `official_page` |
| `devcore-meet` | `/dev/meet` | `https://devcore.kktix.cc/` | 資安小聚與開放報名 | `kktix_listing` |
| `devcore-conf` | DEVCORE Conference | `https://conf.devco.re/` | 年度研討會與售票 | `official_page` |
| `teamt5` | TeamT5 | `https://teamt5.org/` | Security Camp、威脅分析師活動 | `official_page` |
| `cybersec` | CYBERSEC | `https://cybersec.ithome.com.tw/` | 大會、議程與報名 | `official_page` |
| `nics` | 國家資通安全研究院 | `https://www.nics.nat.gov.tw/` | 培訓、競賽及公開活動 | `official_page` |
| `scist` | SCIST | `https://scist.org/` | 公開日曆中的資安課程、競賽與助教活動 | `ical_calendar` |
| `bamboofox` | BambooFox | `https://bamboofox.org/` | 官方公開日曆中的 CTF、社課、工作坊與社群活動 | `ical_calendar` |
| `balsn` | Balsn | `https://balsn.tw/` | CTF、研究分享與活動 | `official_page` |

`official_page` 初期只代表登錄與人工驗證，不代表立即爬 HTML。只有找到 RSS、iCal、JSON、KKTIX 列表或其他穩定結構化入口後，才將狀態升級為 `active`。

#### 已驗證公開日曆

| 來源 | 結構化入口 | 實際處理 |
| --- | --- | --- |
| SCIST | 首頁「SCIST 公開日曆」所嵌入的 Google Calendar iCal | 只接受標題或描述含資安、CTF、Pwn、Web Security、Reverse、Crypto、Forensics、漏洞、滲透、紅隊或藍隊的項目，避免把純演算法培訓送進資安頻道 |
| BambooFox | 官網「複製 iCal 網址」公開的 Google Calendar iCal | 接受尚未開始的社課、工作坊、競賽及社群活動；官網與日曆均由同一社群維護 |

實測日期為 2026-09-19。BambooFox 日曆當時可解析出 7 個未開始項目，包括 Git Workshop、Linux Workshop、Web Security、門禁安全與後續社課。SCIST 日曆當時沒有尚未開始且符合資安關鍵字的項目，因此回傳 0 是有效結果，不代表連線或解析失敗。iCal 通常沒有報名截止日、程度及人數，公告必須維持「未公開」，不得由活動名稱推測。

#### 從 awesome-cs-training 引入

只新增以下週期事件監控種子，不引入一般競程活動：

| ID | 名稱 | 預期公告月份 | 受眾 | 用途 |
| --- | --- | --- | --- | --- |
| `ais3-myfirstctf-cycle` | AIS3 MyFirstCTF | 前一年 11 月至當年 4 月 | 初學者、學生 | 提醒檢查新一屆報名公告 |
| `ais3-eof-cycle` | AIS3 EOF | 前一年 11 月起 | 具基礎至進階 | 提醒檢查新一屆競賽公告 |
| `golden-shield-cycle` | 資安技能金盾獎 | 8 月至 10 月 | 學生 | 提醒檢查報名與賽程 |

這三筆的月份只用於「何時檢查」，絕不生成活動日期。若 `taiwan-security-deadlines` 已提供當年度資料，以正式來源為準並去重。

#### Registry 必備欄位

```json
{
  "id": "hitcon",
  "name": "HITCON",
  "homepage": "https://hitcon.org/",
  "sourceProject": "Ice1187/TW-Security-and-CTF-Resource",
  "mode": "official_page",
  "status": "candidate",
  "region": "TW",
  "language": ["zh-TW", "en"],
  "audience": ["public"],
  "usualAnnouncementMonths": [],
  "lastCheckedAt": null,
  "lastSuccessfulAt": null,
  "notes": ""
}
```

### 第三階段：確定要加入的活動分類能力

從 `TW-Security-and-CTF-Resource` 引入的是技術詞彙，不是它的文章內容。新增 `src/event-classifier.js`，輸出兩個不同維度：

- `directions`：紅隊、藍隊、紫隊、綜合。
- `topics`：Web、Pwn、Reverse、Crypto、Forensics、Malware、Threat Intelligence、Cloud、ICS、Mobile、Web3 等。

不能把 Web、Pwn 或 Reverse 直接當成「紅隊標籤」後就丟掉技術資訊。公告可顯示主要方向，資料庫仍保留 topic，未來可供頻道搜尋或個人訂閱。

#### 首版確定規則

| 結果 | 必須出現的證據 |
| --- | --- |
| 紅隊 | penetration testing、red team、offensive security、exploit development、漏洞利用等明確攻擊內容 |
| 藍隊 | SOC、DFIR、incident response、threat hunting、defensive security、偵測工程等明確防禦內容 |
| 紫隊 | purple team，或明確同時要求 adversary emulation 與 detection validation／防禦改進 |
| 綜合 | 多軌研討會、一般社群活動，或無單一攻防方向 |

一般 CTF 不因名稱含 CTF 就自動標紅隊。若只有 Web、Pwn、Crypto、Reverse、Forensics 題型，保留 topics；方向依整體說明判斷，證據不足時使用 `unspecified`，不能用綜合掩飾未知。

分類函式必須同時回傳 `evidence`。例如：

```json
{
  "directions": ["purple"],
  "topics": ["detection-engineering"],
  "level": "foundational",
  "evidence": {
    "directions": "活動說明中的原句",
    "level": "活動說明中的原句"
  }
}
```

沒有原文證據就不能輸出具體程度或隊伍上限。

### 第四階段：確定要加入的新聞 RSS

目前 `src/news-feed.js` 只支援 Blogger JSON，不能直接讀一般 RSS／Atom。要新增：

- `src/syndication-feed.js`：解析 RSS 2.0 與 Atom，正規化成現有 article 結構。
- `data/news-source-registry.json`：保存來源而不是只靠一個 `NEWS_FEED_URL`。
- `src/source-health.js`：保存最近成功、連續失敗、最後有意義文章與隔離狀態。
- `test/syndication-feed.test.js` 與 `test/source-health.test.js`。
- 設定 `MAX_SOURCES_PER_RUN`，避免一次請求數百個網站。

#### 從 r0eXpeR/Security_RSS 選入觀察池

| ID | URL | 預設分類 | 原因 |
| --- | --- | --- | --- |
| `exploit-db` | `https://www.exploit-db.com/rss.xml` | 漏洞利用、紅隊 | 新公開 exploit 與研究訊號 |
| `packet-storm-files` | `https://rss.packetstormsecurity.com/files/` | 漏洞、工具、研究 | 原始安全檔案與公告 |
| `github-security-lab` | `https://securitylab.github.com/research/feed.xml` | 漏洞研究 | 高技術含量研究 |
| `dfir-report` | `https://thedfirreport.com/feed/` | DFIR、藍隊 | 完整事件與攻擊鏈分析 |
| `red-team-journal` | `https://redteamjournal.com/blog?format=rss` | 紅隊 | 紅隊方法與觀點 |

不引入該清單中的 RSSHub 端點、HTTP-only 端點及未先驗證的聚合站。

#### 從 Han0nly/SecurityRSS 選入觀察池

| ID | 候選 URL | 預設分類 | 啟用前要求 |
| --- | --- | --- | --- |
| `defcon` | `https://www.defcon.org/defconrss.xml` | 會議、社群 | 驗證 HTTPS 與最近更新時間 |
| `google-security` | `https://security.googleblog.com/atom.xml` | 漏洞、防禦、研究 | 驗證 Atom 解析及永久連結 |
| `ctftime-rss-fallback` | `https://ctftime.org/event/list/upcoming/rss/` | CTF 活動備援 | 必須與 CTFtime API 依活動 URL／ID 去重，預設不公告 |

OPML 匯入器不是第一階段功能。未來若實作，匯入結果一律是 `candidate`，禁止自動變成 active。

#### 從 arch3rPro/SecurityRSS 選入觀察池

只選一個不與上面重複的研究來源：

| ID | URL | 預設分類 | 原因 |
| --- | --- | --- | --- |
| `360-netlab` | `https://blog.netlab.360.com/rss` | 網路威脅、惡意基礎設施 | 補充殭屍網路與網路層研究 |

從此專案真正要引入的主要是來源分級與淘汰機制：

- `core`：已證明高訊號，正常參與推送。
- `extended`：仍在觀察，只記錄不推送。
- `special`：需要 RSSHub、登入或特殊網路條件，預設停用。
- 連續 7 次抓取失敗進入 `quarantined`。
- 90 天沒有文章時標記 `stale`，不再每輪抓取。
- 恢復來源必須先通過一次人工或管理員指令檢查。

不引入 Full OPML、Lite OPML 或 WeChat OPML 的原始內容；我們只建立自己的精選登錄檔。

### 第五階段：MoltbotAP-security 的明確採用範圍

不複製任何程式。只把下列兩項納入本專案介面：

1. 每個新聞來源必須有 `language`，首批支援 `zh-TW`、`zh-CN`、`en`，讓 AI 或規則知道輸入語言，但輸出仍統一為繁體中文。
2. 每個來源必須透過相同 adapter 介面回傳正規化文章，傳送到 Discord 的程式不能知道來源是 RSS、Atom、Blogger JSON 或 HTML。

建議介面：

```js
{
  id,
  name,
  language,
  fetch({ signal }),
  normalize(rawItem)
}
```

明確不採用：

- Telegram Bot API。
- 網站 HTML selector 或爬蟲程式。
- 每天無篩選地把所有新文章一次發完。
- 未知的排程、去重或秘密管理實作。

### 公告格式確定版

#### 傳送方式

- 一個活動一則普通 Discord Markdown 訊息，不使用 Embed、討論串、按鈕或附件。
- 每次最多五則，依最近 deadline 優先，其次依活動開始時間排序。
- `allowedMentions.parse` 固定為空陣列，任何外部文字都不能觸發 `@everyone`、身分組或使用者通知。
- 不把來源名稱、內部分數、原始標籤、抓取狀態或「推薦／必讀」字樣放進公開訊息。
- 所有可標準化的時間轉成 `Asia/Taipei`，並在活動時間列明示「台灣時間」。

#### 固定欄位順序

```text
[活動名稱](官方活動或報名頁)
方向圖示 方向 · 活動類型｜適合程度｜參與方式或人數
🧩 最多五個主要技術主題，超過時標示剩餘數量
📅 活動起訖時間（台灣時間）
⏳ deadline 類型與時間
📍／🌐 地點或線上形式
👤 參與資格
```

標題、快速判斷列與活動時間是固定骨架；技術主題、deadline、地點與資格沒有可靠資料時依下列規則處理。

#### 第一列：標題與連結

```text
[Holmes CTF 2026: The Reichenbach Directive](https://example.com/official-event)
```

- 使用官方活動頁或官方報名頁，不連到聚合站文章。
- Discord 顯示標題最多 200 字元；移除會破壞 Markdown 連結的 `[` 與 `]`。
- 不自行翻譯活動專有名稱，官方有繁中名稱時優先使用繁中名稱。

#### 第二列：快速判斷列

```text
🔴 紅隊 · CTF｜具基礎｜最多 5 人
```

方向顯示值：

| 值 | 顯示 | 使用條件 |
| --- | --- | --- |
| `red` | `🔴 紅隊` | 有明確攻擊、滲透或漏洞利用證據 |
| `blue` | `🔵 藍隊` | 有明確偵測、應變、鑑識或防禦證據 |
| `purple` | `🟣 紫隊` | 明確整合攻擊模擬與偵測／防禦驗證 |
| `general` | `⚪ 綜合` | 明確為多軌研討會、綜合課程或一般社群活動 |
| `unspecified` | `⚫ 方向未標示` | 來源資訊不足；不可拿「綜合」掩飾未知 |

活動類型顯示值固定為：`CTF`、`競賽`、`培訓`、`工作坊`、`研討會`、`社群小聚`、`徵稿`。無法判斷時使用 `活動`。

程度顯示值固定為：`入門`、`具基礎`、`進階`、`程度未標示`。

參與方式依證據顯示：

- 個人活動：`個人報名`、`個人申請`或`個人參賽`。
- 明確隊伍上下限：`2～5 人`。
- 只有上限：`最多 5 人`。
- 只知道是隊伍制：`隊伍制，人數未公開`。
- 完全未知：`人數未公開`。

#### 第三列：技術主題

```text
🧩 Web、Pwn、Reverse
```

- 所有具證據的 topics 都保存於資料庫，不因公開訊息長度而丟棄。
- 公開訊息在五個以內時全部顯示；超過五個時顯示前五個並附上 `（另有 N 類）`，例如 `🧩 Web、Pwn、Reverse、Crypto、Forensics（另有 2 類）`。
- 顯示順序優先沿用官方題型或議程順序；來源沒有提供順序時，按主題第一次出現在官方說明中的位置排列，不按字母排序，也不讓 AI 自行決定重要性。
- 不使用 `#紅隊`、`#技術` 等沒有檢索價值的泛用 hashtag。
- 沒有可靠 topic 時整列省略，不顯示「主題未標示」。第二列仍能呈現方向與活動類型。

#### 第四列：活動時間

有精確起訖時間：

```text
📅 2026/09/18 12:00～09/22 17:00（台灣時間）
```

只有全天日期：

```text
📅 2026/09/18～09/22
```

只有官方自由文字，無法安全解析：

```text
📅 Sep 2026 – Aug 2027（詳細時間請見官網）
```

只有未來 deadline，沒有可信活動日期：

```text
📅 活動日期請見官網
```

不得把報名截止日填成活動開始時間。

#### 第五列：期限

依可證實的 deadline 類型選擇文字：

```text
⏳ 報名至 2026/09/10 23:59
⏳ 投稿至 2026/09/10 23:59
⏳ 甄選至 2026/09/10 23:59
⏳ 資料繳交至 2026/09/10 23:59
⏳ 最近期限 2026/09/10 23:59
```

- 每則訊息只顯示最近一個尚未到期的 deadline。
- 無法確認 deadline 用途時使用「最近期限」。
- 沒有 deadline 或已全部過期時省略整列。

#### 第六列：參與形式與地點

```text
🌐 線上
📍 台北南港展覽館 2 館
📍 新竹 · 同步提供線上參與
```

- 線上活動使用 `🌐`。
- 實體活動使用 `📍`。
- 混合活動以實體地點為主，附「同步提供線上參與」。
- 只知道 `ONSITE` 但沒有地點時顯示 `📍 實體活動，地點請見官網`。
- 地點與形式都未知時省略整列。

#### 第七列：資格限制

只在有明確限制時顯示：

```text
👤 限高中職學生
👤 限女性參與者
👤 需通過 Pre-exam
```

公開活動不顯示 `👤 一般大眾`，避免增加沒有決策價值的文字。不得從主辦單位或活動名稱推測資格。

#### 完整範例：CTF

```text
[Holmes CTF 2026: The Reichenbach Directive](https://example.com/holmes-ctf)
🔴 紅隊 · CTF｜具基礎｜最多 5 人
🧩 Web、Pwn、Reverse
📅 2026/09/18 12:00～09/22 17:00（台灣時間）
🌐 線上
```

#### 完整範例：藍隊工作坊

```text
[DFIR 事件調查實戰工作坊](https://example.com/dfir-workshop)
🔵 藍隊 · 工作坊｜具基礎｜個人報名
🧩 DFIR、Windows、Threat Hunting
📅 2026/10/03 09:30～16:30（台灣時間）
⏳ 報名至 2026/09/25 23:59
📍 台北
```

#### 完整範例：紫隊活動

```text
[Atomic Red Team 偵測驗證實作](https://example.com/purple-team-lab)
🟣 紫隊 · 工作坊｜進階｜個人報名
🧩 Adversary Emulation、Detection Engineering
📅 2026/10/17 13:00～17:00（台灣時間）
📍 新竹 · 同步提供線上參與
```

#### 完整範例：綜合研討會

```text
[HITCON 2026](https://hitcon.org/2026/)
⚪ 綜合 · 研討會｜程度未標示｜個人報名
🧩 AI Security、Cloud Security、Threat Intelligence
📅 2026/08/21～08/22
📍 台北
```

#### 完整範例：只有截止資訊的培訓

```text
[臺灣好厲駭 2027 學員徵選](https://example.com/taiwan-holy-high)
⚪ 綜合 · 培訓｜進階｜個人申請
📅 活動日期請見官網
⏳ 甄選至 2026/11/30 18:00
👤 需符合官方徵選資格
```

最後一個範例中的資格文字只能在官方資料確實描述資格時使用；如果只知道「學員徵選」而沒有資格內容，資格列必須省略。

### 去重策略確定版

同一活動可能同時出現在 CTFtime、Taiwan Security Deadlines 與主辦單位網站。去重依序使用：

1. 完全相同或正規化後相同的官方 URL。
2. CTFtime event ID。
3. 正規化標題、年份及活動開始日。
4. 正規化標題、主辦單位與最近 deadline。

來源合併時，官方主辦頁的活動時間優先；CTFtime 的精確競賽起訖時間次之；Taiwan Security Deadlines 的 deadline 與地點補入同一筆。不同來源提供衝突時間時不自行選擇，記錄衝突並跳過自動公告。

### 實作檔案總表

| 檔案 | 動作 | 職責 |
| --- | --- | --- |
| `src/event-model.js` | 新增 | 正規化、驗證、合併與跨來源去重 |
| `src/event-classifier.js` | 新增 | 方向、topics、程度與證據 |
| `src/event-sources/taiwan-deadlines.js` | 新增 | 臺灣期限 YAML adapter |
| `src/event-feed.js` | 修改 | 編排三個正式來源並回報逐來源狀態 |
| `src/event-publisher.js` | 修改 | 新公告格式、deadline 與地點 |
| `src/config.js` | 修改 | 新來源開關、URL 與來源限制 |
| `data/event-source-registry.json` | 新增 | 臺灣主辦單位與週期事件監控名冊 |
| `src/syndication-feed.js` | 新增 | 通用 RSS／Atom 解析 |
| `data/news-source-registry.json` | 新增 | 精選新聞來源與生命週期狀態 |
| `src/source-health.js` | 新增 | 失敗隔離、過期與恢復判斷 |
| `test/taiwan-deadlines.test.js` | 新增 | YAML adapter 測試 |
| `test/event-classifier.test.js` | 新增 | 可解釋分類測試 |
| `test/event-model.test.js` | 新增 | 合併與去重測試 |
| `test/syndication-feed.test.js` | 新增 | RSS／Atom 測試 |
| `test/source-health.test.js` | 新增 | 來源生命週期測試 |

### 驗收條件

完成上述功能必須同時滿足：

1. 能從 Taiwan Security Deadlines 解析至少名稱、官方 URL、deadline、時區、地點及 attendance。
2. 舊年度資料不會被公告，未來 deadline 能正確換算成台灣時間。
3. 三個正式活動來源任一失敗不影響另外兩個。
4. 同一活動出現在兩個來源時只公告一次，且欄位能互補。
5. 紫隊只在明確攻防協作證據存在時出現。
6. 沒有官方隊伍人數時顯示「人數未公開」，不以報名人數代替。
7. 新聞 RSS 首批來源全部先進 observation 狀態，不會部署後立刻灌入新聞頻道。
8. `/events_status` 能列出各正式來源最後成功時間、讀取筆數與最近錯誤。
9. 所有 parser 使用固定 fixture 測試，不依賴測試當下的外部網路。
10. 部署前完整測試通過，並用一次 live dry-run 顯示將公告的內容而不實際發送。

### 原子化提交順序

1. `refactor(automation): normalize security event records`
2. `feat(automation): classify security event audiences`
3. `feat(automation): ingest Taiwan security deadlines`
4. `feat(automation): publish enriched security events`
5. `feat(automation): register Taiwan security organizers`
6. `feat(automation): parse RSS and Atom news feeds`
7. `feat(automation): monitor external source health`
8. `docs(automation): document expanded security sources`

活動來源與新聞 RSS 分成不同提交及部署階段；不能在同一次部署同時擴大兩個頻道的輸入量。

## 1. goodjack/awesome-cs-training

### 專案定位

這是一份以臺灣高中生為出發點的資訊培訓資源彙整，內容橫跨試題、教材、工具、社群、學校資源、競賽、營隊、課程與研討會。它不是純資安資料庫，也不是持續更新的活動 API。

授權為 CC BY 4.0。若重製其整理內容，必須保留適當姓名標示；只把它作為官方入口探索清單仍應在文件中註明來源。

### 可借鑑內容

- 以「競賽」及「營隊／課程／研討會」分開整理，提醒我們活動類型不能只分為 CTF 與社群。
- 依月份列出週期性活動，可用於建立年度監控提示，例如 AIS3 MyFirstCTF、AIS3 EOF、金盾獎與各種學生競賽。
- 收錄學生社群、學校資源、Discord、Facebook 與官方網站，可補充目前只依賴 CTFtime、OWASP 的盲區。
- 其讀者定位能協助建立受眾分類：高中職、初學者、一般學生、公開參與者。
- 適合產生「每年到了某個月份，檢查官方頁是否已公布新一屆活動」的監控種子。

### 建議整合方式

- 不直接解析整份 README 來產生活動。
- 人工挑選資安相關且仍有效的主辦單位與活動官網，寫入本專案自己的來源登錄檔。
- 對週期性活動保存 `usualAnnouncementMonth`，到期時檢查官方網站，而不是直接沿用過往日期。
- 對學生限定活動保存 `audience`，例如 `high_school`、`university` 或 `open`。

### 限制與風險

- 大量內容與資安無關，若整包接入會造成噪音。
- 月份資料可能只是歷史規律，不代表當年度一定舉辦。
- 部分來源是 Facebook、Discord 或存檔頁，無法穩定自動擷取。
- 多數條目缺少完整年份、時區、截止時間與隊伍人數。
- 不應從「曾經適合高中生」推定今年活動仍有相同資格限制。

### 採用決策

作為學生向活動與主辦單位的補充探索名冊，不作為直接公告來源。

## 2. stwater20/taiwan-security-deadlines

### 專案定位

這是目前最符合本活動雷達需求的專案。它專門記錄臺灣資安教育活動的報名或徵件截止時間，收錄 AIS3、AIS3 Junior、MyFirstCTF、臺灣好厲駭、HITCON、CYBERSEC、金盾獎與全國技能競賽等。

專案採 MIT 授權，核心資料位於 `_data/conferences.yml`，另提供全部、實體與線上活動的 iCal。其維護規則要求附官方公告來源，適合成為可信的臺灣活動候選源。

### 可借鑑內容

- 結構化 YAML 欄位：`name`、`year`、`date`、`description`、`link`、`deadline`、`timezone`、`place`、`tags`、`comment`。
- `deadline` 支援多個期限，能表達預試、報名、繳件等不同階段。
- 明確區分時區，臺灣活動使用 `Asia/Taipei`，可避免跨日錯誤。
- 以 `ONLINE`、`ONSITE`、`EDU` 標記活動形式與教育性質。
- 收錄標準要求臺灣本地或與臺灣社群高度相關、有明確期限並附官方來源。
- 提供 iCal，證明活動期限可以被轉換為通用行事曆事件。
- 舊年度資料與新年度資料同時保留，可用於辨識週期性活動，但不能全部當作現在有效。

### 建議整合方式

優先讀取 GitHub Raw 上的 `_data/conferences.yml`，而不是先使用 iCal：

- YAML 保留活動說明、官方連結、地點、標籤及多重期限。
- iCal 主要表示截止日，若直接當活動開始時間會誤導使用者。
- 只保留當年度或仍有未到期 deadline 的項目。
- `date` 是顯示用自由文字，解析成功才填入 `startsAt`／`endsAt`；解析失敗時保留原文字並清楚標示「活動日期請見官網」。
- 每個 deadline 應保存自己的用途。若 `comment` 無法對應到個別期限，公告只能寫「最近期限」，不能自行聲稱是報名截止。
- 活動連結必須再檢查一次是否可連線及是否重新導向到無關頁面。

建議的穩定識別碼為：

```text
taiwan-deadlines:<year>:<normalized-name>:<deadline>
```

若同一活動有兩個 deadline，應視為同一活動的兩個里程碑，公告時合併顯示，資料庫則保留各期限避免重複通知。

### 適合新增的公告欄位

- 活動日期
- 最近報名／甄選／投稿期限
- 線上、實體或混合
- 地點
- 主辦單位與官方頁
- 受眾限制
- 技術方向與程度（必須由 description 或官方頁補證）

### 限制與風險

- `date` 不是標準時間格式，可能只有月份、日期區間或跨年度文字。
- `deadline` 不一定是報名截止，也可能是活動開始、投稿或資料繳交時間。
- 部分歷史項目缺少 `timezone`。
- 標籤目前不足以直接區分紅隊、藍隊、紫隊或難度。
- 資料由社群維護，最終仍要以主辦單位公告為準。

### 採用決策

列為下一個應實作的正式活動來源，與 CTFtime、OWASP 平行運作。來源失敗時不可阻斷其他來源。

## 3. Ice1187/TW-Security-and-CTF-Resource

### 專案定位

這是一份臺灣資安與 CTF 生態系索引，採 MIT 授權。它涵蓋學習資源、技術領域、CTF、Wargame、營隊、培訓計畫、社群、學校社團、活動、實習及其他機會。

### 可借鑑內容

- 技術分類可作為我們活動方向分類的詞彙基礎：Pwn、Web、Reverse、Crypto、Network、Fuzzing、Windows、Android、紅隊、工控、Web3、Cloud 等。
- CTF 名冊可補充臺灣或亞洲常見賽事，例如 BambooFox、Balsn、HITCON、AIS3、MyFirstCTF 與 CGGC。
- 營隊與培訓名冊可補充 AIS3 Junior、臺灣好厲駭、TeamT5 Security Camp、HITCON Training 等非 CTF 活動。
- 社群與學校社團名冊可建立官方監控入口，例如 SCIST、SCAICT、HITCON GIRLS、CHROOT、Balsn、BambooFox CSC、各校資安社。
- 活動名冊指出 `/dev/meet`、HITCON、DEVCORE Conference、CraftCon、TeamT5 威脅分析師高峰會、CYBERSEC 等臺灣活動。
- 其分類可協助建立「來源主辦者」與「活動內容」兩層標籤，避免把社群名稱直接當技術方向。

### 建議整合方式

- 將仍有效的官方入口人工整理為 `event-sources.json` 或等價設定檔。
- 每個入口記錄 `organizer`、`homepage`、`feedUrl`、`calendarUrl`、`eventPagePattern`、`audience` 與 `trustLevel`。
- 優先監控組織自己的網站、RSS、KKTIX 或 iCal；Facebook、Instagram、Discord 只作人工補充，不假設可穩定爬取。
- 技術分類可轉成活動方向規則，但只在活動頁明確提及時套用。

### 限制與風險

- 它是靜態資源索引，不包含標準化活動日期。
- 同一條目可能同時指向官網、Facebook、YouTube 或 Discord，不能任取一個作公告來源。
- 某些社群或活動可能已停止；清單存在不代表近期有活動。
- 紅隊相關資源較多，不能據此把所有列出的活動都判成紅隊。
- Facebook、Instagram 與 Discord 常需要登入，也可能限制自動存取。

### 採用決策

列為臺灣資安主辦單位與技術分類的主要探索名冊，不直接產生公告。

## 4. r0eXpeR/Security_RSS

### 專案定位

這是一份簡短的安全 RSS README 清單，主要分為漏洞、技術資訊與安全博客。倉庫內容簡單，沒有標準 OPML，也未看到明確授權。

### 可借鑑內容

- 將漏洞公告與一般技術資訊分開，可改善新聞來源分級。
- 包含 Exploit-DB、Packet Storm、GitHub Security Lab、The DFIR Report 等不同性質來源，可用來補足漏洞、攻擊研究與藍隊案例。
- 可由來源類型預先給定初步領域，例如漏洞資料庫、DFIR、紅隊研究、產業新聞，再由文章內容做最後判斷。
- 清單規模較小，適合人工逐一驗證，而不是大量匯入。

### 建議整合方式

- 只挑選與讀書會目標高度相關且仍可用的來源。
- 新來源先執行健康檢查：HTTPS、HTTP 狀態、有效 XML、更新時間、文章連結與重複率。
- 通過觀察期後才加入正式新聞池；觀察期內只記錄，不推送。
- RSSHub 產生的端點要與原站來源分開標示，避免第三方服務中斷時誤判原站失效。

### 限制與風險

- 未看到授權，不複製 README 或清單內容到本倉庫。
- 多個端點使用 RSSHub 或舊 HTTP URL，穩定性與供應鏈風險較高。
- 清單不提供最後成功時間、更新頻率或內容品質評分。
- RSS 文章不等於活動；不能直接送到活動頻道。

### 採用決策

只作為新聞來源候選，不接入活動雷達。

## 5. Han0nly/SecurityRSS

### 專案定位

這是一份網路安全 RSS 訂閱列表，並提供 `SecureRss.opml`。內容包含安全組織、媒體、研究者、開發及其他來源，也收錄 CTFtime upcoming RSS。未看到明確授權。

### 可借鑑內容

- OPML 是機器可讀的來源交換格式，可供來源匯入器參考。
- 依安全組織、Hackers、開發及其他類別分組，表示來源本身需要分類，而不是全部視為同質新聞。
- 同時保存網站首頁與 RSS URL，便於來源故障時回到官方頁查證。
- 把已停止維護的來源移除或註記，是來源生命週期管理的重要概念。
- CTFtime RSS 可作為 API 的備援訊號，但不能與 API 結果重複公告。

### 建議整合方式

- 若未來實作 OPML 匯入，只將它視為候選來源輸入，不直接啟用。
- OPML 匯入後建立來源審核狀態：`candidate`、`observing`、`active`、`quarantined`、`retired`。
- 同一網域的多個 feed 先合併評估，避免重複文章。
- 對 CTFtime RSS 與既有 CTFtime API 做 URL 或活動 ID 去重。

### 限制與風險

- 清單中含大量 HTTP、FeedBurner、舊部落格與可能失效的站點。
- 更新時間與來源健康狀態不是即時資料。
- 部分來源偏一般新聞、隱私或開發，不一定符合讀書會研究方向。
- 未看到授權，不複製其 OPML 或程式內容。

### 採用決策

借鑑 OPML 匯入與來源生命週期概念；只選少數來源進入新聞候選池。

## 6. arch3rPro/SecurityRSS

### 專案定位

這是一套較大型的安全 RSS／OPML 集合，提供完整、精簡與微信來源三種套件。README 表示完整版約 378 個來源、精簡版約 140 個、微信擴充約 238 個，並將來源分為安全資訊、博客論壇、官網文章、國外博客、漏洞庫、漏洞預警、實驗室團隊、武器工具庫、CTF／靶場及微信等。未看到明確授權。

### 可借鑑內容

- 「完整包／精簡包／特殊平台包」的分級方式，可轉化為本 Bot 的來源層級。
- 精簡版概念適合我們：少量高訊號來源優於數百個未篩選來源。
- README 對來源標記 `online`，可延伸成自動健康狀態與最近成功時間。
- 依內容性質分組可作為新聞預分類，降低後續 AI 或規則判斷負擔。
- 定期刪除長期未更新來源的做法，適合加入維護流程。

### 建議整合方式

建立自己的小型來源登錄檔，不整包匯入：

```text
source id
display name
feed URL
homepage
language
region
content categories
default team direction
trust level
last successful fetch
last meaningful article
status
```

新增來源時先觀察文章品質與重複率。只有能穩定產生讀書會會讀的內容，才升級為 active。

### 限制與風險

- 數百個來源會提高網路請求、解析失敗、重複新聞與 AI 成本。
- `online` 只代表某次檢查可用，不代表內容仍有價值。
- 微信或 RSSHub 類來源高度依賴第三方轉接服務。
- 大量來源以中國大陸安全媒體為主，不一定符合臺灣讀書會需求。
- 未看到授權，不直接複製 OPML。

### 採用決策

採用「精簡來源包、分類、健康狀態、淘汰機制」的設計，不採用整包來源。

## 7. weiyongsheng1124/MoltbotAP-security

### 專案定位

這是一個每日資安新聞 Telegram Bot。README 描述其從 BleepingComputer、The Hacker News、SecurityWeek、iThome 與 iThome 資安抓取新聞，每天 08:00 發送；倉庫根目錄包含 `server.js`、`package.json` 與 `SKILL.md`。未看到明確授權。

### 可借鑑內容

- 中英文來源分組，適合加入我們的來源語言與地區欄位。
- 將多個新聞來源聚合到單一排程，再發送到聊天平台，與本專案的基本流程相似，可作為功能完整性檢查表。
- 部署文件使用環境變數保存 Bot token 與目的地 ID，與我們目前做法一致。
- 固定每日發送模式可與我們的輪詢加每日檢查點設計比較。
- 它選擇的五個來源可列入新聞來源候選，但仍應逐一做健康與品質檢查。

### 不應直接照搬的部分

- README 沒描述持久化去重、來源部分失敗、訊息品質篩選、速率限制、狀態查詢或測試策略，不能假設其已處理。
- Telegram 的訊息與權限模型不同於 Discord，不能直接移植傳送層。
- 爬取網站 HTML 比官方 RSS 更脆弱，應先確認每個站是否有 RSS 或其他正式介面。
- 未看到明確授權，不複製其程式碼。
- 它是新聞 Bot，不提供臺灣活動資料，也不能解決活動方向、程度和參與人數分類。

### 採用決策

只用作排程、多來源與部署流程的比較案例，不作為活動來源，也不直接移植程式。

## 建議的來源架構

### A. 正式活動來源

資料足以直接形成活動公告：

- CTFtime API
- OWASP 官方 `events.yml`
- Taiwan Security Activity Deadlines `_data/conferences.yml`

各來源採獨立 adapter；其中一個失敗時，其他來源仍繼續。每次執行應記錄各來源抓取數量、錯誤、延遲及最後成功時間。

### B. 官方主辦單位監控

由兩份臺灣資源清單建立監控名冊，但活動必須回到官方頁確認：

- HITCON
- DEVCORE 與 `/dev/meet`
- TeamT5
- AIS3 系列
- NICS
- SCIST、SCAICT
- BambooFox、Balsn
- 各校資安社團
- CYBERSEC、CraftCon 等會議

每個來源優先尋找 RSS、iCal、KKTIX 或結構化資料。若只有社群平台，標示為人工監控，不建立不穩定的登入爬蟲。

### C. 新聞 RSS 候選池

三份 RSS 清單只用來發現新聞來源。來源先進入觀察期，評估：

- 最近 90 天是否仍更新
- HTTP 與 XML 是否穩定
- 是否提供永久文章 URL
- 與現有來源的重複率
- 能否提供足夠正文供篩選
- 紅隊、藍隊、紫隊或研究主題的命中率
- 廣告、轉載與低品質文章比例

### D. 活動候選偵測

新聞或社群貼文只有同時出現以下資訊，才可升級成活動候選：

- 明確活動名稱
- 未來日期或報名截止時間
- 官方主辦或活動頁
- 可辨識的活動類型

候選仍需經過欄位驗證；缺日期或只引用二手消息時不自動推送。

## 建議的標準活動資料模型

```json
{
  "id": "來源內穩定識別碼",
  "source": "ctftime | owasp | taiwan-deadlines | organizer",
  "sourceUrl": "實際取得資料的網址",
  "officialUrl": "活動或報名官方頁",
  "title": "活動名稱",
  "organizer": "主辦單位",
  "kind": "competition | training | conference | meetup | workshop | cfp",
  "startsAt": "ISO 8601 或 null",
  "endsAt": "ISO 8601 或 null",
  "dateText": "無法標準化時保留的官方日期文字",
  "deadlines": [
    { "at": "ISO 8601", "kind": "registration | submission | selection | unknown" }
  ],
  "timeZone": "IANA time zone",
  "attendance": "online | onsite | hybrid | unknown",
  "location": "地點或空字串",
  "directions": ["red | blue | purple | general | unspecified"],
  "level": "beginner | foundational | advanced | unspecified",
  "participation": "individual | team | either | unspecified",
  "teamSizeMin": null,
  "teamSizeMax": null,
  "audience": ["public"],
  "evidence": {
    "direction": "判定方向的原文或欄位",
    "level": "判定程度的原文或欄位",
    "teamSize": "判定人數的原文或欄位"
  }
}
```

`evidence` 很重要：它讓我們知道分類從何而來，也能避免模型或關鍵字把活動誤標。

## 方向、程度與參與方式

### 活動方向

- 紅隊：Web、Pwn、漏洞利用、滲透測試、逆向、攻擊研究。
- 藍隊：SOC、DFIR、事件應變、威脅獵捕、惡意程式分析、防禦工程。
- 紫隊：活動明確要求攻擊模擬與偵測驗證協作，例如 adversary emulation、detection engineering、Atomic Red Team。
- 綜合：已有足夠內容可確認是多軌研討會、綜合課程或一般社群活動。
- 未標示：來源資訊不足，無法判斷方向；不能用綜合代替未知。

同時含紅隊與藍隊議程時可標兩個方向；只有真正整合攻擊驗證與防禦改進時才標紫隊。

### 適合程度

- 入門：明確寫明零基礎、初學者、Junior、MyFirst 或有完整入門教學。
- 具基礎：要求基本 Linux、程式、網路或資安概念。
- 進階：要求實戰經驗、選拔、資格賽、研究發表或高階技術。
- 未標示：沒有足夠證據。

### 參與人數

- 只採用官方明確寫出的個人制、隊伍制或人數上下限。
- 參賽隊伍數、報名人數、Discord 成員數都不能當隊伍上限。
- 沒有明確資料時顯示「人數未公開」，不能推估。

## 實作順序建議

1. 新增 `taiwan-security-deadlines` YAML adapter，保留 deadline、活動日期文字、地點與線上／實體標籤。
2. 擴充活動資料模型與 Discord 格式，分開顯示活動日期和最近期限。
3. 實作可解釋的方向、程度、參與方式分類，證據不足時回傳未知。
4. 從兩份臺灣資源清單建立小型、人工審核的主辦單位登錄檔。
5. 建立 RSS 候選來源健康檢查和觀察期，不立即擴大正式來源。
6. 增加來源級狀態與 `/events_status` 統計，能看見每個來源最後成功、錯誤與新增數量。

## 來源與授權備註

- `goodjack/awesome-cs-training`：CC BY 4.0。
- `stwater20/taiwan-security-deadlines`：MIT。
- `Ice1187/TW-Security-and-CTF-Resource`：MIT。
- `r0eXpeR/Security_RSS`：研究時未看到明確授權。
- `Han0nly/SecurityRSS`：研究時未看到明確授權。
- `arch3rPro/SecurityRSS`：研究時未看到明確授權。
- `weiyongsheng1124/MoltbotAP-security`：研究時未看到明確授權。

授權狀態可能變更；真正複製程式或資料前必須再次確認指定版本的 LICENSE。
