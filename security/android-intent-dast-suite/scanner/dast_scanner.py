#!/usr/bin/env python3
"""
DAST Scanner — Android Dynamic Application Security Testing
===========================================================
基於 1.txt 的 Intent Redirection 漏洞場景，
動態掃描 Android APK 中的 Intent Redirection 漏洞。

Usage:
    python dast_scanner.py <apk_path>          # 掃描本地 APK
    python dast_scanner.py --pkg <package>     # 掃描已安裝的 App
    python dast_scanner.py --manifest <xml>    # 掃描已解包的 Manifest

Flow:
    1. 解析 AndroidManifest.xml → 找所有 exported=true 的 Activity
    2. 用 aapt / apkanalyzer 提取 component 資訊
    3. 對每個 exported Activity，生成巢狀 Intent PoC
    4. 透過 ADB 發送 PoC Intent
    5. 用 oracle (dumpsys activity top) 判定是否觸發了私有 Activity
    6. 產生掃描報告
"""

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional


# ── Data Models ──────────────────────────────────────────────────────────────

@dataclass
class Component:
    name: str
    exported: bool
    intent_filters: list = field(default_factory=list)
    permission: Optional[str] = None
    is_activity: bool = True


@dataclass
class Vulnerability:
    component: str
    vuln_type: str
    target_component: str
    severity: str
    poc_command: str
    evidence: str
    verified: bool = False


# ── Manifest Parser ──────────────────────────────────────────────────────────

class ManifestParser:
    """解析 AndroidManifest.xml，找出所有 exported Activity 和 Service"""

    NS_ANDROID = "http://schemas.android.com/apk/res/android"

    def __init__(self, manifest_path: str):
        self.tree = ET.parse(manifest_path)
        self.root = self.tree.getroot()
        self.package = self.root.get("package", "unknown")

    def _get_android_attr(self, elem, attr):
        """取得 android:name 等帶 namespace 的屬性"""
        return elem.get(f"{{{self.NS_ANDROID}}}{attr}")

    def _parse_intent_filter(self, filter_elem):
        """解析 <intent-filter> 裡的 action / data / category"""
        info = {"actions": [], "categories": [], "data": []}
        for action in filter_elem.findall("action"):
            a = self._get_android_attr(action, "name")
            if a:
                info["actions"].append(a)
        for cat in filter_elem.findall("category"):
            c = self._get_android_attr(cat, "name")
            if c:
                info["categories"].append(c)
        for data in filter_elem.findall("data"):
            d = {
                "scheme": self._get_android_attr(data, "scheme") or "",
                "host": self._get_android_attr(data, "host") or "",
                "mimeType": self._get_android_attr(data, "mimeType") or "",
            }
            info["data"].append(d)
        return info

    def get_exported_activities(self) -> list[Component]:
        """取得所有 exported=true 的 Activity"""
        activities = []
        app_node = self.root.find("application")
        if app_node is None:
            return activities

        for act in app_node.findall("activity"):
            name = self._get_android_attr(act, "name")
            if not name:
                continue

            exported_str = self._get_android_attr(act, "exported")
            has_intent_filter = len(act.findall("intent-filter")) > 0

            # Android 12+ 規則：有 intent-filter 就必須明確設定 exported
            if exported_str is not None:
                exported = exported_str.lower() == "true"
            elif has_intent_filter:
                exported = True  # 有 intent-filter 但沒設定 → 預設 true
            else:
                exported = False

            if not exported:
                continue  # 只保留 exported=true 的

            permission = self._get_android_attr(act, "permission")
            filters = [self._parse_intent_filter(f) for f in act.findall("intent-filter")]

            activities.append(Component(
                name=name,
                exported=exported,
                intent_filters=filters,
                permission=permission,
                is_activity=True,
            ))

        return activities

    def get_all_activities(self) -> list[Component]:
        """取得所有 Activity（含未導出的）"""
        activities = []
        app_node = self.root.find("application")
        if app_node is None:
            return activities

        for act in app_node.findall("activity"):
            name = self._get_android_attr(act, "name")
            if not name:
                continue

            exported_str = self._get_android_attr(act, "exported")
            has_intent_filter = len(act.findall("intent-filter")) > 0
            if exported_str is not None:
                exported = exported_str.lower() == "true"
            elif has_intent_filter:
                exported = True
            else:
                exported = False

            activities.append(Component(
                name=name,
                exported=exported,
                is_activity=True,
            ))

        return activities


