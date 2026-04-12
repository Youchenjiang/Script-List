# Photo Splitter

這是一個從合照中提取單人人物照的工具。它可以自動偵測人臉，並根據合照下方的姓名標示自動命名輸出檔案。

## 功能特點
- 自動人臉偵測 (OpenCV YuNet)
- 自動文字辨識 (Tesseract OCR)
- 智慧裁切：自動計算人像邊界，避免包含到旁邊的同學
- 多方案對應：針對不同組別的合照排版提供各別的命名規則

## 使用方法
1. 安裝相依套件：
   ```bash
   pip install -r requirements.txt
   ```
2. 執行腳本：
   ```bash
   python split_students.py
   ```

## 輸出結果
- `split_students_output`: 存放裁切後的單人照片
- `split_students_debug`: 存放帶有偵測框線的檢查圖
