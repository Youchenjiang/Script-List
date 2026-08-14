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

- 關注主題
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

#### 步驟 1：關注主題（可複選）

- `zero_day`：零日漏洞或尚無完整修補的攻擊
- `critical_vulnerability`：重大或高風險漏洞
- `ransomware`：勒索軟體與勒索組織活動
- `data_breach`：資料外洩或大規模帳號暴露
- `supply_chain`：軟體、套件或服務供應鏈攻擊
- `apt`：APT 或國家級威脅活動
- `cloud_identity`：雲端、身分、存取權與憑證安全
- `malware_campaign`：具實際影響的惡意程式活動

至少選擇一項。

#### 步驟 2：嚴重程度（單選）

- `critical_only`：只接收重大事件
- `high_or_above`：高風險以上（建議）
- `medium_or_above`：中風險以上
- `any`：不限制嚴重程度

嚴重程度只在文章提供足夠證據時使用，不得由 AI 猜測 CVSS 或影響程度。

#### 步驟 3：地區範圍（單選）

- `taiwan_priority`：台灣相關事件，以及全球重大事件（建議）
- `taiwan_only`：必須明確影響台灣
- `global`：全球事件，不限制地區

#### 步驟 4：排除內容（可複選）

- `advertisement`：產品廣告或置入內容
- `event_promotion`：活動、研討會或課程宣傳
- `routine_update`：沒有安全事件的一般產品更新
- `opinion_only`：缺少具體事件或證據的純評論
- `research_without_impact`：尚未呈現實際風險的概念性研究

提供 `使用建議排除項目` 與 `不排除` 選項。

#### 步驟 5：AI 信心門檻（單選）

- `0.90`：嚴格，推送較少
- `0.80`：平衡（建議）
- `0.70`：寬鬆，可能增加誤判

#### 步驟 6：補充條件（選填）

提供 `新增補充條件` 與 `略過`。只有選擇新增時才開啟文字輸入框，例如：

```text
CISA 已知遭利用漏洞一律推送；排除只影響已停止支援產品的事件。
```

補充條件是受控規則的一部分，不會取代系統指令，也不能改變輸出格式或要求 Bot 執行其他動作。

### 3. 預覽與確認

儲存前顯示完整摘要：

```text
主題：零日漏洞、重大漏洞、勒索軟體、供應鏈攻擊
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
  "schemaVersion": 1,
  "topics": ["zero_day", "supply_chain"],
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

AI 必須回傳固定格式：

```json
{
  "matches": true,
  "confidence": 0.91,
  "severity": "critical",
  "regionRelevance": "global_major",
  "matchedCriteria": ["zero_day"],
  "matchedExclusions": [],
  "evidence": ["摘要指出漏洞已遭實際利用"],
  "reason": "符合零日漏洞與高風險條件"
}
```

程式只有在以下條件全部成立時才允許推送：

1. `matches` 為 `true`
2. `confidence` 大於或等於規則門檻
3. `matchedCriteria` 至少包含一個使用者選擇的主題
4. `severity` 通過使用者選擇的嚴重程度門檻
5. `regionRelevance` 通過使用者選擇的地區範圍
6. `evidence` 至少包含一項文章內可驗證的依據
7. 未命中任何使用者選擇的排除條件

任何欄位缺失、格式錯誤、AI 呼叫失敗或證據不足，結果均視為拒絕。

## Discord 指令

- `/news_rule setup`：開始互動式設定
- `/news_rule show`：顯示目前規則與版本
- `/news_rule clear`：停用規則；清除也必須增加版本
- `/news_rule test`（第二階段）：以近期文章測試規則，只顯示判斷，不實際推送
- `/news_status`：顯示上次抓取、AI 判斷、符合、拒絕與推送數量

規則管理指令只允許具「管理伺服器」權限者使用，且只能在設定的新聞頻道操作。互動元件只接受啟動設定流程的使用者操作。

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
- `/news_rule test` 不會新增已推送紀錄，也不會發送公開訊息。

## 實作範圍建議

第一階段先完成 `setup`、`show`、`clear`、結構化儲存、AI 判斷契約與推送門檻；第二階段再加入 `/news_rule test` 與更細緻的選項。如此可先交付完整且安全的主要流程，同時控制單次改動規模。
