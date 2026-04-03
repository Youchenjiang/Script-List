import urllib.request
from pathlib import Path

import cv2
import numpy as np

YUNET_MODEL = Path("face_detection_yunet_2023mar.onnx")
YUNET_URL = "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx"


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


def ensure_yunet_model() -> bool:
    if YUNET_MODEL.exists():
        return True
    print(f"Downloading YuNet model to {YUNET_MODEL}...")
    try:
        urllib.request.urlretrieve(YUNET_URL, str(YUNET_MODEL))
        return True
    except Exception as e:
        print(f"Download failed: {e}")
        return False


def nms_boxes(boxes: list[tuple[int, int, int, int]], iou_thr: float = 0.35) -> list[tuple[int, int, int, int]]:
    if not boxes:
        return []
    arr = np.array(boxes, dtype=np.float32)
    x1, y1 = arr[:, 0], arr[:, 1]
    x2, y2 = arr[:, 0] + arr[:, 2], arr[:, 1] + arr[:, 3]
    area = (x2 - x1) * (y2 - y1)
    order = area.argsort()[::-1]
    keep = []
    while order.size > 0:
        i = order[0]
        keep.append(i)
        xx1 = np.maximum(x1[i], x1[order[1:]])
        yy1 = np.maximum(y1[i], y1[order[1:]])
        xx2 = np.minimum(x2[i], x2[order[1:]])
        yy2 = np.minimum(y2[i], y2[order[1:]])
        w = np.maximum(0.0, xx2 - xx1)
        h = np.maximum(0.0, yy2 - yy1)
        inter = w * h
        iou = inter / (area[i] + area[order[1:]] - inter + 1e-6)
        inds = np.where(iou <= iou_thr)[0]
        order = order[inds + 1]
    return [boxes[i] for i in keep]


def detect_faces(img: np.ndarray) -> list[tuple[int, int, int, int]]:
    h, w = img.shape[:2]
    if ensure_yunet_model():
        try:
            detector = cv2.FaceDetectorYN.create(str(YUNET_MODEL), "", (w, h), 0.6, 0.3, 5000)
            _, det = detector.detect(img)
            if det is not None:
                boxes = []
                for row in det:
                    # YuNet output: x, y, w, h, x_re, y_re, x_le, y_le, ... score
                    bx, by, bw, bh = row[:4]
                    score = row[-1]
                    if score > 0.7:
                        boxes.append((int(bx), int(by), int(bw), int(bh)))
                if boxes:
                    return nms_boxes(boxes)
        except Exception as e:
            print(f"YuNet detection error: {e}")

    # Fallback to Haar
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    faces = face_cascade.detectMultiScale(gray, 1.1, 5, minSize=(30, 30))
    return [(int(fx), int(fy), int(fw), int(fh)) for (fx, fy, fw, fh) in faces]


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

        faces = detect_faces(photo_area)
        if not faces:
            print(f"No faces found in {img_path.name}")
            continue

        rows = split_rows_by_y(faces)
        rows = sorted(rows, key=lambda ids: sum(faces[i][1] for i in ids)/len(ids))

        ocr_text = run_ocr(text_area)
        import re
        names = re.findall(r"[\u4e00-\u9fff]{2,3}", ocr_text)

        stem_out = output_dir / img_path.stem
        stem_out.mkdir(exist_ok=True)
        for f in stem_out.glob("*.png"):
            f.unlink()

        dbg_img = photo_area.copy()
        face_idx_total = 1

        for row_idx, row_ids in enumerate(rows):
            row_faces_info = sorted([(i, faces[i]) for i in row_ids], key=lambda t: t[1][0])
            n_in_row = len(row_faces_info)

            for j, (orig_id, (fx, fy, fw, fh)) in enumerate(row_faces_info):
                cx = fx + fw * 0.5
                left_lim = 0
                if j > 0:
                    prev_fx, _, prev_fw, _ = row_faces_info[j-1][1]
                    left_lim = int((prev_fx + prev_fw * 0.5 + cx) * 0.5)

                right_lim = w_orig
                if j < n_in_row - 1:
                    next_fx, _, next_fw, _ = row_faces_info[j+1][1]
                    right_lim = int((cx + next_fx + next_fw * 0.5) * 0.5)

                # 以臉為中心對稱裁切邊界
                half_w = min(cx - left_lim, right_lim - cx, fw * 1.5)
                x1 = max(0, int(cx - half_w))
                x2 = min(w_orig, int(cx + half_w))

                y1 = max(0, fy - int(fh * 0.8))
                y2 = min(split_y, fy + int(fh * 8.0))

                if len(rows) > 1:
                    if row_idx == 0:
                        y2 = min(y2, int(fy + fh * 3.5))
                    else:
                        y1 = max(y1, int(fy - fh * 1.2))

                crop = photo_area[y1:y2, x1:x2]
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
