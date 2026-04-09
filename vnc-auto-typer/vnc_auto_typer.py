"""
VNC Auto Typer
==============
A tool to simulate keyboard input into a VNC window when clipboard paste
is unavailable. Reads text from the local clipboard (or a file) and types
it character-by-character into the focused window, giving you time to
switch to the VNC window before typing begins.

Default backend: ``keyboard`` — handles special characters (quotes, colons,
hyphens, etc.) correctly. Use ``--backend pyautogui`` only as a fallback.
"""

import argparse
import sys
import time

import pyperclip


# ─── Helpers ────────────────────────────────────────────────────────────────

def countdown(seconds: int) -> None:
    """Print a live countdown so you can switch to the VNC window in time."""
    for i in range(seconds, 0, -1):
        print(f"\r⏳ Starting in {i}s … (switch to VNC window now)", end="", flush=True)
        time.sleep(1)
    print("\r✅ Typing started!                                    ")


def type_text(text: str, interval: float, use_xdotool: bool, backend: str) -> None:
    """
    Type *text* character-by-character.

    Parameters
    ----------
    text        : The string to type.
    interval    : Seconds between each keystroke.
    use_xdotool : If True, emit xdotool shell commands to stdout instead of
                  using a local keyboard backend. Useful when this script is
                  run inside a Linux VM that has xdotool installed.
    backend     : 'keyboard' (default) or 'pyautogui'.
                  - 'keyboard'  uses the ``keyboard`` library which sends raw
                    character events and handles special chars (', :, -, etc.)
                    correctly even through VNC.
                  - 'pyautogui' uses pyautogui.write() which maps chars to
                    virtual key codes; may produce garbled output for special
                    characters in VNC sessions.
    """
    if use_xdotool:
        # Emit xdotool shell commands to stdout so the caller can pipe them.
        # Useful for: python vnc_auto_typer.py | bash
        for char in text:
            # xdotool type handles most printable ASCII.
            # Escape single-quotes for the shell.
            safe = char.replace("'", "'\\''")
            print(f"xdotool type --clearmodifiers --delay {int(interval * 1000)} '{safe}'")
        return

    if backend == "keyboard":
        try:
            import keyboard as kb
        except ImportError:
            print(
                "❌  'keyboard' library not found. Install it with:\n"
                "    pip install keyboard\n"
                "Or use --backend pyautogui as a fallback.",
                file=sys.stderr,
            )
            sys.exit(1)
        # keyboard.write() sends actual character events — special chars work.
        kb.write(text, delay=interval)
    else:
        # pyautogui fallback
        import pyautogui
        pyautogui.FAILSAFE = True          # Move mouse to top-left corner to abort
        pyautogui.write(text, interval=interval)


# ─── CLI ────────────────────────────────────────────────────────────────────

def build_parser() -> argparse.ArgumentParser:  # noqa: PLR0915
    parser = argparse.ArgumentParser(
        prog="vnc_auto_typer",
        description=(
            "Simulate keyboard input into a VNC window when clipboard paste "
            "is unavailable. By default the text is read from your local "
            "clipboard. The default backend is 'keyboard' which handles special "
            "characters (quotes, colons, hyphens …) correctly through VNC."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples
--------
  # Type whatever is in your clipboard (3-second countdown):
  python vnc_auto_typer.py

  # Type the contents of a file with a 5-second lead-in:
  python vnc_auto_typer.py -f script.sh --delay 5

  # Type a one-liner directly:
  python vnc_auto_typer.py -t "echo hello"

  # Slow typing (0.05 s/char) to avoid dropped characters on laggy connections:
  python vnc_auto_typer.py --interval 0.05

  # Use pyautogui if the keyboard library is unavailable:
  python vnc_auto_typer.py --backend pyautogui

  # Output xdotool commands instead (run inside the Linux VM):
  python vnc_auto_typer.py --xdotool | bash
""",
    )

    source = parser.add_mutually_exclusive_group()
    source.add_argument(
        "-t", "--text",
        metavar="TEXT",
        help="Text string to type. Cannot be used together with --file.",
    )
    source.add_argument(
        "-f", "--file",
        metavar="FILE",
        help="Path to a plain-text file whose contents will be typed. "
             "Cannot be used together with --text.",
    )

    parser.add_argument(
        "-d", "--delay",
        type=int,
        default=3,
        metavar="SECONDS",
        help="Countdown (seconds) before typing starts, giving you time to "
             "click inside the VNC window. Default: 3.",
    )
    parser.add_argument(
        "-i", "--interval",
        type=float,
        default=0.03,
        metavar="SECONDS",
        help="Interval between keystrokes in seconds. Increase this value "
             "(e.g. 0.05–0.1) if characters are dropped on slow connections. "
             "Default: 0.03.",
    )
    parser.add_argument(
        "--xdotool",
        action="store_true",
        help="Instead of using a local keyboard backend, print xdotool type "
             "commands to stdout. Useful when this script is run inside a Linux "
             "VM that has xdotool installed (pipe the output to bash).",
    )
    parser.add_argument(
        "--no-countdown",
        action="store_true",
        help="Skip the countdown entirely. Typing begins immediately.",
    )
    parser.add_argument(
        "--backend",
        choices=["keyboard", "pyautogui"],
        default="keyboard",
        help="Keyboard backend to use. 'keyboard' (default) handles special "
             "characters correctly through VNC. 'pyautogui' maps chars to "
             "virtual key codes and may garble quotes/colons/hyphens in a VNC "
             "session.",
    )

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    # ── Determine source text ────────────────────────────────────────────────
    if args.text:
        text = args.text
        print(f"📝 Source : inline text ({len(text)} chars)")
    elif args.file:
        try:
            with open(args.file, "r", encoding="utf-8") as fh:
                text = fh.read()
        except FileNotFoundError:
            print(f"❌ File not found: {args.file}", file=sys.stderr)
            sys.exit(1)
        except OSError as exc:
            print(f"❌ Cannot read file: {exc}", file=sys.stderr)
            sys.exit(1)
        print(f"📄 Source : {args.file} ({len(text)} chars)")
    else:
        # Default: read from clipboard
        try:
            text = pyperclip.paste()
        except pyperclip.PyperclipException as exc:
            print(f"❌ Clipboard error: {exc}", file=sys.stderr)
            print(
                "   Tip: pass text directly with -t 'your text' "
                "or from a file with -f path/to/file.txt",
                file=sys.stderr,
            )
            sys.exit(1)

        if not text:
            print("⚠️  Clipboard is empty. Nothing to type.", file=sys.stderr)
            sys.exit(1)

        print(f"📋 Source : clipboard ({len(text)} chars)")

    # ── Countdown ────────────────────────────────────────────────────────────
    if not args.no_countdown and not args.xdotool:
        print(f"⚙️  Backend  : {args.backend}")
        print(f"⚙️  Interval : {args.interval} s/char")
        countdown(args.delay)
    elif args.xdotool:
        print("# Generated by vnc_auto_typer --xdotool", flush=True)

    # ── Type ─────────────────────────────────────────────────────────────────
    try:
        type_text(text, interval=args.interval, use_xdotool=args.xdotool, backend=args.backend)
    except KeyboardInterrupt:
        print("\n⛔ Aborted by user (Ctrl+C / mouse to top-left corner).")
        sys.exit(130)

    if not args.xdotool:
        print("✅ Done!")


if __name__ == "__main__":
    main()