# ── ADB Executor ─────────────────────────────────────────────────────────────

class ADBExecutor:
    """透過 ADB 與 Android 裝置互動"""

    def __init__(self, device_serial: Optional[str] = None):
        self.serial = device_serial
        self.adb = self._build_adb_cmd()

    def _build_adb_cmd(self) -> list[str]:
        cmd = ["adb"]
        if self.serial:
            cmd += ["-s", self.serial]
        return cmd

    def run(self, *args, timeout: int = 10) -> tuple[int, str, str]:
        """執行 ADB 命令，回傳 (returncode, stdout, stderr)"""
        cmd = self.adb + list(args)
        try:
            result = subprocess.run(
                cmd, capture_output=True, text=True, timeout=timeout
            )
            return result.returncode, result.stdout, result.stderr
        except subprocess.TimeoutExpired:
            return -1, "", "timeout"
        except FileNotFoundError:
            return -2, "", "adb not found in PATH"

    def check_device(self) -> bool:
        """確認 ADB 裝置連線"""
        rc, out, _ = self.run("devices")
        if rc != 0:
            return False
        lines = [l for l in out.strip().split("\n")[1:] if l.strip() and "device" in l]
        return len(lines) > 0

    def get_current_activity(self) -> Optional[str]:
        """用 dumpsys 取得目前頂層 Activity"""
        rc, out, _ = self.run("shell", "dumpsys", "activity", "top", timeout=8)
        if rc != 0:
            return None
        # 找 ACTIVITY 開頭的行
        for line in out.split("\n"):
            line = line.strip()
            if line.startswith("ACTIVITY"):
                return line
        return None

    def start_activity(self, component: str, extras: Optional[dict] = None) -> tuple[int, str]:
        """用 am start 啟動 Activity"""
        cmd_args = ["shell", "am", "start", "-n", component]
        if extras:
            for k, v in extras.items():
                cmd_args += ["--es", k, v]
        rc, out, err = self.run(*cmd_args, timeout=8)
        return rc, out if rc == 0 else err

    def start_intent_uri(self, uri: str) -> tuple[int, str]:
        """用 am start 發送 Intent URI"""
        cmd_args = ["shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", uri]
        rc, out, err = self.run(*cmd_args, timeout=8)
        return rc, out if rc == 0 else err

    def force_stop(self, package: str):
        """強制停止 App"""
        self.run("shell", "am", "force-stop", package)

    def uninstall(self, package: str) -> bool:
        """解除安裝 App"""
        rc, _, _ = self.run("uninstall", package)
        return rc == 0

    def install(self, apk_path: str) -> bool:
        """安裝 APK"""
        rc, out, err = self.run("install", "-r", apk_path, timeout=60)
        return rc == 0

    def pull_file(self, remote: str, local: str) -> bool:
        """從裝置拉檔案"""
        rc, _, _ = self.run("pull", remote, local)
        return rc == 0

    def push_file(self, local: str, remote: str) -> bool:
        """推送檔案到裝置"""
        rc, _, _ = self.run("push", local, remote)
        return rc == 0

    def extract_manifest_via_aapt(self, apk_path: str) -> Optional[str]:
        """用 aapt 從 APK 提取 AndroidManifest.xml 並 dumpxml"""
        # 先試 aapt dump xmltree
        try:
            result = subprocess.run(
                ["aapt", "dump", "xmltree", apk_path, "AndroidManifest.xml"],
                capture_output=True, text=True, timeout=15
            )
            if result.returncode == 0:
                return result.stdout
        except (FileNotFoundError, subprocess.TimeoutExpired):
            pass

        # 退而求其次：用 adb 從已安裝 App 拉
        return None


