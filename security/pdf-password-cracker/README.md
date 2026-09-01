# PDF Password Cracker

A high-performance Python utility for analyzing and cracking password-protected PDF files using Standard Security Handler (Revision 2, 3, and 4; 40-bit and 128-bit RC4 encryption).

[繁體中文版](README.zh-TW.md)

---

## Features

- **Direct Crypto Implementation**: Bypasses heavy PDF parsing overhead during brute-forcing for ultra-high throughput (MD5 + RC4).
- **Multiprocessing Support**: Scales across all available CPU cores with batched worker queues.
- **Parameter Inspection**: Inspects and displays PDF encryption metadata (`/U`, `/O`, `/P`, `/R`, `/Length`, `/ID`).
- **Standard Verification**: Supports single password validation and wordlist attacks.

---

## Installation

No external dependencies required (uses standard library `hashlib`, `multiprocessing`, `argparse`, `struct`, `re`).

```bash
python --version  # Requires Python 3.8+
```

---

## Usage

### 1. Inspect PDF Encryption Parameters

```bash
python pdf_cracker.py sample.pdf
```

### 2. Verify Single Password

```bash
python pdf_cracker.py sample.pdf -p "mypassword"
```

### 3. Run Wordlist Attack

```bash
python pdf_cracker.py sample.pdf -w /path/to/wordlist.txt -t 8
```

---

## Supported Encryption Standards

- **PDF 1.1 - 1.3 (Revision 2)**: 40-bit RC4
- **PDF 1.4 - 1.6 (Revision 3 & 4)**: Up to 128-bit RC4
- *Note: AES-128 / AES-256 (Revision 5+) requires separate AES cipher routines.*

---

## License

MIT License
