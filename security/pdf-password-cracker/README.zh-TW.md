# PDF 密碼破解與加密分析工具 (PDF Password Cracker)

高效能的 Python PDF 密碼分析與字典檔暴力破解工具，支援 PDF Standard Security Handler（Revision 2、3、4，40-bit 及 128-bit RC4 加密演算法）。

[English Version](README.md)

---

## 功能特色

- **原生密碼學加速**：直接實現 PDF 標準密鑰衍生演算法（MD5 + RC4），避免第三方 PDF 解析庫的龐大渲染開銷，大幅提升破解速度。
- **多處理程序並行 (Multiprocessing)**：自動調度多核心 CPU 進行批次分配與並行檢驗。
- **加密參數檢視**：快速解析 PDF 加密字典中的 `/U`、`/O`、`/P`、`/R`、`/Length`、`/ID` 等參數。
- **單密碼校準與字典檔攻擊**：支援單一密碼快速驗證以及大型字典檔（如 rockyou.txt）並行破解。

---

## 安裝需求

使用 Python 原生標準庫（`hashlib`、`multiprocessing`、`argparse`、`struct`、`re`），無須額外安裝第三方套件。

```bash
python --version  # 建議使用 Python 3.8 以上版本
```

---

## 使用方式

### 1. 檢視 PDF 加密參數

```bash
python pdf_cracker.py sample.pdf
```

### 2. 快速驗證單一密碼

```bash
python pdf_cracker.py sample.pdf -p "mypassword"
```

### 3. 執行字典檔多核心破解

```bash
python pdf_cracker.py sample.pdf -w /path/to/wordlist.txt -t 8
```

---

## 支援之加密規範

- **PDF 1.1 - 1.3 (Revision 2)**：40-bit RC4
- **PDF 1.4 - 1.6 (Revision 3 & 4)**：128-bit RC4
- *註：AES-128 / AES-256 (Revision 5+) 需使用 AES 模組。*

---

## 授權條款

MIT License
