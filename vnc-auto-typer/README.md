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

## 🚀 Building the Standalone EXE (Lite)

To keep the repository lightweight, we do not distribute the binary directly. You can build your own **13MB "Lite" version** using PyInstaller:

1. **Prerequisites**: Ensure you have Python and the requirements installed.
2. **Install PyInstaller**:
   ```bash
   pip install pyinstaller
   ```
3. **Run the Slim Build Command**:
   ```bash
   pyinstaller --onefile --windowed --name VNCAutoTyper_Lite --collect-all keyboard --exclude-module PyQt5 --exclude-module PyQt6 --exclude-module numpy --exclude-module cv2 --exclude-module matplotlib --exclude-module scipy --exclude-module pandas --exclude-module mkl vnc_typer_gui.py
   ```
4. The output will be located in the `dist/` folder as `VNCAutoTyper_Lite.exe`.

> [!TIP]
> **Why this command?** Standard PyInstaller builds can exceed 300MB if they pull in libraries like OpenCV or NumPy from your environment. The `--exclude-module` flags ensure you get the smallest possible file.

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
