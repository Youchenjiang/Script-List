import argparse
import difflib
import re
import subprocess
import urllib.request
from pathlib import Path

import cv2
import numpy as np

YUNET_MODEL = Path("face_detection_yunet_2023mar.onnx")
YUNET_URL = "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx"
DEFAULT_ROSTER_IMAGE = None

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

# 依「每組合照上的名字標示」指定順序
GROUP_IMAGE_ORDER_NAMES: dict[int, list[str]] = {
    1: ["林妤蓁", "鄒雅雯", "周怡湘", "朱宇婕", "蘇文馨", "黃詩涵"],
    2: ["簡柔恩", "陳梓銜", "王廷瑜", "胡翔安"],
    3: ["林承駿", "葉羿君", "黃櫳萱", "李恩齊", "蔣侑宸", "林秭礽"],
    4: ["林秋香", "朱芸萱", "林佩臻", "張芮瑀", "李采姈", "陳莉豐"],
    5: ["彭琦崴", "謝嘉盈", "彭家樺", "李若依", "郭士揚", "賴劭穎"],
    6: ["張珉萁", "謝子尉", "廖承偉", "潘維晟", "楊佳炘", "陳柏甫"],
    7: ["林立翰", "李軒毅", "何明哲", "李芝瑢", "吳心平", "蘇郁茜"],
    8: ["林靖恒", "鍾柏安", "黃昱鈞", "李佳蓁", "陳欣妤", "蕭筑云"],
    9: ["王品淳", "吳佩瑜", "郭潔蓉", "黃毓芳", "鄭成裕", "劉和媛"],
    10: ["陳冠豪", "吳宇翰", "郭明儒", "林婷君", "林冠澔"],
    11: ["黃仁和", "李嶧", "侯威華", "張謦麒", "吳霜"],
    12: ["陳信翰", "陳慎", "謝侑明", "詹凱程", "廖柏廉", "柳炫州"],
}

# 特定組別排版：由上到下每排人數
GROUP_ROW_LAYOUT: dict[int, list[int]] = {
    1: [4, 2],
    3: [5, 1],
    4: [3, 3],
    8: [3, 3],
    9: [3, 3],
    11: [3, 2],
}

# 這些組別要用整張圖偵測，不做 photo/text 切分
GROUP_USE_FULL_IMAGE: set[int] = {3, 9}


def detect_photo_text_split(img: np.ndarray) -> int:
    h = img.shape[0]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    row_mean = gray.mean(axis=1)
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


def run_tesseract_ocr(text_img: np.ndarray) -> str:
    tmp = Path("_tmp_ocr_input.png")
    cv2.imwrite(str(tmp), text_img)
    cmd = ["tesseract", str(tmp), "stdout", "-l", "chi_tra", "--psm", "6"]
    try:
        out = subprocess.check_output(cmd, text=True, encoding="utf-8", errors="ignore")
    finally:
        if tmp.exists():
            tmp.unlink(missing_ok=True)
    return out


def extract_names_from_line(line: str) -> list[str]:
    # 去掉空白後再從冒號後方擷取姓名片段
    compact = re.sub(r"\s+", "", line)
    if ":" in compact:
        compact = compact.split(":", 1)[1]
    elif "：" in compact:
        compact = compact.split("：", 1)[1]
    raw_names = re.findall(r"[\u4e00-\u9fff]{2,4}", compact)
    return [n for n in raw_names if n not in ("左右", "由左至右")]


def parse_top_bottom_names(ocr_text: str) -> tuple[list[str], list[str]]:
    top_names: list[str] = []
    bottom_names: list[str] = []
    for line in ocr_text.splitlines():
        if "上" in line and "排" in line:
            top_names = extract_names_from_line(line)
        elif "下" in line and "排" in line:
            bottom_names = extract_names_from_line(line)
    return top_names, bottom_names


