# 密碼安全檢查工具

一個 PowerShell 工具,使用 Have I Been Pwned (HIBP) API 檢查密碼是否在資料外洩事件中曝光,並估算暴力破解所需時間。

## 功能特色

- **外洩檢查**: 驗證密碼是否出現在 HIBP 已洩漏密碼資料庫中
- **安全輸入**: 使用 PowerShell 的 SecureString 安全輸入密碼
- **隱私優先**: 僅傳送 SHA-1 雜湊值的前 5 個字元 (k-匿名模型)
- **強度分析**: 根據以下條件計算預估暴力破解時間:
  - 密碼長度
  - 字元集多樣性 (數字、小寫、大寫、符號)
  - NVIDIA RTX-4090 SHA-256 雜湊速率基準
- **互動式迴圈**: 一次檢查多個密碼

## 環境需求

- **Windows PowerShell 5.1+** 或 **PowerShell Core 7+**
- **網路連線**: 需要連線至 HIBP API

## 安裝步驟

1. 進入工具目錄:
```powershell
cd password-security-checker
```

2. 無需額外安裝依賴 - 使用內建 PowerShell 模組

## 使用方式

### 執行腳本

```powershell
.\Check-PasswdCollision.ps1
```

### 互動式操作流程

1. 在提示時輸入密碼 (輸入會被隱藏)
2. 查看結果:
   - **如果已洩漏**: 顯示密碼在資料外洩中出現的次數
   - **如果安全**: 顯示預估的暴力破解時間
3. 直接按 Enter 離開,或繼續檢查其他密碼

### 輸出範例

**已洩漏的密碼**:
```
請輸入要檢查的密碼: ********
5BAA6 - 1E4C9B93F3F0682250B6CF8331B7EE68FD8
警告!此密碼在 HIBP 資料庫出現 3,861,493 次，不建議使用
```

**安全的密碼**:
```
請輸入要檢查的密碼: ********
A1B2C - 3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T
呼~ HIBP 資料庫未收錄此密碼
長度 16 (數字、小寫、大寫、符號) 預估暴力破解時間約：1,234,567 年 (NVIDIA RTX-4090 / SHA256)
```

## 運作原理

### 隱私保護的 API 查詢

1. **雜湊密碼**: 計算輸入密碼的 SHA-1 雜湊值
2. **k-匿名**: 僅傳送雜湊值的前 5 個字元到 HIBP API
3. **本地比對**: 下載所有相同前綴的雜湊值,在本地進行比對
4. **結果**: 你的完整密碼永遠不會離開你的電腦

範例:
- 密碼雜湊值: `5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8`
- 傳送到 API: `5BAA6`
- 接收: 所有以 `5BAA6` 開頭的雜湊值
- 本地比對: `1E4C9B93F3F0682250B6CF8331B7EE68FD8`

### 強度計算

**字元集池**:
- 數字 (0-9): 10 個字元
- 小寫 (a-z): 26 個字元
- 大寫 (A-Z): 26 個字元
- 符號: 32 個常見特殊字元

**公式**:
```
總組合數 = (字元池大小) ^ (密碼長度)
時間 = 組合數 ÷ RTX-4090 雜湊速率
```

**基準**: NVIDIA RTX-4090 @ 21,791.7 MH/s (SHA-256)

## 安全性說明

- ✅ **SecureString**: 密碼在記憶體中安全儲存
- ✅ **使用後清零**: 使用後立即清除記憶體
- ✅ **k-匿名**: HIBP API 永遠看不到你的完整密碼雜湊值
- ✅ **HTTPS**: 所有 API 通訊都經過加密
- ⚠️ **本地處理**: 雜湊值比對在你的機器上完成
- ⚠️ **僅供參考**: 暴力破解時間為理論估算值

## 使用情境

- **個人安全**: 驗證你的密碼是否已洩漏
- **密碼稽核**: 檢查組織密碼政策
- **安全意識**: 向他人展示密碼強度
- **事件回應**: 快速檢查憑證是否在外洩資料庫中

## API 資訊

- **服務**: [Have I Been Pwned](https://haveibeenpwned.com/)
- **API 端點**: `https://api.pwnedpasswords.com/range/`
- **文件**: [Pwned Passwords API](https://haveibeenpwned.com/API/v3#PwnedPasswords)
- **速率限制**: 合理使用政策,無需驗證

## 疑難排解

### 「請輸入要檢查的密碼」未出現

確保在互動式 PowerShell 工作階段中執行,而非排程工作。

### 網路連線錯誤

檢查網路連線和防火牆設定。腳本需要連線到 `api.pwnedpasswords.com`。

### 執行原則錯誤

如果看到「無法載入腳本」,執行:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## 致謝

- **原作者**: 黑暗執行緒 (DarkThread)
- **來源**: [快速檢測密碼是否外洩或被列入已知清單](https://blog.darkthread.net/blog/pwd-hibp-check/)
- **HIBP 服務**: Troy Hunt
- **基準資料**: [Hashcat 論壇](https://hashcat.net/forum/thread-11277.html)

## 技術細節

- **語言**: PowerShell
- **雜湊演算法**: SHA-1 (與 HIBP 相容)
- **基準演算法**: SHA-256 (用於強度估算)
- **API 協定**: HTTPS GET 請求
- **回應格式**: 純文字,冒號分隔值

## 授權條款

此工具是 Script-List 專案的一部分,遵循相同的 MIT 授權。