# ── Intent Redirection Scanner ───────────────────────────────────────────────

class IntentRedirectionScanner:
    """
    動態掃描 Intent Redirection 漏洞

    核心邏輯（對應 1.txt）：
    1. 找到 exported Activity A
    2. 找到同一 App 裡未導出的 Activity B
    3. 構造巢狀 Intent: A → B
    4. 透過 ADB 發送
    5. 檢查 Activity B 是否被啟動
    """

    def __init__(self, package: str, adb: ADBExecutor, manifest: Optional[ManifestParser] = None):
        self.package = package
        self.adb = adb
        self.manifest = manifest
        self.vulnerabilities: list[Vulnerability] = []

    def scan_intent_redirection(self) -> list[Vulnerability]:
        """掃描 Intent Redirection 漏洞"""
        if not self.manifest:
            print("[!] No manifest available, skipping Intent Redirection scan")
            return []

        exported = self.manifest.get_exported_activities()
        all_acts = self.manifest.get_all_activities()
        private = [a for a in all_acts if not a.exported]

        print(f"\n[*] Scanning Intent Redirection:")
        print(f"    Package: {self.package}")
        print(f"    Exported Activities: {len(exported)}")
        print(f"    Private Activities: {len(private)}")

        if not exported or not private:
            print("    [!] No exported→private pairs to test")
            return []

        for exp in exported:
            if not exp.exported:
                continue
            for priv in private:
                self._test_redirect(exp, priv)

        return self.vulnerabilities

    def _test_redirect(self, exported: Component, private: Component):
        """對一對 exported→private 嘗試 Intent Redirection"""
        print(f"\n    [>] Testing: {exported.name} → {private.name}")

        # Step 1: 記錄目前頂層 Activity
        before = self.adb.get_current_activity()

        # Step 2: 強制停止 App，確保乾淨狀態
        self.adb.force_stop(self.package)
        time.sleep(0.5)

        # Step 3: 構造巢狀 Intent
        # 格式: --es target_intent "#Intent;component=PKG/PRIVATE;end"
        nested_intent = (
            f"#Intent;component={self.package}/{private.name};end"
        )

        # Step 4: 透過 ADB 發送
        poc_cmd = (
            f"adb shell am start "
            f"-n {self.package}/{exported.name} "
            f'--es target_intent "{nested_intent}"'
        )

        print(f"    [>] PoC: {poc_cmd}")
        rc, out = self.adb.start_activity(
            f"{self.package}/{exported.name}",
            extras={"target_intent": nested_intent}
        )

        if rc != 0:
            print(f"    [!] Failed to start: {out}")
            return

        time.sleep(1.5)

        # Step 5: Oracle — 檢查頂層 Activity 是否變成了 private 那個
        after = self.adb.get_current_activity()

        if after and private.name in after:
            vuln = Vulnerability(
                component=exported.name,
                vuln_type="Intent Redirection",
                target_component=private.name,
                severity="CRITICAL",
                poc_command=poc_cmd,
                evidence=f"Private activity {private.name} launched via {exported.name}",
                verified=True,
            )
            self.vulnerabilities.append(vuln)
            print(f"    [!!!] VULNERABLE! {private.name} was launched!")
        else:
            print(f"    [-] Not vulnerable (or blocked by security measure)")

        # Step 6: 清理
        self.adb.force_stop(self.package)
        time.sleep(0.3)

    def scan_exported_services(self) -> list[Vulnerability]:
        """
        延伸：掃描 exported Service 的 Intent Redirection
        （1.txt 只講 Activity，但同樣原理適用於 Service）
        """
        # TODO: 解析 <service> 標籤，同樣邏輯
        return []


# ── Dynamic Oracle ───────────────────────────────────────────────────────────

