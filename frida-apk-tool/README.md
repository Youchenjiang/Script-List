# Frida Gadget Penetration Testing Framework

A reusable framework for patching and hooking Android APKs using Frida Gadget.

## Directory Structure
*   **`apks/`**: **Input Folder**. Drop your target APKs here.
*   **`build/`**: **Output Folder**. Patched APKs will appear here.
*   **`tools/`**: Dependencies (apktool, etc.).
*   **`docs/`**: Documentation (`walkthrough.md`).
*   **`scripts/`**: Helper scripts.

## Workflow for New APKs

1.  **Prepare**: Drop your target APK into the `apks/` folder.
2.  **Patch**: Run the patch script:
    ```powershell
    .\patch-apk.ps1
    ```
    *   It will automatically find the APK in `apks/` and save the patched version to `build/`.
3.  **Install**:
    ```powershell
    adb install -r build/your-app.objection.apk
    ```
4.  **Run**:
    *   Start the app on the emulator.
    *   Forward port: `adb forward tcp:27042 tcp:27042`
    *   Inject hooks: `frida -H 127.0.0.1:27042 Gadget -l basic-hook.js`

## Requirements
*   Android Emulator (API 34 recommended)
*   Python 3.12+ (Conda env `android-pentest`)
*   Frida Tools (`pip install frida-tools objection`)

