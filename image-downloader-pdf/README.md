# Image Downloader & PDF Converter

[閱讀繁體中文版](README.zh-TW.md)

A tool for batch downloading web images and automatically merging them into a PDF document.

## Features

- 🔄 **Auto Mode**: Automatically detect and download all available images
- 📝 **Manual Mode**: Specify the number of images to download
- 📄 **PDF Conversion**: Automatically merge images into a single PDF in order
- ⚡ **Smart Sorting**: Use natural sorting to ensure correct image order (1, 2, 3... not 1, 10, 2...)
- 🛡️ **Error Handling**: Complete error handling and timeout protection

## Requirements

- Python 3.8+
- Required packages listed in `requirements.txt`

## Installation

```bash
pip install -r requirements.txt
```

## Usage

### Basic Usage

```bash
python download_and_convert.py
```

The program will interactively ask for:
1. Base image URL (e.g., `https://example.com/images/`)
2. Output folder name (default: `downloaded_images`)
3. PDF filename (default: `output.pdf`)
4. Download mode selection

### Download Modes

#### 1. Auto Mode (Recommended)

The program automatically detects and downloads all available images, stopping after 3 consecutive failures.

Use cases:
- Unknown total number of images
- Sequential image numbering
- Need to download all available images

#### 2. Manual Mode

Requires manual specification of total image count.

Use cases:
- Known total number of images
- Possible gaps in image numbering
- Only need to download partial images

## Examples

### Example 1: Auto Mode

```
==================================================
Image Download & PDF Conversion Tool
==================================================

Enter base image URL (without number and .jpg): https://example.com/images/

Output folder name [default: downloaded_images]: my_images

PDF filename [default: output.pdf]: my_document.pdf

Select download mode:
1. Auto mode - Auto detect and download all available images (Recommended)
2. Manual mode - Download specified number of images

Select mode (1/2) [default: 1]: 1
```

### Example 2: Manual Mode

```
Select mode (1/2) [default: 1]: 2
Enter total number of images to download [default: 41]: 50
```

## Output

- **Images**: Saved in the specified output folder (default `downloaded_images/`)
- **PDF**: Saved in current directory with specified filename (default `output.pdf`)

## Notes

1. **URL Format**: Base URL should not include numbers and file extensions
   - ✅ Correct: `https://example.com/images/`
   - ❌ Wrong: `https://example.com/images/1.jpg`

2. **Image Numbering**: Program assumes images are numbered starting from 1 (1.jpg, 2.jpg, 3.jpg...)

3. **File Format**: Currently only supports JPG format

4. **Network Connection**: Ensure stable network connection, program has 10-second timeout protection

## Troubleshooting

### Issue: Download Failed

**Possible Causes**:
- Incorrect URL or image doesn't exist
- Network connection issues
- Server access restrictions

**Solutions**:
- Check if URL is correct
- Verify network connection
- Try opening image URL in browser

### Issue: Cannot Create PDF

**Possible Causes**:
- No images in folder
- Unsupported image format
- Insufficient disk space

**Solutions**:
- Confirm images downloaded successfully
- Check if images are in JPG format
- Check disk space

## License

MIT License

## Related Projects

- [Method-List](https://github.com/Youchenjiang/Method-List) - Technical Knowledge Base

