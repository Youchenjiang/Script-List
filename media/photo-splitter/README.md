# Photo Splitter

這是一個從合照中提取單人人物照的工具。它可以自動偵測人臉，並根據合照下方的姓名標示自動命名輸出檔案。

## 功能特點
- **自動人臉偵測 (OpenCV YuNet)**：提供高準確度的人臉識別，自動下載模型。
- **智慧型裁切策略**：自動計算同學之間的中線，確保裁切範圍不重疊且完整。
- **多策略命名機制**：支援從原圖底部 OCR 提取姓名，並可按組別指定特定排版規則。
- **自動文字辨識 (Tesseract OCR)**：識別原圖上的姓名標籤。

### 核心技術說明
詳細的偵測邏輯與裁切演算法說明請參考：[TECHNICAL_NOTES.md](docs/TECHNICAL_NOTES.md)

## 使用方法

### 1. 系統依賴 (Tesseract OCR)

本腳本使用 **Tesseract OCR** 進行文字辨識。請確保系統已安裝並將其加入環境變數 `PATH`：
- **Windows**: [下載安裝檔](https://github.com/UB-Mannheim/tesseract/wiki) (請務必勾選安裝 **Traditional Chinese** 語系檔)。
- **Ubuntu**: `sudo apt install tesseract-ocr tesseract-ocr-chi-tra`
- **MacOS**: `brew install tesseract`

### 2. 安裝 Python 依賴

```bash
pip install -r requirements.txt
```

### 3. 執行腳本

```bash
python split_students.py --input-dir <圖片目錄路徑>
```
*(若不指定 `--input-dir`，預設會掃描當前目錄下的圖片)*

## 輸出結果
- `split_students_output`: 存放裁切後的單人照片
- `split_students_debug`: 存放帶有偵測框線的檢查圖