def parse_names_generic(ocr_text: str) -> list[str]:
    stop = {
        "由開至右", # OCR 可能誤認
        "由左至右",
        "左右",
        "上排",
        "下排",
        "上排由左",
        "下排由左",
        "至右",
        "組別",
        "組員",
        "學號",
        "姓名",
        "名單",
    }
    names: list[str] = []
    for line in ocr_text.splitlines():
        compact = re.sub(r"\s+", "", line)
        if not compact:
            continue
        for n in re.findall(r"[\u4e00-\u9fff]{2,4}", compact):
            if n in stop:
                continue
            if n not in names:
                names.append(n)
    return names


def parse_names_from_full_image(img: np.ndarray) -> list[str]:
    tmp = Path("_tmp_full_ocr.png")
    cv2.imwrite(str(tmp), img)
    cmd = ["tesseract", str(tmp), "stdout", "-l", "chi_tra", "--psm", "11"]
    try:
        out = subprocess.check_output(cmd, text=True, encoding="utf-8", errors="ignore")
    finally:
        if tmp.exists():
            tmp.unlink(missing_ok=True)
    compact = re.sub(r"\s+", "", out)
    names = re.findall(r"[\u4e00-\u9fff]{2,4}", compact)
    stop = {
        "由左至右",
        "左右",
        "上排",
        "下排",
        "上排由左",
        "下排由左",
        "至右",
        "組別",
        "組員",
        "學號",
        "姓名",
        "名單",
    }
    result = []
    for n in names:
        if n in stop:
            continue
        if n not in result:
            result.append(n)
    return result


def best_match_name(name: str, candidates: list[str]) -> tuple[str, float]:
    if not candidates:
        return name, 0.0
    scored: list[tuple[float, str]] = []
    for c in candidates:
        ratio = difflib.SequenceMatcher(None, name, c).ratio()
        if name and c and name[0] == c[0]:
            ratio += 0.15
        if len(name) == len(c):
            ratio += 0.05
        scored.append((ratio, c))
    scored.sort(reverse=True)
    return scored[0][1], scored[0][0]


def normalize_names_with_roster(
    image_names: list[str], roster_names: list[str], expected_count: int
) -> tuple[list[str], float, int]:
    if not roster_names:
        clipped = image_names[:expected_count]
        return clipped, 0.0, len(clipped)

    # 先以原圖 OCR 名字做對位，再映射到正式名單修正錯字
    result: list[str] = []
    unused = roster_names.copy()
    score_sum = 0.0
    matched = 0
    for n in image_names:
        match, score = best_match_name(n, unused)
        if score >= 0.45:
            result.append(match)
            unused.remove(match)
            score_sum += score
            matched += 1
        else:
            result.append(n)

    # 若原圖名字不足，才以名單補齊
    for n in unused:
        if len(result) >= expected_count:
            break
        result.append(n)
    out = result[:expected_count]
    avg_score = (score_sum / matched) if matched else 0.0
    return out, avg_score, matched


def fill_non_roster_names(names: list[str], roster_names: list[str], expected_count: int) -> list[str]:
    if not roster_names:
        return names[:expected_count]
    out = names[:expected_count]
    unused = roster_names.copy()
    for n in out:
        if n in unused:
            unused.remove(n)
    for i, n in enumerate(out):
        if n not in roster_names and unused:
            out[i] = unused.pop(0)
    while len(out) < expected_count and unused:
        out.append(unused.pop(0))
    return out[:expected_count]


def load_roster_from_image(roster_img: Path) -> dict[int, list[str]]:
    if not roster_img.exists():
        return {}
    img = cv2.imread(str(roster_img))
    if img is None:
        return {}
    img = cv2.resize(img, None, fx=2.2, fy=2.2, interpolation=cv2.INTER_CUBIC)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    _, bw = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    tmp = Path("_tmp_roster_ocr.png")
    cv2.imwrite(str(tmp), bw)
    cmd = ["tesseract", str(tmp), "stdout", "-l", "chi_tra", "--psm", "6"]
    try:
        out = subprocess.check_output(cmd, text=True, encoding="utf-8", errors="ignore")
    finally:
        if tmp.exists():
            tmp.unlink(missing_ok=True)

    roster: dict[int, list[str]] = {}
    last_gid = 0
    for line in out.splitlines():
        compact = re.sub(r"\s+", "", line)
        if not compact:
            continue
        ids_names = re.findall(r"1\d{8}([\u4e00-\u9fff]{2,4})", compact)
        if not ids_names:
            continue
        m = re.match(r"^[^0-9]*([0-9]{1,2})", compact)
        if m:
            gid = int(m.group(1))
            last_gid = gid
        else:
            if last_gid == 0:
                continue
            gid = last_gid + 1
            last_gid = gid
        roster[gid] = ids_names[:6]
    return roster


