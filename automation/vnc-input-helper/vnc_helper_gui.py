"""
VNC Input Helper – Persistent GUI
=================================
A tabbed, modern dark-themed helper application for VNC and VM sessions.
Includes:
1. Auto Typer: Auto-typing pasted text character by character.
2. Key Holder: Pressing and holding a keyboard key (with a grid of common keys).
3. Auto Clicker: Fast mouse auto-clicking using ctypes Win32 API.

Features global "Always on top", hotkey cancellation (Esc), and safety releases.
"""

import sys
import os

# Prevent crashes in windowed mode (console=False) where sys.stdout/stderr are None
if sys.stdout is None:
    sys.stdout = open(os.devnull, "w")
if sys.stderr is None:
    sys.stderr = open(os.devnull, "w")

import threading
import time
import subprocess
import tkinter as tk
from tkinter import ttk

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


def _release_modifiers() -> None:
    """Safely release any stuck modifier keys."""
    if KEYBOARD_OK:
        for mod in ["shift", "ctrl", "alt", "windows"]:
            try:
                _kb.release(mod)
            except Exception:
                pass


# ── GUI Application ──────────────────────────────────────────────────────────

class VNCInputHelperApp:
    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self._running = False
        self._recording = False
        self._recorded_actions = []
        self._recording_start_time = 0
        self._abort_event = threading.Event()
        self._topmost_var = tk.BooleanVar(value=True)

        self._configure_root()
        self._build_ui()
        self._apply_topmost()
        self._register_global_hotkey()
        self._register_key_capture()

    def _configure_root(self) -> None:
        self.root.title("VNC Input Helper")
        self.root.configure(bg=C["bg"])
        self.root.resizable(True, True)
        self.root.minsize(450, 580)
        self.root.geometry("500x620")

        # Root layout: Row 0=Header, Row 1=Tabs (Notebook), Row 2=Global Footer
        self.root.grid_columnconfigure(0, weight=1)
        self.root.grid_rowconfigure(0, weight=0)
        self.root.grid_rowconfigure(1, weight=1)
        self.root.grid_rowconfigure(2, weight=0)

        # Placement - center/right of screen
        self.root.update_idletasks()
        sw, sh = self.root.winfo_screenwidth(), self.root.winfo_screenheight()
        self.root.geometry(f"+{sw - 520}+{sh - 720}")

        # Safety handle for window closing
        self.root.protocol("WM_DELETE_WINDOW", self._on_close)

    def _build_ui(self) -> None:
        self._build_header()
        self._build_tabs()
        self._build_footer()
        
        # Binds for local control
        self.root.bind("<Control-Return>", lambda _e: self._on_action_clicked())
        self.root.bind("<Escape>", lambda _e: self._on_global_abort())

    def _build_header(self) -> None:
        header = tk.Frame(self.root, bg=C["surface"], pady=10)
        header.grid(row=0, column=0, sticky="ew")
        
        tk.Label(header, text="⌨  VNC Input Helper", bg=C["surface"], fg=C["text"],
                 font=("Segoe UI", 13, "bold")).pack(side="left", padx=14)
                 
        tk.Checkbutton(header, text="Always on top", variable=self._topmost_var,
                       command=self._apply_topmost, bg=C["surface"], fg=C["muted"],
                       selectcolor=C["surface"], font=("Segoe UI", 9),
                       borderwidth=0, activebackground=C["surface"]).pack(side="right", padx=14)

    def _build_tabs(self) -> None:
        # Style Notebook tabs
        style = ttk.Style()
        style.theme_use("default")
        style.configure("TNotebook", background=C["bg"], borderwidth=0)
        style.configure("TNotebook.Tab",
                        background=C["surface"],
                        foreground=C["muted"],
                        padding=[12, 6],
                        font=("Segoe UI", 9, "bold"),
                        borderwidth=0)
        style.map("TNotebook.Tab",
                  background=[("selected", C["bg"]), ("active", C["surface"])],
                  foreground=[("selected", C["text"]), ("active", C["text"])])

        self.notebook = ttk.Notebook(self.root, style="TNotebook")
        self.notebook.grid(row=1, column=0, sticky="nsew", padx=14, pady=(10, 4))

        # ── Tab 1: Auto Typer ──
        self._tab_typer = tk.Frame(self.notebook, bg=C["bg"])
        self.notebook.add(self._tab_typer, text="  Auto Typer  ")
        self._build_tab_typer()

        # ── Tab 2: Key Holder ──
        self._tab_holder = tk.Frame(self.notebook, bg=C["bg"])
        self.notebook.add(self._tab_holder, text="  Key Holder  ")
        self._build_tab_holder()

        # ── Tab 3: Auto Clicker ──
        self._tab_clicker = tk.Frame(self.notebook, bg=C["bg"])
        self.notebook.add(self._tab_clicker, text="  Auto Clicker  ")
        self._build_tab_clicker()

    def _build_tab_typer(self) -> None:
        tab = self._tab_typer
        tab.grid_columnconfigure(0, weight=1)
        tab.grid_rowconfigure(1, weight=1)

        tk.Label(tab, text="Paste text to type into VNC:", bg=C["bg"], fg=C["muted"],
                 font=("Segoe UI", 9), anchor="w").grid(row=0, column=0, sticky="ew", padx=2, pady=(10, 2))

        outer = tk.Frame(tab, bg=C["border"], padx=1, pady=1)
        outer.grid(row=1, column=0, sticky="nsew", padx=2, pady=(0, 6))

        self.text_area = tk.Text(outer, bg=C["input"], fg=C["text"], insertbackground=C["text"],
                                 font=("Consolas", 10), relief="flat", wrap="none", undo=True, padx=10, pady=8)
        vsb = tk.Scrollbar(outer, orient="vertical", command=self.text_area.yview)
        hsb = tk.Scrollbar(outer, orient="horizontal", command=self.text_area.xview)
        self.text_area.configure(yscrollcommand=vsb.set, xscrollcommand=hsb.set)
        
        vsb.pack(side="right", fill="y")
        hsb.pack(side="bottom", fill="x")
        self.text_area.pack(fill="both", expand=True)

        # Settings sub-row
        row = tk.Frame(tab, bg=C["bg"])
        row.grid(row=2, column=0, sticky="ew", pady=(2, 6))
        
        tk.Label(row, text="Interval (s/char):", bg=C["bg"], fg=C["muted"], font=("Segoe UI", 9)).pack(side="left")
        self._interval_var = tk.DoubleVar(value=0.03)
        tk.Spinbox(row, from_=0.00, to=1.0, increment=0.01, textvariable=self._interval_var, width=6,
                   bg=C["input"], fg=C["text"], relief="flat", font=("Segoe UI", 9), format="%.2f").pack(side="left", padx=(4, 14))

        tk.Button(row, text="Clear text", command=self._clear_text, bg=C["surface"], fg=C["muted"],
                  font=("Segoe UI", 9), relief="flat", padx=10, cursor="hand2").pack(side="right")

    def _build_tab_holder(self) -> None:
        tab = self._tab_holder

        # Row 0: Combo display
        combo_frame = tk.Frame(tab, bg=C["surface"], padx=8, pady=6)
        combo_frame.pack(fill="x", padx=10, pady=(10, 4))

        tk.Label(combo_frame, text="Selected:", bg=C["surface"], fg=C["muted"],
                 font=("Segoe UI", 9)).pack(side="left")
        self._hold_combo_var = tk.StringVar(value="(none)")
        tk.Label(combo_frame, textvariable=self._hold_combo_var, bg=C["surface"], fg=C["accent"],
                 font=("Consolas", 11, "bold")).pack(side="left", padx=(8, 0))

        self._capturing_combo = False
        self._capture_btn = tk.Button(combo_frame, text="⏺ Capture Keys", command=self._toggle_capture_combo,
                                      bg=C["surface"], fg=C["muted"], font=("Segoe UI", 8), relief="flat",
                                      padx=6, cursor="hand2")
        self._capture_btn.pack(side="right", padx=(4, 0))
        tk.Button(combo_frame, text="Clear", command=self._clear_hold_combo, bg=C["surface"], fg=C["muted"],
                  font=("Segoe UI", 8), relief="flat", padx=6, cursor="hand2").pack(side="right")

        # Track which keys are selected
        self._hold_selected_keys = []
        self._hold_key_buttons = {}

        # Row 1: Virtual keyboard
        kb_frame = tk.Frame(tab, bg=C["bg"])
        kb_frame.pack(fill="x", padx=10, pady=4)

        KB_KEY_H = 28
        KB_FONT = ("Segoe UI", 7)

        def make_key(parent, label, vk_name, col, row, width=1, colspan=1):
            """Create a keyboard key button."""
            is_mod = vk_name in ("ctrl", "alt", "shift", "win")
            bg = C["accent"] if is_mod else C["surface"]
            btn = tk.Button(parent, text=label, bg=bg, fg=C["text"],
                           activebackground=C["accent_hover"], activeforeground="#ffffff",
                           relief="flat", font=KB_FONT, cursor="hand2", height=1,
                           command=lambda v=vk_name: self._toggle_hold_key(v))
            btn.grid(row=row, column=col, columnspan=colspan, padx=1, pady=1, sticky="nsew")
            self._hold_key_buttons[vk_name] = btn
            return btn

        # Row 0: Esc + F-keys
        row0 = tk.Frame(kb_frame, bg=C["bg"])
        row0.pack(fill="x", pady=1)
        for i in range(13):
            row0.grid_columnconfigure(i, weight=1)
        f_labels = [("Esc", "esc")] + [(f"F{i}", f"f{i}") for i in range(1, 13)]
        for col, (label, vk) in enumerate(f_labels):
            make_key(row0, label, vk, col, 0, width=1)

        # Row 1: Number row
        row1 = tk.Frame(kb_frame, bg=C["bg"])
        row1.pack(fill="x", pady=1)
        num_keys = [
            ("`", "`"), ("1", "1"), ("2", "2"), ("3", "3"), ("4", "4"),
            ("5", "5"), ("6", "6"), ("7", "7"), ("8", "8"), ("9", "9"),
            ("0", "0"), ("-", "-"), ("=", "="), ("Bksp", "backspace"),
        ]
        for i in range(14):
            row1.grid_columnconfigure(i, weight=1)
        for col, (label, vk) in enumerate(num_keys):
            w = 2 if vk == "backspace" else 1
            make_key(row1, label, vk, col, 0, width=w)

        # Row 2: QWERTY row
        row2 = tk.Frame(kb_frame, bg=C["bg"])
        row2.pack(fill="x", pady=1)
        qwerty_keys = [
            ("Tab", "tab"), ("Q", "q"), ("W", "w"), ("E", "e"), ("R", "r"),
            ("T", "t"), ("Y", "y"), ("U", "u"), ("I", "i"), ("O", "o"),
            ("P", "p"), ("[", "["), ("]", "]"), ("\\", "\\"),
        ]
        for i in range(14):
            row2.grid_columnconfigure(i, weight=1)
        for col, (label, vk) in enumerate(qwerty_keys):
            w = 2 if vk == "tab" else 1
            make_key(row2, label, vk, col, 0, width=w)

        # Row 3: Home row
        row3 = tk.Frame(kb_frame, bg=C["bg"])
        row3.pack(fill="x", pady=1)
        home_keys = [
            ("Caps", "capslock"), ("A", "a"), ("S", "s"), ("D", "d"), ("F", "f"),
            ("G", "g"), ("H", "h"), ("J", "j"), ("K", "k"), ("L", "l"),
            (";", ";"), ("'", "'"), ("Enter", "enter"),
        ]
        for i in range(13):
            row3.grid_columnconfigure(i, weight=1)
        for col, (label, vk) in enumerate(home_keys):
            w = 2 if vk in ("capslock", "enter") else 1
            make_key(row3, label, vk, col, 0, width=w)

        # Row 4: Shift row
        row4 = tk.Frame(kb_frame, bg=C["bg"])
        row4.pack(fill="x", pady=1)
        shift_keys = [
            ("Shift", "shift"), ("Z", "z"), ("X", "x"), ("C", "c"), ("V", "v"),
            ("B", "b"), ("N", "n"), ("M", "m"), (",", ","), (".", "."),
            ("/", "/"), ("Shift", "shift_r"),
        ]
        for i in range(12):
            row4.grid_columnconfigure(i, weight=1)
        for col, (label, vk) in enumerate(shift_keys):
            w = 2 if "shift" in vk else 1
            make_key(row4, label, vk, col, 0, width=w)

        # Row 5: Bottom row
        row5 = tk.Frame(kb_frame, bg=C["bg"])
        row5.pack(fill="x", pady=1)
        bottom_keys = [
            ("Ctrl", "ctrl"), ("Win", "win"), ("Alt", "alt"),
            ("Space", "space"), ("Alt", "alt_r"), ("Win", "win_r"),
            ("Menu", "menu"), ("Ctrl", "ctrl_r"),
        ]
        for i in range(8):
            row5.grid_columnconfigure(i, weight=1)
        for col, (label, vk) in enumerate(bottom_keys):
            w = 3 if vk == "space" else 1
            make_key(row5, label, vk, col, 0, width=w)

        # Row 6: Hold Mode
        mode_frame = tk.Frame(tab, bg=C["bg"])
        mode_frame.pack(fill="x", padx=10, pady=(8, 2))

        tk.Label(mode_frame, text="Hold Mode:", bg=C["bg"], fg=C["text"],
                 font=("Segoe UI", 9)).pack(side="left")
        self._hold_indefinite_var = tk.BooleanVar(value=True)
        tk.Radiobutton(mode_frame, text="Until Esc", variable=self._hold_indefinite_var, value=True,
                       command=self._update_hold_states, bg=C["bg"], fg=C["muted"], selectcolor=C["surface"],
                       activebackground=C["bg"], activeforeground=C["text"], font=("Segoe UI", 9)).pack(side="left", padx=(8, 0))
        tk.Radiobutton(mode_frame, text="Timed:", variable=self._hold_indefinite_var, value=False,
                       command=self._update_hold_states, bg=C["bg"], fg=C["muted"], selectcolor=C["surface"],
                       activebackground=C["bg"], activeforeground=C["text"], font=("Segoe UI", 9)).pack(side="left", padx=(8, 0))
        self._hold_duration_var = tk.DoubleVar(value=10.0)
        self._hold_spin = tk.Spinbox(mode_frame, from_=1.0, to=3600.0, increment=1.0, textvariable=self._hold_duration_var,
                                     width=5, bg=C["input"], fg=C["text"], relief="flat", font=("Segoe UI", 9))
        self._hold_spin.pack(side="left", padx=(4, 0))
        tk.Label(mode_frame, text="s", bg=C["bg"], fg=C["muted"], font=("Segoe UI", 9)).pack(side="left")
        self._update_hold_states()

    def _toggle_hold_key(self, vk_name: str) -> None:
        """Toggle a key in the hold combo."""
        if vk_name in self._hold_selected_keys:
            self._hold_selected_keys.remove(vk_name)
        else:
            self._hold_selected_keys.append(vk_name)
        self._update_hold_combo_display()

    def _clear_hold_combo(self) -> None:
        self._hold_selected_keys.clear()
        self._update_hold_combo_display()

    def _update_hold_combo_display(self) -> None:
        """Update the combo label and key button highlights."""
        if self._hold_selected_keys:
            combo = "+".join(self._hold_selected_keys)
            self._hold_combo_var.set(combo)
        else:
            self._hold_combo_var.set("(none)")

        # Update button highlights
        for vk, btn in self._hold_key_buttons.items():
            if vk in self._hold_selected_keys:
                btn.config(bg=C["success"], fg="#ffffff")
            else:
                is_mod = vk in ("ctrl", "alt", "shift", "win")
                btn.config(bg=C["accent"] if is_mod else C["surface"], fg=C["text"])

    def _build_tab_clicker(self) -> None:
        tab = self._tab_clicker
        tab.grid_columnconfigure(0, weight=0)
        tab.grid_columnconfigure(1, weight=1)

        # Row 0: Description
        tk.Label(tab, text="Record mouse actions and replay them, or click continuously.", bg=C["bg"], fg=C["muted"],
                 font=("Segoe UI", 9), anchor="w").grid(row=0, column=0, columnspan=2, sticky="ew", pady=(10, 8))

        # Row 1: Mode selector
        tk.Label(tab, text="Mode:", bg=C["bg"], fg=C["text"], font=("Segoe UI", 10)).grid(row=1, column=0, sticky="w", pady=6)
        self._click_mode_var = tk.StringVar(value="simple")
        mode_frame = tk.Frame(tab, bg=C["bg"])
        mode_frame.grid(row=1, column=1, sticky="w", pady=6)
        tk.Radiobutton(mode_frame, text="Simple Click", variable=self._click_mode_var, value="simple",
                       command=self._update_click_mode, bg=C["bg"], fg=C["muted"], selectcolor=C["surface"],
                       activebackground=C["bg"], activeforeground=C["text"], font=("Segoe UI", 9)).pack(side="left")
        tk.Radiobutton(mode_frame, text="Record & Replay", variable=self._click_mode_var, value="record",
                       command=self._update_click_mode, bg=C["bg"], fg=C["muted"], selectcolor=C["surface"],
                       activebackground=C["bg"], activeforeground=C["text"], font=("Segoe UI", 9)).pack(side="left", padx=(14, 0))

        # ── Simple Click sub-panel ──
        self._click_simple_frame = tk.Frame(tab, bg=C["bg"])
        self._click_simple_frame.grid(row=2, column=0, columnspan=2, sticky="ew")

        sf = self._click_simple_frame
        sf.grid_columnconfigure(1, weight=1)

        tk.Label(sf, text="Mouse button:", bg=C["bg"], fg=C["text"], font=("Segoe UI", 10)).grid(row=0, column=0, sticky="w", pady=6)
        btn_frame = tk.Frame(sf, bg=C["bg"])
        btn_frame.grid(row=0, column=1, sticky="w", pady=6)
        self._click_btn_var = tk.StringVar(value="left")
        for btn_name in ["left", "right", "middle"]:
            tk.Radiobutton(btn_frame, text=btn_name.capitalize(), variable=self._click_btn_var, value=btn_name,
                           bg=C["bg"], fg=C["muted"], selectcolor=C["surface"], activebackground=C["bg"],
                           activeforeground=C["text"], font=("Segoe UI", 9)).pack(side="left", padx=(0, 14))

        tk.Label(sf, text="Click interval (ms):", bg=C["bg"], fg=C["text"], font=("Segoe UI", 10)).grid(row=1, column=0, sticky="w", pady=6)
        self._click_interval_var = tk.IntVar(value=100)
        tk.Spinbox(sf, from_=1, to=10000, increment=10, textvariable=self._click_interval_var,
                   width=6, bg=C["input"], fg=C["text"], relief="flat", font=("Segoe UI", 10)).grid(row=1, column=1, sticky="w", pady=6)

        tk.Label(sf, text="Click count:", bg=C["bg"], fg=C["text"], font=("Segoe UI", 10)).grid(row=2, column=0, sticky="w", pady=6)
        count_frame = tk.Frame(sf, bg=C["bg"])
        count_frame.grid(row=2, column=1, sticky="w", pady=6)
        self._click_indefinite_var = tk.BooleanVar(value=True)
        tk.Radiobutton(count_frame, text="Unlimited (Esc to stop)", variable=self._click_indefinite_var, value=True,
                       command=self._update_click_states, bg=C["bg"], fg=C["muted"], selectcolor=C["surface"],
                       activebackground=C["bg"], activeforeground=C["text"], font=("Segoe UI", 9)).pack(side="left")
        tk.Radiobutton(count_frame, text="Limit:", variable=self._click_indefinite_var, value=False,
                       command=self._update_click_states, bg=C["bg"], fg=C["muted"], selectcolor=C["surface"],
                       activebackground=C["bg"], activeforeground=C["text"], font=("Segoe UI", 9)).pack(side="left", padx=(14, 0))
        self._click_count_var = tk.IntVar(value=100)
        self._click_spin = tk.Spinbox(count_frame, from_=1, to=100000, increment=10, textvariable=self._click_count_var,
                                      width=8, bg=C["input"], fg=C["text"], relief="flat", font=("Segoe UI", 10))
        self._click_spin.pack(side="left", padx=(4, 0))
        self._update_click_states()

        # Row 3: Hold key during click
        tk.Label(sf, text="Hold key:", bg=C["bg"], fg=C["text"], font=("Segoe UI", 10)).grid(row=3, column=0, sticky="w", pady=6)
        hold_frame = tk.Frame(sf, bg=C["bg"])
        hold_frame.grid(row=3, column=1, sticky="w", pady=6)
        self._click_hold_key_var = tk.StringVar(value="")
        tk.Entry(hold_frame, textvariable=self._click_hold_key_var, bg=C["input"], fg=C["text"],
                 insertbackground=C["text"], relief="flat", font=("Segoe UI", 10), width=14).pack(side="left")
        tk.Label(hold_frame, text="(e.g. ctrl, alt, ctrl+shift)", bg=C["bg"], fg=C["muted"],
                 font=("Segoe UI", 8)).pack(side="left", padx=(6, 0))

        # ── Record & Replay sub-panel ──
        self._click_record_frame = tk.Frame(tab, bg=C["bg"])
        self._click_record_frame.grid(row=2, column=0, columnspan=2, sticky="ew")

        rf = self._click_record_frame
        rf.grid_columnconfigure(1, weight=1)

        tk.Label(rf, text="Recorded actions:", bg=C["bg"], fg=C["text"], font=("Segoe UI", 10)).grid(row=0, column=0, sticky="w", pady=6)
        self._record_status_var = tk.StringVar(value="No actions recorded")
        tk.Label(rf, textvariable=self._record_status_var, bg=C["bg"], fg=C["muted"],
                 font=("Segoe UI", 9), anchor="w").grid(row=0, column=1, sticky="w", pady=6)

        rec_btn_frame = tk.Frame(rf, bg=C["bg"])
        rec_btn_frame.grid(row=1, column=0, columnspan=2, sticky="w", pady=4)
        self._rec_btn = tk.Button(rec_btn_frame, text="⏺  Start Recording", command=self._toggle_recording,
                                  bg=C["danger"], fg="white", font=("Segoe UI", 9, "bold"), relief="flat",
                                  padx=10, cursor="hand2")
        self._rec_btn.pack(side="left")
        tk.Button(rec_btn_frame, text="🗑  Clear", command=self._clear_recording, bg=C["surface"], fg=C["muted"],
                  font=("Segoe UI", 9), relief="flat", padx=10, cursor="hand2").pack(side="left", padx=(8, 0))

        tk.Label(rf, text="Replay speed:", bg=C["bg"], fg=C["text"], font=("Segoe UI", 10)).grid(row=2, column=0, sticky="w", pady=6)
        speed_frame = tk.Frame(rf, bg=C["bg"])
        speed_frame.grid(row=2, column=1, sticky="w", pady=6)
        self._replay_speed_var = tk.DoubleVar(value=1.0)
        tk.Scale(speed_frame, from_=0.1, to=5.0, resolution=0.1, orient="horizontal",
                 variable=self._replay_speed_var, bg=C["bg"], fg=C["text"], troughcolor=C["input"],
                 highlightthickness=0, font=("Segoe UI", 8), length=140).pack(side="left")
        tk.Label(speed_frame, text="x", bg=C["bg"], fg=C["muted"], font=("Segoe UI", 9)).pack(side="left")

        tk.Label(rf, text="Loop count:", bg=C["bg"], fg=C["text"], font=("Segoe UI", 10)).grid(row=3, column=0, sticky="w", pady=6)
        loop_frame = tk.Frame(rf, bg=C["bg"])
        loop_frame.grid(row=3, column=1, sticky="w", pady=6)
        self._replay_loop_var = tk.BooleanVar(value=True)
        tk.Radiobutton(loop_frame, text="Once", variable=self._replay_loop_var, value=False,
                       bg=C["bg"], fg=C["muted"], selectcolor=C["surface"],
                       activebackground=C["bg"], activeforeground=C["text"], font=("Segoe UI", 9)).pack(side="left")
        tk.Radiobutton(loop_frame, text="Repeat:", variable=self._replay_loop_var, value=True,
                       bg=C["bg"], fg=C["muted"], selectcolor=C["surface"],
                       activebackground=C["bg"], activeforeground=C["text"], font=("Segoe UI", 9)).pack(side="left", padx=(14, 0))
        self._replay_count_var = tk.IntVar(value=10)
        tk.Spinbox(loop_frame, from_=1, to=10000, textvariable=self._replay_count_var,
                   width=6, bg=C["input"], fg=C["text"], relief="flat", font=("Segoe UI", 10)).pack(side="left", padx=(4, 0))

        # Hide record panel by default
        self._click_record_frame.grid_remove()

    def _build_footer(self) -> None:
        footer = tk.Frame(self.root, bg=C["bg"])
        footer.grid(row=2, column=0, sticky="ew", padx=14, pady=(0, 14))

        # Row 1: Global Delay setting
        delay_row = tk.Frame(footer, bg=C["bg"])
        delay_row.pack(fill="x", pady=(2, 6))
        
        tk.Label(delay_row, text="Startup Delay (seconds):", bg=C["bg"], fg=C["muted"], font=("Segoe UI", 9)).pack(side="left")
        self._delay_var = tk.IntVar(value=3)
        tk.Spinbox(delay_row, from_=0, to=60, textvariable=self._delay_var, width=4, bg=C["input"], fg=C["text"],
                   relief="flat", font=("Segoe UI", 9)).pack(side="left", padx=(8, 0))

        # Row 2: Status Output
        status_wrap = tk.Frame(footer, bg=C["bg"], height=22)
        status_wrap.pack(fill="x", pady=(2, 2))
        status_wrap.pack_propagate(False)
        
        self._status_var = tk.StringVar(value="Ready — Select mode and click Start.")
        self._status_label = tk.Label(status_wrap, textvariable=self._status_var, bg=C["bg"],
                                      fg=C["muted"], font=("Segoe UI", 9), anchor="w")
        self._status_label.pack(fill="x")

        # Row 3: Progressbar
        self._progress = ttk.Progressbar(footer, orient="horizontal", mode="determinate")
        self._progress.pack(fill="x", pady=(0, 10))

        # Row 4: Start/Stop Button
        self._action_btn = tk.Button(footer, text="⏎  Start Helper   (Ctrl+Enter)", command=self._on_action_clicked,
                                     bg=C["accent"], fg="white", font=("Segoe UI", 11, "bold"),
                                     relief="flat", pady=12, cursor="hand2")
        self._action_btn.pack(fill="x")

    def _update_hold_states(self) -> None:
        if self._hold_indefinite_var.get():
            self._hold_spin.config(state="disabled", fg=C["muted"])
        else:
            self._hold_spin.config(state="normal", fg=C["text"])

    def _update_click_states(self) -> None:
        if self._click_indefinite_var.get():
            self._click_spin.config(state="disabled", fg=C["muted"])
        else:
            self._click_spin.config(state="normal", fg=C["text"])

    def _update_click_mode(self) -> None:
        if self._click_mode_var.get() == "simple":
            self._click_simple_frame.grid()
            self._click_record_frame.grid_remove()
        else:
            self._click_simple_frame.grid_remove()
            self._click_record_frame.grid()

    def _toggle_recording(self) -> None:
        if self._recording:
            self._stop_recording()
        else:
            self._start_recording()

    def _start_recording(self) -> None:
        self._recording = True
        self._recorded_actions = []
        self._recording_start_time = time.time()
        self._rec_btn.config(text="⏹  Stop Recording", bg=C["warning"])
        self._record_status_var.set("Recording... perform your clicks now")
        threading.Thread(target=self._record_worker, daemon=True).start()

    def _stop_recording(self) -> None:
        self._recording = False
        self._rec_btn.config(text="⏺  Start Recording", bg=C["danger"])
        count = len(self._recorded_actions)
        self._record_status_var.set(f"{count} actions recorded")

    def _clear_recording(self) -> None:
        self._recording = False
        self._recorded_actions = []
        self._rec_btn.config(text="⏺  Start Recording", bg=C["danger"])
        self._record_status_var.set("No actions recorded")

    def _record_worker(self) -> None:
        """Record mouse clicks AND keyboard presses with timestamps."""
        import ctypes
        user32 = ctypes.windll.user32
        VK_LBUTTON = 0x01
        VK_RBUTTON = 0x02
        VK_MBUTTON = 0x04
        prev_left = prev_right = prev_middle = False

        # Track which keyboard keys are currently held for combo detection
        held_keys = set()

        def on_key_event(event):
            if not self._recording:
                return
            # Skip Esc (used to stop recording) and modifier-only events
            if event.name == "esc":
                return
            ts = time.time() - self._recording_start_time
            if event.event_type == "down":
                if event.name not in held_keys:
                    held_keys.add(event.name)
                    self._recorded_actions.append(("key_down", event.name, 0, 0, ts))
            elif event.event_type == "up":
                held_keys.discard(event.name)
                self._recorded_actions.append(("key_up", event.name, 0, 0, ts))

        kb_hook = None
        if KEYBOARD_OK:
            kb_hook = _kb.hook(on_key_event)

        try:
            while self._recording:
                point = ctypes.wintypes.POINT()
                user32.GetCursorPos(ctypes.byref(point))
                left = user32.GetAsyncKeyState(VK_LBUTTON) & 0x8000 != 0
                right = user32.GetAsyncKeyState(VK_RBUTTON) & 0x8000 != 0
                middle = user32.GetAsyncKeyState(VK_MBUTTON) & 0x8000 != 0

                ts = time.time() - self._recording_start_time
                if left and not prev_left:
                    self._recorded_actions.append(("mouse_click", "left", point.x, point.y, ts))
                if right and not prev_right:
                    self._recorded_actions.append(("mouse_click", "right", point.x, point.y, ts))
                if middle and not prev_middle:
                    self._recorded_actions.append(("mouse_click", "middle", point.x, point.y, ts))

                prev_left, prev_right, prev_middle = left, right, middle
                count = len(self._recorded_actions)
                if count > 0:
                    self.root.after(0, lambda c=count: self._record_status_var.set(f"Recording... {c} actions captured"))
                time.sleep(0.02)
        finally:
            if kb_hook:
                _kb.unhook(kb_hook)

    def _apply_topmost(self) -> None:
        self.root.attributes("-topmost", self._topmost_var.get())

    def _clear_text(self) -> None:
        self.text_area.delete("1.0", "end")
        self._progress["value"] = 0

    def _register_global_hotkey(self) -> None:
        if KEYBOARD_OK:
            try:
                # Runs on its own keyboard thread, so we dispatch cleanly
                _kb.add_hotkey("esc", self._on_global_abort)
            except Exception as e:
                print(f"Warning: Global Esc hotkey failed to register: {e}")

    def _on_global_abort(self, event=None) -> None:
        if self._running:
            self._abort_event.set()

    def _register_key_capture(self) -> None:
        """Register key capture - only active when _capturing_combo is True."""
        pass  # Now handled by _toggle_capture_combo

    def _toggle_capture_combo(self) -> None:
        """Start/stop capturing keyboard input for combo building."""
        if self._capturing_combo:
            self._stop_capture_combo()
        else:
            self._start_capture_combo()

    def _start_capture_combo(self) -> None:
        if not KEYBOARD_OK:
            self._set_ui("⚠️ keyboard library not available", C["warning"], 0)
            return
        self._capturing_combo = True
        self._capture_btn.config(text="⏹ Stop Capture", bg=C["danger"], fg="white")
        self._set_ui("⌨️ Capturing... press keys to build combo, Esc or click Stop to finish", C["warning"], 0)
        self._kb_capture_hook = _kb.hook(self._on_capture_key_event)

    def _stop_capture_combo(self) -> None:
        self._capturing_combo = False
        self._capture_btn.config(text="⏺ Capture Keys", bg=C["surface"], fg=C["muted"])
        if hasattr(self, '_kb_capture_hook') and self._kb_capture_hook:
            _kb.unhook(self._kb_capture_hook)
            self._kb_capture_hook = None
        self._set_ui("Ready — Select mode and click Start.", C["muted"], 0)

    def _on_capture_key_event(self, event) -> None:
        """Handle captured key events for combo building."""
        if not self._capturing_combo:
            return
        if event.name == "esc":
            self.root.after(0, self._stop_capture_combo)
            return
        if event.event_type == "down":
            self.root.after(0, lambda name=event.name: self._toggle_hold_key(name))

    def _on_action_clicked(self) -> None:
        if self._running:
            self._abort_event.set()
            return

        # Stop any active key capture
        if self._capturing_combo:
            self._stop_capture_combo()

        # Prepare parameters & validate
        self._abort_event.clear()
        
        tab_idx = self.notebook.index(self.notebook.select())
        delay = self._delay_var.get()

        if tab_idx == 0:
            # Auto Typer
            text = self.text_area.get("1.0", "end-1c")
            if not text.strip():
                self._set_ui("⚠️ Type some text first!", C["warning"], 0)
                return
            interval = self._interval_var.get()
            
            self._running = True
            self._action_btn.config(text="⛔  Abort   (Esc)", bg=C["danger"])
            threading.Thread(target=self._type_worker, args=(text, delay, interval), daemon=True).start()

        elif tab_idx == 1:
            # Key Holder
            if not self._hold_selected_keys:
                self._set_ui("⚠️ Click keys on the keyboard first!", C["warning"], 0)
                return
            key = "+".join(self._hold_selected_keys)
            
            indefinite = self._hold_indefinite_var.get()
            duration = 0.0 if indefinite else self._hold_duration_var.get()
            
            self._running = True
            self._action_btn.config(text="⛔  Abort   (Esc)", bg=C["danger"])
            threading.Thread(target=self._hold_worker, args=(key, delay, duration), daemon=True).start()

        elif tab_idx == 2:
            # Auto Clicker
            if self._click_mode_var.get() == "record":
                # Record & Replay mode
                if not self._recorded_actions:
                    self._set_ui("⚠️ Record some actions first!", C["warning"], 0)
                    return
                speed = self._replay_speed_var.get()
                loop = self._replay_loop_var.get()
                loop_count = 0 if not loop else self._replay_count_var.get()
                self._running = True
                self._action_btn.config(text="⛔  Abort   (Esc)", bg=C["danger"])
                threading.Thread(target=self._replay_worker, args=(delay, speed, loop_count), daemon=True).start()
            else:
                # Simple Click mode
                button = self._click_btn_var.get()
                interval_ms = self._click_interval_var.get()
                indefinite = self._click_indefinite_var.get()
                count = 0 if indefinite else self._click_count_var.get()
                hold_key = self._click_hold_key_var.get().strip() or None
                self._running = True
                self._action_btn.config(text="⛔  Abort   (Esc)", bg=C["danger"])
                threading.Thread(target=self._click_worker, args=(button, delay, interval_ms / 1000.0, count, hold_key), daemon=True).start()

    # ── Workers ──────────────────────────────────────────────────────────────

    def _run_countdown(self, delay: int) -> bool:
        """Countdown loop that updates the progress and checks for abort."""
        for rem in range(delay, 0, -1):
            if self._abort_event.is_set():
                self._finish("⛔ Aborted", C["danger"])
                return False
            self._set_ui(f"⏳ Switch focus to VNC… {rem}s", C["warning"], (delay - rem) / delay * 100)
            time.sleep(1)
        
        if self._abort_event.is_set():
            self._finish("⛔ Aborted", C["danger"])
            return False
            
        self._set_ui("🚀 Running...", C["success"], 100)
        return True

    def _type_worker(self, text: str, delay: int, interval: float) -> None:
        _release_modifiers()
        
        if not self._run_countdown(delay):
            return

        try:
            for i, char in enumerate(text):
                if self._abort_event.is_set():
                    self._finish("⛔ Aborted", C["danger"])
                    return
                
                if KEYBOARD_OK:
                    _kb.write(char)
                if interval > 0:
                    time.sleep(interval)
                
                # Update progress during typing
                self._set_progress((i + 1) / len(text) * 100)

            self._finish("✅ Done!", C["success"])
        except Exception as e:
            self._finish(f"❌ Error: {e}", C["danger"])

    def _hold_worker(self, key: str, delay: int, duration: float) -> None:
        _release_modifiers()
        if not KEYBOARD_OK:
            self._finish("❌ Error: Keyboard library not loaded", C["danger"])
            return

        if not self._run_countdown(delay):
            return

        try:
            self._set_ui(f"🔒 Holding down '{key}'...", C["text"], 100)
            _kb.press(key)
            
            start_time = time.time()
            while not self._abort_event.is_set():
                if duration > 0:
                    elapsed = time.time() - start_time
                    percent = min(100.0, (elapsed / duration) * 100)
                    self._set_progress(percent)
                    if elapsed >= duration:
                        break
                else:
                    # Pulsing progress for indefinite mode
                    pulse = int(time.time() * 2) % 2 * 100
                    self._set_progress(pulse)
                
                time.sleep(0.05)

            self._finish("✅ Done!", C["success"])
        except Exception as e:
            self._finish(f"❌ Error: {e}", C["danger"])
        finally:
            _kb.release(key)

    def _click_worker(self, button: str, delay: int, interval_s: float, count: int, hold_key: str = None) -> None:
        if not self._run_countdown(delay):
            return

        hold_str = f" with '{hold_key}' held" if hold_key else ""
        try:
            self._set_ui(f"🖱️  Clicking '{button}'{hold_str}...", C["text"], 100)
            
            if hold_key and KEYBOARD_OK:
                _kb.press(hold_key)
            
            clicks_done = 0
            while not self._abort_event.is_set():
                mouse_click(button)
                clicks_done += 1
                
                if count > 0:
                    self._set_progress((clicks_done / count) * 100)
                    if clicks_done >= count:
                        break
                else:
                    # Pulsing progress for indefinite mode
                    pulse = int(time.time() * 2) % 2 * 100
                    self._set_progress(pulse)

                # Responsive sleep: sleep in max 50ms increments to capture Abort quickly
                sleep_end = time.time() + interval_s
                while time.time() < sleep_end and not self._abort_event.is_set():
                    time.sleep(min(0.05, sleep_end - time.time()))

            self._finish("✅ Done!", C["success"])
        except Exception as e:
            self._finish(f"❌ Error: {e}", C["danger"])
        finally:
            if hold_key and KEYBOARD_OK:
                _kb.release(hold_key)

    def _replay_worker(self, delay: int, speed: float, loop_count: int) -> None:
        """Replay recorded mouse + keyboard actions with timing."""
        if not self._run_countdown(delay):
            return

        try:
            actions = list(self._recorded_actions)
            total = len(actions)
            loops = loop_count if loop_count > 0 else 1
            self._set_ui(f"▶️  Replaying {total} actions ({loops}x)...", C["text"], 0)

            for loop_idx in range(loops):
                if self._abort_event.is_set():
                    break
                for i, action in enumerate(actions):
                    if self._abort_event.is_set():
                        break
                    # Wait for timing
                    ts = action[4]
                    if i > 0:
                        prev_ts = actions[i - 1][4]
                        wait = (ts - prev_ts) / speed
                        sleep_end = time.time() + wait
                        while time.time() < sleep_end and not self._abort_event.is_set():
                            time.sleep(min(0.05, sleep_end - time.time()))

                    # Execute action
                    act_type = action[0]
                    if act_type == "mouse_click":
                        _, button, x, y, _ = action
                        mouse_click(button, x, y)
                    elif act_type == "key_down":
                        _, key, _, _, _ = action
                        if KEYBOARD_OK:
                            _kb.press(key)
                    elif act_type == "key_up":
                        _, key, _, _, _ = action
                        if KEYBOARD_OK:
                            _kb.release(key)

                    progress = ((loop_idx * total + i + 1) / (loops * total)) * 100
                    self._set_progress(progress)
                    self._set_ui(f"▶️  Loop {loop_idx + 1}/{loops} — Action {i + 1}/{total}", C["text"], progress)

            self._finish("✅ Replay done!", C["success"])
        except Exception as e:
            self._finish(f"❌ Error: {e}", C["danger"])

    # ── UI Thread Safe Setters ───────────────────────────────────────────────

    def _set_ui(self, msg: str, color: str, prog: float) -> None:
        self.root.after(0, lambda: (
            self._status_var.set(msg),
            self._status_label.config(fg=color),
            self._progress.config(value=prog)
        ))

    def _set_progress(self, val: float) -> None:
        self.root.after(0, lambda: self._progress.config(value=val))

    def _finish(self, msg: str, color: str) -> None:
        self._running = False
        self._set_ui(msg, color, 0)
        self.root.after(0, lambda: self._action_btn.config(text="⏎  Start Helper   (Ctrl+Enter)", bg=C["accent"]))

    def _on_close(self) -> None:
        """Cleanup logic when application window is closed."""
        self._abort_event.set()
        self._recording = False
        if self._capturing_combo:
            self._stop_capture_combo()
        time.sleep(0.1)
        
        if KEYBOARD_OK:
            try:
                _release_modifiers()
                # Release any held combo keys
                for vk in self._hold_selected_keys:
                    try:
                        _kb.release(vk)
                    except Exception:
                        pass
            except Exception:
                pass
        self.root.destroy()


if __name__ == "__main__":
    root = tk.Tk()
    VNCInputHelperApp(root)
    root.mainloop()
