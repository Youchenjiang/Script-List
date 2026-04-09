# VNC Auto Typer

當 VNC 剪貼簿貼上功能無法使用時（例如 CDX 等受限平台），透過模擬鍵盤輸入的方式，將文字「打」進 VNC 視窗中的工具。

[Read English Version](README.md)

## 描述

透過網頁版 VNC 客戶端（如 noVNC）連線至遠端虛擬機時，從主機複製貼上文字的功能往往被封鎖。本專案提供**兩個工具**來解決此問題：

| 工具 | 適合情境 |
|---|---|
| `vnc_typer_gui.py` | **重複使用** — 常駐的置頂視窗；貼上文字後一鍵發送 |
| `vnc_auto_typer.py` | **單次 / 腳本使用** — 命令列工具，支援參數或剪貼簿輸入 |

## 環境需求

- **Python 3.8+**
- **tkinter** — GUI 工具使用；Windows 和 macOS 的 Python 已內建。
  Linux 上需安裝：`sudo apt install python3-tk`

## 安裝

一次安裝所有依賴：

```bash
pip install -r requirements.txt
```

### 各套件說明

| 套件 | 用途 | 備注 |
|---|---|---|
| `keyboard` | **主要鍵盤後端** | 傳送原始字元事件，可正確處理 `'`、`:`、`-` 等特殊字元。部分系統需要管理員/root 權限。 |
| `pyautogui` | 備用鍵盤後端 | 將字元映射為虛擬按鍵碼，在 VNC 環境下特殊字元可能顯示錯誤。 |
| `pyperclip` | 剪貼簿讀取 | 供 `vnc_auto_typer.py` 預設（剪貼簿）模式使用。Linux 上需安裝 `xclip` 或 `xsel`。 |

---

## GUI 工具 — `vnc_typer_gui.py` *（建議使用）*

常駐的置頂視窗，可在操作 VNC 時保持可見。

### 使用方式

```bash
python vnc_typer_gui.py
```

### 操作流程

1. 視窗出現在螢幕右上角並持續置於最上層。
2. 將要輸入到 VNC 的文字**貼入**文字區域。
3. 點擊 **「Send to VNC」**（或按 **Ctrl+Enter**）— 倒數計時開始。
4. **切換到 VNC 視窗**，點擊游標應出現的位置。
5. 文字自動輸入完成。
6. GUI 重置 — 從第 2 步重複操作下一段文字。
7. **關閉視窗**即可結束程式。

### GUI 設定說明

| 控制項 | 預設值 | 說明 |
|---|---|---|
| Delay (s) | `5` | 開始打字前的倒數秒數。 |
| Interval (s/char) | `0.04` | 每次按鍵的間隔秒數，網路慢時可調高。 |
| Backend | `keyboard` | 選擇 `keyboard`（建議）或 `pyautogui`（備用）。 |
| Always on top | ✅ 開啟 | 讓視窗保持在所有其他視窗之上。 |
| Abort 按鈕 | — | 倒數或輸入中出現；點擊立即取消。 |

---

## CLI 工具 — `vnc_auto_typer.py`

適合單次使用或腳本整合。

### 預設模式（剪貼簿 → 輸入）

1. 在主機上複製文字。
2. 確認 VNC 視窗可見。
3. 執行腳本：

```bash
python vnc_auto_typer.py
```

### 其他輸入模式

```bash
# 從檔案輸入
python vnc_auto_typer.py -f path/to/script.sh

# 直接輸入字串
python vnc_auto_typer.py -t "echo hello world"
```

### 所有 CLI 參數

| 參數 | 預設值 | 說明 |
|---|---|---|
| `-t`, `--text` TEXT | — | 直接輸入文字（與 `--file` 互斥）。 |
| `-f`, `--file` FILE | — | 純文字檔路徑（與 `--text` 互斥）。 |
| `-d`, `--delay` 秒數 | `3` | 開始打字前的倒數秒數。 |
| `-i`, `--interval` 秒數 | `0.03` | 每次按鍵的間隔秒數。 |
| `--backend` | `keyboard` | `keyboard`（建議）或 `pyautogui`（備用）。 |
| `--xdotool` | 關閉 | 將 `xdotool type` 指令輸出到 stdout 而非本機輸入。 |
| `--no-countdown` | 關閉 | 跳過倒數，立即開始輸入。 |

---

## 使用技巧

- **字元被漏掉**：調高 `--interval`（試試 `0.07`–`0.1`）。
- **隨時中止**：GUI 中點擊 **Abort** 按鈕，或在終端機按 `Ctrl+C`。`pyautogui` 後端還支援將滑鼠移至**螢幕左上角**來中止。
- **特殊字元亂碼**：確認使用 `keyboard` 後端（預設）。`pyautogui` 使用虛擬按鍵碼，VNC 可能映射錯誤。
- **Linux `keyboard` 權限錯誤**：改用 `sudo python vnc_typer_gui.py` 執行。