class DynamicOracle:
    """
    動態判定標準（Dynamic Oracle）
    對應 1.txt 第 3 節的 oracle：
    - 觀察實機畫面是否跳出私有 Activity
    - 或透過 dumpsys activity top 查看頂層 Activity
    """

    @staticmethod
    def check_activity_launched(adb: ADBExecutor, expected_activity: str) -> bool:
        current = adb.get_current_activity()
        if current and expected_activity in current:
            return True
        return False

    @staticmethod
    def screenshot_evidence(adb: ADBExecutor, output_path: str) -> bool:
        """截圖作為證據"""
        rc, _, _ = adb.run("shell", "screencap", "-p", "/sdcard/dast_evidence.png")
        if rc == 0:
            rc2, _, _ = adb.run("pull", "/sdcard/dast_evidence.png", output_path)
            adb.run("shell", "rm", "/sdcard/dast_evidence.png")
            return rc2 == 0
        return False

    @staticmethod
    def get_logcat_evidence(adb: ADBExecutor, package: str, keyword: str = "Security",
                            lines: int = 20) -> str:
        """抓 logcat 作為補充證據"""
        rc, out, _ = adb.run(
            "logcat", "-d", "-s", f"*:E", "-t", str(lines),
            timeout=5
        )
        if rc == 0:
            relevant = [
                l for l in out.split("\n")
                if package in l or keyword in l
            ]
            return "\n".join(relevant[:30])
        return ""


# ── Report Generator ─────────────────────────────────────────────────────────

