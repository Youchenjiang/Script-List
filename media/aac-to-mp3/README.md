# AAC to MP3 Audio Converter

High-performance audio converter script for converting AAC (`.aac`, `.m4a`, `.adts`) files into high-quality MP3 format.

## Features

- ⚡ **Multi-threading**: Batch converts folders concurrently for ultra-fast processing.
- 🎵 **High Quality Audio**: Default 320 kbps (CBR/VBR support via custom `--bitrate`).
- 📁 **Batch & Recursive**: Recursively discovers and processes all audio files while preserving directory structure.
- 🏷️ **Metadata Preservation**: Retains ID3 tags, title, artist, album, and track metadata from source files.
- 🛠️ **Smart FFmpeg Resolution**: Automatically locates FFmpeg from PATH, Windows WinGet/npm paths, or python `imageio-ffmpeg`.

---

## Installation

```bash
# Optional: install imageio-ffmpeg for zero-config automatic FFmpeg binary
pip install -r requirements.txt
```

---

## Quick Usage

### 1. Single File Conversion
```bash
python aac_to_mp3.py --input audio.aac --output audio.mp3
```

### 2. Batch Convert Entire Folder
```bash
python aac_to_mp3.py --input ./music --output ./converted_mp3 --recursive --threads 8
```

### 3. Custom Bitrate
```bash
python aac_to_mp3.py --input song.aac --bitrate 192k
```
