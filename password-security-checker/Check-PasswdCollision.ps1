#來源：
#	黑暗執行緒:小工具：快速檢測密碼是否外洩或被列入已知清單
#	https://blog.darkthread.net/blog/pwd-hibp-check/
#
# 增強版本：
#   - 加入錯誤處理機制
#   - 支援非互動模式 (-Password 參數)
#   - 改善使用者體驗

<#
.SYNOPSIS
    檢查密碼是否在 Have I Been Pwned (HIBP) 資料庫中出現，並評估密碼強度。

.DESCRIPTION
    此工具使用 HIBP API 的 k-anonymity 模型來檢查密碼是否在已知的資料外洩事件中出現。
    若密碼未外洩，則會根據密碼長度和字元類型估算暴力破解所需時間。

.PARAMETER Password
    要檢查的密碼（選用）。若未提供，則進入互動模式。

.EXAMPLE
    .\Check-PasswdCollision.ps1
    進入互動模式，可連續檢查多個密碼

.EXAMPLE
    .\Check-PasswdCollision.ps1 -Password "MyP@ssw0rd"
    直接檢查指定密碼（非互動模式）

.NOTES
    隱私保護：僅傳送密碼 SHA-1 雜湊值的前 5 個字元到 HIBP API
    基準：NVIDIA RTX-4090 @ 21,791.7 MH/s (SHA-256)
#>

param(
    [Parameter(Mandatory=$false)]
    [string]$Password
)

$ProgressPreference = 'SilentlyContinue'

# 檢查密碼函式
function Test-PasswordSecurity {
    param(
        [Parameter(Mandatory=$true)]
        [string]$CheckPassword
    )
    
    try {
        # 計算密碼的 SHA-1 雜湊值
        $pwdBytes = [System.Text.Encoding]::UTF8.GetBytes($CheckPassword)
        $hash = [System.BitConverter]::ToString([System.Security.Cryptography.SHA1]::Create().ComputeHash($pwdBytes)).Replace('-', '')
        $prefix = $hash.Substring(0, 5)
        $remaining = $hash.Substring(5)
        
        Write-Host "$prefix - $remaining" -ForegroundColor Cyan
        
        # 查詢 HIBP API
        try {
            $response = Invoke-WebRequest "https://api.pwnedpasswords.com/range/$prefix" -ErrorAction Stop
            $found = $response.Content.Split("`n") | Select-String -Pattern $remaining -CaseSensitive
        }
        catch {
            Write-Host "錯誤：無法連線到 HIBP API" -ForegroundColor Red
            Write-Host "請檢查網路連線或稍後再試" -ForegroundColor Yellow
            Write-Host "錯誤詳情：$($_.Exception.Message)" -ForegroundColor DarkGray
            return
        } 
        
        # 分析結果
        if ($found) {
            $p = $found -split ':'
            Write-Host "警告!此密碼在 HIBP 資料庫出現 " -ForegroundColor Red -NoNewline
            Write-Host (+$p[1]).ToString('n0') -ForegroundColor Yellow -NoNewline
            Write-Host " 次，不建議使用" -ForegroundColor Red
            Write-Host $found -ForegroundColor Cyan
        }
        else {
            Write-Host "呼~ HIBP 資料庫未收錄此密碼" -ForegroundColor Green
            
            # 計算密碼強度
            $charPool = 0
            $setNames = @();
            if ($CheckPassword -match '[0-9]') { $charPool += 10; $setNames += '數字' }
            if ($CheckPassword -cmatch '[a-z]') { $charPool += 26; $setNames += '小寫' }
            if ($CheckPassword -cmatch '[A-Z]') { $charPool += 26; $setNames += '大寫' }
            if ($CheckPassword -cmatch '[^0-9a-zA-Z]') { $charPool += 32; $setNames += '符號' }
            
            if ($charPool -eq 0) {
                Write-Host "警告：無法判斷字元類型" -ForegroundColor Yellow
                return
            }
            
            $length = $CheckPassword.Length
            [bigint]$count = [bigint]::Pow($charPool, $length)
            $rtx4090Power = 21791700000; #SHA2-256 21791.7 MH/s https://hashcat.net/forum/thread-11277.html
            $secs = [bigint]::Divide($count, $rtx4090Power)
            
            if ($secs -lt 60) { $time = "$secs 秒" }
            elseif ($secs -lt 3600) { $time = "$([bigint]::Divide($secs, 60)) 分鐘" }
            elseif ($secs -lt 86400) { $time = "$([bigint]::Divide($secs,3600)) 小時" }
            elseif ($secs -lt 86400 * 365) { $time = "$([bigint]::Divide($secs,86400)) 天" }
            else { 
                $time = "$([bigint]::Divide($secs,86400 * 365).ToString('n0')) 年" 
            }
            
            Write-Host "長度 $length ($($setNames -join '、')) 預估暴力破解時間約：$time (NVIDIA RTX-4090 / SHA256)" -ForegroundColor Magenta
        }
    }
    catch {
        Write-Host "發生未預期的錯誤：$($_.Exception.Message)" -ForegroundColor Red
    }
}

# 主程式邏輯
if ($Password) {
    # 非互動模式：直接檢查提供的密碼
    Write-Host "檢查密碼..." -ForegroundColor Cyan
    Test-PasswordSecurity -CheckPassword $Password
}
else {
    # 互動模式：循環輸入
    Write-Host "密碼安全檢查工具 (Have I Been Pwned)" -ForegroundColor Cyan
    Write-Host "直接按 Enter 離開" -ForegroundColor Gray
    Write-Host ""
    
    while ($true) {
        $secString = Read-Host "請輸入要檢查的密碼" -AsSecureString
        if ($secString.Length -eq 0) {
            Write-Host "Bye~" -ForegroundColor Green
            break
        }
        
        # https://github.com/PowerShell/PowerShell/issues/13494#issuecomment-678150857
        $ptr = [System.Runtime.InteropServices.Marshal]::SecureStringToGlobalAllocUnicode($secString)
        $passwd = [System.Runtime.InteropServices.Marshal]::PtrToStringUni($ptr)
        [System.Runtime.InteropServices.Marshal]::ZeroFreeGlobalAllocUnicode($ptr)
        
        Test-PasswordSecurity -CheckPassword $passwd
        Write-Host ""
    }
}
