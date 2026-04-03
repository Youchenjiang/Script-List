import argparse
import subprocess
from pathlib import Path

import cv2
import numpy as np


def detect_faces_haar(img: np.ndarray) -> list[tuple[int, int, int, int]]:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    faces = face_cascade.detectMultiScale(gray, 1.3, 5)
    return [(int(x), int(y), int(w), int(h)) for (x, y, w, h) in faces]


def run_ocr(img: np.ndarray) -> str:
    tmp_path = "_tmp_ocr.png"
    cv2.imwrite(tmp_path, img)
    # 使用 Tesseract 辨識繁體中文
    cmd = ["tesseract", tmp_path, "stdout", "-l", "chi_tra"]
    try:
        result = subprocess.check_output(cmd, text=True, encoding="utf-8")
    except Exception:
        result = ""
    finally:
        if Path(tmp_path).exists():
            Path(tmp_path).unlink()
    return result


def process_images(input_dir: Path, output_dir: Path, debug_dir: Path):
    output_dir.mkdir(exist_ok=True)
    debug_dir.mkdir(exist_ok=True)

    for img_path in input_dir.glob("*.[pj][np][g]"):
        if img_path.name.startswith("_tmp_"):
            continue

        img = cv2.imread(str(img_path))
        if img is None:
            continue

        h, w = img.shape[:2]
        # 簡單切分：上半部為照片，下半部為文字區
        photo_area = img[:int(h * 0.7), :]
        text_area = img[int(h * 0.7):, :]

        faces = detect_faces_haar(photo_area)
        # 依 X 座標排序（從左到右）
        faces = sorted(faces, key=lambda f: f[0])

        ocr_text = run_ocr(text_area)
        # 這裡簡化處理：從 OCR 結果抓取姓名，或使用 unknown
        import re
        names = re.findall(r"[\u4e00-\u9fff]{2,3}", ocr_text)

        stem_out = output_dir / img_path.stem
        stem_out.mkdir(exist_ok=True)

        dbg_img = photo_area.copy()
        for i, (x, y, fw, fh) in enumerate(faces):
            name = names[i] if i < len(names) else f"unknown_{i+1:02d}"
            # 初始版本：簡單擴增臉部框
            x1 = max(0, x - int(fw * 0.5))
            y1 = max(0, y - int(fh * 0.5))
            x2 = min(w, x + fw + int(fw * 0.5))
            y2 = min(h, y + fh + int(fh * 1.5))

            crop = photo_area[y1:y2, x1:x2]
            cv2.imwrite(str(stem_out / f"{i+1:02d}_{name}.png"), crop)
            cv2.rectangle(dbg_img, (x, y), (x + fw, y + fh), (0, 255, 0), 2)

        cv2.imwrite(str(debug_dir / f"{img_path.stem}_debug.png"), dbg_img)
        print(f"Processed {img_path.name}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="../../photo", help="Original photo directory")
    parser.add_argument("--output", default="split_students_output")
    parser.add_argument("--debug", default="split_students_debug")
    args = parser.parse_args()

    process_images(Path(args.input), Path(args.output), Path(args.debug))


if __name__ == "__main__":
    main()
