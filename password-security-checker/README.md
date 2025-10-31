# Password Security Checker

A PowerShell tool to check if your password has been exposed in data breaches using the Have I Been Pwned (HIBP) API, and estimate brute-force cracking time.

## Features

- **Breach Check**: Verify if password appears in HIBP database of compromised passwords
- **Secure Input**: Uses PowerShell's SecureString for safe password entry
- **Privacy First**: Only sends first 5 characters of SHA-1 hash (k-anonymity model)
- **Strength Analysis**: Calculate estimated brute-force time based on:
  - Password length
  - Character set diversity (numbers, lowercase, uppercase, symbols)
  - NVIDIA RTX-4090 SHA-256 hash rate benchmark
- **Interactive Loop**: Check multiple passwords in one session

## Prerequisites

- **Windows PowerShell 5.1+** or **PowerShell Core 7+**
- **Internet Connection**: Required to query HIBP API

## Installation

1. Navigate to the tool directory:
```powershell
cd password-security-checker
```

2. No additional dependencies required - uses built-in PowerShell modules

## Usage

### Run the Script

```powershell
.\Check-PasswdCollision.ps1
```

### Interactive Workflow

1. Enter a password when prompted (input is hidden)
2. View results:
   - **If compromised**: Shows how many times password appears in breaches
   - **If safe**: Shows estimated brute-force cracking time
3. Press Enter without typing to exit, or check another password

### Example Output

**Compromised Password**:
```
請輸入要檢查的密碼: ********
5BAA6 - 1E4C9B93F3F0682250B6CF8331B7EE68FD8
警告!此密碼在 HIBP 資料庫出現 3,861,493 次，不建議使用
```

**Safe Password**:
```
請輸入要檢查的密碼: ********
A1B2C - 3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T
呼~ HIBP 資料庫未收錄此密碼
長度 16 (數字、小寫、大寫、符號) 預估暴力破解時間約：1,234,567 年 (NVIDIA RTX-4090 / SHA256)
```

## How It Works

### Privacy-Preserving API Query

1. **Hash Password**: Compute SHA-1 hash of entered password
2. **k-Anonymity**: Send only first 5 characters of hash to HIBP API
3. **Local Matching**: Download all hashes with same prefix, match locally
4. **Result**: Your full password never leaves your computer

Example:
- Password hash: `5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8`
- Send to API: `5BAA6`
- Receive: All hashes starting with `5BAA6`
- Match locally: `1E4C9B93F3F0682250B6CF8331B7EE68FD8`

### Strength Calculation

**Character Set Pools**:
- Numbers (0-9): 10 characters
- Lowercase (a-z): 26 characters
- Uppercase (A-Z): 26 characters
- Symbols: 32 common special characters

**Formula**:
```
Total Combinations = (Pool Size) ^ (Password Length)
Time = Combinations ÷ RTX-4090 Hash Rate
```

**Benchmark**: NVIDIA RTX-4090 @ 21,791.7 MH/s (SHA-256)

## Security Notes

- ✅ **SecureString**: Password stored securely in memory
- ✅ **Zero After Use**: Memory cleared immediately after use
- ✅ **k-Anonymity**: HIBP API never sees your full password hash
- ✅ **HTTPS**: All API communications encrypted
- ⚠️ **Local Processing**: Hash comparison done on your machine
- ⚠️ **Reference Only**: Brute-force time is theoretical estimate

## Use Cases

- **Personal Security**: Verify your passwords aren't compromised
- **Password Audit**: Check organizational password policies
- **Security Awareness**: Demonstrate password strength to others
- **Incident Response**: Quickly check if credentials are in breach databases

## API Information

- **Service**: [Have I Been Pwned](https://haveibeenpwned.com/)
- **API Endpoint**: `https://api.pwnedpasswords.com/range/`
- **Documentation**: [Pwned Passwords API](https://haveibeenpwned.com/API/v3#PwnedPasswords)
- **Rate Limit**: Reasonable use policy, no authentication required

## Troubleshooting

### "請輸入要檢查的密碼" Not Appearing

Ensure you're running in an interactive PowerShell session, not as a scheduled task.

### Network Connection Error

Check internet connectivity and firewall settings. The script needs to reach `api.pwnedpasswords.com`.

### Execution Policy Error

If you see "script cannot be loaded", run:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## Credits

- **Original Author**: 黑暗執行緒 (DarkThread)
- **Source**: [快速檢測密碼是否外洩或被列入已知清單](https://blog.darkthread.net/blog/pwd-hibp-check/)
- **HIBP Service**: Troy Hunt
- **Benchmark Data**: [Hashcat Forum](https://hashcat.net/forum/thread-11277.html)

## Technical Details

- **Language**: PowerShell
- **Hash Algorithm**: SHA-1 (for HIBP compatibility)
- **Benchmark**: SHA-256 (for strength estimation)
- **API Protocol**: HTTPS GET request
- **Response Format**: Plain text, colon-separated values

## License

This tool is part of the Script-List project and follows the same MIT License.
