# A2: Agentic Android Analysis (Reproduction)

這是一個基於論文 **"A2: Efficient Automated Attacker for Mobile App Vulnerabilities"** 的復現專案。
該系統旨在構建一個**多代理人（Multi-Agent）自動化系統**，用於自動發現並驗證 Android App 中的漏洞。

## 📂 專案架構與實作狀態

本專案分為兩個主要階段，目前復現進度如下：

### 1. Discovery Phase (發現模組) - ✅ Beta 
- **目標**：將 APK 轉換為 LLM 可讀的資訊，並產出「推測性漏洞」。
- **實作詳情**：
    - **Extraction**: ✅ 使用 `Jadx` 反編譯 APK，已實作第三方庫 (AndroidX, Google, etc.) 自動過濾。
    - **Static Analysis**: ⚠️ 目前僅實作簡易檔案搜索 (File Search)，未來需整合 MobSF 以獲得更精確的行號映射。
    - **Vulnerability Analysis**: ✅ 使用 LLM (Qwen2.5 via SiliconFlow) 分析真實源代碼，識別漏洞。

### 2. Validation Phase (驗證模組) - ⚠️ Prototype 
- **目標**：使用 Agentic Workflow 驗證發現的漏洞。
- **實作詳情**：
    - **Planner**: ✅ 基於 LangGraph 實作。能生成分步驟計畫，並具備錯誤重試 (Re-plan) 機制。
    - **Executor**: ⚠️ **目前為模擬執行 (Mock Execution)**。尚未完全實作論文中的 29 個 ADB 工具函數，僅支援各類模擬指令列印。
    - **Validator**: ⚠️ **依賴 LLM 自省**。論文要求的「動態 Oracle 生成 (Dynamic Python Assertions)」尚未實作，目前僅透過 LLM 分析執行日誌 (Mock Logs) 來判斷成功與否。

---

## 🚀 快速開始

### 環境要求
- **OS**: Windows / Linux / macOS
- **Python**: 3.10+
- **Tools**:
    - `adb` (Android Debug Bridge)
    - `jadx` (本專案提供自動安裝腳本)
    - `conda` (建議使用虛擬環境)

### 安裝步驟

1.  **切換到專案目錄**
    ```bash
    cd Script-List/A2-Reproduction
    ```

2.  **建立/啟用 Conda 環境**
    ```bash
    conda create -n android-pentest python=3.10 -y
    conda activate android-pentest
    ```

3.  **安裝依賴**
    ```bash
    pip install -r requirements.txt
    ```

4.  **安裝 JADX (反編譯工具)**
    由於系統 PATH 可能設定不易，本專案提供腳本將 JADX 安裝於專案目錄下的 `tools/` 資料夾：
    ```bash
    python setup_jadx.py
    ```

5.  **設定 API Key (SiliconFlow)**
    本專案目前配置使用 SiliconFlow (OpenAI-compatible) 作為 LLM 後端 (Qwen/Qwen2.5-7B-Instruct)。
    
    Powershell:
    ```powershell
    $env:SILICONFLOW_API_KEY="您的_sk_key"
    ```
    
    或者您可以在 `config.py` 中進行配置。

---

## 🛠️ 使用方式

使用 `main.py` 作為統一入口：

### 1. 執行完整流程 (Discovery + Validation)
此模式會先反編譯 APK，進行漏洞分析，若發現漏洞則自動進入驗證階段。

```bash
python main.py --apk <path_to_apk> --mode full
```

**範例**:
```bash
python main.py --apk "../frida-apk-tool/apks/week13.apk" --mode full
```

### 2. 僅執行發現 (Discovery Only)
僅產出分析報告，不進行攻擊驗證。

```bash
python main.py --apk <path_to_apk> --mode discovery
```

---

## 🚧 待開發功能 (Gap Analysis)
根據 A2 論文規格，以下功能尚缺：

1.  **完整工具集 (Executor)**:
    - [ ] File System Tools (`pull_device_file`, `check_file_existence`...)
    - [ ] UI Interaction Tools (`click_ui_element`, `input_text_field`...)
    - [ ] APK Gen & Web Server (用於 Payload 傳遞)

2.  **動態驗證 (Validator)**:
    - [ ] 實作 Oracle 生成邏輯，不單純依賴 LLM 判斷 Log，而是生成 Python Assertions 檢查檔案或狀態。

3.  **靜態分析整合**:
    - [ ] 整合 MobSF API 以獲取真實的靜態掃描報告 (JSON)。

---

## ⚠️ 免責聲明
本工具僅供**教育與授權測試**使用。請勿針對未經授權的應用程式進行測試。開發者不對任何濫用行為負責。
