# AAC 轉 MP3 高效音訊轉檔工具 (AAC to MP3 Audio Converter)

高效能的 Python 批次音訊轉檔工具，可將 AAC、M4A、ADTS 格式音訊快速轉換為高品質 MP3 格式。

[English Version](README.md)

---

## 功能特色

- ⚡ **多執行緒並行加速**：支援多核心同時批次轉檔，大幅縮短大量音樂轉檔時間。
- 🎵 **高品質輸出**：預設輸出 320 kbps 高音質，可透過 `--bitrate` 自訂位元率。
- 📁 **遞迴搜尋與結構保留**：可遞迴遍歷子目錄並完整保留原始資料夾層級結構。
- 🏷️ **中繼資料保留**：完整保留原始音訊的 ID3 歌曲標籤、演出者、專輯名稱與曲目資訊。
- 🛠️ **自動偵測 FFmpeg**：優先抓取系統 PATH、WinGet 安裝目錄或 Python `imageio-ffmpeg` 套件。

---

## 安裝需求

```bash
# 可選：安裝 imageio-ffmpeg 套件（若系統未安裝 ffmpeg 執行檔）
pip install -r requirements.txt
```

---

## 使用方式

### 1. 單一檔案轉檔
```bash
python aac_to_mp3.py --input audio.aac --output audio.mp3
```

### 2. 批次轉換整份資料夾
```bash
python aac_to_mp3.py --input ./music --output ./converted_mp3 --recursive --threads 8
```

### 3. 自訂輸出位元率
```bash
python aac_to_mp3.py --input song.aac --bitrate 192k
```

---

## 授權條款

MIT License
