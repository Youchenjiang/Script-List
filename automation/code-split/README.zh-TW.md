# Code Split（程式碼拆分工具）

一個 CLI 工具，用於從原始碼檔案中提取函式、方法或程式碼區塊到獨立檔案。支援多種程式語言並自動偵測。

[English](README.md)

---

## 功能特色

- **多語言支援**：C、C++、C#、Java、JavaScript、TypeScript、Go、Rust、Swift、Python、Ruby
- **自動偵測**：根據副檔名自動偵測語言（可用 `--lang` 覆蓋）
- **三種提取模式**：依方法名稱、正則表達式、行號範圍
- **批次拆分**：使用 `--rule` 參數將單一檔案拆分成多個檔案
- **Git 整合**：可選擇每次提取後自動提交
- **預覽模式**：修改檔案前先預覽變更

---

## 系統需求

- Python 3.8+
- 無外部依賴（僅使用標準庫）

## 安裝

```bash
# 無需安裝，直接執行即可
python code_split.py --help
```

---

## 使用方法

### 提取單一函式

```bash
# 依方法名稱提取（自動偵測語言）
python code_split.py extract service.py --method process_data

# 從 C# 檔案提取
python code_split.py extract MyFile.cs --method WndProc --output MyFile.Events.cs

# 依行號範圍提取
python code_split.py extract handler.js --lines 50-120 --output handler.utils.js

# 依正則表達式提取
python code_split.py extract main.go --regex "func Handle\w+" --output handlers.go
```

### 批次拆分檔案

```bash
python code_split.py split MyWindow.cs \
  --rule State:lines:15-106 \
  --rule Events:method:WndProc \
  --commit "refactor: 將 MyWindow 拆分為 partial classes"
```

### 強制指定語言

```bash
python code_split.py extract myfile --method main --lang python
```

### 預覽模式（不修改檔案）

```bash
python code_split.py extract MyFile.cs --method Foo --dry-run
```

---

## CLI 參數說明

```
usage: code_split.py [-h] {extract,split} ...

code-split: 從原始碼檔案中提取函式/區塊到獨立檔案

positional arguments:
  {extract,split}
    extract        從單一檔案提取區塊
    split          將檔案依規則拆分

extract 參數:
  file                  來源檔案
  --method METHOD       要提取的函式/方法名稱
  --regex REGEX         正則表達式匹配模式
  --lines LINES         行號範圍，例如 10-50
  --output, -o FILE     輸出檔名
  --name NAME           輸出檔案的名稱後綴
  --lang {c,csharp,python,...}
                        強制指定語言（預設依副檔名自動偵測）
  --commit MSG          Git 提交訊息
  --dry-run             預覽模式，不修改檔案

split 參數:
  file                  來源檔案
  --rule RULE           拆分規則：名稱:類型:值（類型：method/lines/regex）
  --lang LANG           強制指定語言
  --commit MSG          Git 提交訊息
  --dry-run             預覽模式，不修改檔案
```

---

## 支援的語言

| 語言 | 副檔名 | 區塊偵測方式 |
|------|--------|-------------|
| C | `.c`, `.h` | 大括號 `{}` |
| C++ | `.cpp`, `.cc`, `.cxx`, `.hpp` | 大括號 `{}` |
| C# | `.cs` | 大括號 `{}` |
| Java | `.java` | 大括號 `{}` |
| JavaScript | `.js`, `.mjs`, `.jsx` | 大括號 `{}` |
| TypeScript | `.ts`, `.tsx` | 大括號 `{}` |
| Go | `.go` | 大括號 `{}` |
| Rust | `.rs` | 大括號 `{}` |
| Swift | `.swift` | 大括號 `{}` |
| Python | `.py` | 縮排 |
| Ruby | `.rb` | `do...end` / 大括號 |

---

## 範例

### Python：提取函式

```bash
python code_split.py extract utils.py --method calculate_total
```

提取前：
```python
def calculate_total(items):
    return sum(item.price for item in items)

def validate_input(data):
    ...
```

提取 `calculate_total` 後：

`utils.calculate_total.py`：
```python
def calculate_total(items):
    return sum(item.price for item in items)
```

`utils.py`：
```python
def validate_input(data):
    ...
```

### JavaScript：批次拆分

```bash
python code_split.py split app.js \
  --rule Handlers:regex:"function handle\w+" \
  --rule Utils:method:formatDate \
  --commit "refactor: 將 app.js 拆分為模組"
```

---

## 授權條款

MIT
