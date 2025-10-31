# 文字轉換工具 (簡繁中文)

一套可選擇性的中文簡繁轉換工具組，讓你在轉換前檢視並控制哪些字元要進行轉換。

## 功能特色

- **檢查模式** (`convert-check.py`): 唯讀檢查工具，預覽哪些字元可以轉換
- **主轉換器** (`convert-main.py`): 兩步驟轉換流程，可手動審核
- **選擇性轉換**: 透過 JSON 設定檔精確選擇要轉換的字元
- **安全操作**: 轉換前預覽，避免意外變更

## 環境需求

- Python 3.6+
- OpenCC 函式庫

## 安裝步驟

1. 進入工具目錄:
```bash
cd text-converter-zh
```

2. 安裝依賴套件:
```bash
pip install -r requirements.txt
```

## 使用方式

### 方法一: 快速檢查 (唯讀)

使用 `convert-check.py` 快速預覽檔案中有哪些簡體字及其對應的繁體字:

```bash
python convert-check.py <檔案路徑>
```

**範例**:
```bash
python convert-check.py document.txt
```

**輸出**:
```
在檔案 'document.txt' 中找到以下可轉換的簡體字：
台 -> 臺
国 -> 國
学 -> 學
```

此工具**不會修改**任何檔案 - 只會顯示轉換對照表。

### 方法二: 選擇性轉換 (兩步驟流程)

使用 `convert-main.py` 進行可控制的轉換，並手動審核:

#### 步驟 1: 產生設定檔

```bash
python convert-main.py <檔案路徑>
```

這會掃描檔案並建立包含所有「簡體→繁體」字元對應的 `conversion_config.json`。

**`conversion_config.json` 範例**:
```json
{
    "台": "臺",
    "国": "國",
    "学": "學",
    "说": "說"
}
```

#### 步驟 2: 檢視並編輯設定檔

1. 用文字編輯器開啟 `conversion_config.json`
2. **刪除**你不想轉換的字元所在的行
3. 儲存檔案

例如，如果你想保留「台」不變，但轉換其他字元，就刪除 `"台": "臺"` 這行:
```json
{
    "国": "國",
    "学": "學",
    "说": "說"
}
```

#### 步驟 3: 執行轉換

```bash
python convert-main.py <檔案路徑> --convert
```

腳本會根據你編輯後的設定檔替換原始檔案中的字元。

## 工作流程範例

```bash
# 1. 檢查可以轉換什麼 (選擇性預覽)
python convert-check.py article.md

# 2. 產生設定檔
python convert-main.py article.md

# 3. 編輯 conversion_config.json 移除不想轉換的項目

# 4. 套用轉換
python convert-main.py article.md --convert
```

## 使用情境

- **技術文件**: 轉換術語時保留程式碼範例和特定詞彙
- **學術論文**: 為引用文獻和專有名詞進行選擇性轉換
- **雙語內容**: 維持特定詞彙的原始形式
- **品質控管**: 在套用變更前檢視所有轉換

## 重要提醒

- ⚠️ **備份檔案**: 轉換前務必建立備份
- 📝 **檢查設定**: 執行 `--convert` 前仔細檢視 `conversion_config.json`
- 🔄 **迭代流程**: 可以重新產生設定檔並根據需求調整
- 📁 **工作目錄**: `conversion_config.json` 會在當前目錄建立

## 疑難排解

### "ModuleNotFoundError: No module named 'opencc'"

安裝必要套件:
```bash
pip install opencc-python-reimplemented
```

### "UnicodeDecodeError"

確保你的檔案是 UTF-8 編碼。大多數現代文字編輯器都支援 UTF-8。

### 字元沒有轉換

- 確認字元存在於 `conversion_config.json` 中
- 檢查步驟 3 是否使用了 `--convert` 參數
- 確保設定檔是有效的 JSON 格式

## 技術細節

- **轉換引擎**: OpenCC (Open Chinese Convert)
- **字元偵測**: 比較每個字元與其轉換後的形式
- **檔案編碼**: UTF-8
- **設定檔格式**: JSON

## 授權條款

此工具是 Script-List 專案的一部分，遵循相同的 MIT 授權。
