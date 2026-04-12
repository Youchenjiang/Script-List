# Base64 Converter

A versatile Python script to encode and decode Base64 for both text and files.

## Features

- Encode text or files to Base64 format
- Decode Base64 strings or files back to text or original files
- Command-line interface for easy usage

## Usage

```bash
python base64_converter.py [-h] (-e | -d) [-t TEXT] [-f FILE] [-o OUTPUT]
```

### Arguments

- `-e, --encode`: Encode mode
- `-d, --decode`: Decode mode
- `-t, --text TEXT`: Text to encode/decode
- `-f, --file FILE`: File to encode/decode (input)
- `-o, --output OUTPUT`: Output file path (saving base64 string or decoded file)

### Examples

**Encode text:**
```bash
python base64_converter.py -e -t "Hello World"
```

**Decode text:**
```bash
python base64_converter.py -d -t "SGVsbG8gV29ybGQ="
```

**Encode file and save string to another file:**
```bash
python base64_converter.py -e -f image.png -o image_base64.txt
```

**Decode file and save to original format:**
```bash
python base64_converter.py -d -f image_base64.txt -o decoded_image.png
```
