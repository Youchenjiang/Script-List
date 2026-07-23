# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_all

datas = []
binaries = []
hiddenimports = []
tmp_ret = collect_all('keyboard')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]

a = Analysis(
    ['tapster_gui.py'],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['multiprocessing', 'PyQt5', 'PyQt5.QtCore', 'PyQt5.QtWidgets', 'PyQt5.QtGui', 'sip', 'qtpy'],
    noarchive=False,
    optimize=0,
)

# ── STRICT WHITELIST FILTERING ────────────────────────────────────────────────
whitelist = {
    # App code & core library dependencies
    'tapster_gui',
    'keyboard',
    'pyperclip',
    'tkinter',
    'ctypes',

    # Standard library core modules required for Python boot, Tkinter, keyboard, and pyperclip
    'sys', 'os', 'time', 'threading', 'subprocess', 'select', 'selectors', 'signal',
    'encodings', 'codecs', 'io', 'abc', 'stat', 'ntpath', 'posixpath', 'genericpath',
    'fnmatch', 'locale', 're', 'sre_compile', 'sre_parse', 'sre_constants', 'copyreg',
    'types', 'linecache', 'traceback', 'warnings', 'weakref', '_weakrefset', 'collections',
    'keyword', 'operator', 'reprlib', 'contextlib', 'importlib', 'struct', 'enum',
    'queue', 'atexit', 'platform', 'token', 'tokenize', 'inspect', 'dis', 'opcode',
    'bisect', 'shutil', 'tempfile', 'random', 'math', 'errno', 'pathlib', 'heapq',
    '_collections_abc', 'ast', 'zipfile', 'urllib', 'ipaddress', 'pkgutil', 'typing',
}

# Explicitly reject Qt / PyQt5 modules (pulled in by hook-qtpy but never used)
REJECT = {'PyQt5', 'sip', 'qtpy'}


def is_whitelisted(module_name):
    parts = module_name.split('.')
    root = parts[0]
    if root in REJECT:
        return False
    return root in whitelist

# Filter Python modules
a.pure = [item for item in a.pure if is_whitelisted(item[0])]

# Binary (DLLs/PYDs) Whitelist
allowed_binary_substrings = [
    'python312', 'vcruntime', 'msvcp', '_tkinter', 'tcl86', 'tk86',
    '_ctypes', 'ffi', '_queue', 'select', 'api-ms-win', 'ucrtbase',
    'kernel32', 'user32', 'shell32', 'zlib', 'unicodedata'
]

# Reject Qt DLLs
REJECT_BINARY = ['qt5', 'qtcore', 'qtwidgets', 'qtgui', 'pyqt5', 'sip', 'd3dcompiler', 'opengl', 'libeay', 'ssleay']

def is_binary_allowed(name):
    name_lower = name.lower()
    if any(s in name_lower for s in REJECT_BINARY):
        return False
    return any(s in name_lower for s in allowed_binary_substrings)

# Filter binaries
a.binaries = [b for b in a.binaries if is_binary_allowed(b[0])]


pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='Tapster',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False, # Set to False for production release
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
