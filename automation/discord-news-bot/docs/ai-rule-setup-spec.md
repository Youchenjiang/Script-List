# Discord AI 新聞規則設定規格

## 目標

讓具「管理伺服器」權限的使用者，不需要了解 prompt 或記住參數，即可在 Discord 中完成新聞篩選規則設定。Bot 必須先展示有哪些設定面向與可用選項，再逐步引導選擇。

AI 僅負責依固定規則判斷文章；最終是否推送仍由程式檢查結構化結果與信心門檻。沒有有效規則、AI 無法使用或結果不完整時，一律不推送。

## 使用者流程

### 1. 開始設定

使用者只需執行：

```text
/news_rule setup
```

Bot 先以 ephemeral 訊息顯示設定總覽，讓使用者在開始前知道會設定：

- 事件類型
- 技術領域
- 讀書會共用研究方向
- 嚴重程度
- 地區範圍
- 排除內容
- AI 信心門檻
- 選填的補充條件

起始畫面提供三個按鈕：

- `使用建議設定`：直接產生推薦規則並進入預覽
- `逐步自訂`：進入互動式設定
- `取消`

### 2. 逐步自訂

每一步都必須直接列出可選項與簡短說明，不要求使用者自行猜測允許值。

#### 步驟 1：事件類型（可複選）

- `zero_day`：零日漏洞或尚無完整修補的攻擊
- `critical_vulnerability`：重大或高風險漏洞
- `ransomware`：勒索軟體與勒索組織活動
- `data_breach`：資料外洩或大規模帳號暴露
- `supply_chain`：軟體、套件或服務供應鏈攻擊
- `apt`：APT 或國家級威脅活動
- `identity_compromise`：帳號接管、憑證竊取、權限濫用或身分系統遭入侵
- `malware_campaign`：具實際影響的惡意程式活動

至少選擇一項。

#### 步驟 2：技術領域（可複選）

- `any`：不限技術領域
- `endpoint_os`：Windows、Linux、macOS 與端點裝置
- `identity_access`：IAM、Active Directory、SSO、OAuth 與憑證
- `cloud_containers`：公有雲、Kubernetes、Docker、Serverless 與雲端控制面
- `web_api`：網站、Web 應用、API、瀏覽器與應用伺服器
- `network_infrastructure`：路由器、防火牆、VPN、DNS、郵件與邊界設備
- `developer_ecosystem`：程式語言、套件管理器、CI/CD、原始碼與開發工具
- `data_platform`：資料庫、搜尋、儲存、分析與資料處理平台
- `mobile`：Android、iOS 與行動應用程式
- `ai_ml`：模型、推論服務、Agent、MLOps 與 AI 開發框架
- `iot_ot`：物聯網、工控、醫療設備與嵌入式系統

至少選擇一項；選擇 `any` 時忽略其他技術選項。事件類型描述「發生什麼事」，技術領域描述「影響什麼技術」，兩者必須分開判斷。

#### 步驟 3：讀書會共用研究方向（可複選）

- `vulnerability_research`：漏洞成因、利用技術、PoC 與攻擊面分析
- `threat_intelligence`：攻擊者、攻擊活動、TTP 與情資關聯
- `malware_reverse`：惡意程式行為、逆向工程與樣本分析
- `detection_engineering`：日誌、偵測規則、獵捕方法與可觀測性
- `incident_response`：應變流程、調查證據、鑑識與復原
- `application_security`：Web、API、供應鏈與安全開發生命週期
- `cloud_identity_security`：雲端控制面、IAM、SSO 與權限治理
- `security_engineering`：防禦架構、系統設計、工具與自動化
- `governance_risk`：風險管理、政策、法規與組織衝擊
- `ai_security`：模型、Agent、提示攻擊與 AI 系統防護

至少選擇一項。這些方向不取代新聞過濾條件，而是讓公開閱讀卡呈現文章與讀書會各研究方向的關聯程度。

#### 步驟 4：嚴重程度（單選）

- `critical_only`：只接收重大事件
- `high_or_above`：高風險以上（建議）
- `medium_or_above`：中風險以上
- `any`：不限制嚴重程度

