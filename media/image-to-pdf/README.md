# 圖片合併 PDF 工具 (Image to PDF Converter)

這是一個簡單的 Python 腳本，用於將資料夾中的多張圖片合併成一個 PDF 檔案。支援自然排序（例如：1.jpg, 2.jpg, ..., 10.jpg）。

## 功能

-   將指定資料夾中的圖片合併為單個 PDF。
-   支援多種圖片格式 (`.jpg`, `.jpeg`, `.png`, `.bmp`, `.gif`)。
-   使用自然排序處理檔名，確保順序正確。
-   互動式介面。

## 安裝依賴

在使用腳本之前，請確保已安裝 Python，然後執行以下指令安裝必要的套件：

```bash
pip install -r requirements.txt
```

或者手動安裝：

```bash
pip install Pillow natsort
```

## 使用方法

1.  執行腳本：

    ```bash
    python img2pdf.py
    ```

2.  依照提示輸入：
    -   **圖片資料夾路徑**: 輸入包含圖片的資料夾路徑（按 Enter 使用當前目錄）。
    -   **PDF 檔案名稱**: 輸入輸出的 PDF 檔案名稱（預設為 `output.pdf`）。

3.  程式將會自動讀取圖片並產生 PDF 檔案。

## 注意事項

-   程式會自動過濾非圖片檔案。
-   如果遇到無法讀取的圖片，程式會跳過並繼續處理其他圖片。
