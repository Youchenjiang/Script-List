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


def mouse_click(button: str = "left") -> None:
    """Simulate a mouse click using Windows API or fallback to xdotool on Linux/macOS."""
    if sys.platform == "win32":
        import ctypes
        if button == "left":
            ctypes.windll.user32.mouse_event(0x0002, 0, 0, 0, 0)  # Left down
            ctypes.windll.user32.mouse_event(0x0004, 0, 0, 0, 0)  # Left up
        elif button == "right":
            ctypes.windll.user32.mouse_event(0x0008, 0, 0, 0, 0)  # Right down
            ctypes.windll.user32.mouse_event(0x0010, 0, 0, 0, 0)  # Right up
        elif button == "middle":
            ctypes.windll.user32.mouse_event(0x0020, 0, 0, 0, 0)  # Middle down
            ctypes.windll.user32.mouse_event(0x0040, 0, 0, 0, 0)  # Middle up
    else:
        # Fallback for Linux (needs xdotool installed)
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
        self._abort_event = threading.Event()
        self._topmost_var = tk.BooleanVar(value=True)

        self._configure_root()
        self._build_ui()
        self._apply_topmost()
        self._register_global_hotkey()

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
        tab.grid_columnconfigure(0, weight=0)
        tab.grid_columnconfigure(1, weight=1)

        # Row 0: Description
        tk.Label(tab, text="Simulates holding a key down in the active VNC window.", bg=C["bg"], fg=C["muted"],
                 font=("Segoe UI", 9), anchor="w").grid(row=0, column=0, columnspan=2, sticky="ew", pady=(10, 8))

        # Row 1: Key field
        tk.Label(tab, text="Key to hold:", bg=C["bg"], fg=C["text"], font=("Segoe UI", 10)).grid(row=1, column=0, sticky="w", pady=6)
        
        key_input_frame = tk.Frame(tab, bg=C["bg"])
        key_input_frame.grid(row=1, column=1, sticky="ew", pady=6)
        
        self._hold_key_var = tk.StringVar(value="w")
        self._hold_key_entry = tk.Entry(key_input_frame, textvariable=self._hold_key_var, bg=C["input"], fg=C["text"],
                                        insertbackground=C["text"], relief="flat", font=("Segoe UI", 10), width=10)
        self._hold_key_entry.pack(side="left")
        
        # Row 2: Common keys picker grid
        tk.Label(tab, text="Common Keys:", bg=C["bg"], fg=C["muted"], font=("Segoe UI", 9)).grid(row=2, column=0, sticky="nw", pady=(12, 0))
        
        keys_grid = tk.Frame(tab, bg=C["bg"])
        keys_grid.grid(row=2, column=1, sticky="w", pady=(12, 10))
        
        common_keys = [
            ("W", "w"), ("A", "a"), ("S", "s"), ("D", "d"),
            ("Space", "space"), ("Shift", "shift"), ("Ctrl", "ctrl"),
            ("Alt", "alt"), ("Enter", "enter"), ("Tab", "tab"), ("Up", "up"), ("Down", "down")
        ]
        for index, (label, val) in enumerate(common_keys):
            r, c = index // 4, index % 4
            btn = tk.Button(keys_grid, text=label, bg=C["surface"], fg=C["text"],
                            activebackground=C["accent"], activeforeground="#ffffff",
                            relief="flat", width=7, font=("Segoe UI", 8), cursor="hand2",
                            command=lambda v=val: self._hold_key_var.set(v))
            btn.grid(row=r, column=c, padx=3, pady=3)

        # Row 3: Mode Options (Indefinite vs Duration)
        tk.Label(tab, text="Hold Mode:", bg=C["bg"], fg=C["text"], font=("Segoe UI", 10)).grid(row=3, column=0, sticky="w", pady=6)
        
        mode_frame = tk.Frame(tab, bg=C["bg"])
        mode_frame.grid(row=3, column=1, sticky="w", pady=6)
        
        self._hold_indefinite_var = tk.BooleanVar(value=True)
        
        tk.Radiobutton(mode_frame, text="Indefinitely (Until Esc)", variable=self._hold_indefinite_var, value=True,
                       command=self._update_hold_states, bg=C["bg"], fg=C["muted"], selectcolor=C["surface"],
                       activebackground=C["bg"], activeforeground=C["text"], font=("Segoe UI", 9)).pack(side="left")
                       
        tk.Radiobutton(mode_frame, text="Timed hold", variable=self._hold_indefinite_var, value=False,
                       command=self._update_hold_states, bg=C["bg"], fg=C["muted"], selectcolor=C["surface"],
                       activebackground=C["bg"], activeforeground=C["text"], font=("Segoe UI", 9)).pack(side="left", padx=(14, 0))

        # Row 4: Duration Spinbox
        tk.Label(tab, text="Duration (s):", bg=C["bg"], fg=C["text"], font=("Segoe UI", 10)).grid(row=4, column=0, sticky="w", pady=6)
        self._hold_duration_var = tk.DoubleVar(value=10.0)
        self._hold_spin = tk.Spinbox(tab, from_=1.0, to=3600.0, increment=1.0, textvariable=self._hold_duration_var,
                                     width=6, bg=C["input"], fg=C["text"], relief="flat", font=("Segoe UI", 10))
        self._hold_spin.grid(row=4, column=1, sticky="w", pady=6)
        
        self._update_hold_states()

    def _build_tab_clicker(self) -> None:
        tab = self._tab_clicker
        tab.grid_columnconfigure(0, weight=0)
        tab.grid_columnconfigure(1, weight=1)

        # Row 0: Description
        tk.Label(tab, text="Simulates continuous mouse clicking at current cursor position.", bg=C["bg"], fg=C["muted"],
                 font=("Segoe UI", 9), anchor="w").grid(row=0, column=0, columnspan=2, sticky="ew", pady=(10, 8))

        # Row 1: Mouse button
        tk.Label(tab, text="Mouse button:", bg=C["bg"], fg=C["text"], font=("Segoe UI", 10)).grid(row=1, column=0, sticky="w", pady=6)
        
        btn_frame = tk.Frame(tab, bg=C["bg"])
        btn_frame.grid(row=1, column=1, sticky="w", pady=6)
        
        self._click_btn_var = tk.StringVar(value="left")
        for btn_name in ["left", "right", "middle"]:
            tk.Radiobutton(btn_frame, text=btn_name.capitalize(), variable=self._click_btn_var, value=btn_name,
                           bg=C["bg"], fg=C["muted"], selectcolor=C["surface"], activebackground=C["bg"],
                           activeforeground=C["text"], font=("Segoe UI", 9)).pack(side="left", padx=(0, 14))

        # Row 2: Interval
        tk.Label(tab, text="Click interval (ms):", bg=C["bg"], fg=C["text"], font=("Segoe UI", 10)).grid(row=2, column=0, sticky="w", pady=6)
        self._click_interval_var = tk.IntVar(value=100)
        tk.Spinbox(tab, from_=1, to=10000, increment=10, textvariable=self._click_interval_var,
                   width=6, bg=C["input"], fg=C["text"], relief="flat", font=("Segoe UI", 10)).grid(row=2, column=1, sticky="w", pady=6)

        # Row 3: Click mode options
        tk.Label(tab, text="Click Mode:", bg=C["bg"], fg=C["text"], font=("Segoe UI", 10)).grid(row=3, column=0, sticky="w", pady=6)
        
        mode_frame = tk.Frame(tab, bg=C["bg"])
        mode_frame.grid(row=3, column=1, sticky="w", pady=6)
        
        self._click_indefinite_var = tk.BooleanVar(value=True)
        tk.Radiobutton(mode_frame, text="Indefinitely (Until Esc)", variable=self._click_indefinite_var, value=True,
                       command=self._update_click_states, bg=C["bg"], fg=C["muted"], selectcolor=C["surface"],
                       activebackground=C["bg"], activeforeground=C["text"], font=("Segoe UI", 9)).pack(side="left")
                       
        tk.Radiobutton(mode_frame, text="Click count limit", variable=self._click_indefinite_var, value=False,
                       command=self._update_click_states, bg=C["bg"], fg=C["muted"], selectcolor=C["surface"],
                       activebackground=C["bg"], activeforeground=C["text"], font=("Segoe UI", 9)).pack(side="left", padx=(14, 0))

        # Row 4: Count spinbox
        tk.Label(tab, text="Click count limit:", bg=C["bg"], fg=C["text"], font=("Segoe UI", 10)).grid(row=4, column=0, sticky="w", pady=6)
        self._click_count_var = tk.IntVar(value=100)
        self._click_spin = tk.Spinbox(tab, from_=1, to=100000, increment=10, textvariable=self._click_count_var,
                                      width=8, bg=C["input"], fg=C["text"], relief="flat", font=("Segoe UI", 10))
        self._click_spin.grid(row=4, column=1, sticky="w", pady=6)

        self._update_click_states()

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

    def _on_action_clicked(self) -> None:
        if self._running:
            self._abort_event.set()
            return

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
            key = self._hold_key_var.get().strip().lower()
            if not key:
                self._set_ui("⚠️ Enter a key name first!", C["warning"], 0)
                return
            
            indefinite = self._hold_indefinite_var.get()
            duration = 0.0 if indefinite else self._hold_duration_var.get()
            
            self._running = True
            self._action_btn.config(text="⛔  Abort   (Esc)", bg=C["danger"])
            threading.Thread(target=self._hold_worker, args=(key, delay, duration), daemon=True).start()

        elif tab_idx == 2:
            # Auto Clicker
            button = self._click_btn_var.get()
            interval_ms = self._click_interval_var.get()
            indefinite = self._click_indefinite_var.get()
            count = 0 if indefinite else self._click_count_var.get()
            
            self._running = True
            self._action_btn.config(text="⛔  Abort   (Esc)", bg=C["danger"])
            threading.Thread(target=self._click_worker, args=(button, delay, interval_ms / 1000.0, count), daemon=True).start()

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

    def _click_worker(self, button: str, delay: int, interval_s: float, count: int) -> None:
        if not self._run_countdown(delay):
            return

        try:
            self._set_ui(f"🖱️  Clicking '{button}'...", C["text"], 100)
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
        time.sleep(0.1)  # Allow worker threads brief window to release keys
        
        # Absolute safety release check
        if KEYBOARD_OK:
            try:
                _release_modifiers()
                hold_key = self._hold_key_var.get().strip().lower()
                if hold_key:
                    _kb.release(hold_key)
            except Exception:
                pass
        self.root.destroy()


if __name__ == "__main__":
    root = tk.Tk()
    VNCInputHelperApp(root)
    root.mainloop()