嚴重程度只在文章提供足夠證據時使用，不得由 AI 猜測 CVSS 或影響程度。

#### 步驟 5：地區範圍（單選）

- `taiwan_priority`：台灣相關事件，以及全球重大事件（建議）
- `taiwan_only`：必須明確影響台灣
- `global`：全球事件，不限制地區

#### 步驟 6：排除內容（可複選）

- `advertisement`：產品廣告或置入內容
- `event_promotion`：活動、研討會或課程宣傳
- `routine_update`：沒有安全事件的一般產品更新
- `opinion_only`：缺少具體事件或證據的純評論
- `research_without_impact`：尚未呈現實際風險的概念性研究

提供 `使用建議排除項目` 與 `不排除` 選項。

#### 步驟 7：AI 信心門檻（單選）

- `0.90`：嚴格，推送較少
- `0.80`：平衡（建議）
- `0.70`：寬鬆，可能增加誤判

#### 步驟 8：補充條件（選填）

提供 `新增補充條件` 與 `略過`。只有選擇新增時才開啟文字輸入框，例如：

```text
CISA 已知遭利用漏洞一律推送；排除只影響已停止支援產品的事件。
```

補充條件是受控規則的一部分，不會取代系統指令，也不能改變輸出格式或要求 Bot 執行其他動作。

### 3. 預覽與確認

儲存前顯示完整摘要：

```text
事件類型：零日漏洞、重大漏洞、勒索軟體、供應鏈攻擊
技術領域：雲端與容器、Web 與 API
研究方向：漏洞研究與利用、威脅情報、偵測工程、雲端與身分安全
嚴重度：高風險以上
地區：台灣優先＋全球重大事件
排除：廣告、活動宣傳、一般產品更新
AI 信心門檻：80%
補充條件：CISA 已知遭利用漏洞一律推送
```

提供：

- `確認儲存`
- `返回修改`
- `取消`

只有按下確認後才更新正式規則。取消或逾時不得覆蓋目前生效的規則。

## 建議設定

```json
{
  "topics": [
    "zero_day",
    "critical_vulnerability",
    "ransomware",
    "supply_chain"
  ],
  "technologies": ["any"],
  "researchAreas": [
    "vulnerability_research",
    "threat_intelligence",
    "malware_reverse",
    "detection_engineering",
    "incident_response",
    "application_security",
    "cloud_identity_security",
    "security_engineering"
  ],
  "minimumSeverity": "high_or_above",
  "regionScope": "taiwan_priority",
  "exclusions": [
    "advertisement",
    "event_promotion",
    "routine_update"
  ],
  "confidenceThreshold": 0.8,
  "notes": ""
}
```

## 儲存格式

規則以結構化 JSON 保存，而不是只保存一段 prompt：

```json
{
  "schemaVersion": 3,
  "topics": ["zero_day", "supply_chain"],
  "technologies": ["cloud_containers", "developer_ecosystem"],
  "researchAreas": ["vulnerability_research", "detection_engineering"],
  "minimumSeverity": "high_or_above",
  "regionScope": "taiwan_priority",
  "exclusions": ["advertisement", "routine_update"],
  "confidenceThreshold": 0.8,
  "notes": "CISA 已知遭利用漏洞一律推送",
  "version": 3,
  "updatedBy": "DISCORD_USER_ID",
  "updatedAt": "ISO-8601"
}
```

每次確認儲存或清除規則都必須增加 `version`。AI 判斷快取以文章 ID、頻道 ID、規則版本、Base URL、模型與判斷契約版本為鍵，避免沿用舊規則或舊供應商的結果。

## AI 判斷契約

定時評估分成兩階段。第一階段只回傳 `matches`、`confidence`、`severity`、`regionRelevance`、`reason`、`readingRecommendation`、三種比對結果與 `evidence`；只有 `matches=true` 且 `readingRecommendation=must_read` 時，第二階段才產生公開敘事與技術細節。程式合併兩階段後，最終結果必須符合下列固定格式：