def nms_boxes(boxes: list[tuple[int, int, int, int]], iou_thr: float = 0.35) -> list[tuple[int, int, int, int]]:
    if not boxes:
        return []

    arr = np.array(boxes, dtype=np.float32)
    x1 = arr[:, 0]
    y1 = arr[:, 1]
    x2 = arr[:, 0] + arr[:, 2]
    y2 = arr[:, 1] + arr[:, 3]
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


def dedupe_by_x(boxes: list[tuple[int, int, int, int]]) -> list[tuple[int, int, int, int]]:
    if not boxes:
        return []
    boxes_sorted = sorted(boxes, key=lambda b: b[0] + b[2] * 0.5)
    widths = [b[2] for b in boxes_sorted]
    thr = max(20.0, np.median(widths) * 0.75)

    groups: list[list[tuple[int, int, int, int]]] = [[boxes_sorted[0]]]
    for b in boxes_sorted[1:]:
        prev = groups[-1][-1]
        cx_prev = prev[0] + prev[2] * 0.5
        cx = b[0] + b[2] * 0.5
        if abs(cx - cx_prev) <= thr:
            groups[-1].append(b)
        else:
            groups.append([b])

    deduped = []
    for g in groups:
        deduped.append(max(g, key=lambda b: b[2] * b[3]))
    return deduped


def ensure_yunet_model() -> bool:
    if YUNET_MODEL.exists():
        return True
    try:
        urllib.request.urlretrieve(YUNET_URL, str(YUNET_MODEL))
        return True
    except Exception:
        return False


def detect_faces(photo: np.ndarray) -> list[tuple[int, int, int, int]]:
    h_img, w_img = photo.shape[:2]

    # 優先用 YuNet，人臉偵測準確度明顯較高
    if ensure_yunet_model():
        try:
            detector = cv2.FaceDetectorYN.create(str(YUNET_MODEL), "", (w_img, h_img), 0.65, 0.3, 5000)
            _, det = detector.detect(photo)
            if det is not None and len(det) > 0:
                boxes = []
                for row in det:
                    x, y, w, h, score = row[0], row[1], row[2], row[3], row[-1]
                    if score < 0.7:
                        continue
                    b = (int(x), int(y), int(w), int(h))
                    boxes.append(b)
                boxes = [b for b in boxes if b[1] < int(h_img * 0.8)]
                boxes = nms_boxes(boxes, iou_thr=0.35)
                if boxes:
                    return boxes
        except Exception:
            pass

    # 備援：Haar
    gray = cv2.cvtColor(photo, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)

    frontal = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    profile = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_profileface.xml")

    faces = []
    f1 = frontal.detectMultiScale(gray, scaleFactor=1.05, minNeighbors=4, minSize=(36, 36))
    for x, y, w, h in f1:
        faces.append((int(x), int(y), int(w), int(h)))

    p1 = profile.detectMultiScale(gray, scaleFactor=1.05, minNeighbors=4, minSize=(36, 36))
    for x, y, w, h in p1:
        faces.append((int(x), int(y), int(w), int(h)))

    gray_flip = cv2.flip(gray, 1)
    p2 = profile.detectMultiScale(gray_flip, scaleFactor=1.05, minNeighbors=4, minSize=(36, 36))
    w_img = gray.shape[1]
    for x, y, w, h in p2:
        x_back = w_img - x - w
        faces.append((int(x_back), int(y), int(w), int(h)))

    faces = [b for b in faces if b[1] < int(h_img * 0.65)]
    faces = nms_boxes(faces, iou_thr=0.35)
    faces = dedupe_by_x(faces)
    return faces


