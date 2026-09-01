#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
High-Performance AAC to MP3 Batch Audio Converter
Supports:
- Multi-threaded batch conversion with progress tracking
- Automatic FFmpeg discovery (PATH, imageio-ffmpeg, local binaries)
- Recursive folder conversion preserving relative structure
- Metadata and ID3 preservation
"""

import argparse
import os
import shutil
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Optional, Tuple


def find_ffmpeg() -> Optional[str]:
    """Find ffmpeg binary in PATH or via imageio_ffmpeg."""
    # 1. System PATH
    ffmpeg_path = shutil.which("ffmpeg")
    if ffmpeg_path:
        return ffmpeg_path

    # 2. imageio-ffmpeg python package fallback
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        pass

    # 3. Common Windows directories
    common_paths = [
        r"C:\ProgramData\chocolatey\bin\ffmpeg.exe",
        r"C:\ffmpeg\bin\ffmpeg.exe",
    ]
    for p in common_paths:
        if os.path.isfile(p):
            return p

    return None


def convert_single_file(
    ffmpeg_exe: str,
    input_file: str,
    output_file: str,
    bitrate: str = "320k",
    overwrite: bool = True
) -> Tuple[bool, str]:
    """Convert single AAC/M4A/ADTS file to MP3."""
    if not overwrite and os.path.exists(output_file):
        return True, f"[Skipped] {output_file} already exists"

    out_dir = os.path.dirname(output_file)
    if out_dir and not os.path.exists(out_dir):
        os.makedirs(out_dir, exist_ok=True)

    cmd = [
        ffmpeg_exe,
        "-y" if overwrite else "-n",
        "-i", input_file,
        "-codec:a", "libmp3lame",
        "-b:a", bitrate,
        "-map_metadata", "0",
        "-id3v2_version", "3",
        "-loglevel", "error",
        output_file
    ]

    try:
        proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if proc.returncode == 0:
            return True, f"[Success] {os.path.basename(input_file)} -> {os.path.basename(output_file)}"
        else:
            return False, f"[Error] {os.path.basename(input_file)}: {proc.stderr.strip()}"
    except Exception as e:
        return False, f"[Exception] {os.path.basename(input_file)}: {str(e)}"


def discover_audio_files(input_dir: str, recursive: bool = True) -> List[str]:
    """Discover all supported AAC/M4A/ADTS audio files."""
    valid_exts = {".aac", ".m4a", ".adts"}
    discovered = []

    if recursive:
        for root, _, files in os.walk(input_dir):
            for file in files:
                ext = os.path.splitext(file)[1].lower()
                if ext in valid_exts:
                    discovered.append(os.path.join(root, file))
    else:
        for file in os.listdir(input_dir):
            full_path = os.path.join(input_dir, file)
            if os.path.isfile(full_path):
                ext = os.path.splitext(file)[1].lower()
                if ext in valid_exts:
                    discovered.append(full_path)

    return sorted(discovered)


def main():
    parser = argparse.ArgumentParser(description="High-Performance AAC to MP3 Audio Converter")
    parser.add_argument("-i", "--input", required=True, help="Path to input audio file or folder")
    parser.add_argument("-o", "--output", help="Path to output MP3 file or directory")
    parser.add_argument("-b", "--bitrate", default="320k", help="Audio bitrate (e.g. 320k, 256k, 192k; default: 320k)")
    parser.add_argument("-t", "--threads", type=int, default=os.cpu_count() or 4, help="Concurrent conversion threads (default: CPU count)")
    parser.add_argument("-r", "--recursive", action="store_true", help="Recursively search subdirectories")
    parser.add_argument("--no-overwrite", action="store_true", help="Skip existing target MP3 files")

    args = parser.parse_args()

    ffmpeg_exe = find_ffmpeg()
    if not ffmpeg_exe:
        print("[Error] FFmpeg was not found on your system.", file=sys.stderr)
        print("Please install FFmpeg or run: pip install imageio-ffmpeg", file=sys.stderr)
        sys.exit(1)

    input_path = os.path.abspath(args.input)
    if not os.path.exists(input_path):
        print(f"[Error] Input path not found: {input_path}", file=sys.stderr)
        sys.exit(1)

    # Mode 1: Single file conversion
    if os.path.isfile(input_path):
        if args.output and (args.output.endswith(".mp3") or not os.path.isdir(args.output)):
            output_file = os.path.abspath(args.output)
        else:
            base_dir = os.path.abspath(args.output) if args.output else os.path.dirname(input_path)
            base_name = os.path.splitext(os.path.basename(input_path))[0] + ".mp3"
            output_file = os.path.join(base_dir, base_name)

        print(f"[*] Converting: {input_path} -> {output_file} ({args.bitrate})")
        ok, msg = convert_single_file(ffmpeg_exe, input_path, output_file, args.bitrate, not args.no_overwrite)
        print(msg)
        sys.exit(0 if ok else 1)

    # Mode 2: Directory batch conversion
    out_base_dir = os.path.abspath(args.output) if args.output else input_path
    audio_files = discover_audio_files(input_path, recursive=args.recursive)

    if not audio_files:
        print(f"[Warning] No AAC/M4A/ADTS files found in: {input_path}")
        sys.exit(0)

    print(f"[*] Found {len(audio_files)} audio file(s). Starting conversion with {args.threads} worker threads...")

    success_count = 0
    fail_count = 0

    with ThreadPoolExecutor(max_workers=args.threads) as executor:
        future_map = {}
        for src_file in audio_files:
            rel_path = os.path.relpath(src_file, input_path)
            rel_dir = os.path.dirname(rel_path)
            base_name = os.path.splitext(os.path.basename(src_file))[0] + ".mp3"
            dst_file = os.path.join(out_base_dir, rel_dir, base_name)

            future = executor.submit(
                convert_single_file,
                ffmpeg_exe,
                src_file,
                dst_file,
                args.bitrate,
                not args.no_overwrite
            )
            future_map[future] = src_file

        for future in as_completed(future_map):
            ok, msg = future.result()
            print(msg)
            if ok:
                success_count += 1
            else:
                fail_count += 1

    print("\n" + "=" * 50)
    print(f"🎉 Batch Conversion Finished! Total: {len(audio_files)} | Success: {success_count} | Failed: {fail_count}")
    print("=" * 50)


if __name__ == "__main__":
    main()