```json
{
  "matches": true,
  "confidence": 0.91,
  "severity": "critical",
  "regionRelevance": "global_major",
  "matchedCriteria": ["zero_day"],
  "matchedTechnologies": ["cloud_containers"],
  "matchedExclusions": [],
  "evidence": ["文章指出漏洞已遭實際利用"],
  "reason": "符合零日漏洞與高風險條件",
  "readingRecommendation": "must_read",
  "headline": "雲端管理介面的零日漏洞已遭利用",
  "publicSummary": "八月中旬，研究團隊在檢查一套公開的雲端管理介面時發現異常登入，追查後確認攻擊者先利用身分驗證缺強取得介面存取權，再建立高權限帳號並控制伺服器。供應商在事件公開後封鎖異常帳號，遭入侵的伺服器也已隔離並保存證據。",
  "technicalFocus": ["身分驗證狀態檢查", "高權限帳號建立"],
  "technicalOutcome": "攻擊者完成攻擊鏈後取得管理權限，並建立可持續存取受感染伺服器的高權限帳號。",
  "attackChainGroups": [
    {
      "title": "驗證缺陷如何轉成系統控制權",
      "steps": [
        {
          "stage": "鎖定入口",
          "action": "攻擊者探測公開管理介面",
          "mechanism": "以特製請求辨認身分驗證端點",
          "result": "找出可接受惡意驗證資料的入口"
        },
        {
          "stage": "取得存取權",
          "action": "攻擊者送入異常驗證資料",
          "mechanism": "服務錯誤接受未授權的驗證狀態",
          "result": "攻擊者進入管理介面"
        },
        {
          "stage": "建立持久性",
          "action": "攻擊者新增高權限帳號",
          "mechanism": "利用管理功能寫入新的帳號資料",
          "result": "產生可持續登入的管理身分"
        },
        {
          "stage": "控制系統",
          "action": "攻擊者以新帳號操作伺服器",
          "mechanism": "管理權限允許修改系統設定",
          "result": "受感染伺服器遭攻擊者控制"
        }
      ]
    }
  ],
  "evidenceBoundaries": [
    {
      "status": "confirmed_capability",
      "claim": "驗證缺陷可讓未授權使用者進入管理介面"
    },
    {
      "status": "confirmed_victim",
      "claim": "受感染伺服器已發現攻擊者建立的高權限帳號"
    }
  ],
  "exploitationStatus": "confirmed_exploitation",
  "confirmedConsequences": [
    "攻擊者已取得管理權限並建立新帳號",
    "供應商已撤回受污染版本",
    "遭入侵的伺服器已隔離"
  ],
  "difficulty": "advanced",
  "researchRelevance": [
    {
      "area": "vulnerability_research",
      "relevance": "high",
      "reason": "包含漏洞成因與利用條件"
    },
    {
      "area": "detection_engineering",
      "relevance": "medium",
      "reason": "提供可轉換為偵測邏輯的行為線索"
    }
  ]
}
```

`readingRecommendation` 只能是 `must_read`、`recommended`、`skim` 或 `skip`，但程式只推送 `must_read`。`headline` 必須是自然的繁體中文標題。`publicSummary` 必須以 180 至 500 個繁體中文字，依時間順序用連貫敘事交代人、事、時、地、物、攻擊或發現經過、技術效果、已確認後果與事件收尾；不得使用列點、小標題、未來推演、處置建議或重複的閱讀判斷。

`technicalFocus` 必須使用一至四個具體技術詞組，不能使用「重大漏洞」或「網路安全」等泛用分類。`technicalOutcome` 直接說明攻擊鏈完成後造成的權限、控制能力、資料結果或服務結果。`attackChainGroups` 將不同性質的攻擊階段分成最多兩條相接的鏈，每組至少兩步、合計至少四步；每一步都必須交代動作者與動作、處理機制及交給下一步的結果。`evidenceBoundaries` 則使用 `confirmed_capability`、`confirmed_impact`、`confirmed_exposure`、`confirmed_victim`、`not_confirmed` 或 `unknown`，區分已證實能力、已確認影響、實際曝露環境、確認受害者與尚未確認事項。

