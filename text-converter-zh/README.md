# Text Converter (Simplified ↔ Traditional Chinese)

A selective Chinese text conversion toolkit that allows you to review and control which characters to convert between Simplified and Traditional Chinese.

## Features

- **Check Mode** (`convert-check.py`): Read-only inspection tool to preview which characters can be converted
- **Main Converter** (`convert-main.py`): Two-step conversion process with manual review
- **Selective Conversion**: Choose exactly which characters to convert via JSON configuration
- **Safe Operation**: Preview before conversion, no accidental changes

## Prerequisites

- Python 3.6+
- OpenCC library

## Installation

1. Navigate to the tool directory:
```bash
cd text-converter-zh
```

2. Install required dependencies:
```bash
pip install -r requirements.txt
```

## Usage

### Method 1: Quick Check (Read-Only)

Use `convert-check.py` to quickly preview which Simplified Chinese characters exist in a file and their Traditional equivalents:

```bash
python convert-check.py <file_path>
```

**Example**:
```bash
python convert-check.py document.txt
```

**Output**:
```
在檔案 'document.txt' 中找到以下可轉換的簡體字：
台 -> 臺
国 -> 國
学 -> 學
```

This tool **does not modify** any files - it only displays the conversion map.

### Method 2: Selective Conversion (Two-Step Process)

Use `convert-main.py` for controlled conversion with manual review:

#### Step 1: Generate Configuration File

```bash
python convert-main.py <file_path>
```

This scans the file and creates `conversion_config.json` with all Simplified→Traditional character mappings.

**Example** of `conversion_config.json`:
```json
{
    "台": "臺",
    "国": "國",
    "学": "學",
    "说": "說"
}
```

#### Step 2: Review and Edit Configuration

1. Open `conversion_config.json` in a text editor
2. **Remove** any lines for characters you don't want to convert
3. Save the file

For example, if you want to keep "台" unchanged but convert others, delete the `"台": "臺"` line:
```json
{
    "国": "國",
    "学": "學",
    "说": "說"
}
```

#### Step 3: Execute Conversion

```bash
python convert-main.py <file_path> --convert
```

The script will replace characters in the original file according to your edited configuration.

## Workflow Example

```bash
# 1. Check what can be converted (optional preview)
python convert-check.py article.md

# 2. Generate configuration file
python convert-main.py article.md

# 3. Edit conversion_config.json to remove unwanted conversions

# 4. Apply the conversion
python convert-main.py article.md --convert
```

## Use Cases

- **Technical Documentation**: Convert terminology while preserving code examples and specific terms
- **Academic Papers**: Selective conversion for citations and proper nouns
- **Bilingual Content**: Maintain certain terms in their original form
- **Quality Control**: Review all conversions before applying changes

## Important Notes

- ⚠️ **Backup Your Files**: Always create backups before conversion
- 📝 **Check Configuration**: Review `conversion_config.json` carefully before running `--convert`
- 🔄 **Iterative Process**: You can regenerate the config file and adjust as needed
- 📁 **Working Directory**: `conversion_config.json` is created in the current directory

## Troubleshooting

### "ModuleNotFoundError: No module named 'opencc'"

Install the required package:
```bash
pip install opencc-python-reimplemented
```

### "UnicodeDecodeError"

Ensure your file is UTF-8 encoded. Most modern text editors support UTF-8.

### Characters Not Converting

- Verify the character exists in `conversion_config.json`
- Check that you're using the `--convert` flag in step 3
- Ensure the config file is valid JSON format

## Technical Details

- **Conversion Engine**: OpenCC (Open Chinese Convert)
- **Character Detection**: Compares each character with its converted form
- **File Encoding**: UTF-8
- **Configuration Format**: JSON

## License

This tool is part of the Script-List project and follows the same MIT License.
