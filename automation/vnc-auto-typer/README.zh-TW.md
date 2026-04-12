# VNC Auto Typer

當 VNC 剪貼簿貼上功能無法使用時（例如 CDX 等受限平台），透過模擬鍵盤輸入的方式，將文字「打」進 VNC 視窗中的工具。

[Read English Version](README.md)

## 描述

透過網頁版 VNC 客戶端（如 noVNC 或 CDX）連線至遠端虛擬機時，從主機複製貼上文字的功能往往被封鎖。本專案讓你可以將文字貼入本機視窗，並自動將其透過物理按鍵事件模擬「打」進遠端連線中。

| 工具 | 適合情境 |
|---|---|
| `vnc_typer_gui.py` | **重複使用** — 常駐的置頂 GUI 視窗。 |
| `vnc_auto_typer.py` | **單次 / 腳本使用** — 命令列工具，支援參數或剪貼簿輸入。 |
| **免安裝執行檔** | **快速啟動** — 單一檔案 `VNCAutoTyper_Lite.exe`。 |

---

## 🚀 自行打包免安裝執行檔 (Lite)
為了保持專案倉庫的輕量化，我們不直接分發二進位檔案。您可以透過 PyInstaller 自行產出僅約 **13MB 的 Lite 版本**：

1. **環境準備**：確保已安裝 Python 以及 `requirements.txt` 中的必要套件。
2. **安裝 PyInstaller**：
   ```bash
   pip install pyinstaller
   ```
3. **執行瘦身編譯指令**：
   ```bash
   pyinstaller --onefile --windowed --name VNCAutoTyper_Lite --collect-all keyboard --exclude-module PyQt5 --exclude-module PyQt6 --exclude-module numpy --exclude-module cv2 --exclude-module matplotlib --exclude-module scipy --exclude-module pandas --exclude-module mkl vnc_typer_gui.py
   ```
4. 打包完成後，執行檔將位於 `dist/` 資料夾中的 `VNCAutoTyper_Lite.exe`。

> [!TIP]
> **為什麼要用這串指令？** 標準的 PyInstaller 打包可能會因為拉進環境中的 OpenCV 或 NumPy 等重量級套件而超過 300MB。透過 `--exclude-module` 指令排除掉程式沒用到的模組，可以獲得最精簡的體積。

---

## 環境需求 (腳本版)

- **Python 3.8+**
- **依賴套件**: `pip install keyboard pyperclip`
- **權限說明**: `keyboard` 函式庫需要**管理員權限** (Windows) 或 **root/sudo** (Linux) 才能跨越 VNC 隧道正確模擬物理按鍵。

---

## GUI 工具 — `vnc_typer_gui.py` *（建議使用）*

一個常駐且精簡的視窗，可讓你在操作 VNC 時保持置頂。

### 功能亮點
- **永遠置頂 (Always on Top)**：確保操作時視窗不會消失在瀏覽器後方。
- **即時中止 (Abort)**：打字中可隨時點擊中止，精確到每一個字元。
- **即時進度條**：直觀顯示打字進度。
- **廣泛支援**：支援中文與特殊字元輸入。

### 使用方式
```bash
python vnc_typer_gui.py
```

1. 將文字**貼入**文字區域。
2. 點擊 **「Send to VNC」**（或按 **Ctrl+Enter**）— 倒數開始。
3. **切換到您的 VNC 視窗** 並點擊一下輸入框。
4. 程式會自動開始輸入文字。

---

## CLI 工具 — `vnc_auto_typer.py`

適合命令列操作或腳本整合。

```bash
# 從剪貼簿輸入 (預設)
python vnc_auto_typer.py

# 從檔案輸入
python vnc_auto_typer.py -f script.sh

# 輸入特定字串
python vnc_auto_typer.py -t "echo hello world"
```

---

## 常見問題排除

- **字元被漏掉**：調高 **Interval (s/char)** 設定（如 `0.06` 或 `0.08`），以補償 VNC 網路延遲。
- **大寫卡死 (Shift Stuck)**：若發生打字變全大寫的情況，程式現在會在每次打字前自動重置所有組合鍵狀態（清理 Shift/Ctrl/Alt）。
- **特殊字元亂碼**：我們採用 Canonical Key Map 與 `keyboard.write()` 以換取對 VNC 隧道的最大相容性。
- **Linux 權限錯誤**：請改用 `sudo python vnc_typer_gui.py` 執行。

---

## 授權條款
MIT License
