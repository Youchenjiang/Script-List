# URL Health & HTTP Status Checker

A fast, concurrent URL availability and HTTP status code verification utility in Python and PowerShell.

[繁體中文版](README.zh-TW.md)

---

## Features

- **Multi-threaded Checks**: Inspect hundreds of URLs concurrently in seconds.
- **Robust Error Handling**: Accurately classifies DNS failures, SSL/TLS handshake issues, timeouts, and redirect chains.
- **Flexible Inputs**: Pass URLs via text file or directly on the CLI.
- **Export Options**: Formatted terminal tables, CSV (`utf-8-sig` with Excel compatibility), and JSON.
- **Cross-Platform & Dual-Language**: Available in Python 3 and PowerShell.

---

## Usage

### Python Version

```bash
# Check from file
python check_urls.py -f urls.txt

# Check multiple URLs directly
python check_urls.py -u https://google.com https://github.com

# Export report to CSV / JSON with custom workers & timeout
python check_urls.py -f urls.txt -w 20 -t 10 --csv report.csv --json report.json

# Ignore SSL certificate errors
python check_urls.py -f urls.txt --insecure
```

### PowerShell Version

```powershell
# Basic check
.\check_urls.ps1 -FilePath .\urls.txt

# Export to CSV
.\check_urls.ps1 -FilePath .\urls.txt -CsvPath report.csv
```

---

## License

MIT License
