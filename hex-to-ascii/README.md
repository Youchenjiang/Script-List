# Hex to ASCII Converter

A simple Python script to convert Hexadecimal strings to ASCII characters.

## Features

- Supports hexadecimal strings with or without spaces, commas, `0x` or `\x` prefixes.
- Convert hex strings passed via command line argument.
- Read hexadecimal content from a file.
- Supports piping from standard input.

## Usage

```bash
python hex_to_ascii.py [-h] [-t TEXT] [-f FILE]
```

### Arguments

- `-t, --text TEXT`: The hexadecimal string to convert
- `-f, --file FILE`: File to read the hexadecimal string from

### Examples

**Convert a simple hex string:**
```bash
python hex_to_ascii.py -t "48656c6c6f20576f726c64"
```

**Convert hex with spaces or prefixes:**
```bash
python hex_to_ascii.py -t "0x48 0x65 0x6c 0x6c 0x6f"
```

**Read from a file:**
```bash
python hex_to_ascii.py -f hex_data.txt
```

**Pipe from standard input:**
```bash
echo "48656c6c6f" | python hex_to_ascii.py
```
