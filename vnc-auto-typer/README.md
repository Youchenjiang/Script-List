# VNC Auto Typer

A lightweight tool that simulates keyboard input into a VNC window when the clipboard paste function is unavailable (e.g. on restricted platforms like CDX).

[閱讀繁體中文版](README.zh-TW.md)

## Description

When connecting to a remote virtual machine via a web-based VNC client (e.g. noVNC or CDX), copying and pasting text from the host machine is often blocked. This project allows you to paste text into a local window and automatically "type" it into the remote session using physical key events.

| Tool | Best for |
|---|---|
| `vnc_typer_gui.py` | **Repeated use** — a persistent always-on-top GUI window. |
| `vnc_auto_typer.py` | **One-shot / scripted use** — CLI tool driven by arguments or clipboard. |
| **Standalone EXE** | **No-install use** — Single file `VNCAutoTyper_Lite.exe`. |

---

## 🚀 Standalone Executable (Windows)

If you don't want to install Python or dependencies, you can use the pre-built portable version:

1. Locate `dist/VNCAutoTyper_Lite.exe`.
2. Run it (may require "Run as Administrator" for the `keyboard` engine to hook system events).
3. Follow the GUI instructions.

> [!TIP]
> **Anti-virus Note**: Standalone EXEs created by PyInstaller are sometimes flagged as false positives. You may need to click "Run anyway" in Windows Defender.

---

## Prerequisites (Script Version)

- **Python 3.8+**
- **Requirements**: `pip install keyboard pyperclip`
- **Permissions**: The `keyboard` library requires **Administrator** (Windows) or **root/sudo** (Linux) privileges to simulate physical key presses correctly across the VNC tunnel.

---

## GUI Tool — `vnc_typer_gui.py` *(Recommended)*

A persistent, compact window that stays visible while you work in VNC.

### Features
- **Always on top**: Never loses focus behind your browser.
- **Immediate Abort**: Interrupt typing instantly at any character.
- **Real-time Progress**: Visual bar shows typing completion.
- **Unicode Support**: Safely types Chinese/special characters.

### Usage
```bash
python vnc_typer_gui.py
```

1. **Paste** text into the text area.
2. Click **"Send to VNC"** (or press **Ctrl+Enter**) — countdown starts.
3. **Switch to your VNC window** and click inside the text field.
4. The tool types the text automatically.

---

## CLI Tool — `vnc_auto_typer.py`

Driven by command line arguments for scripting or one-off tasks.

```bash
# Type from clipboard (default)
python vnc_auto_typer.py

# Type from a file
python vnc_auto_typer.py -f script.sh

# Type specific string
python vnc_auto_typer.py -t "echo hello world"
```

---

## Troubleshooting

- **Characters dropped**: Increase the **Interval (s/char)** setting (e.g., `0.06` or `0.08`) to compensate for VNC network lag.
- **Stuck Keys**: If the Shift key gets "stuck" (typing in all caps), the tool now includes an automatic modifier reset at the start of every task.
- **Special characters garbled**: We use a canonical key map and `keyboard.write()` for maximum compatibility with VNC tunnels.
- **Linux Permission Error**: Run with `sudo python vnc_typer_gui.py`.

---

## License
MIT
