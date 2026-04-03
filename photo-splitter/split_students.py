import difflib
import re
import subprocess
import urllib.request
from pathlib import Path

import cv2
import numpy as np

YUNET_MODEL = Path("face_detection_yunet_2023mar.onnx")
YUNET_URL = "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx"

ROSTER_MAP: dict[int, list[str]] = {
    1: ["鄒雅雯", "周怡湘", "蘇文馨", "黃詩涵", "林妤蓁", "朱宇婕"],
    2: ["胡翔安", "王廷瑜", "簡柔恩", "陳梓銜", "謝亭茹"],
    3: ["林承駿", "葉羿君", "黃櫳萱", "李恩齊", "蔣侑宸", "林秭礽"],
    4: ["林秋香", "朱芸萱", "林佩臻", "陳莉豐", "李采姈", "張芮瑀"],
    5: ["彭琦崴", "謝嘉盈", "彭家樺", "郭士揚", "賴劭穎", "李若依"],
    6: ["楊佳炘", "潘維晟", "陳柏甫", "廖承偉", "張珉萁", "謝子尉"],
    7: ["吳心平", "蘇郁茜", "李軒毅", "李芝瑢", "林立翰", "何明哲"],
    8: ["林靖恒", "黃昱鈞", "鍾柏安", "李佳蓁", "蕭筑云", "陳欣妤"],
    9: ["王品淳", "吳佩瑜", "劉和媛", "黃毓芳", "郭潔蓉", "鄭成裕"],
    10: ["陳冠豪", "吳宇翰", "郭明儒", "林婷君", "林冠澔"],
    11: ["黃仁和", "吳霜", "李嶧", "張謦麒", "侯威華"],
    12: ["陳信翰", "陳慎", "詹凱程", "廖柏廉", "謝侑明", "柳炫州"],
}


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


def run_ocr(text_img: np.ndarray) -> str:
    tmp = Path("_tmp_ocr_input.png")
    cv2.imwrite(str(tmp), text_img)
    cmd = ["tesseract", str(tmp), "stdout", "-l", "chi_tra", "--psm", "6"]
    try:
        out = subprocess.check_output(cmd, text=True, encoding="utf-8", errors="ignore")
    finally:
        if tmp.exists():
            tmp.unlink()
    return out


def extract_names_from_line(line: str) -> list[str]:
    compact = re.sub(r"\s+", "", line)
    # 移除標點與控制字
    cleaned = re.sub(r"[^\u4e00-\u9fff]", "", compact)
    raw_names = re.findall(r"[\u4e00-\u9fff]{2,3}", cleaned)
    stop = {"上排", "下排", "由左", "至右", "左右"}
    return [n for n in raw_names if n not in stop]


def parse_top_bottom_names(ocr_text: str) -> tuple[list[str], list[str]]:
    top_names: list[str] = []
    bottom_names: list[str] = []
    for line in ocr_text.splitlines():
        if "上" in line and "排" in line:
            top_names.extend(extract_names_from_line(line))
        elif "下" in line and "排" in line:
            bottom_names.extend(extract_names_from_line(line))
    return top_names, bottom_names


def best_match_name(name: str, candidates: list[str]) -> tuple[str, float]:
    if not candidates:
        return name, 0.0
    scored = []
    for c in candidates:
        ratio = difflib.SequenceMatcher(None, name, c).ratio()
        scored.append((ratio, c))
    scored.sort(reverse=True)
    return scored[0][1], scored[0][0]


def normalize_names_with_roster(image_names: list[str], roster_names: list[str]) -> list[str]:
    if not roster_names:
        return image_names
    result = []
    unused = roster_names.copy()
    for n in image_names:
        match, score = best_match_name(n, unused)
        if score >= 0.4:
            result.append(match)
            unused.remove(match)
        else:
            result.append(n)
    # 若剩餘名單中有，則補齊
    for n in result:
        if n in roster_names:
            pass # already there
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
        top_names, bottom_names = parse_top_bottom_names(ocr_text)
        image_names = top_names + bottom_names
        if not image_names:
            image_names = extract_names_from_line(ocr_text)

        gid = int(img_path.stem) if img_path.stem.isdigit() else None
        roster_names = ROSTER_MAP.get(gid, []) if gid else []
        
        fixed_names = normalize_names_with_roster(image_names, roster_names)
        # 如果辨識出來的人員不足，補上名單中的人
        if len(fixed_names) < len(faces):
            for n in roster_names:
                if n not in fixed_names and len(fixed_names) < len(faces):
                    fixed_names.append(n)

        stem_out = output_dir / img_path.stem
        stem_out.mkdir(parents=True, exist_ok=True)
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
                name = fixed_names[face_idx_total - 1] if face_idx_total - 1 < len(fixed_names) else f"unknown_{face_idx_total:02d}"
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
