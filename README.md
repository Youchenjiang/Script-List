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
├── image-downloader-pdf/       # Image downloader and PDF converter
├── text-converter-zh/          # Chinese text converter (Simplified ↔ Traditional)
├── password-security-checker/  # Password breach and strength checker
└── openai-chat-cli/            # OpenAI Chat CLI with custom personas
```

## 🛠️ Available Tools

Practical script tools:

- **Image Downloader & PDF Converter** ([image-downloader-pdf/](image-downloader-pdf/)) - Batch download web images and automatically merge them into a PDF document. Supports auto detection and manual mode with smart sorting. → [Details](image-downloader-pdf/README.md)
- **Text Converter (Simplified ↔ Traditional Chinese)** ([text-converter-zh/](text-converter-zh/)) - Selective Chinese text conversion toolkit with review-before-convert workflow. Check mode for preview and two-step conversion process with JSON configuration. → [Details](text-converter-zh/README.md)
- **Password Security Checker** ([password-security-checker/](password-security-checker/)) - PowerShell tool to check if passwords have been exposed in data breaches using HIBP API. Includes brute-force time estimation and privacy-preserving k-anonymity query. → [Details](password-security-checker/README.md)
- **OpenAI Chat CLI** ([openai-chat-cli/](openai-chat-cli/)) - Command-line interface for OpenAI Chat API with customizable conversation styles. Features include Zhuge Liang persona, multi-language support, and conversation history management. → [Details](openai-chat-cli/README.md)

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
