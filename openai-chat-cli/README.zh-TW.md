# OpenAI Chat CLI (簡化版)

這是最精簡的命令列對話腳本：
- 單一檔案 `openai-chat.py`
- 內建 Execute Copilot 提示詞（重述目標 → 行動步驟 → 風險提醒）
- 每次輸入問題就呼叫 OpenAI API 並輸出繁體中文回答
- `exit`/`quit`/`Ctrl+C` 可離開

## 使用方式

1. 安裝依賴：
```bash
pip install openai
```

2. 執行腳本：
```bash
python openai-chat.py
```

3. 如果未設定 API 金鑰，腳本會提示您直接輸入。

**其他設定方式（選填）：**

**方法 1：環境變數**
```bash
# Windows PowerShell
$env:OPENAI_API_KEY="your-api-key"

# Linux/Mac
export OPENAI_API_KEY="your-api-key"
```

**方法 2：命令列參數**
```bash
python openai-chat.py --api-key="your-api-key"
```

## 環境變數

- `OPENAI_API_KEY`（必填）：OpenAI API 金鑰
- `OPENAI_BASE_URL`（選填）：預設為 `https://api.chatanywhere.tech/v1`
- `OPENAI_MODEL`（選填）：預設為 `gpt-4o-mini`

## 注意
請勿將真實金鑰提交到版本控制，正式環境務必改用環境變數或密鑰管理服務。
