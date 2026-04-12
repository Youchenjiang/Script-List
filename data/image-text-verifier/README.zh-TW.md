# 問卷影像辨識與校對工具 (Image-Text Verifier)

一套用於將實體問卷影像自動辨識為文字，並與現有 CSV 資料進行比對、校對與自動修正的工具。

## 功能特色

- **自動化結構分析**: 透過形態學操作自動偵測表格欄列，排除答題區以外的雜訊。
- **筆跡能量判定**: 針對每個候選欄位計算像素能量，並判斷最佳選項與信心水準。
- **針對性風險控管**: 支持對特定頁面（如第二頁）採更嚴格的防錯規則（如雙勾、重畫或塗改等情況）。
- **報表輸出**: 可生成 JSON 格式的校對報告 (`verify_report.json`)，列出所有不一致的項目與需要人工裁決的疑義格。
- **自動修正**: 支援將高信心度且與 CSV 不一致的項目直接覆寫回結果檔。

## 環境需求

- Python 3.8+
- OpenCV (`opencv-python`)
- NumPy (`numpy`)

## 安裝步驟

1. 進入工具目錄:
```bash
cd image-text-verifier
```

2. 安裝依賴套件:
```bash
pip install -r requirements.txt
```

## 使用方式

本工具的主要腳本為 `image-text-verifier.py`，支援多項 CLI 參數調控。

### 前置條件

- **CSV 格式**: 前兩欄為識別欄（如公司、姓名），後續為題目欄位。
- **影像命名格式**: `{record}-{page}.jpg`（例如 `17-1.jpg`, `17-2.jpg`）。
- **固定題數**: 預設第 1 頁 16 題、第 2 頁 24 題（可透過參數調整）。

### 建議執行命令

**1. 檢查模式 (不寫回 CSV，僅產生報告):**
```bash
python image-text-verifier.py --csv results.csv --image-dir image --strict-page2 --dry-run
```

**2. 產生報告 + 自動寫回高信心修正:**
```bash
python image-text-verifier.py --csv results.csv --image-dir image --strict-page2 --report-json verify_report.json
```

### 重要參數說明

- `--csv`: 輸入的 CSV 檔案路徑 (預設: `results.csv`)
- `--image-dir`: 影像資料夾路徑 (預設: `image`)
- `--strict-page2`: 啟用對第二頁的嚴格風險判定 (遇到不穩定筆跡列為疑義格)
- `--apply-risky`: 是否連同低信心度 (疑義格) 也強制覆寫 (預設不建議)
- `--dry-run`: 唯讀模式，只進行比對與產生報告，不會修改 CSV 檔
- `--records`: 欲處理的資料總筆數 (預設: `40`)
- `--questions-per-record`: 每筆資料的總題數 (預設: `40`)
- `--report-json`: 報告輸出的 JSON 檔案路徑 (預設: `verify_report.json`)

## 建議校對流程

1. 先執行帶有 `--dry-run` 的指令，檢視報告中的 `mismatches` (不一致題) 與 `page2_risky` (疑義題)。
2. 針對報告中標示的疑義題進行人工看圖覆核。
3. 確認無誤後，取消 `--dry-run` 執行修正 (不開啟 `--apply-risky`)，讓明確的錯誤先行被腳本自動更正。
4. 將人工覆核確認的疑義題手動修改至 CSV，再跑一次檢查確認所有錯誤歸零。
