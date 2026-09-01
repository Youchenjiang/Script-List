<#
.SYNOPSIS
    連結 HTTP 狀態碼檢測腳本 (PowerShell 版)
.DESCRIPTION
    讀取 URL 清單檔案並平行測試 HTTP 連線狀態碼。
.EXAMPLE
    .\check_urls.ps1 -FilePath .\urls.txt -CsvPath report.csv
#>

param (
    [string]$FilePath = "urls.txt",
    [string[]]$Urls,
    [int]$TimeoutSec = 5,
    [string]$CsvPath
)

$targetUrls = @()

if ($Urls) {
    $targetUrls = $Urls
} elseif (Test-Path $FilePath) {
    $targetUrls = Get-Content $FilePath | Where-Object { $_ -match '\S' -and -not $_.StartsWith('#') }
} else {
    Write-Host "[錯誤] 找不到檔案: $FilePath" -ForegroundColor Red
    exit 1
}

Write-Host "[資訊] 開始檢測 $($targetUrls.Count) 個連結 (逾時: ${TimeoutSec}s)..." -ForegroundColor Cyan

$results = @()

foreach ($rawUrl in $targetUrls) {
    $url = $rawUrl.Trim()
    if (-not ($url.StartsWith("http://") -or $url.StartsWith("https://"))) {
        $testUrl = "http://" + $url
    } else {
        $testUrl = $url
    }

    $statusCode = "N/A"
    $resultType = "FAIL"
    $detail = ""

    try {
        $req = [System.Net.HttpWebRequest]::Create($testUrl)
        $req.Timeout = $TimeoutSec * 1000
        $req.UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        $req.AllowAutoRedirect = $true

        $resp = [System.Net.HttpWebResponse]$req.GetResponse()
        $statusCode = [int]$resp.StatusCode
        $detail = $resp.StatusDescription
        $resp.Close()

        if ($statusCode -ge 200 -and $statusCode -lt 300) {
            $resultType = "SUCCESS"
        } else {
            $resultType = "REDIRECT/OTHER"
        }
    } catch [System.Net.WebException] {
        if ($_.Response) {
            $resp = [System.Net.HttpWebResponse]$_.Response
            $statusCode = [int]$resp.StatusCode
            $detail = "HTTP $statusCode $($resp.StatusDescription)"
            if ($statusCode -ge 400 -and $statusCode -lt 500) { $resultType = "CLIENT_ERROR" }
            elseif ($statusCode -ge 500) { $resultType = "SERVER_ERROR" }
        } else {
            $statusCode = "N/A"
            $resultType = "FAIL"
            $detail = $_.Exception.Message
        }
    } catch {
        $statusCode = "N/A"
        $resultType = "FAIL"
        $detail = $_.Exception.Message
    }

    $results += [PSCustomObject]@{
        OriginalUrl = $url
        StatusCode  = $statusCode
        ResultType  = $resultType
        Detail      = $detail
    }
}

Write-Host ""
$results | Format-Table -AutoSize

if ($CsvPath) {
    $results | Export-Csv -Path $CsvPath -NoTypeInformation -Encoding UTF8
    Write-Host "[資訊] 結果已匯出至 CSV: $CsvPath" -ForegroundColor Green
}
