# Frida APK Penetration Testing Setup Guide

## 1. Environment Setup

### Activate Conda Environment
We have created a dedicated environment for you. Activate it using:
```powershell
conda activate android-pentest
```

### Configure ADB (Android Debug Bridge)
Since you have Android Studio installed, ADB is already available at:
`C:\Users\g1014308\AppData\Local\Android\Sdk\platform-tools\adb.exe`

**Add to PATH (Recommended)**
1. Open Windows Search and type "env", select "Edit the system environment variables".
2. Click "Environment Variables".
3. Under "User variables", find `Path` and click "Edit".
4. Click "New" and paste: `C:\Users\g1014308\AppData\Local\Android\Sdk\platform-tools`
5. Click OK -> OK -> OK.
6. Restart your terminal (close and reopen) and type `adb version` to verify.

**Or use full path**
If you don't want to change your PATH, you will need to replace `adb` with the full path in all commands:
`& "C:\Users\g1014308\AppData\Local\Android\Sdk\platform-tools\adb.exe" devices`


## 2. Device Setup

### Enable USB Debugging
1. On your Android device, go to **Settings > About Phone**.
2. Tap **Build Number** 7 times to enable Developer Options.
3. Go to **Settings > System > Developer Options**.
4. Enable **USB Debugging**.

### Install Frida Server
1. Download the latest `frida-server` for your device's architecture (usually `android-arm64`) from [Frida Releases](https://github.com/frida/frida/releases).
   - Look for: `frida-server-XX.X.X-android-arm64.xz`
2. Extract the `.xz` file to get the binary.
3. Push it to the device and run it:
```powershell
# Push to device
adb push frida-server /data/local/tmp/

# Give permissions
adb shell "chmod 755 /data/local/tmp/frida-server"

# Run server (in background)
adb shell "/data/local/tmp/frida-server &"
```

## 3. Running the Scripts

### Basic Hooking
We provided a `frida_loader.py` and `basic_hook.js`.

1. **Find your target package name**:
   ```powershell
   frida-ps -Uai
   ```
   (Look for the identifier, e.g., `com.example.app`)

2. **Run the loader**:
   ```powershell
   python frida_loader.py -p com.example.app
   ```
   This will spawn the app and inject `basic_hook.js`.

3. **Modify `basic_hook.js`**:
   Edit the Javascript file to hook specific functions you are interested in.
