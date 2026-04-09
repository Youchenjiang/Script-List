# VNC Auto Typer

A lightweight Python utility that simulates keyboard input into a VNC window when the clipboard paste function is unavailable (e.g. on restricted platforms like CDX).

## Description

When connecting to a remote virtual machine via a web-based VNC client (e.g. noVNC), copying and pasting text from the host machine is often blocked. This tool reads text from your **local clipboard**, a **file**, or an **inline argument** and types it character-by-character into the focused VNC window using `pyautogui`.

An optional `--xdotool` mode is also available: instead of controlling the mouse/keyboard directly, it prints `xdotool type` shell commands to stdout so you can pipe them to `bash` from *inside* the VM.

## Prerequisites

- Python 3.8+
- A clipboard manager (required for the default clipboard mode):
  - **Windows / macOS**: built-in clipboard access, no extra setup needed.
  - **Linux**: install `xclip` or `xsel` (`sudo apt install xclip`).
- `xdotool` (optional, Linux only, for `--xdotool` mode): `sudo apt install xdotool`

## Installation

1. Install the required Python packages:
   ```bash
   pip install -r requirements.txt
   ```

## Usage

### Default Mode (clipboard → pyautogui)

1. Copy the text you want to paste into the VNC window on your **host machine**.
2. Ensure the VNC window is visible on screen.
3. Run the script (you have 3 seconds to click inside the VNC window):

```bash
python vnc_auto_typer.py
```

### Type Text Directly

```bash
python vnc_auto_typer.py -t "echo hello world"
```

### Type from a File

```bash
python vnc_auto_typer.py -f path/to/script.sh
```

### Options

| Option | Default | Description |
|---|---|---|
| `-t`, `--text` TEXT | — | Inline text to type (mutually exclusive with `--file`). |
| `-f`, `--file` FILE | — | Path to a plain-text file to type (mutually exclusive with `--text`). |
| `-d`, `--delay` SECONDS | `3` | Countdown before typing starts (time to click inside VNC). |
| `-i`, `--interval` SECONDS | `0.03` | Seconds between each keystroke. Increase for laggy connections. |
| `--xdotool` | off | Print `xdotool type` commands to stdout instead of using pyautogui. |
| `--no-countdown` | off | Skip the countdown and start typing immediately. |

### Examples

```bash
# Type clipboard contents with the default 3-second countdown
python vnc_auto_typer.py

# Custom 5-second countdown (more time to switch windows)
python vnc_auto_typer.py --delay 5

# Slow typing on a laggy VNC connection (0.1 s between keystrokes)
python vnc_auto_typer.py --interval 0.1

# Type from a shell script file
python vnc_auto_typer.py -f setup.sh --interval 0.05

# Type a one-liner immediately (no countdown)
python vnc_auto_typer.py -t "sudo apt update" --no-countdown

# Generate xdotool commands and run them inside the VM
python vnc_auto_typer.py -f commands.sh --xdotool | bash
```

## How It Works

1. Reads text from the clipboard (`pyperclip`), a file, or an inline argument.
2. Prints a live countdown so you have time to click inside the VNC window.
3. Calls `pyautogui.write()` to simulate individual keystrokes at the configured interval.
4. `pyautogui`'s **fail-safe** is enabled by default — move the mouse to the **top-left corner** of the screen to abort typing immediately (or press `Ctrl+C`).

## Tips

- **Characters are dropped**: Increase `--interval` (e.g. `0.05` or `0.1`).
- **Special characters not typed correctly**: `pyautogui.write()` only supports printable ASCII. For Unicode or special keys, consider the `--xdotool` mode on Linux.
- **Abort anytime**: Move your mouse to the **top-left corner** of the screen (pyautogui fail-safe) or press `Ctrl+C`.