def pick_expected_count(faces: list[tuple[int, int, int, int]], expected: int) -> list[tuple[int, int, int, int]]:
    if expected <= 0 or len(faces) <= expected:
        return sorted(faces, key=lambda b: b[0] + b[2] * 0.5)

    by_area = sorted(faces, key=lambda b: b[2] * b[3], reverse=True)
    picked = by_area[:expected]
    return sorted(picked, key=lambda b: b[0] + b[2] * 0.5)


def sanitize_filename(name: str) -> str:
    name = re.sub(r"[\\/:*?\"<>|]", "_", name)
    name = name.strip("_ ")
    return name or "unknown"


def split_rows_by_y(faces: list[tuple[int, int, int, int]]) -> list[list[int]]:
    if not faces:
        return []
    if len(faces) <= 2:
        return [list(range(len(faces)))]

    centers = [(i, f[1] + f[3] * 0.5) for i, f in enumerate(faces)]
    centers_sorted = sorted(centers, key=lambda t: t[1])
    ys = [y for _, y in centers_sorted]
    gaps = [ys[i + 1] - ys[i] for i in range(len(ys) - 1)]
    max_gap_idx = int(np.argmax(gaps))
    max_gap = gaps[max_gap_idx]
    median_h = np.median([f[3] for f in faces])

    if max_gap < max(22.0, median_h * 0.7):
        return [list(range(len(faces)))]

    top_ids = [idx for idx, _ in centers_sorted[: max_gap_idx + 1]]
    bottom_ids = [idx for idx, _ in centers_sorted[max_gap_idx + 1 :]]
    if min(len(top_ids), len(bottom_ids)) < 2:
        # 一排只有 1 人時，只有在上下落差非常明顯才視為兩排
        if max_gap < max(40.0, median_h * 0.95):
            return [list(range(len(faces)))]
    return [top_ids, bottom_ids]


def compute_crop_boxes(
    photo: np.ndarray, faces: list[tuple[int, int, int, int]]
) -> list[tuple[int, int, int, int]]:
    ph, pw = photo.shape[:2]
    if not faces:
        return []

    rows = split_rows_by_y(faces)
    crop_boxes: list[tuple[int, int, int, int]] = [(0, 0, 0, 0)] * len(faces)

    row_meta = []
    for row_ids in rows:
        row_faces = [faces[i] for i in row_ids]
        top = min(f[1] for f in row_faces)
        bottom = max(f[1] + f[3] for f in row_faces)
        row_meta.append((row_ids, top, bottom))

    row_meta = sorted(row_meta, key=lambda t: t[1])
    y_cuts = []
    for i in range(len(row_meta) - 1):
        upper_bottom = row_meta[i][2]
        lower_top = row_meta[i + 1][1]
        y_cuts.append(int((upper_bottom + lower_top) * 0.5))

    for row_i, (row_ids, _, _) in enumerate(row_meta):
        order = sorted(row_ids, key=lambda idx: faces[idx][0] + faces[idx][2] * 0.5)
        cxs = [faces[idx][0] + faces[idx][2] * 0.5 for idx in order]

        left_bounds = [0] * len(order)
        right_bounds = [pw] * len(order)
        for j in range(len(order)):
            if j > 0:
                left_bounds[j] = int((cxs[j - 1] + cxs[j]) * 0.5)
            if j < len(order) - 1:
                right_bounds[j] = int((cxs[j] + cxs[j + 1]) * 0.5)

        for j, idx in enumerate(order):
            x, y, w, h = faces[idx]
            cx = x + 0.5 * w
            half_w = 1.15 * w
            left_lim = 0 if j == 0 else left_bounds[j] + 4
            right_lim = pw if j == len(order) - 1 else right_bounds[j] - 4

            half_w = min(half_w, cx - left_lim, right_lim - cx)
            if half_w < 0.6 * w:
                half_w = 0.6 * w
            x1 = max(0, int(cx - half_w))
            x2 = min(pw, int(cx + half_w))
            y1 = max(0, int(y - 0.8 * h))
            y2 = min(ph, int(y + 8.2 * h))

            # 兩排時用排與排之間切線限制高度，避免吃到另一排
            if len(row_meta) > 1:
                if row_i == 0:
                    y2 = min(y2, y_cuts[0] + int(0.25 * h))
                else:
                    y1 = max(y1, y_cuts[row_i - 1] - int(0.2 * h))

            if x2 <= x1:
                cx = int(x + w * 0.5)
                half = max(18, int(0.8 * w))
                x1 = max(0, cx - half)
                x2 = min(pw, cx + half)
            if y2 <= y1:
                cy = int(y + h * 0.5)
                half = max(18, int(1.8 * h))
                y1 = max(0, cy - half)
                y2 = min(ph, cy + half)

            crop_boxes[idx] = (x1, y1, x2, y2)

    return crop_boxes


