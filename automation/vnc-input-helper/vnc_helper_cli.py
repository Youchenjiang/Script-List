"""
VNC Input Helper — Command Line Interface
========================================
Supports three automation modes:
1. typer: Simulates typing text into a focused VNC session.
2. hold: Simulates holding down a physical keyboard key.
3. click: Simulates auto-clicking mouse buttons.

Press 'Esc' at any time to abort the running operation.
"""

import argparse
import sys
import time
import subprocess

# Backend keyboard library check
try:
    import keyboard as _kb
    KEYBOARD_OK = True
except ImportError:
    KEYBOARD_OK = False

# Backend clipboard library
try:
    import pyperclip
    CLIPBOARD_OK = True
except ImportError:
    CLIPBOARD_OK = False


def mouse_click(button: str = "left", x: int = None, y: int = None) -> None:
    """Simulate a mouse click using Windows API or fallback to xdotool on Linux/macOS.
    If x and y are provided, move to that position first."""
    if sys.platform == "win32":
        import ctypes
        user32 = ctypes.windll.user32
        if x is not None and y is not None:
            screen_w = user32.GetSystemMetrics(0)
            screen_h = user32.GetSystemMetrics(1)
            abs_x = int(x * 65535 / screen_w)
            abs_y = int(y * 65535 / screen_h)
            user32.mouse_event(0x8000 | 0x0001, abs_x, abs_y, 0, 0)  # ABSOLUTE | MOVE
            time.sleep(0.01)
        if button == "left":
            user32.mouse_event(0x0002, 0, 0, 0, 0)  # Left down
            user32.mouse_event(0x0004, 0, 0, 0, 0)  # Left up
        elif button == "right":
            user32.mouse_event(0x0008, 0, 0, 0, 0)  # Right down
            user32.mouse_event(0x0010, 0, 0, 0, 0)  # Right up
        elif button == "middle":
            user32.mouse_event(0x0020, 0, 0, 0, 0)  # Middle down
            user32.mouse_event(0x0040, 0, 0, 0, 0)  # Middle up
    else:
        # Fallback for Linux (needs xdotool installed)
        if x is not None and y is not None:
            try:
                subprocess.run(["xdotool", "mousemove", str(x), str(y)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            except Exception:
                pass
        btn_map = {"left": "1", "middle": "2", "right": "3"}
        btn = btn_map.get(button, "1")
        try:
            subprocess.run(["xdotool", "click", btn], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception:
            pass


def get_cursor_pos():
    """Get current cursor position (Windows only)."""
    if sys.platform == "win32":
        import ctypes
        point = ctypes.wintypes.POINT()
        ctypes.windll.user32.GetCursorPos(ctypes.byref(point))
        return point.x, point.y
    return 0, 0


def pick_position():
    """Interactive coordinate picker: track mouse, Enter to confirm, Esc to cancel."""
    print("=== Mouse Position Picker ===")
    print("Move mouse to target, press Enter to confirm, Esc to cancel.\n")
    if sys.platform != "win32":
        print("Error: --pick only supports Windows.")
        return None, None
    import ctypes
    VK_RETURN = 0x0D
    VK_ESCAPE = 0x1B
    user32 = ctypes.windll.user32
    last_pos = None
    while True:
        if user32.GetAsyncKeyState(VK_RETURN) & 0x8000:
            x, y = get_cursor_pos()
            print(f"\nConfirmed: ({x}, {y})")
            return x, y
        if user32.GetAsyncKeyState(VK_ESCAPE) & 0x8000:
            print("\nCancelled.")
            return None, None
        x, y = get_cursor_pos()
        if (x, y) != last_pos:
            print(f"\r  Position: ({x}, {y})  ", end="", flush=True)
            last_pos = (x, y)
        time.sleep(0.05)


def _release_modifiers() -> None:
    """Safely release any stuck modifier keys."""
    if KEYBOARD_OK:
        for mod in ["shift", "ctrl", "alt", "windows"]:
            try:
                _kb.release(mod)
            except Exception:
                pass


def run_countdown(delay: int) -> bool:
    """Run countdown in console. Returns False if aborted via Ctrl+C or Esc."""
    try:
        for i in range(delay, 0, -1):
            if KEYBOARD_OK and _kb.is_pressed("esc"):
                print("\n⛔ Operation aborted before starting!")
                return False
            print(f"\r⏳ Starting in {i}s (Press Esc to Cancel)...", end="", flush=True)
            time.sleep(1)
        print("\r🚀 Started!                      ")
        return True
    except KeyboardInterrupt:
        print("\n⛔ Aborted")
        return False


def run_typer(text: str, interval: float) -> None:
    """Simulate typing character by character, check Esc at each step."""
    _release_modifiers()
    print("⌨️  Typing text... Press Esc to STOP.")
    
    try:
        for char in text:
            if KEYBOARD_OK and _kb.is_pressed("esc"):
                print("\n⛔ Typing Aborted")
                return
            
            if KEYBOARD_OK:
                _kb.write(char)
            if interval > 0:
                time.sleep(interval)
        print("\n✅ Done!")
    except KeyboardInterrupt:
        print("\n⛔ Typing Aborted")


def run_hold(key: str, duration: float) -> None:
    """Hold down a physical keyboard key for a duration or indefinitely."""
    _release_modifiers()
    if not KEYBOARD_OK:
        print("Error: keyboard library not available.")
        return
        
    print(f"🔒 Holding key '{key}'... Press Esc to RELEASE/STOP.")
    try:
        _kb.press(key)
        
        start_time = time.time()
        while True:
            # Check abort
            if _kb.is_pressed("esc"):
                print("\n⛔ Key Hold Aborted")
                break
                
            # Check duration timeout
            if duration > 0 and (time.time() - start_time) >= duration:
                print(f"\n✅ Finished key hold ({duration}s)")
                break
                
            time.sleep(0.05)
    except KeyboardInterrupt:
        print("\n⛔ Key Hold Aborted")
    finally:
        _kb.release(key)


def run_clicker(button: str, interval: float, count: int, x: int = None, y: int = None) -> None:
    """Click mouse repeatedly at interval for count times or indefinitely.
    If x and y are provided, click at that position; otherwise click at current cursor."""
    pos_str = f"at ({x}, {y})" if x is not None else "at cursor"
    print(f"🖱️  Clicking '{button}' button {pos_str}... Press Esc to STOP.")
    clicks_done = 0
    try:
        while True:
            if KEYBOARD_OK and _kb.is_pressed("esc"):
                print("\n⛔ Clicker Aborted")
                break
                
            mouse_click(button, x, y)
            clicks_done += 1
            
            if count > 0 and clicks_done >= count:
                print(f"\n✅ Finished clicking {count} times")
                break
                
            time.sleep(interval)
    except KeyboardInterrupt:
        print("\n⛔ Clicker Aborted")


def main() -> None:
    parser = argparse.ArgumentParser(description="VNC Input Helper CLI")
    parser.add_argument("-m", "--mode", choices=["typer", "hold", "click"], default="typer",
                        help="Automation mode (default: typer)")
    parser.add_argument("-d", "--delay", type=int, default=3,
                        help="Startup delay in seconds (default: 3)")
    
    # Typer args
    parser.add_argument("-t", "--text", help="Inline text to type (for typer mode)")
    parser.add_argument("-f", "--file", help="File containing text to type (for typer mode)")
    parser.add_argument("-i", "--interval", type=float, default=0.03,
                        help="Interval: s/char for typer, or s/click for clicker (default: 0.03/0.1)")
    
    # Hold args
    parser.add_argument("-k", "--key", default="w", help="Key to hold down (for hold mode)")
    parser.add_argument("-dur", "--duration", type=float, default=10.0,
                        help="Duration in seconds to hold key (0 for indefinite, default: 10.0)")
    
    # Clicker args
    parser.add_argument("-btn", "--button", choices=["left", "right", "middle"], default="left",
                        help="Mouse button to click (for click mode)")
    parser.add_argument("-c", "--count", type=int, default=100,
                        help="Number of clicks to perform (0 for indefinite, default: 100)")
    parser.add_argument("--x", type=int, help="Target X coordinate for clicking")
    parser.add_argument("--y", type=int, help="Target Y coordinate for clicking")
    parser.add_argument("--pick", action="store_true",
                        help="Interactive coordinate picker mode (Enter to confirm, Esc to cancel)")
    parser.add_argument("--now", action="store_true",
                        help="Skip startup delay and start immediately")
    
    args = parser.parse_args()

    # Handle --pick mode
    if args.pick:
        x, y = pick_position()
        if x is None:
            return
        args.x, args.y = x, y

    # Determine text to type if in typer mode
    if args.mode == "typer":
        if args.text:
            text = args.text
        elif args.file:
            try:
                with open(args.file, "r", encoding="utf-8") as f:
                    text = f.read()
            except Exception as e:
                print(f"Error reading file: {e}")
                sys.exit(1)
        elif CLIPBOARD_OK:
            text = pyperclip.paste()
            if not text:
                print("Clipboard is empty and no text/file arguments were provided.")
                return
        else:
            print("Error: No input text provided, and pyperclip is not available to read clipboard.")
            sys.exit(1)
            
        if not text:
            print("No text to type.")
            return

    # Run Countdown (skip if --now)
    if not args.now:
        if not run_countdown(args.delay):
            return

    # Run selected mode
    if args.mode == "typer":
        run_typer(text, args.interval)
    elif args.mode == "hold":
        run_hold(args.key, args.duration)
    elif args.mode == "click":
        # Clicker uses interval argument. If user didn't override the default typer interval (0.03),
        # click interval should ideally default to 0.1s. Let's make clicker default interval 0.1s if unmodified.
        click_interval = args.interval if args.interval != 0.03 else 0.1
        run_clicker(args.button, click_interval, args.count, args.x, args.y)


if __name__ == "__main__":
    if not KEYBOARD_OK:
        print("Warning: keyboard module not found. Keyboard simulation might fail.")
    main()
