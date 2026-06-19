# Code Split

A CLI tool to extract functions, methods, or code blocks from source files into separate files. Supports multiple programming languages with auto-detection.

[閱讀繁體中文版](README.zh-TW.md)

---

## Features

- **Multi-language support**: C, C++, C#, Java, JavaScript, TypeScript, Go, Rust, Swift, Python, Ruby
- **Auto-detection**: Language detected from file extension (override with `--lang`)
- **Three extraction modes**: by method name, regex pattern, or line range
- **Batch split**: Split one file into multiple files with `--rule` flags
- **Git integration**: Optional auto-commit for each extraction
- **Dry-run**: Preview changes before modifying files

---

## Prerequisites

- Python 3.8+
- No external dependencies (stdlib only)

## Installation

```bash
# No installation needed, just run the script
python code_split.py --help
```

---

## Usage

### Extract a single function

```bash
# Extract by method name (auto-detects language)
python code_split.py extract service.py --method process_data

# Extract from C#
python code_split.py extract MyFile.cs --method WndProc --output MyFile.Events.cs

# Extract by line range
python code_split.py extract handler.js --lines 50-120 --output handler.utils.js

# Extract by regex pattern
python code_split.py extract main.go --regex "func Handle\w+" --output handlers.go
```

### Split a file by multiple rules

```bash
python code_split.py split MyWindow.cs \
  --rule State:lines:15-106 \
  --rule Events:method:WndProc \
  --commit "refactor: split MyWindow into partial classes"
```

### Force language detection

```bash
python code_split.py extract myfile --method main --lang python
```

### Dry run (preview only)

```bash
python code_split.py extract MyFile.cs --method Foo --dry-run
```

---

## CLI Reference

```
usage: code_split.py [-h] {extract,split} ...

code-split: Extract functions/blocks from source files into separate files

positional arguments:
  {extract,split}
    extract        Extract a single block from a source file
    split          Split a file by multiple rules

extract arguments:
  file                  Source file
  --method METHOD       Function/method name to extract
  --regex REGEX         Regex pattern to match
  --lines LINES         Line range, e.g. 10-50
  --output, -o FILE     Output filename
  --name NAME           Name suffix for output file
  --lang {c,csharp,python,...}
                        Force language (auto-detected from extension)
  --commit MSG          Git commit message
  --dry-run             Preview without modifying files

split arguments:
  file                  Source file
  --rule RULE           Extraction rule: name:type:value (type: method/lines/regex)
  --lang LANG           Force language
  --commit MSG          Git commit message
  --dry-run             Preview without modifying files
```

---

## Supported Languages

| Language | Extensions | Block Detection |
|----------|------------|-----------------|
| C | `.c`, `.h` | Braces `{}` |
| C++ | `.cpp`, `.cc`, `.cxx`, `.hpp` | Braces `{}` |
| C# | `.cs` | Braces `{}` |
| Java | `.java` | Braces `{}` |
| JavaScript | `.js`, `.mjs`, `.jsx` | Braces `{}` |
| TypeScript | `.ts`, `.tsx` | Braces `{}` |
| Go | `.go` | Braces `{}` |
| Rust | `.rs` | Braces `{}` |
| Swift | `.swift` | Braces `{}` |
| Python | `.py` | Indentation |
| Ruby | `.rb` | `do...end` / braces |

---

## Examples

### Python: Extract a function

```bash
python code_split.py extract utils.py --method calculate_total
```

Before:
```python
def calculate_total(items):
    return sum(item.price for item in items)

def validate_input(data):
    ...
```

After extracting `calculate_total`:

`utils.calculate_total.py`:
```python
def calculate_total(items):
    return sum(item.price for item in items)
```

`utils.py`:
```python
def validate_input(data):
    ...
```

### JavaScript: Batch split

```bash
python code_split.py split app.js \
  --rule Handlers:regex:"function handle\w+" \
  --rule Utils:method:formatDate \
  --commit "refactor: split app.js into modules"
```

---

## License

MIT
