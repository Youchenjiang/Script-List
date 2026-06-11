# 本地 HTTPS 自簽憑證測試與生成助手

本工具用於生成本地 HTTPS 測試所需的自簽憑證（Self-Signed Certificate），並提供簡單的 Node.js 測試伺服器，用以學習和驗證「如何讓瀏覽器信任本地自簽憑證」。

## 📂 檔案結構

* `generate-certs.sh`：一鍵生成憑證的 OpenSSL 輔助腳本。
* `index.js`：極簡的 Node.js HTTPS 測試伺服器。
* `v3.ext`：憑證的 X509 v3 擴充設定檔（定義 `Subject Alternative Name (SAN)` 以支援 `localhost` 與 `127.0.0.1`）。
* `.gitignore`：確保私鑰（`.key`）與證書（`.crt`）不會被提交到 Git 倉庫。

---

## 🚀 快速使用步驟

### 1. 生成憑證
在 Git Bash 或相容的 Linux 環境下執行以下指令：
```bash
./generate-certs.sh
```
執行後，會自動在當前目錄下建立 `certs/` 資料夾，並生成以下檔案：
* `rootCA.key` / `rootCA.crt`：本地根證書（CA）的私鑰與憑證。
* `server.key` / `server.crt`：由 Root CA 簽署的伺服器私鑰與憑證。

---

### 2. 讓作業系統與瀏覽器信任 Root CA
自簽憑證預設會被瀏覽器判定為不安全，您需要手動將 `rootCA.crt` 導入系統的信任清單。

#### 🌐 Windows 設定步驟：
1. 雙擊打開 `certs/rootCA.crt`。
2. 點擊 **「安裝憑證...」**。
3. 儲存位置選擇 **「本機電腦」**，點擊下一步（需要管理員權限）。
4. 選擇 **「將所有憑證放入以下的存放區」**。
5. 點擊「瀏覽」，選擇 **「信任的根憑證授權機構」**，點擊確定。
6. 一路點擊下一步並完成。

> [!TIP]
> 導入完成後，**必須完全關閉並重新啟動您的瀏覽器**（如 Chrome 或 Edge），信任設定才會生效。

---

### 3. 啟動測試伺服器
請確保您的環境已安裝 [Node.js](https://nodejs.org/)。

由於 HTTPS 預設使用 443 通訊埠，在多數作業系統中啟動需要管理員權限：

* **Windows (以系統管理員身分執行 PowerShell/CMD)**：
  ```bash
  node index.js
  ```
* **macOS / Linux**：
  ```bash
  sudo node index.js
  ```

啟動後，請在瀏覽器中開啟 [https://localhost](https://localhost) 或 [https://127.0.0.1](https://127.0.0.1)。此時應該會看到網址列出現綠色鎖頭（或顯示連接是安全的），並回傳 `Hello Secure World!`。

---

## 🔍 原理說明

1. **為什麼需要 `v3.ext`？**
   現代瀏覽器（如 Chrome 58 之後）已不再僅依賴憑證的通用名稱 (Common Name, CN)，而是強制檢查 **主機備用名稱 (Subject Alternative Name, SAN)**。`v3.ext` 檔案即是用來告訴 OpenSSL，這個伺服器憑證適用於 `localhost` 與 IP `127.0.0.1`，否則瀏覽器依然會報錯（`NET::ERR_CERT_COMMON_NAME_INVALID`）。

2. **為什麼要建立 Root CA 而非直接自簽 Server 憑證？**
   在實際開發中，我們建立一個專屬的本地 Root CA。只要我們在系統中信任了這個 Root CA，未來所有由該 Root CA 簽署的各種開發用 server 憑證，都會自動被瀏覽器信任，最貼近真實世界的憑證授權中心架構。
