#!/usr/bin/env python3
"""
Batch DAST Scanner — 掃描多個 APK 並產生比較報告
"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path

# 確保 scanner 在 path 裡
sys.path.insert(0, os.path.dirname(__file__))

from dast_scanner import (
    ADBExecutor, ManifestParser, IntentRedirectionScanner,
    ReportGenerator
)


def scan_single_apk(apk_path: str, adb: ADBExecutor) -> dict:
    """掃描單個 APK"""
    print(f"\n{'='*60}")
    print(f"  Scanning: {apk_path}")
    print(f"{'='*60}")

    # 安裝
    print("[*] Installing APK...")
    if not adb.install(apk_path):
        return {"apk": apk_path, "error": "install failed"}

    # 提取 package name（用 aapt 或 apkanalyzer）
    # 這裡簡化，用 install 後的 pm list 確認
    import subprocess
    rc, out, _ = adb.run("shell", "pm", "list", "packages", "-3")
    if rc != 0:
        return {"apk": apk_path, "error": "cannot list packages"}

    # TODO: 實際應該從 APK 提取 package name
    # 暫時用目錄名作為提示
    pkg = Path(apk_path).stem

    # 從 APK 提取 manifest
    import tempfile
    tmpdir = tempfile.mkdtemp(prefix="dast_batch_")
    manifest = None

    try:
        result = subprocess.run(
            ["aapt", "dump", "xmltree", apk_path, "AndroidManifest.xml"],
            capture_output=True, text=True, timeout=15
        )
        if result.returncode == 0:
            mp = os.path.join(tmpdir, "AndroidManifest.xml")
            with open(mp, "w") as f:
                f.write(result.stdout)
            manifest = ManifestParser(mp)
            pkg = manifest.package
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass

    if not manifest:
        print("[!] Cannot extract manifest, skipping")
        return {"apk": apk_path, "error": "no manifest"}

    # 掃描
    scanner = IntentRedirectionScanner(pkg, adb, manifest)
    vulns = scanner.scan_intent_redirection()

    # 截圖取證
    evidence_dir = os.path.join(tmpdir, "evidence")
    os.makedirs(evidence_dir, exist_ok=True)

    return {
        "apk": apk_path,
        "package": pkg,
        "vulnerabilities": len(vulns),
        "details": [
            {
                "component": v.component,
                "target": v.target_component,
                "severity": v.severity,
                "verified": v.verified,
            }
            for v in vulns
        ],
    }


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Batch DAST Scanner")
    parser.add_argument("apks", nargs="+", help="APK files to scan")
    parser.add_argument("--serial", "-s", help="ADB device serial")
    parser.add_argument("--output", "-o", default="batch_report.json")
    args = parser.parse_args()

    adb = ADBExecutor(device_serial=args.serial)
    if not adb.check_device():
        print("[!] No ADB device connected")
        sys.exit(1)

    results = []
    for apk in args.apks:
        result = scan_single_apk(apk, adb)
        results.append(result)
        # 清理
        if result.get("package"):
            adb.uninstall(result["package"])

    # 產生報告
    report = {
        "scan_time": datetime.now().isoformat(),
        "total_apks": len(results),
        "total_vulns": sum(r.get("vulnerabilities", 0) for r in results),
        "results": results,
    }

    with open(args.output, "w") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print(f"\n{'='*60}")
    print(f"  Batch Scan Complete")
    print(f"  APKs scanned: {len(results)}")
    print(f"  Total vulnerabilities: {report['total_vulns']}")
    print(f"  Report: {args.output}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