class ReportGenerator:
    """產生掃描報告 (JSON + Markdown)"""

    @staticmethod
    def generate_json(vulns: list[Vulnerability], package: str, output: str):
        report = {
            "scan_time": datetime.now().isoformat(),
            "package": package,
            "total_vulns": len(vulns),
            "critical": sum(1 for v in vulns if v.severity == "CRITICAL"),
            "vulnerabilities": [
                {
                    "component": v.component,
                    "type": v.vuln_type,
                    "target": v.target_component,
                    "severity": v.severity,
                    "verified": v.verified,
                    "poc": v.poc_command,
                    "evidence": v.evidence,
                }
                for v in vulns
            ],
        }
        with open(output, "w") as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        print(f"\n[+] JSON report saved to: {output}")

    @staticmethod
    def generate_markdown(vulns: list[Vulnerability], package: str, output: str):
        lines = [
            f"# DAST Scan Report",
            f"",
            f"- **Package**: `{package}`",
            f"- **Scan Time**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            f"- **Vulnerabilities Found**: {len(vulns)}",
            f"",
        ]

        if not vulns:
            lines.append("✅ No vulnerabilities found.")
        else:
            lines.append("## Vulnerabilities\n")
            for i, v in enumerate(vulns, 1):
                lines.extend([
                    f"### {i}. {v.vuln_type} — {v.severity}",
                    f"",
                    f"| Field | Value |",
                    f"|-------|-------|",
                    f"| Exported Component | `{v.component}` |",
                    f"| Target (Private) | `{v.target_component}` |",
                    f"| Severity | **{v.severity}** |",
                    f"| Verified | {'✅' if v.verified else '❌'} |",
                    f"",
                    f"**PoC Command:**",
                    f"```bash",
                    f"{v.poc_command}",
                    f"```",
                    f"",
                    f"**Evidence:** {v.evidence}",
                    f"",
                    f"---",
                    f"",
                ])

            # Add fix recommendation
            lines.extend([
                "## Recommended Fix",
                "",
                "在 `startActivity(targetIntent)` 前加上白名單校驗：",
                "",
                "```kotlin",
                "val component = targetIntent.resolveActivity(packageManager)",
                "if (component != null && isAllowedComponent(component)) {",
                "    startActivity(targetIntent)",
                "} else {",
                '    Log.w("Security", "Blocked unauthorized intent redirection")',
                "}",
                "```",
                "",
            ])

        with open(output, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
        print(f"[+] Markdown report saved to: {output}")


# ── Main ─────────────────────────────────────────────────────────────────────

def extract_manifest_from_apk(apk_path: str, output_dir: str) -> Optional[str]:
    """從 APK 解出 AndroidManifest.xml"""
    # 方法 1: aapt
    try:
        result = subprocess.run(
            ["aapt", "dump", "xmltree", apk_path, "AndroidManifest.xml"],
            capture_output=True, text=True, timeout=15
        )
        if result.returncode == 0:
            manifest_path = os.path.join(output_dir, "AndroidManifest.xml")
            with open(manifest_path, "w") as f:
                f.write(result.stdout)
            return manifest_path
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass

    # 方法 2: apkanalyzer
    try:
        result = subprocess.run(
            ["apkanalyzer", "manifest", "print", apk_path],
            capture_output=True, text=True, timeout=15
        )
        if result.returncode == 0:
            manifest_path = os.path.join(output_dir, "AndroidManifest.xml")
            with open(manifest_path, "w") as f:
                f.write(result.stdout)
            return manifest_path
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass

    print("[!] Cannot extract manifest. Install Android SDK build-tools or apkanalyzer.")
    return None


def main():
    parser = argparse.ArgumentParser(
        description="Android DAST Scanner — Intent Redirection Detection"
    )
    parser.add_argument("apk", nargs="?", help="Path to APK file")
    parser.add_argument("--pkg", help="Package name of installed app")
    parser.add_argument("--manifest", help="Path to AndroidManifest.xml")
    parser.add_argument("--serial", "-s", help="ADB device serial")
    parser.add_argument("--output", "-o", default="dast_report", help="Output prefix")
    parser.add_argument("--install", action="store_true", help="Install APK before scan")
    parser.add_argument("--uninstall", action="store_true", help="Uninstall after scan")
    args = parser.parse_args()

    if not args.apk and not args.pkg and not args.manifest:
        parser.print_help()
        sys.exit(1)

    print("=" * 60)
    print("  DAST Scanner — Intent Redirection Detection")
    print("=" * 60)

    adb = ADBExecutor(device_serial=args.serial)

    # 檢查 ADB 連線
    if not adb.check_device():
        print("[!] No ADB device connected. Please connect a device or start an emulator.")
        print("    $ adb devices")
        sys.exit(1)
    print("[+] ADB device connected")

    package = args.pkg
    manifest = None
    tmpdir = tempfile.mkdtemp(prefix="dast_")

    # 取得 Manifest
    if args.manifest:
        manifest = ManifestParser(args.manifest)
        print(f"[+] Using provided manifest: {args.manifest}")
    elif args.apk:
        # 從 APK 提取
        pkg_name = extract_manifest_from_apk(args.apk, tmpdir)
        if pkg_name:
            manifest = ManifestParser(pkg_name)
            print(f"[+] Manifest extracted from APK")

        if not package:
            # 從 manifest 取 package name
            if manifest:
                package = manifest.package
            else:
                print("[!] Cannot determine package name. Use --pkg")
                sys.exit(1)

        # 安裝 APK
        if args.install:
            print(f"[*] Installing APK: {args.apk}")
            if adb.install(args.apk):
                print("[+] APK installed")
            else:
                print("[!] Failed to install APK")
                sys.exit(1)

    if not package:
        print("[!] No package name. Use --pkg or provide an APK")
        sys.exit(1)

    print(f"\n[*] Target package: {package}")

    # 執行掃描
    scanner = IntentRedirectionScanner(package, adb, manifest)
    vulns = scanner.scan_intent_redirection()

    # 產生報告
    output_json = f"{args.output}.json"
    output_md = f"{args.output}.md"
    ReportGenerator.generate_json(vulns, package, output_json)
    ReportGenerator.generate_markdown(vulns, package, output_md)

    # 總結
    print("\n" + "=" * 60)
    print(f"  Scan Complete: {len(vulns)} vulnerability(ies) found")
    for v in vulns:
        status = "✅ VERIFIED" if v.verified else "❌ UNVERIFIED"
        print(f"  [{v.severity}] {v.component} → {v.target_component} — {status}")
    print("=" * 60)

    # 清理
    if args.uninstall and args.apk:
        adb.uninstall(package)

    return len(vulns)


if __name__ == "__main__":
    sys.exit(main())
