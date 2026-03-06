# Base64 轉換器 (Base64 Converter)

這是一個多用途的 Python 腳本，可用於對文字和檔案進行 Base64 編碼和解碼。

## 功能特點

- 將文字或檔案編碼為 Base64 格式
- 將 Base64 字串或檔案解碼回文字或原始檔案
- 提供簡單易用的命令列介面

## 使用方法

```bash
python base64_converter.py [-h] (-e | -d) [-t TEXT] [-f FILE] [-o OUTPUT]
```

### 參數說明

- `-e, --encode`: 編碼模式
- `-d, --decode`: 解碼模式
- `-t, --text TEXT`: 要編碼/解碼的文字
- `-f, --file FILE`: 要編碼/解碼的檔案 (輸入)
- `-o, --output OUTPUT`: 輸出檔案路徑 (用於儲存 Base64 字串或解碼後的檔案)

### 範例

**編碼文字：**
```bash
python base64_converter.py -e -t "Hello World"
```

**解碼文字：**
```bash
python base64_converter.py -d -t "SGVsbG8gV29ybGQ="
```

**將檔案編碼並儲存為 Base64 文字檔：**
```bash
python base64_converter.py -e -f image.png -o image_base64.txt
```

**將 Base64 文字檔解碼為原始檔案：**
```bash
python base64_converter.py -d -f image_base64.txt -o decoded_image.png
```
