# Frida Penetration Testing Setup Walkthrough

This document records the successful process for setting up a Frida penetration testing environment using the **Frida Gadget** (non-root) method on an Android Emulator.

## 1. Environment Setup

### Prerequisites
*   **Anaconda/Miniconda** installed.
*   **Android Studio** installed with SDK and Emulator.

### Create Conda Environment
```powershell
conda create -n android-pentest python=3.12 -y
conda activate android-pentest
```

### Install Tools
```powershell
pip install frida-tools objection
```

### Configure ADB
Ensure `adb` is in your PATH. If using Android Studio:
```powershell
$env:PATH += ";C:\Users\g1014308\AppData\Local\Android\Sdk\platform-tools"
```

## 2. Emulator Setup (Critical)

> [!IMPORTANT]
> **Do NOT use Android 16 (API 36) Preview.** Frida is currently incompatible with it.
> Use **Android 14 (API 34)** or **Android 13 (API 33)**.

### Check Available AVDs
List your installed emulators to find the correct name:
```powershell
& "$env:ANDROID_HOME\emulator\emulator.exe" -list-avds
```

### Start the Emulator
Start the emulator using the name found above (e.g., `Medium_Phone_API_34`):
```powershell
& "$env:ANDROID_HOME\emulator\emulator.exe" -avd Medium_Phone_API_34
```

### Verify Android Version
Once the emulator is running, verify it is **API 34** or lower:
```powershell
adb shell getprop ro.build.version.sdk
```
*   Output `34` = Android 14 (Good)
*   Output `36` = Android 16 (Bad - Frida will crash)


## 3. Patching the APK

We use `objection` to inject the Frida Gadget into the APK. This allows us to use Frida without rooting the device.

```powershell
# Patch the APK
objection patchapk --source app-release.apk
```
*Output:* `app-release.objection.apk`

## 4. Installation and Connection

### Install Patched APK
```powershell
# Install the patched APK to the emulator
adb install -r app-release.objection.apk
```

### Setup Port Forwarding
The Frida Gadget listens on port `27042` inside the device. We must forward this to our computer.

```powershell
adb forward tcp:27042 tcp:27042
```

### Launch the App
1.  Tap the app icon (`com.example.lost_found_app`) on the emulator.
2.  **Note:** The app will pause at a white screen. This is normal; it is waiting for Frida to connect.

## 5. Running Frida Hooks

Use the `frida` CLI to connect to the Gadget and load your script.

### Command
```powershell
frida -H 127.0.0.1:27042 Gadget -l basic_hook.js
```

### Sample Script (`basic_hook.js`)
```javascript
console.log("[*] Script attached to Gadget.");

if (Java.available) {
    Java.perform(function () {
        console.log("[+] SUCCESS: Java is available on this device!");
        console.log("[*] Android Version: " + Java.androidVersion);
    });
} else {
    console.log("[-] ERROR: Java is still not available.");
}
```

## Troubleshooting

*   **"Unable to find copied methods in java/lang/Thread"**: You are running on an incompatible Android version (likely API 36). Switch to API 34.
*   **"Connection refused"**: Ensure the app is running (white screen) and you have run `adb forward tcp:27042 tcp:27042`.
