"""
VNC Auto Typer
==============
A tool to simulate keyboard input into a VNC window when clipboard paste
is unavailable.
"""

import argparse
import sys
import time
import pyperclip

try:
    import keyboard as _kb
    KEYBOARD_OK = True
except ImportError:
    KEYBOARD_OK = False


def _smart_write(text: str, interval: float) -> None:
    # Cleanup modifiers
    if KEYBOARD_OK:
        for mod in ['shift', 'ctrl', 'alt', 'windows']:
            try: _kb.release(mod)
            except: pass
        _kb.write(text, delay=interval)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("-t", "--text")
    parser.add_argument("-f", "--file")
    parser.add_argument("-d", "--delay", type=int, default=3)
    parser.add_argument("-i", "--interval", type=float, default=0.03)
    args = parser.parse_args()

    if args.text: text = args.text
    elif args.file:
        with open(args.file, "r", encoding="utf-8") as f: text = f.read()
    else:
        text = pyperclip.paste()

    if not text: return

    for i in range(args.delay, 0, -1):
        print(f"\r⏳ {i}s ...", end="", flush=True)
        time.sleep(1)
    print("\r✅ Typing started!")

    try:
        _smart_write(text, args.interval)
        print("✅ Done!")
    except KeyboardInterrupt:
        print("\n⛔ Aborted")


if __name__ == "__main__":
    if not KEYBOARD_OK:
        print("Error: keyboard module not found.")
        sys.exit(1)
    main()
