# 十六進制轉 ASCII 轉換器 (Hex to ASCII Converter)

一個簡單的 Python 腳本，用於將十六進制字串轉換為 ASCII 字符。

## 功能特點

- 支援帶有空格、逗號或者 `0x`、`\x` 前綴的十六進制字串。
- 可透過命令列參數傳遞欲轉換的字串。
- 支援從檔案中讀取十六進制內容。
- 支援標準輸入管線操作 (Piping)。

## 使用方法

```bash
python hex_to_ascii.py [-h] [-t TEXT] [-f FILE]
```

### 參數說明

- `-t, --text TEXT`: 要轉換的十六進制字串
- `-f, --file FILE`: 從該檔案讀取十六進制字串

### 範例

**轉換簡單的十六進制字串：**
```bash
python hex_to_ascii.py -t "48656c6c6f20576f726c64"
```

**轉換帶有空格或前綴的十六進制：**
```bash
python hex_to_ascii.py -t "0x48 0x65 0x6c 0x6c 0x6f"
```

**從檔案讀取並轉換：**
```bash
python hex_to_ascii.py -f hex_data.txt
```

**使用標準輸入管線 (管線操作)：**
```bash
echo "48656c6c6f" | python hex_to_ascii.py
```