def assign_names_to_faces(
    faces: list[tuple[int, int, int, int]], top_names: list[str], bottom_names: list[str]
) -> list[tuple[str, tuple[int, int, int, int]]]:
    total_names = top_names + bottom_names
    if not faces:
        return []

    expected = len(total_names)
    if expected == 0:
        return [(f"unknown_{i+1:02d}", face) for i, face in enumerate(sorted(faces, key=lambda b: b[0]))]

    faces = pick_expected_count(faces, expected)

    if len(faces) == expected and top_names and bottom_names:
        n_top = len(top_names)
        faces_by_y = sorted(faces, key=lambda b: b[1] + b[3] * 0.5)
        top_faces = sorted(faces_by_y[:n_top], key=lambda b: b[0] + b[2] * 0.5)
        bottom_faces = sorted(faces_by_y[n_top:], key=lambda b: b[0] + b[2] * 0.5)
        pairs: list[tuple[str, tuple[int, int, int, int]]] = []
        for i, nm in enumerate(top_names):
            if i < len(top_faces):
                pairs.append((nm, top_faces[i]))
        for i, nm in enumerate(bottom_names):
            if i < len(bottom_faces):
                pairs.append((nm, bottom_faces[i]))
        return pairs

    faces_sorted = sorted(faces, key=lambda b: b[0] + b[2] * 0.5)
    pairs = []
    for i, face in enumerate(faces_sorted):
        nm = total_names[i] if i < len(total_names) else f"unknown_{i+1:02d}"
        pairs.append((nm, face))
    return pairs


def assign_names_with_row_layout(
    faces: list[tuple[int, int, int, int]], names: list[str], row_counts: list[int]
) -> list[tuple[str, tuple[int, int, int, int]]]:
    if not faces:
        return []
    if not row_counts or sum(row_counts) <= 0:
        return assign_names_to_faces(faces, names, [])

    expected = min(sum(row_counts), len(names))
    faces = pick_expected_count(faces, expected)
    faces_by_y = sorted(faces, key=lambda b: b[1] + b[3] * 0.5)

    pairs: list[tuple[str, tuple[int, int, int, int]]] = []
    cursor = 0
    name_i = 0
    for cnt in row_counts:
        if name_i >= expected or cursor >= len(faces_by_y):
            break
        row_faces = faces_by_y[cursor : cursor + cnt]
        row_faces = sorted(row_faces, key=lambda b: b[0] + b[2] * 0.5)
        for f in row_faces:
            if name_i >= expected:
                break
            pairs.append((names[name_i], f))
            name_i += 1
        cursor += cnt
    return pairs


