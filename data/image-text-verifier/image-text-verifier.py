import argparse
import csv
import itertools
import json
from pathlib import Path

import cv2
import numpy as np


def group_centers(indices: np.ndarray) -> list[float]:
    if indices.size == 0:
        return []
    out: list[float] = []
    s = int(indices[0])
    p = int(indices[0])
    for x in indices[1:]:
        x = int(x)
        if x <= p + 1:
            p = x
        else:
            out.append((s + p) / 2.0)
            s = p = x
    out.append((s + p) / 2.0)
    return out


def pick_x_boundaries(x_candidates: list[float]) -> list[float]:
    x_candidates = sorted(x_candidates)
    if len(x_candidates) == 4:
        return x_candidates
    best = None
    for comb in itertools.combinations(x_candidates, 4):
        gaps = [comb[i + 1] - comb[i] for i in range(3)]
        if not all(180 < g < 360 for g in gaps):
            continue
        score = sum(abs(g - 270) for g in gaps) + float(np.std(gaps) * 2)
        if best is None or score < best[0]:
            best = (score, comb)
    return list(best[1]) if best else x_candidates[-4:]


def parse_name(path: Path) -> tuple[int, int]:
    # Expected: "{record}-{page}.jpg"
    stem = path.stem
    parts = stem.split("-")
    if len(parts) != 2:
        raise ValueError(f"Invalid file name format: {path.name}")
    record = int(parts[0])
    page = int(parts[1])
    if page not in (1, 2):
        raise ValueError(f"Invalid page in file name: {path.name}")
    return record, page


def read_page_answers(
    image_path: Path,
    page: int,
    bin_threshold: int = 180,
) -> tuple[list[str], list[tuple[int, int, int, list[int]]]]:
    img = cv2.imread(str(image_path), cv2.IMREAD_GRAYSCALE)
    if img is None:
        raise RuntimeError(f"Cannot read image: {image_path}")
    bw = cv2.threshold(img, bin_threshold, 255, cv2.THRESH_BINARY_INV)[1]

    # 1) detect major vertical boundaries
    v = cv2.morphologyEx(
        bw, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (1, 80))
    )
    v_sum = cv2.reduce(v, 0, cv2.REDUCE_SUM, dtype=cv2.CV_32S).ravel()
    x_raw = group_centers(np.where(v_sum > 12000)[0])
    x_filtered = [x for x in x_raw if x > 1100]
    grouped: list[list[float]] = []
    for x in sorted(x_filtered):
        if not grouped or x - grouped[-1][-1] > 60:
            grouped.append([x])
        else:
            grouped[-1].append(x)
    x_means = [sum(g) / len(g) for g in grouped]
    x = pick_x_boundaries(x_means)
    if len(x) != 4:
        raise RuntimeError(f"Failed to detect x boundaries: {image_path.name}")

    # 2) detect major horizontal boundaries in answer region
    x_left = int(round(x[0]))
    x_right = int(round(x[-1]))
    answer_roi = bw[:, x_left : x_right + 1]
    h = cv2.morphologyEx(
        answer_roi, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (60, 1))
    )
    h_sum = cv2.reduce(h, 1, cv2.REDUCE_SUM, dtype=cv2.CV_32S).ravel()
    h_thr = max(18000, int(float(h_sum.max()) * 0.23))
    y_raw = group_centers(np.where(h_sum > h_thr)[0])
    y_filtered = [y for y in y_raw if (y > 1500 if page == 1 else 180 < y < 2400)]

    y_dedup: list[float] = []
    for y in y_filtered:
        if not y_dedup or y - y_dedup[-1] > 18:
            y_dedup.append(y)
        else:
            y_dedup[-1] = (y_dedup[-1] + y) / 2.0

    if page == 1:
        if len(y_dedup) < 18:
            raise RuntimeError(f"Page1 row line detection failed: {image_path.name}")
        y_dedup = y_dedup[-18:]
        row_intervals = [(y_dedup[i], y_dedup[i + 1]) for i in range(1, 17)]  # Q1~Q16
        q_start = 1
    else:
        if len(y_dedup) < 25:
            raise RuntimeError(f"Page2 row line detection failed: {image_path.name}")
        y_dedup = y_dedup[:25]
        row_intervals = [(y_dedup[i], y_dedup[i + 1]) for i in range(24)]  # Q17~Q40
        q_start = 17

    # 3) remove table lines, keep handwriting only
    v_lines = cv2.morphologyEx(
        bw, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (1, 80))
    )
    h_lines = cv2.morphologyEx(
        bw, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (60, 1))
    )
    clean = cv2.subtract(bw, cv2.bitwise_or(v_lines, h_lines))

    answers: list[str] = []
    details: list[tuple[int, int, int, list[int]]] = []
    for i, (y1_raw, y2_raw) in enumerate(row_intervals):
        y1 = int(round(y1_raw + 6))
        y2 = int(round(y2_raw - 6))
        scores: list[int] = []
        for c in range(3):
            x1 = int(round(x[c] + 12))
            x2 = int(round(x[c + 1] - 12))
            if x2 <= x1 or y2 <= y1:
                scores.append(0)
                continue
            scores.append(int(clean[y1:y2, x1:x2].sum()))

        best = max(scores)
        best_idx = int(np.argmax(np.array(scores, dtype=np.int32)))
        second = sorted(scores)[-2]
        margin = best - second

        # Conservative blank/uncertain handling.
        if best < 700 or margin < 180:
            ans = "未填"
        else:
            ans = str(best_idx + 1)
        q_no = q_start + i
        answers.append(ans)
        details.append((q_no, best, margin, scores))

    return answers, details


