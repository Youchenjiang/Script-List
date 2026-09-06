# Android DAST Scanner — Intent Redirection

基於 **1.txt** 的 Intent Redirection 漏洞場景，構建完整的 DAST（Dynamic Application Security Testing）工具。

## 專案結構

```
dast/
├── README.md                           ← 你正在看的
├── scanner/
│   ├── dast_scanner.py                 ← 核心掃描器
│   └── batch_scanner.py                ← 批次掃描多個 APK
├── poc/
│   ├── exploit_intent_redirection.sh   ← 漏洞利用 PoC
│   └── verify_fix.sh                   ← 修復後回歸驗證
└── vulnerable-app/                     ← 含漏洞的測試 App
    ├── app/
    │   ├── build.gradle
    │   └── src/main/
    │       ├── AndroidManifest.xml
    │       └── java/com/example/vulnerableapp/
    │           ├── ProxyActivity.kt          ← ⚠️ 漏洞點
    │           ├── SafeProxyActivity.kt      ← ✅ 修復版
    │           ├── MainActivity.kt
    │           └── internal/
    │               ├── AdminSecretActivity.kt  ← 🔒 私有目標
    │               └── PrivateDataActivity.kt  ← 🔒 私有目標
    ├── build.gradle
    └── settings.gradle
```

## 漏洞場景（Intent Redirection）

```
外部惡意 App
    │
    │  Intent(target_intent = nested Intent to AdminSecretActivity)
    ▼
┌─────────────────┐
│  ProxyActivity   │  ← exported=true，任何人都能啟動
│  (Confused Deputy)│
│                  │
│  startActivity(  │
│    targetIntent  │  ← ⚠️ 未校驗，直接轉發
│  )               │
└────────┬────────┘
         │
         ▼
┌──────────────────────────┐
│  AdminSecretActivity      │  ← exported=false
│  (私有頁面，外部不能直接啟動) │
│  但被 ProxyActivity 借權啟動  │
└──────────────────────────┘
```

## 快速開始

### 1. 編譯漏洞 App

```bash
cd vulnerable-app
./gradlew assembleDebug
# APK 輸出在 app/build/outputs/apk/debug/app-debug.apk
```

### 2. 安裝到裝置

```bash
adb install app/build/outputs/apk/debug/app-debug.apk
```

### 3. 執行 PoC 攻擊

```bash
cd ../poc
chmod +x exploit_intent_redirection.sh
./exploit_intent_redirection.sh
```

Expected output:
```
  🔓 VULNERABILITY CONFIRMED!
  AdminSecretActivity was launched from outside!
```

### 4. 用 Scanner 自動掃描

```bash
cd ../scanner
python dast_scanner.py ../vulnerable-app/app/build/outputs/apk/debug/app-debug.apk \
    --install \
    --output ../report
```

### 5. 修復後驗證

部署修復版（`SafeProxyActivity`），然後執行回歸測試：

```bash
cd ../poc
./verify_fix.sh
# Expected: ✅ ALL TESTS PASSED
```

## Scanner 運作流程

```
1. 解析 AndroidManifest.xml
   └─ 找所有 exported=true 的 Activity

2. 交叉比對
   └─ 找同一 App 裡 exported=false 的私有 Activity

3. 生成 PoC Intent
   └─ 對每個 exported→private 組合，構造巢狀 Intent

4. 透過 ADB 執行
   └─ adb shell am start -n PKG/EXPORTED --es target_intent NESTED

5. Dynamic Oracle 驗證
   └─ dumpsys activity top 檢查頂層 Activity
   └─ 如果是私有 Activity → 漏洞確認

6. 產生報告
   └─ JSON + Markdown 格式
```

## Output 範例

### JSON Report
```json
{
  "scan_time": "2026-08-27T12:00:00",
  "package": "com.example.vulnerableapp",
  "total_vulns": 2,
  "critical": 2,
  "vulnerabilities": [
    {
      "component": ".ProxyActivity",
      "type": "Intent Redirection",
      "target": ".internal.AdminSecretActivity",
      "severity": "CRITICAL",
      "verified": true,
      "poc": "adb shell am start -n com.example.vulnerableapp/.ProxyActivity --es target_intent \"#Intent;component=com.example.vulnerableapp/.internal.AdminSecretActivity;end\"",
      "evidence": "Private activity .internal.AdminSecretActivity launched via .ProxyActivity"
    }
  ]
}
```

## 修復方式（SafeProxyActivity）

核心修復：在 `startActivity` 前加白名單校驗

```kotlin
val component = targetIntent.resolveActivity(packageManager)
if (component != null && isAllowedComponent(component)) {
    startActivity(targetIntent)
} else {
    Log.w("Security", "Blocked unauthorized intent redirection to: $component")
}
```

## 依賴

- Python 3.10+
- ADB（Android SDK Platform Tools）
- aapt（Android SDK Build Tools）
- Android Studio（編譯 vulnerable-app）
