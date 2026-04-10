"""
VNC Auto Typer – Persistent GUI
================================
A compact, always-on-top window that lets you paste any text and fire it
into a focused VNC session at the press of a button (or Ctrl+Enter).

Workflow
--------
1. Run this script.  The window appears and stays on top of all other windows.
2. Paste the text you want to type into the VNC session into the text area.
3. Click "Send to VNC" (or press Ctrl+Enter).  A countdown begins.
4. Switch to the VNC window and click wherever you want the text to appear.
5. The text is typed automatically.  The GUI resets and waits for the next paste.
6. Close the window to exit.
"""

import sys
import threading
import time
import tkinter as tk
from tkinter import ttk


# ── Backend availability checks ──────────────────────────────────────────────

try:
    import keyboard as _kb          # primary – handles special chars correctly
    KEYBOARD_OK = True
except ImportError:
    KEYBOARD_OK = False

try:
    import pyautogui as _pag        # fallback
    PYAUTOGUI_OK = True
except ImportError:
    PYAUTOGUI_OK = False


# ── Colour palette ───────────────────────────────────────────────────────────

C = {
    "bg":           "#1e1e2e",
    "surface":      "#2a2a3e",
    "accent":       "#7c3aed",
    "accent_hover": "#6d28d9",
    "danger":       "#ef4444",
    "success":      "#22c55e",
    "warning":      "#f59e0b",
    "text":         "#e2e8f0",
    "muted":        "#94a3b8",
    "border":       "#374151",
    "input":        "#111827",
}


# ── Special-character key map (for keyboard backend) ─────────────────────────
#
# keyboard.write() sends characters as Unicode injection events (KEYEVENTF_UNICODE
# on Windows).  VNC clients often do NOT forward these synthetic events to the
# guest OS.  Characters that need Shift or a non-printable scan code (e.g. '-',
# ':', '"') must be sent as physical key press+release events instead.
#
# Format: char -> (shift_required, key_name_for_keyboard_library)

_KEY_MAP: dict[str, tuple[bool, str]] = {
    # Unshifted punctuation
    '-':  (False, 'minus'),
    '=':  (False, '='),
    '[':  (False, '['),
    ']':  (False, ']'),
    '\\': (False, '\\'),
    ';':  (False, ';'),
    "'":  (False, "'"),
    ',':  (False, ','),
    '.':  (False, '.'),
    '/':  (False, '/'),
    '`':  (False, '`'),
    ' ':  (False, 'space'),
    '\t': (False, 'tab'),
    '\n': (False, 'enter'),
    # Shifted punctuation / symbols
    '!':  (True,  '1'),
    '@':  (True,  '2'),
    '#':  (True,  '3'),
    '$':  (True,  '4'),
    '%':  (True,  '5'),
    '^':  (True,  '6'),
    '&':  (True,  '7'),
    '*':  (True,  '8'),
    '(':  (True,  '9'),
    ')':  (True,  '0'),
    '_':  (True,  'minus'),
    '+':  (True,  '='),
    '{':  (True,  '['),
    '}':  (True,  ']'),
    '|':  (True,  '\\'),
    ':':  (True,  ';'),
    '"':  (True,  "'"),
    '<':  (True,  ','),
    '>':  (True,  '.'),
    '?':  (True,  '/'),
    '~':  (True,  '`'),
}


def _smart_write(text: str, interval: float) -> None:
    """Type *text* using physical press+release events for every character.

    Unlike ``keyboard.write()`` (which uses Unicode injection that VNC may
    ignore), this function uses ``keyboard.press_and_release()`` for all
    characters so VNC receives proper scan-code events.

    - Printable ASCII letters/digits: press the key directly.
    - Uppercase letters: Shift + lowercase.
    - Punctuation / symbols: look up in ``_KEY_MAP`` for the correct key +
      optional Shift modifier.
    """
    for char in text:
        if char in _KEY_MAP:
            shift, key = _KEY_MAP[char]
            combo = f"shift+{key}" if shift else key
            _kb.press_and_release(combo)
        elif char.isupper():
            _kb.press_and_release(f"shift+{char.lower()}")
        elif char.isascii() and char.isprintable():
            _kb.press_and_release(char)
        # silently skip non-ASCII / non-printable characters
        if interval:
            time.sleep(interval)


# ── App ──────────────────────────────────────────────────────────────────────