def process_one_image(
    img_path: Path, out_dir: Path, debug_dir: Path, roster_map: dict[int, list[str]]
) -> None:
    img = cv2.imread(str(img_path))
    if img is None:
        print(f"[WARN] 無法讀取: {img_path.name}")
        return

    gid = int(img_path.stem) if img_path.stem.isdigit() else None
    use_full = gid in GROUP_USE_FULL_IMAGE if gid is not None else False

    split_y = detect_photo_text_split(img)
    if use_full:
        photo = img
        text = img[0:0, :]
    else:
        photo = img[:split_y, :]
        text = img[split_y:, :]

    if text.size == 0:
        ocr_text = ""
    else:
        ocr_text = run_tesseract_ocr(text)
    top_names, bottom_names = parse_top_bottom_names(ocr_text)

    faces = detect_faces(photo)
    expected = len(faces)
    image_names = top_names + bottom_names
    if not image_names:
        image_names = parse_names_generic(ocr_text)
    if not image_names:
        image_names = parse_names_from_full_image(img)

    roster_names = roster_map.get(gid, []) if gid is not None else []
    image_order_names = GROUP_IMAGE_ORDER_NAMES.get(gid, []) if gid is not None else []
    row_layout = GROUP_ROW_LAYOUT.get(gid, []) if gid is not None else []

    # 有指定該組原圖對應順序時，優先使用（避免 OCR 與通用規則誤配）
    if image_order_names:
        expected = min(len(faces), len(image_order_names))
        use_names = image_order_names[:expected]
        if row_layout and sum(row_layout) >= expected:
            pairs = assign_names_with_row_layout(faces, use_names, row_layout)
        else:
            pairs = assign_names_to_faces(faces, use_names, [])
        pair_faces = [f for _, f in pairs]
        crop_boxes = compute_crop_boxes(photo, pair_faces)

        stem_dir = out_dir / img_path.stem
        stem_dir.mkdir(parents=True, exist_ok=True)
        for old in stem_dir.glob("*.png"):
            old.unlink(missing_ok=True)

        dbg = photo.copy()
        for i, (name, face) in enumerate(pairs, start=1):
            x, y, w, h = face
            cv2.rectangle(dbg, (x, y), (x + w, y + h), (0, 255, 0), 2)
            cv2.putText(dbg, f"{i}:{name}", (x, max(20, y - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 255, 0), 2)
            x1, y1, x2, y2 = crop_boxes[i - 1]
            cv2.rectangle(dbg, (x1, y1), (x2, y2), (255, 180, 0), 2)
            crop = photo[y1:y2, x1:x2]
            filename = f"{i:02d}_{sanitize_filename(name)}.png"
            cv2.imwrite(str(stem_dir / filename), crop)

        debug_dir.mkdir(parents=True, exist_ok=True)
        cv2.imwrite(str(debug_dir / f"{img_path.stem}_debug.png"), dbg)
        print(f"[OK] {img_path.name} -> {len(pairs)} 張")
        return

    # 有上排/下排標示時保留排資訊，否則一律按左到右
    if top_names and bottom_names:
        top_fixed, top_avg, top_matched = normalize_names_with_roster(top_names, roster_names, len(top_names))
        remain = [n for n in roster_names if n not in top_fixed]
        bottom_fixed, bottom_avg, bottom_matched = normalize_names_with_roster(bottom_names, remain, len(bottom_names))
        total_matched = top_matched + bottom_matched
        total_cnt = max(1, len(top_fixed) + len(bottom_fixed))
        avg_score = (top_avg * top_matched + bottom_avg * bottom_matched) / max(1, total_matched)
        if roster_names and len(roster_names) >= total_cnt and (total_matched < max(2, total_cnt // 2) or avg_score < 0.6):
            top_fixed = roster_names[: len(top_fixed)]
            bottom_fixed = roster_names[len(top_fixed) : len(top_fixed) + len(bottom_fixed)]
        top_fixed = fill_non_roster_names(top_fixed, roster_names, len(top_fixed))
        remain = [n for n in roster_names if n not in top_fixed]
        bottom_fixed = fill_non_roster_names(bottom_fixed, remain, len(bottom_fixed))
        pairs = assign_names_to_faces(faces, top_fixed, bottom_fixed)
    else:
        if roster_names and len(image_names) < expected and len(roster_names) >= expected:
            fixed_names = roster_names[:expected]
            pairs = assign_names_to_faces(faces, fixed_names, [])
            pair_faces = [f for _, f in pairs]
            crop_boxes = compute_crop_boxes(photo, pair_faces)
            stem_dir = out_dir / img_path.stem
            stem_dir.mkdir(parents=True, exist_ok=True)
            for old in stem_dir.glob("*.png"):
                old.unlink(missing_ok=True)
            dbg = photo.copy()
            for i, (name, face) in enumerate(pairs, start=1):
                x, y, w, h = face
                cv2.rectangle(dbg, (x, y), (x + w, y + h), (0, 255, 0), 2)
                cv2.putText(dbg, f"{i}:{name}", (x, max(20, y - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 255, 0), 2)
                x1, y1, x2, y2 = crop_boxes[i - 1]
                cv2.rectangle(dbg, (x1, y1), (x2, y2), (255, 180, 0), 2)
                crop = photo[y1:y2, x1:x2]
                filename = f"{i:02d}_{sanitize_filename(name)}.png"
                cv2.imwrite(str(stem_dir / filename), crop)
            debug_dir.mkdir(parents=True, exist_ok=True)
            cv2.imwrite(str(debug_dir / f"{img_path.stem}_debug.png"), dbg)
            print(f"[OK] {img_path.name} -> {len(pairs)} 張")
            return
        fixed_names, avg_score, matched_count = normalize_names_with_roster(image_names, roster_names, expected)
        if roster_names and len(roster_names) >= expected and (matched_count < max(2, expected // 2) or avg_score < 0.6):
            fixed_names = roster_names[:expected]
        fixed_names = fill_non_roster_names(fixed_names, roster_names, expected)
        pairs = assign_names_to_faces(faces, fixed_names, [])

    pair_faces = [f for _, f in pairs]
    crop_boxes = compute_crop_boxes(photo, pair_faces)

    stem_dir = out_dir / img_path.stem
    stem_dir.mkdir(parents=True, exist_ok=True)
    # 每次重跑先清掉舊輸出，避免重複檔案殘留
    for old in stem_dir.glob("*.png"):
        old.unlink(missing_ok=True)

    dbg = photo.copy()
    for i, (name, face) in enumerate(pairs, start=1):
        x, y, w, h = face
        cv2.rectangle(dbg, (x, y), (x + w, y + h), (0, 255, 0), 2)
        cv2.putText(dbg, f"{i}:{name}", (x, max(20, y - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 255, 0), 2)
        x1, y1, x2, y2 = crop_boxes[i - 1]
        cv2.rectangle(dbg, (x1, y1), (x2, y2), (255, 180, 0), 2)
        crop = photo[y1:y2, x1:x2]
        filename = f"{i:02d}_{sanitize_filename(name)}.png"
        cv2.imwrite(str(stem_dir / filename), crop)

    if expected and len(pairs) != expected:
        print(f"[WARN] {img_path.name}: 期望 {expected} 人，但目前輸出 {len(pairs)} 人。")

    debug_dir.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(debug_dir / f"{img_path.stem}_debug.png"), dbg)
    print(f"[OK] {img_path.name} -> {len(pairs)} 張")


def main() -> None:
    parser = argparse.ArgumentParser(description="將合照依姓名拆成每位同學個人圖")
    parser.add_argument("--input-dir", default=".", help="輸入資料夾")
    parser.add_argument("--output-dir", default="split_students_output", help="輸出資料夾")
    parser.add_argument("--debug-dir", default="split_students_debug", help="除錯圖資料夾")
    args = parser.parse_args()

    input_dir = Path(args.input_dir)
    out_dir = Path(args.output_dir)
    debug_dir = Path(args.debug_dir)
    roster_map = ROSTER_MAP

    imgs = []
    for ext in ("*.png", "*.jpg", "*.jpeg", "*.JPG", "*.PNG", "*.JPEG"):
        imgs.extend(input_dir.glob(ext))
    uniq = {p.resolve(): p for p in imgs if p.is_file()}
    imgs = sorted(
        p
        for p in uniq.values()
        if not p.name.lower().startswith(("_tmp_", "tmp_ocr"))
    )

    if not imgs:
        print("[INFO] 找不到圖片檔")
        return

    for p in imgs:
        process_one_image(p, out_dir, debug_dir, roster_map)

    print(f"\n完成。個人圖在: {out_dir.resolve()}")
    print(f"請先查看除錯框線圖: {debug_dir.resolve()}")


if __name__ == "__main__":
    main()
