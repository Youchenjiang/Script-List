# VNC Auto Typer

當 VNC 剪貼簿貼上功能無法使用時（例如 CDX 等受限平台），透過模擬鍵盤輸入的方式，將文字「打」進 VNC 視窗中的輕量 Python 工具。

## 描述

透過網頁版 VNC 客戶端（如 noVNC）連線至遠端虛擬機時，從主機複製貼上文字的功能往往被封鎖。  
本工具可從**本機剪貼簿**、**文字檔**，或**命令列參數**讀取文字，並使用 `pyautogui` 以逐字模擬鍵盤輸入的方式，將內容輸入到已聚焦的 VNC 視窗中。

另提供 `--xdotool` 模式：不直接控制鍵盤，而是將 `xdotool type` 指令輸出到 stdout，可在 VM **內部**透過 `bash` 管道執行。

## 環境需求

- Python 3.8+
- 剪貼簿管理工具（使用預設剪貼簿模式時需要）：
  - **Windows / macOS**：內建剪貼簿存取，無需額外設定。
  - **Linux**：需安裝 `xclip` 或 `xsel`（`sudo apt install xclip`）。
- `xdotool`（選用，Linux 限定，用於 `--xdotool` 模式）：`sudo apt install xdotool`

## 安裝

1. 安裝所需 Python 套件：
   ```bash
   pip install -r requirements.txt
   ```

## 使用方法

### 預設模式（剪貼簿 → pyautogui 模擬輸入）

1. 在**主機**上複製要貼入 VNC 視窗的文字。
2. 確認 VNC 視窗已顯示在螢幕上。
3. 執行腳本（倒數 3 秒內請點擊 VNC 視窗內部）：

```bash
python vnc_auto_typer.py
```

### 直接輸入字串

```bash
python vnc_auto_typer.py -t "echo hello world"
```

### 從文字檔輸入

```bash
python vnc_auto_typer.py -f path/to/script.sh
```

### 參數說明

| 參數 | 預設值 | 說明 |
|---|---|---|
| `-t`, `--text` TEXT | — | 直接輸入要打的文字（與 `--file` 互斥）。 |
| `-f`, `--file` FILE | — | 要輸入的純文字檔路徑（與 `--text` 互斥）。 |
| `-d`, `--delay` 秒數 | `3` | 開始打字前的倒數秒數（用來點擊 VNC 視窗）。 |
| `-i`, `--interval` 秒數 | `0.03` | 每次按鍵的間隔秒數，網路較慢時可調高。 |
| `--xdotool` | 關閉 | 改為輸出 `xdotool type` 指令到 stdout，而非使用 pyautogui。 |
| `--no-countdown` | 關閉 | 跳過倒數，立即開始輸入。 |

### 使用範例

```bash
# 輸入剪貼簿內容，預設 3 秒倒數
python vnc_auto_typer.py

# 自訂 5 秒倒數（更多時間切換視窗）
python vnc_auto_typer.py --delay 5

# 網速較慢時放慢打字速度（每次按鍵間隔 0.1 秒）
python vnc_auto_typer.py --interval 0.1

# 從 Shell 腳本檔輸入
python vnc_auto_typer.py -f setup.sh --interval 0.05

# 立即輸入單行指令（不倒數）
python vnc_auto_typer.py -t "sudo apt update" --no-countdown

# 在 VM 內部用 xdotool 執行
python vnc_auto_typer.py -f commands.sh --xdotool | bash
```

## 工作原理

1. 從剪貼簿（`pyperclip`）、檔案或命令列參數讀取文字。
2. 顯示倒數計時，讓你有時間點擊 VNC 視窗內部。
3. 呼叫 `pyautogui.write()` 模擬逐一按鍵輸入，間隔可自訂。
4. 預設啟用 `pyautogui` 的**安全機制**——將滑鼠移至螢幕**左上角**即可立即中止（或按 `Ctrl+C`）。

## 使用技巧

- **字元被漏掉**：調高 `--interval`（例如 `0.05` 或 `0.1`）。
- **特殊字元輸入不正確**：`pyautogui.write()` 僅支援可打印 ASCII 字元。如需輸入 Unicode 或特殊按鍵，請在 Linux 環境使用 `--xdotool` 模式。
- **隨時中止**：將滑鼠移至螢幕**左上角**（pyautogui 安全機制）或按 `Ctrl+C`。
