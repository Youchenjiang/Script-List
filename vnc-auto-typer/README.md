# VNC Auto Typer

A lightweight Python utility that simulates keyboard input into a VNC window when the clipboard paste function is unavailable (e.g. on restricted platforms like CDX).

[閱讀繁體中文版](README.zh-TW.md)

## Description

When connecting to a remote virtual machine via a web-based VNC client (e.g. noVNC), copying and pasting text from the host machine is often blocked. This project provides **two tools** to work around that limitation:

| Tool | Best for |
|---|---|
| `vnc_typer_gui.py` | **Repeated use** — a persistent always-on-top window; paste and fire with one click |
| `vnc_auto_typer.py` | **One-shot / scripted use** — CLI tool driven by arguments or clipboard |

## Prerequisites

- **Python 3.8+**
- **tkinter** — used by the GUI tool; ships with Python on Windows and macOS.
  On Linux: `sudo apt install python3-tk`

## Installation

Install all dependencies in one step:

```bash
pip install -r requirements.txt
```

### What each package does

| Package | Role | Notes |
|---|---|---|
| `keyboard` | **Primary typing backend** | Sends raw character events — handles `'`, `:`, `-` and other special characters correctly through VNC. May require administrator/root privileges. |
| `pyautogui` | Fallback typing backend | Maps characters to virtual key codes; may garble special characters in a VNC session. |
| `pyperclip` | Clipboard reading | Used by `vnc_auto_typer.py` default (clipboard) mode. Needs `xclip` or `xsel` on Linux. |

---

## GUI Tool — `vnc_typer_gui.py` *(recommended)*

A persistent, always-on-top window that stays visible while you work in VNC.

### Usage

```bash
python vnc_typer_gui.py
```

### Workflow

1. The window appears in the top-right corner of your screen and stays on top.
2. **Paste** the text you want to type into the text area.
3. Click **"Send to VNC"** (or press **Ctrl+Enter**) — the countdown starts.
4. **Switch to the VNC window** and click where you want the cursor.
5. The text is typed automatically.
6. The GUI resets — repeat from step 2 for the next snippet.
7. **Close the window** to exit.

### GUI Options

| Control | Default | Description |
|---|---|---|
| Delay (s) | `5` | Countdown seconds before typing starts. |
| Interval (s/char) | `0.04` | Pause between each keystroke. Increase for laggy connections. |
| Backend | `keyboard` | Choose between `keyboard` (recommended) and `pyautogui` (fallback). |
| Always on top | ✅ on | Keeps the window above all other windows. |
| Abort button | — | Appears during countdown/typing; click to cancel immediately. |

---

## CLI Tool — `vnc_auto_typer.py`

For one-off use or scripting.

### Default Mode (clipboard → type)

1. Copy text on your host machine.
2. Switch to the VNC window so it is visible.
3. Run the script:

```bash
python vnc_auto_typer.py
```

### Other input modes

```bash
# Type from a file
python vnc_auto_typer.py -f path/to/script.sh

# Type an inline string
python vnc_auto_typer.py -t "echo hello world"
```

### All CLI options

| Option | Default | Description |
|---|---|---|
| `-t`, `--text` TEXT | — | Inline text to type (mutually exclusive with `--file`). |
| `-f`, `--file` FILE | — | Plain-text file to type (mutually exclusive with `--text`). |
| `-d`, `--delay` SECONDS | `3` | Countdown before typing starts. |
| `-i`, `--interval` SECONDS | `0.03` | Seconds between keystrokes. |
| `--backend` | `keyboard` | `keyboard` (recommended) or `pyautogui` (fallback). |
| `--xdotool` | off | Print `xdotool type` commands to stdout instead of typing locally. |
| `--no-countdown` | off | Skip the countdown; start typing immediately. |

### CLI examples

```bash
# Clipboard with 5-second countdown
python vnc_auto_typer.py --delay 5

# Laggy connection — slow down to 0.1 s/char
python vnc_auto_typer.py --interval 0.1

# Pipe xdotool commands into bash inside the VM
python vnc_auto_typer.py -f setup.sh --xdotool | bash
```

---

## Tips

- **Characters dropped**: Increase `--interval` / Interval setting (try `0.07`–`0.1`).
- **Abort anytime**: Click the **Abort** button in the GUI, or press `Ctrl+C` in the terminal. The `pyautogui` backend also aborts if you move the mouse to the **top-left corner** of the screen.
- **Special characters garbled**: Make sure the `keyboard` backend is selected (default). The `pyautogui` backend uses virtual key codes which VNC may remap incorrectly.
- **Linux `keyboard` permission error**: Run with `sudo python vnc_typer_gui.py`.