def run(args: argparse.Namespace) -> dict:
    csv_path = Path(args.csv).resolve()
    image_dir = Path(args.image_dir).resolve()

    if not csv_path.exists():
        raise FileNotFoundError(f"CSV not found: {csv_path}")
    if not image_dir.exists():
        raise FileNotFoundError(f"Image directory not found: {image_dir}")

    with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
        rows = list(csv.reader(f))
    header = rows[0]
    data = rows[1:]

    expected_cols = 2 + args.questions_per_record
    if len(header) != expected_cols:
        raise RuntimeError(f"Unexpected header columns: got={len(header)} expected={expected_cols}")
    if len(data) != args.records:
        raise RuntimeError(f"Unexpected data rows: got={len(data)} expected={args.records}")

    image_answers: dict[int, list[str]] = {}
    page2_risky: list[dict] = []
    all_risky: list[dict] = []

    for rec in range(1, args.records + 1):
        p1 = image_dir / f"{rec}-1.jpg"
        p2 = image_dir / f"{rec}-2.jpg"
        if not p1.exists() or not p2.exists():
            raise RuntimeError(f"Missing image pair: {rec}-1/2.jpg")

        a1, d1 = read_page_answers(p1, 1, args.bin_threshold)
        a2, d2 = read_page_answers(p2, 2, args.bin_threshold)
        merged = a1 + a2
        if len(merged) != args.questions_per_record:
            raise RuntimeError(f"Answer length mismatch at record {rec}: {len(merged)}")
        image_answers[rec] = merged

        for q, best, margin, scores in d2:
            if best < args.page2_risky_best or margin < args.page2_risky_margin:
                page2_risky.append(
                    {"record": rec, "question": q, "best": best, "margin": margin, "scores": scores}
                )
        for q, best, margin, scores in d1 + d2:
            if best < args.global_risky_best or margin < args.global_risky_margin:
                all_risky.append(
                    {"record": rec, "question": q, "best": best, "margin": margin, "scores": scores}
                )

    mismatches: list[dict] = []
    candidate_fixes = 0
    applied = 0
    for rec in range(1, args.records + 1):
        csv_answers = data[rec - 1][2:]
        img_answers = image_answers[rec]
        for q in range(1, args.questions_per_record + 1):
            old = csv_answers[q - 1]
            new = img_answers[q - 1]
            if old == new:
                continue

            is_page2 = q >= (args.questions_page1 + 1)
            risk_match = [r for r in page2_risky if r["record"] == rec and r["question"] == q]
            risky = bool(risk_match) if is_page2 and args.strict_page2 else False
            mismatches.append(
                {
                    "record": rec,
                    "question": q,
                    "old": old,
                    "new": new,
                    "company": data[rec - 1][0],
                    "name": data[rec - 1][1],
                    "risky": risky,
                }
            )
            if risky and not args.apply_risky:
                continue
            candidate_fixes += 1
            data[rec - 1][2 + (q - 1)] = new
            if not args.dry_run:
                applied += 1

    out_rows = [header] + data
    if not args.dry_run:
        out_csv = Path(args.output_csv).resolve() if args.output_csv else csv_path
        with out_csv.open("w", encoding="utf-8-sig", newline="") as f:
            csv.writer(f).writerows(out_rows)

    report = {
        "records_checked": args.records,
        "cells_checked": args.records * args.questions_per_record,
        "mismatch_count": len(mismatches),
        "candidate_fixes": candidate_fixes,
        "applied_fixes": applied,
        "page2_risky_count": len(page2_risky),
        "global_risky_count": len(all_risky),
        "mismatches": mismatches,
        "page2_risky": page2_risky,
        "global_risky": all_risky,
    }
    if args.report_json:
        report_path = Path(args.report_json).resolve()
        report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return report


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Questionnaire image-to-CSV verifier/fixer (generic, reusable)."
    )
    parser.add_argument("--csv", default="results.csv", help="Input CSV path.")
    parser.add_argument("--image-dir", default="image", help="Image directory path.")
    parser.add_argument("--output-csv", default="", help="Output CSV path. Empty = overwrite input.")
    parser.add_argument("--report-json", default="verify_report.json", help="Output report JSON path.")
    parser.add_argument("--records", type=int, default=40, help="Number of records in CSV.")
    parser.add_argument("--questions-per-record", type=int, default=40, help="Questions per record.")
    parser.add_argument("--questions-page1", type=int, default=16, help="Questions on page 1.")
    parser.add_argument("--bin-threshold", type=int, default=180, help="Binary threshold for image.")
    parser.add_argument("--strict-page2", action="store_true", help="Flag risky mismatches on page2.")
    parser.add_argument("--apply-risky", action="store_true", help="Allow applying risky mismatches.")
    parser.add_argument("--dry-run", action="store_true", help="Do not write CSV.")
    parser.add_argument("--page2-risky-best", type=int, default=1000, help="Page2 risky best threshold.")
    parser.add_argument("--page2-risky-margin", type=int, default=260, help="Page2 risky margin threshold.")
    parser.add_argument("--global-risky-best", type=int, default=850, help="Global risky best threshold.")
    parser.add_argument("--global-risky-margin", type=int, default=220, help="Global risky margin threshold.")
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    report = run(args)
    print(f"records_checked={report['records_checked']}")
    print(f"cells_checked={report['cells_checked']}")
    print(f"mismatch_count={report['mismatch_count']}")
    print(f"candidate_fixes={report['candidate_fixes']}")
    print(f"applied_fixes={report['applied_fixes']}")
    print(f"page2_risky_count={report['page2_risky_count']}")
    print(f"global_risky_count={report['global_risky_count']}")
    print("first_10_mismatches:")
    for item in report["mismatches"][:10]:
        print(item)


if __name__ == "__main__":
    main()
