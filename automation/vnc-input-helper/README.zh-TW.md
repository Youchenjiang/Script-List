# VNC Input Helper

這是一個輕量化的輸入輔助工具包。當您在 VNC 或虛擬機環境中遇到本機與遠端剪貼簿同步失效、按鍵無法長按或需要快速連點滑鼠時（例如 CDX 等受限的安全平台），此工具能以物理硬體按鍵事件模擬輸入，跨越虛擬機通道進行操作。

[Read English Version](README.md)

---

## 🌟 核心功能

1. **Auto Typer (自動打字)**：將本機複製的文字貼入工具中，程式會模擬實體鍵盤將文字逐字「打」入 VNC 視窗，繞過受限平台禁止複製貼上的問題。
2. **Key Holder (按鍵長按)**：模擬實體鍵盤按鍵長按（例如 `w`、`space`、`shift`），支援指定倒數秒數或無限長按，適用於遊戲、防閒置斷線或自動化測試。
3. **Auto Clicker (滑鼠連點)**：快速連點器，支援滑鼠左鍵、右鍵及中鍵，可自訂點擊間隔毫秒數。使用 Windows 原生 `ctypes` API 實作，確保 100% 輕量與無任何額外套件依賴。

| 工具類型 | 適合情境 |
|---|---|
| `vnc_helper_gui.py` | **圖形化操作** — 支援分頁（Tab）切換、常駐且支援永遠置頂的 GUI 控制台。 |
| `vnc_helper_cli.py` | **自動化/腳本化** — 純文字命令列工具，支援各種參數與背景排程。 |
| **免安裝執行檔** | **快速啟動** — 單一打包檔案 `VNCInputHelper_Lite.exe`。 |

---

## 🚀 自行打包免安裝執行檔 (Lite)

您可以透過 PyInstaller 自行打包成僅約 **8MB 的 Lite 版本**：

1. **環境準備**：確保已安裝 Python 3.8+ 與 pip。
2. **安裝 PyInstaller**：
   ```bash
   pip install pyinstaller
   ```
3. **執行白名單編譯指令**：
   ```bash
   pyinstaller --clean VNCInputHelper_Lite.spec
   ```
4. 打包完成後，您將在 `dist/` 資料夾下找到 `VNCInputHelper_Lite.exe`。

> [!TIP]
> **為什麼要用此方式打包？** 本專案包含一個客製化的 `VNCInputHelper_Lite.spec` 白名單打包設定檔。它會自動在打包過程中，將所有程式未使用的 Python 標準庫及 C 連結庫 (DLL) 過濾排除，只打包視窗 GUI、鍵盤模擬及 ctypes 滑鼠點擊所需的最小子集，從而將最終執行檔體積大幅壓縮至僅 ~8MB。

---

## 環境需求 (腳本執行版)

- **Python 3.8+**
- **依賴套件**：`pip install keyboard pyperclip`
- **權限說明**：`keyboard` 函式庫需要**管理員權限** (Windows) 或 **root/sudo** (Linux) 才能跨越 VNC 隧道正確模擬物理按鍵事件。

---

## GUI 工具 — `vnc_helper_gui.py` *(建議使用)*

執行圖形介面：
```bash
python vnc_helper_gui.py
```

### GUI 功能亮點與設計
- **永遠置頂 (Always on Top)**：在頂部選單勾選此功能，即可確保操作 VNC 網頁時輔助控制台不會消失在瀏覽器後方。
- **分頁模式切換**：
  - **Tab 1: 自動打字**：調整打字速度與倒數延遲。
  - **Tab 2: 按鍵長按**：附有常用鍵（W, A, S, D, Space, Shift, Ctrl, Alt, Enter 等）快速點擊網格，以及設定倒數時間或無限長按。
  - **Tab 3: 滑鼠連點**：選擇按鍵種類、自訂連點毫秒間隔。
- **全域啟動延遲**：在下方控制區設定「啟動延遲秒數」（預設 3 秒），點擊啟動後給您充足時間將焦點移回 VNC 輸入框。
- **全域一鍵中止**：不論目前在哪個分頁、執行何種任務，只要按下鍵盤的 **`Esc`** 鍵，程式將會瞬間中止所有打字、長按或點擊操作，並釋放所有虛擬按鍵防止按鍵卡死。

---

## CLI 工具 — `vnc_helper_cli.py`

適合命令列操作或腳本自動化整合。

```bash
# 1. 打字模式 (預設)：自動模擬打字輸入剪貼簿中的文字
python vnc_helper_cli.py --mode typer

# 輸入自訂字串
python vnc_helper_cli.py --mode typer --text "echo 'Hello World'"

# 從檔案讀取並輸入
python vnc_helper_cli.py --mode typer --file script.sh

# 2. 按鍵長按模式：長按 'w' 鍵 10 秒
python vnc_helper_cli.py --mode hold --key w --duration 10.0

# 無限長按 (按下 Esc 鍵釋放按鍵)
python vnc_helper_cli.py --mode hold --key space --duration 0

# 3. 滑鼠連點模式：連點滑鼠左鍵，每 0.5 秒點擊一次，共點擊 10 次
python vnc_helper_cli.py --mode click --button left --interval 0.5 --count 10
```

### CLI 參數詳細說明

```text
  -h, --help            顯示幫助說明並退出
  -m, --mode {typer,hold,click}
                        自動化模式 (預設: typer)
  -d, --delay DELAY     啟動延遲時間 (秒) (預設: 3)
  -t, --text TEXT       要輸入的文字 (打字模式適用)
  -f, --file FILE       要輸入的檔案路徑 (打字模式適用)
  -i, --interval INTERVAL
                        間隔時間：打字為 s/字元，連點為 s/次 (預設: 0.03/0.1)
  -k, --key KEY         要長按的按鍵 (長按模式適用) (預設: w)
  -dur, --duration DURATION
                        按鍵長按持續秒數 (0 為無限長按，預設: 10.0)
  -btn, --button {left,right,middle}
                        要連點的滑鼠按鍵 (連點模式適用) (預設: left)
  -c, --count COUNT     連點點擊次數 (0 為無限連點，預設: 100)
```

---

## 常見問題排除

- **字元被漏掉**：調高 **Interval (s/char)** 設定（如 `0.06` 或 `0.08`），以補償 VNC 遠端網路的延遲。
- **大寫或按鍵卡死 (Keys Stuck)**：若發生鍵盤按鍵（如 Shift、Ctrl 或設定的長按鍵）在程式結束後被 Windows 認為依然被按著的情況，程式現在會在每次任務開始前自動重置所有按鍵狀態。另外，直接關閉 GUI 視窗也會自動釋放所有虛擬按鍵。
- **macOS/Linux 滑鼠連點限制**：連點器為了保持輕量，在 Windows 下使用原生 `ctypes`。在 Linux 下會嘗試呼叫系統中的 `xdotool` 指令，若系統未安裝該指令則會跳過點擊。
- **Linux 權限錯誤**：請改用 `sudo python vnc_helper_gui.py` 執行以提供實體鍵盤模擬權限。

---

## 授權條款
MIT License
