"""
VNC Auto Typer – Persistent GUI
================================
A compact, always-on-top window that lets you paste any text and fire it
into a focused VNC session at the press of a button (or Ctrl+Enter).
"""

import sys
import threading
import time
import tkinter as tk
from tkinter import ttk


# ── Backend availability checks ──────────────────────────────────────────────

try:
    import keyboard as _kb
    KEYBOARD_OK = True
except ImportError:
    KEYBOARD_OK = False

try:
    import pyautogui as _pag
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


def _smart_write(char: str, interval: float, backend: str) -> None:
    """Type a single *char* using library-level functions.
    Standard high-level 'write' handled layout/shift logic correctly.
    """
    if backend == "keyboard":
        _kb.write(char)
    else:
        _pag.write(char)

    if interval:
        time.sleep(interval)


# ── GUI Application ──────────────────────────────────────────────────────────

class VNCTyperApp:
    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self._typing = False
        self._abort_event = threading.Event()
        self._topmost_var = tk.BooleanVar(value=True)

        self._configure_root()
        self._build_ui()
        self._apply_topmost()

    def _configure_root(self) -> None:
        self.root.title("VNC Auto Typer")
        self.root.configure(bg=C["bg"])
        self.root.resizable(True, True)
        self.root.minsize(420, 500)
        self.root.geometry("480x580")

        # Root layout: Row 0=Header, Row 1=Text (expand), Row 2=Controls
        self.root.grid_columnconfigure(0, weight=1)
        self.root.grid_rowconfigure(0, weight=0)
        self.root.grid_rowconfigure(1, weight=1)
        self.root.grid_rowconfigure(2, weight=0)

        # Placement
        self.root.update_idletasks()
        sw, sh = self.root.winfo_screenwidth(), self.root.winfo_screenheight()
        self.root.geometry(f"+{sw - 500}+{sh - 680}")

    def _build_ui(self) -> None:
        self._build_header()
        self._build_top_panel()
        self._build_bottom_panel()
        self.root.bind("<Control-Return>", lambda _e: self._on_send_clicked())

    def _build_header(self) -> None:
        header = tk.Frame(self.root, bg=C["surface"], pady=10)
        header.grid(row=0, column=0, sticky="ew")
        tk.Label(header, text="⌨  VNC Auto Typer", bg=C["surface"], fg=C["text"],
                 font=("Segoe UI", 13, "bold")).pack(side="left", padx=14)
        tk.Checkbutton(header, text="Always on top", variable=self._topmost_var,
                       command=self._apply_topmost, bg=C["surface"], fg=C["muted"],
                       selectcolor=C["surface"], font=("Segoe UI", 9),
                       borderwidth=0, activebackground=C["surface"]).pack(side="right", padx=14)

    def _build_top_panel(self) -> None:
        top = tk.Frame(self.root, bg=C["bg"])
        top.grid(row=1, column=0, sticky="nsew")
        top.grid_columnconfigure(0, weight=1)
        top.grid_rowconfigure(1, weight=1)

        tk.Label(top, text="Paste text to type into VNC:", bg=C["bg"], fg=C["muted"],
                 font=("Segoe UI", 9), anchor="w").grid(row=0, column=0, sticky="ew", padx=14, pady=(10, 2))

        outer = tk.Frame(top, bg=C["border"], padx=1, pady=1)
        outer.grid(row=1, column=0, sticky="nsew", padx=14, pady=(0, 8))

        self.text_area = tk.Text(outer, bg=C["input"], fg=C["text"], insertbackground=C["text"],
                                font=("Consolas", 10), relief="flat", wrap="none", undo=True, padx=10, pady=8)
        vsb = tk.Scrollbar(outer, orient="vertical", command=self.text_area.yview)
        hsb = tk.Scrollbar(outer, orient="horizontal", command=self.text_area.xview)
        self.text_area.configure(yscrollcommand=vsb.set, xscrollcommand=hsb.set)
        vsb.pack(side="right", fill="y")
        hsb.pack(side="bottom", fill="x")
        self.text_area.pack(fill="both", expand=True)

    def _build_bottom_panel(self) -> None:
        bottom = tk.Frame(self.root, bg=C["bg"])
        bottom.grid(row=2, column=0, sticky="ew")

        # Settings frame
        settings = tk.Frame(bottom, bg=C["bg"])
        settings.pack(fill="x", padx=14, pady=(4, 2))

        # Row 1: Delay / Interval
        row1 = tk.Frame(settings, bg=C["bg"])
        row1.pack(fill="x")
        tk.Label(row1, text="Delay (s):", bg=C["bg"], fg=C["muted"], font=("Segoe UI", 9)).pack(side="left")
        self._delay_var = tk.IntVar(value=5)
        tk.Spinbox(row1, from_=1, to=30, textvariable=self._delay_var, width=4, bg=C["input"], fg=C["text"],
                   relief="flat", font=("Segoe UI", 10)).pack(side="left", padx=(4, 14))

        tk.Label(row1, text="Interval (s/char):", bg=C["bg"], fg=C["muted"], font=("Segoe UI", 9)).pack(side="left")
        self._interval_var = tk.DoubleVar(value=0.04)
        tk.Spinbox(row1, from_=0.01, to=0.5, increment=0.01, textvariable=self._interval_var, width=6,
                   bg=C["input"], fg=C["text"], relief="flat", font=("Segoe UI", 10), format="%.2f").pack(side="left", padx=(4, 14))

        tk.Button(row1, text="Clear", command=self._clear_text, bg=C["surface"], fg=C["muted"],
                  font=("Segoe UI", 9), relief="flat", padx=12, cursor="hand2").pack(side="right")

        # Row 2: Backend
        row2 = tk.Frame(settings, bg=C["bg"])
        row2.pack(fill="x", pady=(4, 0))
        tk.Label(row2, text="Backend:", bg=C["bg"], fg=C["muted"], font=("Segoe UI", 9)).pack(side="left")
        self._backend_var = tk.StringVar(value="keyboard")
        for val, label in [("keyboard", "keyboard ✓"), ("pyautogui", "pyautogui")]:
            tk.Radiobutton(row2, text=label, variable=self._backend_var, value=val, bg=C["bg"],
                           fg=C["muted"], selectcolor=C["bg"], font=("Segoe UI", 9)).pack(side="left", padx=(6, 0))

        # Status & Progress
        status_wrap = tk.Frame(bottom, bg=C["bg"], height=22)
        status_wrap.pack(fill="x", padx=14, pady=(6, 2))
        status_wrap.pack_propagate(False)
        self._status_var = tk.StringVar(value="Ready — paste text and click Send.")
        self._status_label = tk.Label(status_wrap, textvariable=self._status_var, bg=C["bg"],
                                     fg=C["muted"], font=("Segoe UI", 9), anchor="w")
        self._status_label.pack(fill="x")

        self._progress = ttk.Progressbar(bottom, orient="horizontal", mode="determinate")
        self._progress.pack(fill="x", padx=14, pady=(0, 4))

        # Send Button
        self._send_btn = tk.Button(bottom, text="⏎  Send to VNC   (Ctrl+Enter)", command=self._on_send_clicked,
                                  bg=C["accent"], fg="white", font=("Segoe UI", 12, "bold"),
                                  relief="flat", pady=14, cursor="hand2")
        self._send_btn.pack(fill="x", padx=14, pady=(0, 14))

    def _apply_topmost(self) -> None:
        self.root.attributes("-topmost", self._topmost_var.get())

    def _clear_text(self) -> None:
        self.text_area.delete("1.0", "end")
        self._progress["value"] = 0

    def _on_send_clicked(self) -> None:
        if self._typing:
            self._abort_event.set()
            return
        text = self.text_area.get("1.0", "end-1c")
        if not text.strip(): return
        self._abort_event.clear()
        self._typing = True
        self._send_btn.config(text="⛔  Abort", bg=C["danger"])
        threading.Thread(target=self._type_worker, args=(text, self._delay_var.get(),
                        self._interval_var.get(), self._backend_var.get()), daemon=True).start()

    def _type_worker(self, text: str, delay: int, interval: float, backend: str) -> None:
        # Initial cleanup
        if backend == "keyboard" and KEYBOARD_OK:
            for mod in ['shift', 'ctrl', 'alt', 'windows']:
                try: _kb.release(mod)
                except: pass

        # Countdown
        for rem in range(delay, 0, -1):
            if self._abort_event.is_set(): self._finish("⛔ Aborted", C["danger"]); return
            self._set_ui(f"⏳ Switch to VNC… {rem}s", C["warning"], (delay-rem)/delay*100)
            time.sleep(1)

        if self._abort_event.is_set(): self._finish("⛔ Aborted", C["danger"]); return
        self._set_ui("⌨️ Typing…", C["text"], 100)

        # Interrupted typing loop
        try:
            for i, char in enumerate(text):
                if self._abort_event.is_set():
                    self._finish("⛔ Aborted", C["danger"])
                    return
                _smart_write(char, interval, backend)
                # Update progress during typing
                self._set_progress((i + 1) / len(text) * 100)

            self._finish("✅ Done!", C["success"])
        except Exception as e:
            self._finish(f"❌ Error: {e}", C["danger"])

    def _set_ui(self, msg: str, color: str, prog: float) -> None:
        self.root.after(0, lambda: (self._status_var.set(msg), self._status_label.config(fg=color), self._progress.config(value=prog)))

    def _set_progress(self, val: float) -> None:
        self.root.after(0, lambda: self._progress.config(value=val))

    def _set_ui(self, msg: str, color: str, prog: float) -> None:
        self.root.after(0, lambda: (self._status_var.set(msg), self._status_label.config(fg=color), self._progress.config(value=prog)))

    def _finish(self, msg: str, color: str) -> None:
        self._typing = False
        self._set_ui(msg, color, 0)
        self.root.after(0, lambda: self._send_btn.config(text="⏎  Send to VNC   (Ctrl+Enter)", bg=C["accent"]))


if __name__ == "__main__":
    if not KEYBOARD_OK and not PYAUTOGUI_OK: sys.exit(1)
    root = tk.Tk()
    VNCTyperApp(root)
    root.mainloop()
