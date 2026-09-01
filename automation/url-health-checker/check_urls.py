#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
URL 連線與 HTTP 狀態碼檢查腳本 (HTTP Status Code Checker)
- 支援從檔案 (例如 urls.txt) 或命令列輸入連結
- 使用多執行緒 (Multi-threading) 快速進行連線測試
- 自動處理重導向、逾時、SSL/TLS 憑證異常與各類 HTTP 狀態碼
- 可輸出為控制台表格、CSV 或 JSON 報告
"""

import argparse
import csv
import json
import os
import ssl
import sys
import urllib.request
import urllib.error
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Optional, Tuple

DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)


def check_url(
    url: str,
    timeout: int = 5,
    verify_ssl: bool = True,
    user_agent: str = DEFAULT_USER_AGENT
) -> Dict[str, str]:
    clean_url = url.strip()
    if not clean_url:
        return {}

    if not (clean_url.startswith("http://") or clean_url.startswith("https://")):
        target_url = "http://" + clean_url
    else:
        target_url = clean_url

    headers = {"User-Agent": user_agent}

    context = None
    if not verify_ssl:
        context = ssl.create_default_context()
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE

    req = urllib.request.Request(target_url, headers=headers, method="GET")

    status_code: Optional[int] = None
    final_url: str = target_url
    status_text: str = ""
    error_msg: str = ""

    try:
        with urllib.request.urlopen(req, timeout=timeout, context=context) as response:
            status_code = response.status
            final_url = response.geturl()
            status_text = "OK"
    except urllib.error.HTTPError as e:
        status_code = e.code
        status_text = f"HTTP Error ({e.reason})"
    except urllib.error.URLError as e:
        if isinstance(e.reason, TimeoutError) or "timed out" in str(e.reason).lower():
            status_code = 0
            status_text = "Timeout"
            error_msg = "連線逾時 (Timeout)"
        else:
            status_code = 0
            status_text = "Connection Failed"
            error_msg = str(e.reason)
    except ssl.SSLError as e:
        status_code = 0
        status_text = "SSL Error"
        error_msg = f"SSL 憑證錯誤: {e}"
    except Exception as e:
        status_code = 0
        status_text = "Error"
        error_msg = str(e)

    if status_code and 200 <= status_code < 300:
        result_type = "SUCCESS"
    elif status_code and 300 <= status_code < 400:
        result_type = "REDIRECT"
    elif status_code and 400 <= status_code < 500:
        result_type = "CLIENT_ERROR"
    elif status_code and 500 <= status_code < 600:
        result_type = "SERVER_ERROR"
    else:
        result_type = "FAIL"

    return {
        "original_url": clean_url,
        "target_url": target_url,
        "status_code": str(status_code) if status_code else "N/A",
        "status_text": status_text,
        "final_url": final_url if final_url != target_url else "-",
        "result_type": result_type,
        "error_msg": error_msg
    }


def load_urls_from_file(file_path: str) -> List[str]:
    urls = []
    if not os.path.exists(file_path):
        print(f"[錯誤] 找不到檔案: {file_path}", file=sys.stderr)
        return []

    with open(file_path, "r", encoding="utf-8") as f:
        for line in f:
            line_str = line.strip()
            if line_str and not line_str.startswith("#"):
                urls.append(line_str)
    return urls


def print_results_table(results: List[Dict[str, str]]):
    print("\n" + "=" * 90)
    print(f"{'HTTP Code':<10} | {'結果':<14} | {'原始 URL':<35} | {'錯誤/備註'}")
    print("=" * 90)

    for r in results:
        code = r['status_code']
        res_type = r['result_type']
        url = r['original_url']
        if len(url) > 35:
            url = url[:32] + "..."

        detail = r['error_msg'] if r['error_msg'] else r['status_text']
        if r['final_url'] != "-":
            detail = f"轉址至 -> {r['final_url']}"

        print(f"{code:<10} | {res_type:<14} | {url:<35} | {detail}")
    
    print("=" * 90)

    total = len(results)
    success_count = sum(1 for r in results if r['result_type'] == "SUCCESS")
    redirect_count = sum(1 for r in results if r['result_type'] == "REDIRECT")
    client_err_count = sum(1 for r in results if r['result_type'] == "CLIENT_ERROR")
    server_err_count = sum(1 for r in results if r['result_type'] == "SERVER_ERROR")
    fail_count = sum(1 for r in results if r['result_type'] == "FAIL")

    print(f"總計檢測: {total} 個連結 | 成功(2xx): {success_count} | 轉址(3xx): {redirect_count} | 用戶端錯誤(4xx): {client_err_count} | 伺服器錯誤(5xx): {server_err_count} | 連線失敗: {fail_count}\n")


def save_csv(results: List[Dict[str, str]], output_path: str):
    fields = ["original_url", "target_url", "status_code", "result_type", "status_text", "final_url", "error_msg"]
    with open(output_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(results)
    print(f"[資訊] 結果已匯出至 CSV: {output_path}")


def save_json(results: List[Dict[str, str]], output_path: str):
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"[資訊] 結果已匯出至 JSON: {output_path}")


def main():
    parser = argparse.ArgumentParser(description="連結 HTTP 狀態碼與存活批次檢測腳本")
    parser.add_argument("-f", "--file", type=str, help="包含 URL 清單的文字檔路徑")
    parser.add_argument("-u", "--urls", type=str, nargs="+", help="直接在命令列輸入一個或多個 URL")
    parser.add_argument("-t", "--timeout", type=int, default=5, help="單一連線逾時秒數 (預設: 5 秒)")
    parser.add_argument("-w", "--workers", type=int, default=10, help="併發執行緒數量 (預設: 10)")
    parser.add_argument("--insecure", action="store_true", help="忽略 SSL 憑證驗證錯誤")
    parser.add_argument("--csv", type=str, help="將結果輸出至 CSV 檔案 (例如 output.csv)")
    parser.add_argument("--json", type=str, help="將結果輸出至 JSON 檔案 (例如 output.json)")

    args = parser.parse_args()

    target_urls = []
    if args.urls:
        target_urls = args.urls
    elif args.file:
        target_urls = load_urls_from_file(args.file)

    if not target_urls:
        print("[警告] 沒有提供任何有效的 URL 進行檢測。")
        print("提示: 請使用 `-f urls.txt` 檔案或 `-u https://example.com` 參數。")
        sys.exit(1)

    print(f"[資訊] 開始檢測 {len(target_urls)} 個連結 (線程數: {args.workers}, 逾時: {args.timeout}s)...")

    results = []
    verify_ssl = not args.insecure

    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        future_to_url = {
            executor.submit(check_url, url, args.timeout, verify_ssl): url
            for url in target_urls
        }
        for future in as_completed(future_to_url):
            res = future.result()
            if res:
                results.append(res)

    url_order = {url.strip(): i for i, url in enumerate(target_urls)}
    results.sort(key=lambda x: url_order.get(x["original_url"], 999999))

    print_results_table(results)

    if args.csv:
        save_csv(results, args.csv)
    if args.json:
        save_json(results, args.json)


if __name__ == "__main__":
    main()
