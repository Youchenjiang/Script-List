# 網址存活與 HTTP 狀態碼批次檢測工具 (URL Health Checker)

快速、高併發的網址連線可用性與 HTTP 狀態碼批次檢驗工具，提供 Python 與 PowerShell 雙版本。

[English Version](README.md)

---

## 功能特色

- **多執行緒高併發**：幾秒內批次檢測數十到數百個目標網站。
- **完整異常辨識**：精準捕捉 DNS 解析失敗、SSL/TLS 憑證無效、連線逾時、4xx 用戶端錯誤與 5xx 伺服器異常。
- **多元輸入支援**：支援讀取文字檔清單（自動忽略註解 `#` 與空行）或直接由命令列傳入網址。
- **清晰報表匯出**：支援控制台美化表格、相容 Excel 的 UTF-8 BOM CSV 報表與 JSON 格式。
- **跨平台雙實現**：提供跨平台 Python 3 腳本與 Windows 原生 PowerShell 腳本。

---

## 使用方式

### Python 版本

```bash
# 從檔案讀取清單檢測
python check_urls.py -f urls.txt

# 直接在終端機輸入多個網址檢測
python check_urls.py -u https://google.com https://github.com

# 指定 20 個線程、10 秒逾時並匯出 CSV 與 JSON 報表
python check_urls.py -f urls.txt -w 20 -t 10 --csv report.csv --json report.json

# 忽略 SSL 憑證檢查（適用於自簽憑證或內部測試環境）
python check_urls.py -f urls.txt --insecure
```

### PowerShell 版本

```powershell
# 基本檢測
.\check_urls.ps1 -FilePath .\urls.txt

# 檢測並匯出 CSV 報表
.\check_urls.ps1 -FilePath .\urls.txt -CsvPath report.csv
```

---

## 授權條款

MIT License
