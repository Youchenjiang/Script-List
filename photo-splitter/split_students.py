import argparse
import subprocess
from pathlib import Path

import cv2
import numpy as np


def detect_photo_text_split(img: np.ndarray) -> int:
    h = img.shape[0]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    row_mean = gray.mean(axis=1)
    # 尋找底部的白色分割區（通常在 45% 高度之後）
    start = int(h * 0.45)
    white = row_mean > 235

    run_start = None
    run_len = 0
    for y in range(start, h):
        if white[y]:
            if run_start is None:
                run_start = y
                run_len = 1
            else:
                run_len += 1
            if run_len >= 20:
                return max(run_start - 2, int(h * 0.55))
        else:
            run_start = None
            run_len = 0

    return int(h * 0.72)


def detect_faces_haar(img: np.ndarray) -> list[tuple[int, int, int, int]]:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    faces = face_cascade.detectMultiScale(gray, 1.1, 5, minSize=(30, 30))
    return [(int(x), int(y), int(w), int(h)) for (x, y, w, h) in faces]


def split_rows_by_y(faces: list[tuple[int, int, int, int]]) -> list[list[int]]:
    if not faces:
        return []
    if len(faces) <= 2:
        return [list(range(len(faces)))]

    centers_y = sorted([(i, f[1] + f[3] * 0.5) for i, f in enumerate(faces)], key=lambda t: t[1])
    ys = [cy for _, cy in centers_y]
    gaps = [ys[i+1] - ys[i] for i in range(len(ys) - 1)]
    if not gaps:
        return [list(range(len(faces)))]

    max_gap_idx = int(np.argmax(gaps))
    max_gap = gaps[max_gap_idx]
    median_h = np.median([f[3] for f in faces])

    # 如果最大 Y 間隔大於人臉高度的一定比例，則視為兩排
    if max_gap > median_h * 0.7:
        top_ids = [idx for idx, _ in centers_y[:max_gap_idx + 1]]
        bottom_ids = [idx for idx, _ in centers_y[max_gap_idx + 1:]]
        return [top_ids, bottom_ids]
    return [list(range(len(faces)))]


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
        if img_path.name.startswith("_tmp_") or img_path.name.startswith("tmp_"):
            continue

        img = cv2.imread(str(img_path))
        if img is None:
            continue

        h_orig, w_orig = img.shape[:2]
        split_y = detect_photo_text_split(img)
        photo_area = img[:split_y, :]
        text_area = img[split_y:, :]

        faces = detect_faces_haar(photo_area)
        if not faces:
            print(f"No faces found in {img_path.name}")
            continue

        rows = split_rows_by_y(faces)
        # 依 y 排列 row_ids
        rows = sorted(rows, key=lambda ids: sum(faces[i][1] for i in ids)/len(ids))

        ocr_text = run_ocr(text_area)
        import re
        names = re.findall(r"[\u4e00-\u9fff]{2,3}", ocr_text)

        stem_out = output_dir / img_path.stem
        stem_out.mkdir(exist_ok=True)
        # 清除舊檔案
        for f in stem_out.glob("*.png"):
            f.unlink()

        dbg_img = photo_area.copy()
        face_idx_total = 1

        for row_idx, row_ids in enumerate(rows):
            # 取得本排所有臉，並依 X 座標排序
            row_faces_info = sorted([(i, faces[i]) for i in row_ids], key=lambda t: t[1][0])
            n_in_row = len(row_faces_info)

            for j, (orig_id, (fx, fy, fw, fh)) in enumerate(row_faces_info):
                cx = fx + fw * 0.5
                # 計算左右邊界（與相鄰人的中線）
                left_lim = 0
                if j > 0:
                    prev_fx, prev_fy, prev_fw, prev_fh = row_faces_info[j-1][1]
                    prev_cx = prev_fx + prev_fw * 0.5
                    left_lim = int((prev_cx + cx) * 0.5)

                right_lim = w_orig
                if j < n_in_row - 1:
                    next_fx, next_fy, next_fw, next_fh = row_faces_info[j+1][1]
                    next_cx = next_fx + next_fw * 0.5
                    right_lim = int((cx + next_cx) * 0.5)

                # 垂直邊界優化
                y1 = max(0, fy - int(fh * 0.8))
                y2 = min(split_y, fy + int(fh * 8.0))

                # 如果有兩排，調整 Y 邊界避免互吃
                if len(rows) > 1:
                    if row_idx == 0:
                        y2 = min(y2, int(fy + fh * 3.5))
                    else:
                        y1 = max(y1, int(fy - fh * 1.2))

                crop = photo_area[y1:y2, left_lim:right_lim]
                name = names[face_idx_total - 1] if face_idx_total - 1 < len(names) else f"unknown_{face_idx_total:02d}"
                cv2.imwrite(str(stem_out / f"{face_idx_total:02d}_{name}.png"), crop)

                # Debug 繪製
                cv2.rectangle(dbg_img, (fx, fy), (fx + fw, fy + fh), (0, 255, 0), 2)
                cv2.rectangle(dbg_img, (left_lim, y1), (right_lim, y2), (255, 0, 0), 1)
                cv2.putText(dbg_img, name, (fx, fy-5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)

                face_idx_total += 1

        cv2.imwrite(str(debug_dir / f"{img_path.stem}_debug.png"), dbg_img)
        print(f"Processed {img_path.name}")

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
