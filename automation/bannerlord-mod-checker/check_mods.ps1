<#
.SYNOPSIS
    Mount & Blade II: Bannerlord Mod 繁簡語言包檢查工具
.DESCRIPTION
    自動掃描 Bannerlord 模組資料夾，檢測各 Mod 是否具備中文（zho-CN/zho-TW）語言檔案。
.PARAMETER BasePath
    Bannerlord Modules 資料夾路徑
#>

param (
    [string]$BasePath = "D:\Game\Steam\steamapps\common\Mount & Blade II Bannerlord\Modules"
)

if (-not (Test-Path $BasePath)) {
    Write-Host "[錯誤] 找不到指定的 Bannerlord 模組目錄: $BasePath" -ForegroundColor Red
    Write-Host "請使用 -BasePath 參數指定正確路徑。" -ForegroundColor Yellow
    exit 1
}

$mods = Get-ChildItem -Path $BasePath -Directory
Write-Host "[資訊] 開始掃描模組目錄: $BasePath (共 $($mods.Count) 個模組)..." -ForegroundColor Cyan
Write-Host ""

$results = @()

foreach ($mod in $mods) {
    $langPath = Join-Path $mod.FullName 'ModuleData\Languages'
    $hasLang = Test-Path $langPath
    $zhFilesCount = 0

    if ($hasLang) {
        $files = Get-ChildItem -Path $langPath -Recurse -Filter '*zho*' -ErrorAction SilentlyContinue
        $zhFilesCount = $files.Count
    }

    $status = if ($zhFilesCount -gt 0) { "已漢化 ($zhFilesCount 檔)" } elseif ($hasLang) { "有語系但無中文" } else { "無獨立語系包" }

    $results += [PSCustomObject]@{
        ModuleName   = $mod.Name
        HasLanguages = $hasLang
        ChineseFiles = $zhFilesCount
        Status       = $status
    }
}

$results | Format-Table -AutoSize