只有 `must_read` 會進入第二階段，且 `confirmedConsequences` 至少要有一項文章可核對的實際結果，可以是後門已證實具備的能力、已發生的入侵／外洩／中斷，或事件後已完成的撤回與封鎖。其他閱讀判斷在第一階段結束後直接轉成安全拒絕，不要求模型浪費輸出生成空白文案。`exploitationStatus` 只能是 `confirmed_exploitation`、`attempted_exploitation`、`no_confirmed_exploitation` 或 `not_reported`；只有原文明確表示沒有成功利用證據時，才能使用 `no_confirmed_exploitation`。`difficulty` 只能是 `beginner`、`intermediate`、`advanced` 或 `specialist`。`researchRelevance.area` 只能引用目前頻道規則選取的研究方向。

程式只有在以下條件全部成立時才允許推送：

1. `matches` 為 `true`
2. `confidence` 大於或等於規則門檻
3. `matchedCriteria` 至少包含一個使用者選擇的主題
4. 技術領域不是 `any` 時，`matchedTechnologies` 至少包含一個使用者選擇的技術
5. `severity` 通過使用者選擇的嚴重程度門檻
6. `regionRelevance` 通過使用者選擇的地區範圍
7. `evidence` 至少包含一項文章內可驗證的依據
8. 未命中任何使用者選擇的排除條件
9. `readingRecommendation` 必須是 `must_read`

任何欄位缺失、格式錯誤、AI 呼叫失敗或證據不足，結果均視為拒絕。

## Discord 指令

- `/news_rule setup`：開始互動式設定
- `/news_rule show`：由任何頻道成員公開顯示目前規則與版本
- `/news_rule clear`：停用規則；清除也必須增加版本
- `/news_rule test`（第二階段）：以近期文章測試規則，只顯示判斷，不實際推送
- `/news_status`：顯示上次抓取、AI 判斷、符合、拒絕與推送數量

`setup` 與 `clear` 只允許具「管理伺服器」權限者使用，`show` 開放所有頻道成員。指令只能在設定的新聞頻道操作，互動元件只接受啟動設定流程的管理者操作。設定確認後，Bot 必須在公開頻道張貼版本與完整規則，讓所有成員知道目前的共同篩選與研究方向。

## 設定工作階段

- 未確認的選擇只保存在暫存工作階段，不寫入正式規則。
- 工作階段需設定逾時時間；逾時後提示重新執行 `/news_rule setup`。
- Bot 重啟造成工作階段遺失時，不得影響目前正式規則。
- 同一使用者重新開始設定時，以新工作階段取代自己的舊工作階段。

## 驗收條件

- 新使用者只輸入 `/news_rule setup` 就能看見所有設定面向。
- 使用者可完全透過選單與按鈕完成推薦設定，不必輸入 prompt。
- 自訂流程會逐步顯示所有允許值及說明。
- 儲存前一定有預覽與確認步驟。
- 取消、逾時或 Bot 重啟不會破壞現有規則。
- AI 結果未通過程式硬性檢查時不會推送。
- 規則更新後不會沿用上一版本的 AI 快取。
- 公開推送不顯示「必讀」或其他閱讀判斷，只包含繁體中文標題、足以獨立理解事件的敘事、具體技術焦點、閱讀門檻與操作按鈕，不產生泛用 hashtag。
- 「查看技術細節」使用 ephemeral 回覆，不建立討論串；內容必須從最早可證實入口一路接到最終技術結果，並逐步呈現動作、機制與結果。
- 技術細節必須分開呈現攻擊鏈階段與證據邊界，不得把「已證實具備能力」誤寫成「已有確認受害者」。
- 除產品名稱、漏洞編號與沒有通行中文譯名的縮寫外，公開文字不得中英逐句混雜，也不得殘留 HTML entity。
- 敘事必須寫出事件已確認造成的結果，並嚴格區分「攻擊能力已證實」與「已有受害者」；未報導利用狀態時不得自行宣稱沒有受害者。
- Feed 有文章內容時以內容分析；只有摘要時必須在閱讀卡標明分析依據為來源摘要。
- `/news_rule test` 不會新增已推送紀錄，也不會發送公開訊息。

## 實作範圍建議

第一階段先完成 `setup`、`show`、`clear`、結構化儲存、AI 判斷契約與推送門檻；第二階段再加入 `/news_rule test` 與更細緻的選項。如此可先交付完整且安全的主要流程，同時控制單次改動規模。
