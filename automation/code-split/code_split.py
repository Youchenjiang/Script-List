#!/usr/bin/env python3
"""code-split: Extract functions/blocks from source files into separate files with optional git commits.

Supports multiple languages:
  - C-style (C, C++, C#, Java, JavaScript, TypeScript, Go, Rust, Swift)
  - Python
  - Ruby
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
import textwrap
from pathlib import Path

# Language detection by file extension
EXTENSION_MAP = {
    ".c": "c", ".h": "c",
    ".cpp": "cpp", ".cc": "cpp", ".cxx": "cpp", ".hpp": "cpp",
    ".cs": "csharp",
    ".java": "java",
    ".js": "javascript", ".mjs": "javascript", ".jsx": "javascript",
    ".ts": "typescript", ".tsx": "typescript",
    ".go": "go",
    ".rs": "rust",
    ".swift": "swift",
    ".py": "python",
    ".rb": "ruby",
}


def detect_language(filepath: str) -> str:
    ext = Path(filepath).suffix.lower()
    return EXTENSION_MAP.get(ext, "cstyle")


# ---------------------------------------------------------------------------
# Block boundary finders
# ---------------------------------------------------------------------------

def find_brace_block(content: str, start: int) -> tuple[int, int]:
    """Find matching { } block. Returns (start, end_exclusive)."""
    count = 0
    inside = False
    for i in range(start, len(content)):
        if content[i] == "{":
            if not inside:
                inside = True
            count += 1
        elif content[i] == "}":
            count -= 1
            if inside and count == 0:
                return start, i + 1
    return start, len(content)


def find_indent_block(lines: list[str], start_idx: int) -> tuple[int, int]:
    """Find Python/Ruby indentation block. Returns (start_line, end_line_exclusive)."""
    if start_idx >= len(lines):
        return start_idx, start_idx
    base_indent = len(lines[start_idx]) - len(lines[start_idx].lstrip())
    end = start_idx + 1
    while end < len(lines):
        line = lines[end]
        if line.strip() == "":
            end += 1
            continue
        indent = len(line) - len(line.lstrip())
        if indent <= base_indent:
            break
        end += 1
    return start_idx, end


def find_do_end_block(content: str, start: int) -> tuple[int, int]:
    """Find Ruby do...end block."""
    idx = content.find("end", start)
    while idx != -1:
        # Simple heuristic: find 'end' at same or lower indentation
        before = content[max(0, idx - 200):idx]
        if before.rstrip().endswith("\n") or idx == 0:
            return start, idx + 3
        idx = content.find("end", idx + 1)
    return start, len(content)


# ---------------------------------------------------------------------------
# Language-specific method extractors
# ---------------------------------------------------------------------------

def extract_method_cstyle(content: str, method_name: str) -> tuple[str | None, int, int]:
    """Extract a function/method from C-style language."""
    patterns = [
        rf"\b{re.escape(method_name)}\s*\(",
        rf"\b{re.escape(method_name)}\s*<",  # generic methods
    ]
    for pat in patterns:
        m = re.search(pat, content)
        if m:
            # Find start of declaration (back up to access modifier or start of line)
            line_start = content.rfind("\n", 0, m.start())
            line_start = 0 if line_start == -1 else line_start + 1
            start, end = find_brace_block(content, content.find("{", m.start()))
            return content[line_start:end], line_start, end
    return None, -1, -1


def extract_method_python(content: str, method_name: str) -> tuple[str | None, int, int]:
    """Extract a function/class from Python file."""
    lines = content.split("\n")
    pat = re.compile(rf"^(def|class)\s+{re.escape(method_name)}\b", re.MULTILINE)
    m = pat.search(content)
    if m:
        # Find line number
        line_idx = content[:m.start()].count("\n")
        start, end = find_indent_block(lines, line_idx)
        block = "\n".join(lines[start:end])
        char_start = sum(len(lines[i]) + 1 for i in range(start))
        char_end = char_start + len(block)
        return block, char_start, char_end
    return None, -1, -1


def extract_method_ruby(content: str, method_name: str) -> tuple[str | None, int, int]:
    """Extract a method from Ruby file."""
    pat = re.compile(rf"^\s*(def|class|module)\s+.*{re.escape(method_name)}\b", re.MULTILINE)
    m = pat.search(content)
    if m:
        line_start = content.rfind("\n", 0, m.start())
        line_start = 0 if line_start == -1 else line_start + 1
        if "do" in content[m.start():m.start() + 200]:
            start, end = find_do_end_block(content, content.find("do", m.start()))
        else:
            start, end = find_brace_block(content, content.find("{", m.start()))
        return content[line_start:end], line_start, end
    return None, -1, -1


def extract_method(content: str, method_name: str, lang: str) -> tuple[str | None, int, int]:
    if lang == "python":
        return extract_method_python(content, method_name)
    elif lang == "ruby":
        return extract_method_ruby(content, method_name)
    else:
        return extract_method_cstyle(content, method_name)


# ---------------------------------------------------------------------------
# Regex & line-range extraction (language-agnostic)
# ---------------------------------------------------------------------------

def extract_by_regex(content: str, pattern: str, lang: str) -> list[tuple[str, int, int]]:
    results = []
    for m in re.finditer(pattern, content, re.MULTILINE):
        if lang == "python":
            lines = content.split("\n")
            line_idx = content[:m.start()].count("\n")
            start, end = find_indent_block(lines, line_idx)
            block = "\n".join(lines[start:end])
            char_start = sum(len(lines[i]) + 1 for i in range(start))
            char_end = char_start + len(block)
            results.append((block, char_start, char_end))
        else:
            brace_pos = content.find("{", m.start())
            if brace_pos != -1 and brace_pos < m.end() + 200:
                s, e = find_brace_block(content, brace_pos)
                results.append((content[s:e], s, e))
            else:
                results.append((m.group(), m.start(), m.end()))
    return results


def extract_by_lines(content: str, start_line: int, end_line: int) -> tuple[str, int, int]:
    lines = content.split("\n")
    s = max(0, start_line - 1)
    e = min(len(lines), end_line)
    block = "\n".join(lines[s:e])
    char_start = sum(len(lines[i]) + 1 for i in range(s))
    return block, char_start, char_start + len(block)


# ---------------------------------------------------------------------------
# Output formatters
# ---------------------------------------------------------------------------

def format_output(code: str, lang: str, filepath: str, name: str) -> str:
    """Wrap extracted code with appropriate file header."""
    suffix = Path(filepath).suffix
    dedented = textwrap.dedent(code).strip()

    if lang == "python":
        return dedented + "\n"
    elif lang == "ruby":
        return dedented + "\n"
    elif lang == "csharp":
        return dedented + "\n"
    elif lang == "go":
        return dedented + "\n"
    elif lang == "rust":
        return dedented + "\n"
    else:
        return dedented + "\n"


# ---------------------------------------------------------------------------
# Git helper
# ---------------------------------------------------------------------------

def git_commit(files: list[str], message: str, body: str | None = None):
    for f in files:
        subprocess.run(["git", "add", f], check=True)
    cmd = ["git", "commit", "-m", message]
    if body:
        cmd += ["-m", body]
    subprocess.run(cmd, check=True)
    print(f"  Committed: {message}")


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

def cmd_extract(args):
    lang = args.lang or detect_language(args.file)
    content = Path(args.file).read_text(encoding="utf-8")
    suffix = Path(args.file).stem
    ext = Path(args.file).suffix

    if args.method:
        code, start, end = extract_method(content, args.method, lang)
        if code is None:
            print(f"Error: method '{args.method}' not found in {args.file}", file=sys.stderr)
            sys.exit(1)
    elif args.regex:
        matches = extract_by_regex(content, args.regex, lang)
        if not matches:
            print(f"Error: no matches for pattern '{args.regex}' in {args.file}", file=sys.stderr)
            sys.exit(1)
        code, start, end = matches[0]
    elif args.lines:
        parts = args.lines.split("-")
        start_line, end_line = int(parts[0]), int(parts[1]) if len(parts) > 1 else int(parts[0])
        code, start, end = extract_by_lines(content, start_line, end_line)
    else:
        print("Error: specify --method, --regex, or --lines", file=sys.stderr)
        sys.exit(1)

    out_name = args.output or f"{suffix}.{args.name}{ext}"
    out_path = Path(args.file).parent / out_name

    if args.dry_run:
        print(f"--- Would extract to {out_path} ---")
        print(code[:500])
        print("---")
        print(f"Remaining in {args.file}:")
        remaining = content[:start] + content[end:]
        print(remaining[:500])
        return

    formatted = format_output(code, lang, args.file, args.method or args.name)
    out_path.write_text(formatted, encoding="utf-8")
    print(f"  Written: {out_path}")

    remaining = content[:start] + content[end:]
    Path(args.file).write_text(remaining, encoding="utf-8")
    print(f"  Updated: {args.file}")

    if args.commit:
        git_commit(
            [str(out_path), args.file],
            args.commit,
            f"Extract {args.method or args.name or 'block'} to {out_name}"
        )


def cmd_split(args):
    lang = args.lang or detect_language(args.file)
    content = Path(args.file).read_text(encoding="utf-8")
    suffix = Path(args.file).stem
    ext = Path(args.file).suffix

    if not args.rule:
        print("Error: provide at least one --rule", file=sys.stderr)
        sys.exit(1)

    extractions = []
    for rule_str in args.rule:
        parts = rule_str.split(":", 2)
        if len(parts) < 3:
            print(f"Error: invalid rule format '{rule_str}'. Expected name:type:value", file=sys.stderr)
            sys.exit(1)
        name, kind, value = parts
        if kind == "method":
            code, start, end = extract_method(content, value, lang)
            if code is None:
                print(f"Warning: method '{value}' not found, skipping", file=sys.stderr)
                continue
            extractions.append((name, code, start, end))
        elif kind == "lines":
            s, e = value.split("-")
            code, start, end = extract_by_lines(content, int(s), int(e))
            extractions.append((name, code, start, end))
        elif kind == "regex":
            matches = extract_by_regex(content, value, lang)
            if not matches:
                print(f"Warning: no match for '{value}', skipping", file=sys.stderr)
                continue
            code, start, end = matches[0]
            extractions.append((name, code, start, end))
        else:
            print(f"Error: unknown rule type '{kind}'", file=sys.stderr)
            sys.exit(1)

    if not extractions:
        print("Nothing to extract.", file=sys.stderr)
        sys.exit(1)

    if args.dry_run:
        for name, code, start, end in extractions:
            print(f"--- [{name}] Would extract ---")
            print(code[:300])
        return

    # Sort by position descending so we can remove from end to start
    extractions.sort(key=lambda x: x[2], reverse=True)

    files_changed = [args.file]
    for name, code, start, end in extractions:
        out_name = f"{suffix}.{name}{ext}"
        out_path = Path(args.file).parent / out_name
        formatted = format_output(code, lang, args.file, name)
        out_path.write_text(formatted, encoding="utf-8")
        print(f"  Written: {out_path}")
        files_changed.append(str(out_path))
        content = content[:start] + content[end:]

    Path(args.file).write_text(content, encoding="utf-8")
    print(f"  Updated: {args.file}")

    if args.commit:
        git_commit(files_changed, args.commit)


def main():
    parser = argparse.ArgumentParser(
        description="code-split: Extract functions/blocks from source files into separate files",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent("""\
            Supported languages: C, C++, C#, Java, JavaScript, TypeScript, Go, Rust, Swift, Python, Ruby

            Examples:
              # Extract a function by name (auto-detect language from extension)
              code_split.py extract service.py --method process_data

              # Extract from C# with explicit namespace wrapping
              code_split.py extract MyFile.cs --method WndProc --output MyFile.Events.cs

              # Extract by line range
              code_split.py extract handler.js --lines 50-120 --output handler.utils.js

              # Split by multiple rules with git commits
              code_split.py split MyFile.cs \\
                --rule State:lines:15-106 \\
                --rule Events:method:WndProc \\
                --commit "refactor: split into partial classes"

              # Force language detection
              code_split.py extract myfile --method main --lang python

              # Dry run to preview
              code_split.py extract MyFile.cs --method Foo --dry-run
        """),
    )
    sub = parser.add_subparsers(dest="command", required=True)

    # extract
    p_ext = sub.add_parser("extract", help="Extract a single block from a source file")
    p_ext.add_argument("file", help="Source file")
    p_ext.add_argument("--method", help="Function/method name to extract")
    p_ext.add_argument("--regex", help="Regex pattern to match")
    p_ext.add_argument("--lines", help="Line range, e.g. 10-50")
    p_ext.add_argument("--output", "-o", help="Output filename")
    p_ext.add_argument("--name", default="extracted", help="Name suffix for output file")
    p_ext.add_argument("--lang", choices=list(set(EXTENSION_MAP.values())), help="Force language (auto-detected from extension)")
    p_ext.add_argument("--commit", metavar="MSG", help="Git commit message")
    p_ext.add_argument("--dry-run", action="store_true", help="Preview without modifying files")

    # split
    p_split = sub.add_parser("split", help="Split a file by multiple rules")
    p_split.add_argument("file", help="Source file")
    p_split.add_argument("--rule", action="append", required=True,
                         help="Extraction rule: name:type:value (type: method/lines/regex)")
    p_split.add_argument("--lang", choices=list(set(EXTENSION_MAP.values())), help="Force language")
    p_split.add_argument("--commit", metavar="MSG", help="Git commit message")
    p_split.add_argument("--dry-run", action="store_true", help="Preview without modifying files")

    args = parser.parse_args()
    if args.command == "extract":
        cmd_extract(args)
    elif args.command == "split":
        cmd_split(args)


if __name__ == "__main__":
    main()
