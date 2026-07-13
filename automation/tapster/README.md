# Tapster

Lightweight input automation tool supporting auto-typing, key holding (with combos and rotation), mouse clicking, and record & replay. Works in VNC, VMs, or any scenario requiring keyboard/mouse simulation.

[閱讀繁體中文版](README.zh-TW.md)

---

## 🌟 Key Features

1. **Auto Typer (自動打字)**: Paste text into a local window and automatically "type" it character by character into a remote VNC session. Prevents clipboard-blocking restrictions.
2. **Key Holder (按鍵長按)**: Simulates holding down a physical keyboard key (e.g. `w`, `space`, `shift`) for a timed duration or indefinitely. Extremely useful for gaming, bypassing idle timeouts, or testing.
3. **Auto Clicker (滑鼠連點)**: Fast mouse clicking simulator supporting left, right, and middle clicks with customizable millisecond intervals. Built natively using Windows `ctypes` API to remain 100% lightweight and zero-dependency.

| Tool | Best for |
|---|---|
| `vnc_helper_gui.py` | **Interactive GUI use** — A tabbed, persistent, always-on-top dashboard. |
| `vnc_helper_cli.py` | **Scripted / automated use** — Pure console tool driven by command-line arguments. |
| **Standalone EXE** | **No-install portability** — Single file `VNCInputHelper_Lite.exe`. |

---

To keep the repository clean, we do not bundle the binaries directly. You can build your own **~8MB "Lite" version** using PyInstaller:

1. **Prerequisites**: Ensure you have Python 3.8+ and pip.
2. **Install PyInstaller**:
   ```bash
   pip install pyinstaller
   ```
3. **Run the Whitelist Build Command**:
   ```bash
   pyinstaller --clean VNCInputHelper_Lite.spec
   ```
4. The output binary will be generated in the `dist/` folder as `VNCInputHelper_Lite.exe`.

> [!TIP]
> **Why this command?** The project contains a custom `VNCInputHelper_Lite.spec` file that enforces strict whitelist-based packaging. It filters the Python standard library and DLLs programmatically so that only the minimum essential modules needed for GUI, key simulation, and ctypes mouse clicks are compiled. This keeps the final binary size at just ~8MB.

---

## Prerequisites (Script Version)

- **Python 3.8+**
- **Dependencies**: `pip install keyboard pyperclip`
- **Permissions**: The `keyboard` library requires **Administrator** (Windows) or **root/sudo** (Linux) privileges to simulate physical key events globally.

---

## GUI Tool — `vnc_helper_gui.py` *(Recommended)*

Launch the graphical dashboard:
```bash
python vnc_helper_gui.py
```

### GUI Layout & Features
- **Always on top**: Toggle checkbox in the header to ensure the utility window stays visible while clicking inside VNC windows.
- **Tab 1: Auto Typer**: Configure typing delay and interval speed.
- **Tab 2: Key Holder**: Features a grid of common keys (W, A, S, D, Space, Shift, Ctrl, Alt, Enter, etc.) for quick selection, support for timed holding (seconds) or indefinite holding.
- **Tab 3: Auto Clicker**: Choose mouse buttons, set millisecond intervals, and specify click counts or run indefinitely.
- **Global Delay**: A startup delay (default 3s) is applied globally across all tasks to give you time to switch focus to your target VNC window.
- **Global Abort**: Pressing the **`Esc`** key at any point (even if focused inside the VNC window) will immediately abort any typing, holding, or clicking operations.

---

## CLI Tool — `vnc_helper_cli.py`

Driven by arguments, perfect for one-shot command-line usage or batch scripting.

```bash
# 1. Typer Mode (Default): Types clipboard content
python vnc_helper_cli.py --mode typer

# Type inline text
python vnc_helper_cli.py --mode typer --text "echo 'Hello World'"

# Type from a file
python vnc_helper_cli.py --mode typer --file script.sh

# 2. Key Holder Mode: Hold 'w' key down for 10 seconds (default)
python vnc_helper_cli.py --mode hold --key w --duration 10.0

# Indefinite hold (Press Esc to release)
python vnc_helper_cli.py --mode hold --key space --duration 0

# 3. Auto Clicker Mode: Double-click left mouse button every 500ms
python vnc_helper_cli.py --mode click --button left --interval 0.5 --count 10
```

### CLI Arguments Reference

```text
  -h, --help            show this help message and exit
  -m, --mode {typer,hold,click}
                        Automation mode (default: typer)
  -d, --delay DELAY     Startup delay in seconds (default: 3)
  -t, --text TEXT       Inline text to type (for typer mode)
  -f, --file FILE       File containing text to type (for typer mode)
  -i, --interval INTERVAL
                        Interval: s/char for typer, or s/click for clicker (default: 0.03/0.1)
  -k, --key KEY         Key to hold down (for hold mode) (default: w)
  -dur, --duration DURATION
                        Duration in seconds to hold key (0 for indefinite, default: 10.0)
  -btn, --button {left,right,middle}
                        Mouse button to click (for click mode) (default: left)
  -c, --count COUNT     Number of clicks to perform (0 for indefinite, default: 100)
```

---

## Troubleshooting

- **Characters dropped**: Increase the **Interval (s/char)** setting (e.g. `0.06` or `0.08`) to compensate for VNC network latency.
- **Sticky Keys**: If modifier keys (like Shift or Ctrl) get stuck, the application will automatically perform a modifier release reset at the start of any run. Alternatively, closing the GUI releases all virtual keys.
- **Clicker issues on macOS/Linux**: The mouse auto-clicker relies on native Windows APIs (`ctypes`) to remain lightweight. On Linux, it falls back to calling `xdotool`. If `xdotool` is not installed, clicking will be skipped.
- **Linux Permission Error**: Run the script with root permissions: `sudo python vnc_helper_gui.py`.

---

## License
MIT
