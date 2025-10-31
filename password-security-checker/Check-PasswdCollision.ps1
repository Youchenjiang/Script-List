#來源：
#	黑暗執行緒:小工具：快速檢測密碼是否外洩或被列入已知清單
#	https://blog.darkthread.net/blog/pwd-hibp-check/

$ProgressPreference = 'SilentlyContinue'
while ($true) {
    $secString = Read-Host "請輸入要檢查的密碼" -AsSecureString
    if ($secString.Length -eq 0) {
        Write-Host "Bye~"
        break
    }
    # https://github.com/PowerShell/PowerShell/issues/13494#issuecomment-678150857
    $ptr = [System.Runtime.InteropServices.Marshal]::SecureStringToGlobalAllocUnicode($secString)
    $passwd = [System.Runtime.InteropServices.Marshal]::PtrToStringUni($ptr)
    [System.Runtime.InteropServices.Marshal]::ZeroFreeGlobalAllocUnicode($ptr)
    $pwdBytes = [System.Text.Encoding]::UTF8.GetBytes($passwd)
    $hash = [System.BitConverter]::ToString([System.Security.Cryptography.SHA1]::Create().ComputeHash($pwdBytes)).Replace('-', '')
    $prefix = $hash.Substring(0, 5)
    $remaining = $hash.Substring(5)
    Write-Host "$prefix - $remaining" -ForegroundColor Cyan
    $found = (Invoke-WebRequest "https://api.pwnedpasswords.com/range/$prefix").Content.Split("`n") | Select-String -Pattern $remaining -CaseSensitive 
    if ($found) {
        $p = $found -split ':'
        Write-Host "警告!此密碼在 HIBP 資料庫出現 " -ForegroundColor Red -NoNewline
        Write-Host (+$p[1]).ToString('n0') -ForegroundColor Yellow -NoNewline
        Write-Host " 次，不建議使用" -ForegroundColor Red
        Write-Host $found -ForegroundColor Cyan
    }
    else {
        Write-Host "呼~ HIBP 資料庫未收錄此密碼" -ForegroundColor Green
        $charPool = 0
        $setNames = @();
        if ($passwd -match '[0-9]') { $charPool += 10; $setNames += '數字' }
        if ($passwd -cmatch '[a-z]') { $charPool += 26; $setNames += '小寫' }
        if ($passwd -cmatch '[A-Z]') { $charPool += 26; $setNames += '大寫' }
        if ($passwd -cmatch '[^0-9a-zA-Z]') { $charPool += 32; $setNames += '符號' }
        $length = $passwd.Length
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
    Write-Host
}