class VNCTyperApp:
    """Persistent GUI application for VNC Auto Typer."""

    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self._typing = False
        self._abort_event = threading.Event()
        self._topmost_var = tk.BooleanVar(value=True)

        self._configure_root()
        self._build_ui()
        self._apply_topmost()

    # ── Root window setup ────────────────────────────────────────────────────

    def _configure_root(self) -> None:
        self.root.title("VNC Auto Typer")
        self.root.configure(bg=C["bg"])
        self.root.resizable(True, True)
        self.root.minsize(420, 500)
        self.root.geometry("480x580")

        # Use grid for the root window.  rowconfigure(weight) locks row sizes
        # so that dynamic content changes (button text, status, progress bar)
        # in one row can never shift elements in another row.
        self.root.grid_columnconfigure(0, weight=1)
        self.root.grid_rowconfigure(0, weight=0)   # header  – fixed
        self.root.grid_rowconfigure(1, weight=1)   # top     – expands
        self.root.grid_rowconfigure(2, weight=0)   # bottom  – fixed

        # Place window in top-right corner
        self.root.update_idletasks()
        sw = self.root.winfo_screenwidth()
        self.root.geometry(f"+{sw - 500}+30")

    # ── UI construction ──────────────────────────────────────────────────────
    #
    # Root grid layout:
    #   row 0  weight=0  header_frame   ← always-on-top bar   (fixed)
    #   row 1  weight=1  top_frame      ← label + text area   (expands)
    #   row 2  weight=0  bottom_frame   ← controls            (fixed)
    #
    # Internal layouts inside each frame still use pack for brevity.

    def _build_ui(self) -> None:
        self._build_header()        # grid row 0
        self._build_top_panel()     # grid row 1  (weight=1, expands)
        self._build_bottom_panel()  # grid row 2
        # Global hotkey: Ctrl+Enter → Send
        self.root.bind("<Control-Return>", lambda _e: self._on_send_clicked())

    # ── Header  (row 0) ──────────────────────────────────────────────────────

    def _build_header(self) -> None:
        header = tk.Frame(self.root, bg=C["surface"], pady=10)
        header.grid(row=0, column=0, sticky="ew")

        tk.Label(
            header,
            text="⌨  VNC Auto Typer",
            bg=C["surface"], fg=C["text"],
            font=("Segoe UI", 13, "bold"),
        ).pack(side="left", padx=14)

        tk.Checkbutton(
            header,
            text="Always on top",
            variable=self._topmost_var,
            command=self._apply_topmost,
            bg=C["surface"], fg=C["muted"],
            selectcolor=C["surface"],
            activebackground=C["surface"], activeforeground=C["text"],
            font=("Segoe UI", 9), borderwidth=0,
        ).pack(side="right", padx=14)

    # ── Top panel – label + text area  (row 1) ───────────────────────────────

    def _build_top_panel(self) -> None:
        top = tk.Frame(self.root, bg=C["bg"])
        top.grid(row=1, column=0, sticky="nsew")
        top.grid_columnconfigure(0, weight=1)
        top.grid_rowconfigure(1, weight=1)   # textarea row is the only expander

        tk.Label(
            top,
            text="Paste text to type into VNC:",
            bg=C["bg"], fg=C["muted"],
            font=("Segoe UI", 9), anchor="w",
        ).grid(row=0, column=0, sticky="ew", padx=14, pady=(10, 2))

        outer = tk.Frame(top, bg=C["border"], padx=1, pady=1)
        outer.grid(row=1, column=0, sticky="nsew", padx=14, pady=(0, 8))

        self.text_area = tk.Text(
            outer,
            bg=C["input"], fg=C["text"],
            insertbackground=C["text"],
            font=("Consolas", 10),
            relief="flat", wrap="none", undo=True,
            padx=10, pady=8,
        )

        vsb = tk.Scrollbar(outer, orient="vertical",   command=self.text_area.yview)
        hsb = tk.Scrollbar(outer, orient="horizontal", command=self.text_area.xview)
        self.text_area.configure(yscrollcommand=vsb.set, xscrollcommand=hsb.set)
        vsb.pack(side="right",  fill="y")
        hsb.pack(side="bottom", fill="x")
        self.text_area.pack(fill="both", expand=True)

        # Ctrl+A → select all inside text area
        self.text_area.bind("<Control-a>", lambda _e: (
            self.text_area.tag_add("sel", "1.0", "end"), "break"
        ))

    # ── Bottom panel – controls  (row 2) ─────────────────────────────────────

    def _build_bottom_panel(self) -> None:
        bottom = tk.Frame(self.root, bg=C["bg"])
        bottom.grid(row=2, column=0, sticky="ew")

        self._build_settings(bottom)
        self._build_status_bar(bottom)
        self._build_send_button(bottom)

    def _build_settings(self, parent: tk.Frame) -> None:
        frame = tk.Frame(parent, bg=C["bg"])
        frame.pack(fill="x", padx=14, pady=(4, 2))

        # Row 1: delay / interval / clear
        row1 = tk.Frame(frame, bg=C["bg"])
        row1.pack(fill="x")

        tk.Label(row1, text="Delay (s):", bg=C["bg"], fg=C["muted"],
                 font=("Segoe UI", 9)).pack(side="left")

        self._delay_var = tk.IntVar(value=5)
        tk.Spinbox(
            row1, from_=1, to=30, textvariable=self._delay_var, width=4,
            bg=C["input"], fg=C["text"], insertbackground=C["text"],
            relief="flat", font=("Segoe UI", 10),
            buttonbackground=C["surface"],
        ).pack(side="left", padx=(4, 14))

        tk.Label(row1, text="Interval (s/char):", bg=C["bg"], fg=C["muted"],
                 font=("Segoe UI", 9)).pack(side="left")

        self._interval_var = tk.DoubleVar(value=0.04)
        tk.Spinbox(
            row1, from_=0.01, to=0.5, increment=0.01,
            textvariable=self._interval_var, width=6,
            bg=C["input"], fg=C["text"], insertbackground=C["text"],
            relief="flat", font=("Segoe UI", 10),
            buttonbackground=C["surface"], format="%.2f",
        ).pack(side="left", padx=(4, 0))

        tk.Button(
            row1, text="Clear",
            command=self._clear_text,
            bg=C["surface"], fg=C["muted"],
            activebackground=C["border"], activeforeground=C["text"],
            font=("Segoe UI", 9), relief="flat", padx=12, cursor="hand2",
        ).pack(side="right")

        # Row 2: backend selector
        row2 = tk.Frame(frame, bg=C["bg"])
        row2.pack(fill="x", pady=(4, 0))

        tk.Label(row2, text="Backend:", bg=C["bg"], fg=C["muted"],
                 font=("Segoe UI", 9)).pack(side="left")

        self._backend_var = tk.StringVar(value="keyboard")
        for val, label in [("keyboard", "keyboard  ✓ recommended"),
                            ("pyautogui", "pyautogui  (fallback)")]:
            state = "normal"
            if val == "keyboard" and not KEYBOARD_OK:
                label += "  [not installed]"
                state = "disabled"
            if val == "pyautogui" and not PYAUTOGUI_OK:
                label += "  [not installed]"
                state = "disabled"
            tk.Radiobutton(
                row2, text=label,
                variable=self._backend_var, value=val,
                state=state,
                bg=C["bg"], fg=C["muted"],
                selectcolor=C["bg"],
                activebackground=C["bg"], activeforeground=C["text"],
                font=("Segoe UI", 9),
            ).pack(side="left", padx=(6, 0))

    def _build_status_bar(self, parent: tk.Frame) -> None:
        self._status_var = tk.StringVar(
            value="Ready — paste text above, then click 'Send to VNC'."
        )
        # Fixed-height wrapper: pack_propagate(False) means the label's text
        # can change without altering this frame's height and reflowing the grid.
        status_wrap = tk.Frame(parent, bg=C["bg"], height=22)
        status_wrap.pack(fill="x", padx=14, pady=(6, 2))
        status_wrap.pack_propagate(False)

        self._status_label = tk.Label(
            status_wrap,
            textvariable=self._status_var,
            bg=C["bg"], fg=C["muted"],
            font=("Segoe UI", 9), anchor="w",
        )
        self._status_label.pack(fill="x")

        style = ttk.Style()
        style.theme_use("clam")
        style.configure(
            "VNC.Horizontal.TProgressbar",
            troughcolor=C["surface"],
            background=C["accent"],
            bordercolor=C["bg"],
            lightcolor=C["accent"],
            darkcolor=C["accent"],
        )
        self._progress = ttk.Progressbar(
            parent, orient="horizontal",
            mode="determinate",
            style="VNC.Horizontal.TProgressbar",
        )
        self._progress.pack(fill="x", padx=14, pady=(0, 4))

    def _build_send_button(self, parent: tk.Frame) -> None:
        self._send_btn = tk.Button(
            parent,
            text="⏎  Send to VNC   (Ctrl+Enter)",
            command=self._on_send_clicked,
            bg=C["accent"], fg="white",
            activebackground=C["accent_hover"], activeforeground="white",
            font=("Segoe UI", 12, "bold"),
            relief="flat", pady=14, cursor="hand2",
        )
        self._send_btn.pack(fill="x", padx=14, pady=(0, 14))

    # ── Callbacks ────────────────────────────────────────────────────────────

    def _apply_topmost(self) -> None:
        self.root.attributes("-topmost", self._topmost_var.get())

    def _clear_text(self) -> None:
        self.text_area.delete("1.0", "end")
        self._set_status("Cleared.  Paste new text and click Send.", C["muted"])
        self._progress["value"] = 0

    def _on_send_clicked(self) -> None:
        if self._typing:
            self._abort_event.set()
            return

        text = self.text_area.get("1.0", "end-1c")
        if not text.strip():
            self._set_status("⚠️  Nothing to type — paste text first.", C["warning"])
            return

        backend = self._backend_var.get()
        if backend == "keyboard" and not KEYBOARD_OK:
            self._set_status("❌  'keyboard' not installed.  Run: pip install keyboard", C["danger"])
            return
        if backend == "pyautogui" and not PYAUTOGUI_OK:
            self._set_status("❌  'pyautogui' not installed.  Run: pip install pyautogui", C["danger"])
            return

        self._abort_event.clear()
        self._typing = True
        self._send_btn.config(text="⛔  Abort", bg=C["danger"])

        threading.Thread(
            target=self._type_worker,
            args=(text, self._delay_var.get(), self._interval_var.get(), backend),
            daemon=True,
        ).start()

    # ── Background typing worker ─────────────────────────────────────────────

    def _type_worker(self, text: str, delay: int, interval: float, backend: str) -> None:
        # ── Countdown ────────────────────────────────────────────────────────
        for remaining in range(delay, 0, -1):
            if self._abort_event.is_set():
                self._finish("⛔  Aborted.", C["danger"])
                return
            pct = (delay - remaining) / delay * 100
            self._set_status(
                f"⏳  Switch to VNC and click cursor…  {remaining}s",
                C["warning"],
            )
            self._set_progress(pct)
            time.sleep(1)

        if self._abort_event.is_set():
            self._finish("⛔  Aborted.", C["danger"])
            return

        # ── Type ─────────────────────────────────────────────────────────────
        self._set_status("⌨️  Typing…", C["text"])
        self._set_progress(100)

        try:
            if backend == "keyboard":
                _smart_write(text, interval)
            else:
                _pag.FAILSAFE = True
                _pag.write(text, interval=interval)
        except Exception as exc:
            self._finish(f"❌  Error: {exc}", C["danger"])
            return

        self._finish("✅  Done!  Paste next text and click Send again.", C["success"])

    # ── Thread-safe UI helpers ───────────────────────────────────────────────

    def _set_status(self, msg: str, color: str) -> None:
        self.root.after(0, lambda: self._status_var.set(msg))
        self.root.after(0, lambda: self._status_label.config(fg=color))

    def _set_progress(self, value: float) -> None:
        self.root.after(0, lambda: self._progress.configure(value=value))

    def _finish(self, msg: str, color: str) -> None:
        self._typing = False
        self._set_status(msg, color)
        self._set_progress(0)
        self.root.after(0, lambda: self._send_btn.config(
            text="⏎  Send to VNC   (Ctrl+Enter)",
            bg=C["accent"],
        ))


# ── Entry point ──────────────────────────────────────────────────────────────

def main() -> None:
    if not KEYBOARD_OK and not PYAUTOGUI_OK:
        print(
            "❌  No typing backend found.\n"
            "   Install at least one:\n"
            "     pip install keyboard       ← recommended\n"
            "     pip install pyautogui      ← fallback",
            file=sys.stderr,
        )
        sys.exit(1)

    root = tk.Tk()
    VNCTyperApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
