# OpenAI Chat CLI

命令列 OpenAI 對話工具,支援自訂對話風格,包含獨特的諸葛亮人設。

## 功能特色

- **互動式對話**: 保留上下文的連續對話
- **多種風格**: 切換不同對話人設
  - 預設: 標準助手
  - 諸葛亮: 古代軍師,使用文言文風格
- **多語言支援**: 繁體中文、簡體中文、英文
- **對話記憶**: 維持多輪對話的上下文
- **命令列參數**: 靈活的 CLI 設定
- **環境變數**: 安全的 API 金鑰管理

## 環境需求

- Python 3.7+
- OpenAI API 金鑰

## 安裝步驟

1. 進入工具目錄:
```bash
cd openai-chat-cli
```

2. 安裝依賴套件:
```bash
pip install -r requirements.txt
```

3. 設定 API 金鑰 (選擇一種方式):

**方法 1: 環境變數 (建議)**
```bash
# Windows PowerShell
$env:OPENAI_API_KEY="your-api-key-here"

# Linux/Mac
export OPENAI_API_KEY="your-api-key-here"
```

**方法 2: 命令列參數**
```bash
python openai-chat.py --api-key "your-api-key-here"
```

**方法 3: 編輯腳本 (正式環境不建議)**
編輯 `openai-chat.py`,替換 `DEFAULT_API_KEY` 的值。

## 使用方式

### 基本用法

使用預設設定啟動:
```bash
python openai-chat.py
```

### 對話風格

**標準助手:**
```bash
python openai-chat.py --style default
```

**諸葛亮人設:**
```bash
python openai-chat.py --style zhugeliang
```

### 語言選項

**繁體中文 (預設):**
```bash
python openai-chat.py --language zh-TW
```

**簡體中文:**
```bash
python openai-chat.py --language zh-CN
```

**英文:**
```bash
python openai-chat.py --language en
```

### 進階設定

**自訂模型:**
```bash
python openai-chat.py --model gpt-4
```

**自訂 API 端點:**
```bash
python openai-chat.py --base-url "https://your-api-endpoint.com/v1"
```

**組合選項:**
```bash
python openai-chat.py --style zhugeliang --language zh-TW --model gpt-4o-mini
```

### 互動指令

對話中可使用的指令:
- `exit` 或 `quit` - 離開程式
- `clear` - 清除對話歷史,重新開始
- 按 `Ctrl+C` - 中斷並離開

## 設定

### 預設值

編輯 `openai-chat.py` 中的常數來修改預設值:

```python
DEFAULT_API_KEY = "your-key"          # 你的 API 金鑰
DEFAULT_BASE_URL = "https://..."      # API 端點
DEFAULT_MODEL = "gpt-4o-mini"         # 使用的模型
```

### 可用模型

- `gpt-4o-mini` (預設,經濟實惠)
- `gpt-4o` (更強大)
- `gpt-4-turbo`
- `gpt-3.5-turbo`

請查詢你的 API 提供商以了解可用模型。

## 範例會話

```
==============================================================
OpenAI Chat CLI - 命令列對話工具
==============================================================
模型：gpt-4o-mini
風格：default
語言：zh-TW

輸入 'exit' 或 'quit' 離開
輸入 'clear' 清除對話歷史
==============================================================

你: 你好，今天天氣如何？

AI: 你好！我無法即時查看天氣資訊，建議您查看當地的天氣預報網站或APP。

你: exit
再見!
```

## 關於諸葛亮風格

諸葛亮人設特色:
- 古典文言文語言模式
- 引經據典與成語
- 戰略與哲學見解
- 正式稱謂與尊敬語氣
- 古代文學風格

此風格基於歷史人物諸葛亮(181-234年),三國時期著名的軍師與政治家。

## API 資訊

**免費 API 來源:**
- [ChatAnywhere - 免費 GPT API](https://github.com/chatanywhere/GPT_API_free)

**官方 OpenAI:**
- [OpenAI Platform](https://platform.openai.com/)

## 安全性說明

- ⚠️ **絕不提交 API 金鑰** 到版本控制系統
- ✅ 使用環境變數管理敏感資料
- ✅ 考慮使用 `.env` 檔案搭配 `python-dotenv`
- ✅ 定期更換金鑰
- ✅ 監控 API 使用量與費用

## 疑難排解

### "Module 'openai' not found"

安裝套件:
```bash
pip install openai
```

### "API key not valid"

檢查 API 金鑰:
1. 確認環境變數或命令列參數設定正確
2. 確保沒有多餘的空格或引號
3. 確認金鑰有效且有額度

### 連線錯誤

- 檢查網路連線
- 確認 `base_url` 正確
- 檢查防火牆/代理設定

### 速率限制

如果遇到速率限制:
- 等待後再重試
- 使用不同的 API 金鑰
- 升級 API 方案

## 技術細節

- **語言**: Python 3.7+
- **API**: OpenAI Chat Completions API
- **上下文管理**: 對話歷史保存在記憶體中
- **錯誤處理**: API 失敗時優雅降級

## 授權條款

此工具是 Script-List 專案的一部分,遵循相同的 MIT 授權。

## 參考資料

- [OpenAI Python 函式庫文件](https://github.com/openai/openai-python)
- [Chat Completions API 指南](https://platform.openai.com/docs/guides/chat)
- [ChatAnywhere 免費 API](https://github.com/chatanywhere/GPT_API_free)
