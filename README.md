# Script List - A Collection of Practical Python and Shell Scripts

[閱讀繁體中文版](README.zh-TW.md)

[![GitHub](https://img.shields.io/badge/GitHub-Script--List-blue)](https://github.com/Youchenjiang/Script-List)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://www.python.org/downloads/)

> A curated collection of practical Python and Shell scripts for everyday tasks. This is the sister project of [Method-List](https://github.com/Youchenjiang/Method-List), providing ready-to-use tools that complement the knowledge base.

## Introduction

Script List is a curated collection of practical scripts and automation tools. It serves as the companion project to Method-List:

- **[Method-List](https://github.com/Youchenjiang/Method-List)**: 📚 Technical knowledge base (documentation)
- **Script-List**: 🛠️ Practical script tools (executable programs)

**Method-List teaches you "how to do it", Script-List gives you "tools to use directly".**

## Table of Contents

- [Script List - A Collection of Practical Python and Shell Scripts](#script-list---a-collection-of-practical-python-and-shell-scripts)
  - [Introduction](#introduction)
  - [Table of Contents](#table-of-contents)
  - [Folder Structure](#folder-structure)
  - [🚀 Quick Start](#-quick-start)
    - [Prerequisites](#prerequisites)
    - [Installation](#installation)
  - [Usage Guidelines](#usage-guidelines)
  - [🤝 Contributing](#-contributing)
  - [📜 License](#-license)
  - [🔗 Related Projects](#-related-projects)
  - [👤 Author](#-author)
  - [⭐ Show Your Support](#-show-your-support)

## Folder Structure

```
Script-List/
├── README.md
├── README.zh-TW.md
├── LICENSE
├── .gitignore
├── ai/                         # Artificial Intelligence & LLM tools
│   ├── openai-chat-cli/        # OpenAI Chat CLI with custom personas
│   └── A2-Reproduction/        # Agentic Android Analysis reproduction
├── automation/                 # Workflow & GUI automation
│   └── vnc-auto-typer/         # VNC clipboard workaround (keyboard simulation)
├── data/                       # Data verification & extraction
│   └── image-text-verifier/    # Questionnaire image to CSV verification tool
├── media/                      # Image, PDF & Document processing
│   ├── image-downloader-pdf/   # Web image downloader and PDF merger
│   ├── image-to-pdf/           # Simple image to PDF converter
│   ├── mhtml-to-pdf/           # MHTML to PDF converter (Google Slides)
│   ├── pdf-merger/             # PDF file merging utility
│   ├── photo-splitter/         # Student photo extraction/splitting tool
│   └── ppt-to-pdf/             # PowerPoint to PDF converter
├── security/                   # Security & Analysis tools
│   ├── password-security-checker/ # HIBP breach and strength checker
│   └── frida-apk-tool/         # Android APK patching with Frida hooks
└── text/                       # Text transformation & encoding
    ├── text-converter-zh/      # Chinese Simplified ↔ Traditional converter
    ├── base64-converter/       # Base64 encoding/decoding utility
    └── hex-to-ascii/           # Hexadecimal to ASCII converter
```

## 🛠️ Available Tools

Practical script tools categorized by function:

### 🤖 AI & LLM
- **OpenAI Chat CLI** ([ai/openai-chat-cli/](ai/openai-chat-cli/)) - Command-line interface for OpenAI Chat API with customizable conversation styles. Features include Zhuge Liang persona, multi-language support, and history management. → [Details](ai/openai-chat-cli/README.md)
- **A2: Agentic Android Analysis** ([ai/A2-Reproduction/](ai/A2-Reproduction/)) - Reproduction of the A2 framework for automated mobile app vulnerability discovery and validation using multi-agent systems. → [Details](ai/A2-Reproduction/README.md)

### ⚙️ Automation
- **VNC Auto Typer** ([automation/vnc-auto-typer/](automation/vnc-auto-typer/)) - Simulate keyboard input into a VNC window when clipboard paste is unavailable. Reads from clipboard, file, or inline text. → [Details](automation/vnc-auto-typer/README.md)

### 📊 Data & Verification
- **Image-Text Verifier** ([data/image-text-verifier/](data/image-text-verifier/)) - Extract answers from scanned questionnaire images and automatically verify/fix them against an existing CSV dataset with targeted risk management. → [Details](data/image-text-verifier/README.md)

### 📁 Media & Documents
- **Image Downloader & PDF Converter** ([media/image-downloader-pdf/](media/image-downloader-pdf/)) - Batch download web images and automatically merge them into a PDF document. Supports smart sorting. → [Details](media/image-downloader-pdf/README.md)
- **MHTML to PDF Converter** ([media/mhtml-to-pdf/](media/mhtml-to-pdf/)) - Convert Google Slides MHTML exports into zero-whitespace 16:9 PDFs. Features GUI file picker and offline mode. → [Details](media/mhtml-to-pdf/README.md)
- **PDF Merger** ([media/pdf-merger/](media/pdf-merger/)) - Simple utility to merge multiple PDF files into a single document with customizable order. → [Details](media/pdf-merger/README.md)
- **Image to PDF** ([media/image-to-pdf/](media/image-to-pdf/)) - Convert a directory of images into a single PDF document. → [Details](media/image-to-pdf/README.md)
- **PPT to PDF** ([media/ppt-to-pdf/](media/ppt-to-pdf/)) - Batch convert PowerPoint presentations (.pptx) to PDF format. → [Details](media/ppt-to-pdf/README.md)
- **Photo Splitter** ([media/photo-splitter/](media/photo-splitter/)) - Extract individual student portraits from group photos using face detection and roster mapping. → [Details](media/photo-splitter/README.md)

### 🛡️ Security
- **Password Security Checker** ([security/password-security-checker/](security/password-security-checker/)) - PowerShell tool to check if passwords have been exposed in data breaches using HIBP API. → [Details](security/password-security-checker/README.md)
- **Frida APK Tool** ([security/frida-apk-tool/](security/frida-apk-tool/)) - Toolkit for patching Android APKs with Frida hooks for dynamic analysis and instrumentation. → [Details](security/frida-apk-tool/README.md)

### 📝 Text & Encoding
- **Text Converter (Simplified ↔ Traditional Chinese)** ([text/text-converter-zh/](text/text-converter-zh/)) - Selective Chinese text conversion toolkit with review-before-convert workflow. → [Details](text/text-converter-zh/README.md)
- **Base64 Converter** ([text/base64-converter/](text/base64-converter/)) - Utility for encoding and decoding strings or files to/from Base64 format. → [Details](text/base64-converter/README.md)
- **Hex to ASCII** ([text/hex-to-ascii/](text/hex-to-ascii/)) - Convert hexadecimal strings to their ASCII text equivalents. → [Details](text/hex-to-ascii/README.md)

## 🚀 Quick Start

### Prerequisites

- Python 3.8 or higher
- pip (Python package manager)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/Youchenjiang/Script-List.git
cd Script-List
```

2. Navigate to the script you want to use:

```bash
cd category/script-name
```

3. Install dependencies (if required):

```bash
pip install -r requirements.txt
```

4. Run the script:

```bash
python script.py
```

## Usage Guidelines

Each script includes:

- **README.md**: Detailed documentation and usage instructions
- **requirements.txt**: List of required Python packages
- **examples/**: Sample inputs and outputs

Please read the individual script's README for specific usage instructions.

## 🤝 Contributing

Contributions are welcome! Here's how to contribute:

1. Fork the repository
2. Create a new branch (`git checkout -b feature/amazing-script`)
3. Make your changes
4. Commit your changes (`git commit -m 'Add amazing script'`)
5. Push to the branch (`git push origin feature/amazing-script`)
6. Open a Pull Request

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Related Projects

- [Method-List](https://github.com/Youchenjiang/Method-List) - Technical knowledge base and solutions

## 👤 Author

**Youchen Jiang**

- GitHub: [@Youchenjiang](https://github.com/Youchenjiang)

## ⭐ Show Your Support

Give a ⭐️ if this project helped you!

---

**Note**: All scripts are provided "as is" without warranty. Please review the code before running in production environments.
