param (
    [string]$ApkName = ""
)

# Configuration
$ToolsDir = "$PSScriptRoot\tools"
$InputDir = "$PSScriptRoot\apks"
$OutputDir = "$PSScriptRoot\build"

# SDK Configuration
if ($env:ANDROID_HOME) {
    $SdkPath = $env:ANDROID_HOME
}
elseif ($env:ANDROID_SDK_ROOT) {
    $SdkPath = $env:ANDROID_SDK_ROOT
}
else {
    $SdkPath = "$env:LOCALAPPDATA\Android\Sdk"
}

if (-not (Test-Path $SdkPath)) {
    Write-Error "Android SDK not found at $SdkPath. Please set ANDROID_HOME."
    exit 1
}

# Find latest build-tools
$BuildToolsBase = Join-Path $SdkPath "build-tools"
if (Test-Path $BuildToolsBase) {
    $LatestBuildTool = Get-ChildItem $BuildToolsBase | Sort-Object Name -Descending | Select-Object -First 1
    if ($LatestBuildTool) {
        $env:PATH += ";$($LatestBuildTool.FullName)"
        Write-Host "Using Build Tools: $($LatestBuildTool.Name)"
    }
}

$env:PATH += ";$ToolsDir"
$env:PATH += ";$(Join-Path $SdkPath "platform-tools")"



# Find APK
if ($ApkName -eq "") {
    $apk = Get-ChildItem -Path $InputDir -Filter "*.apk" | Select-Object -First 1
    if ($null -eq $apk) {
        Write-Error "No APK found in $InputDir"
        exit 1
    }
    $ApkPath = $apk.FullName
    $ApkName = $apk.Name
}
else {
    $ApkPath = Join-Path $InputDir $ApkName
}

Write-Host "Target APK: $ApkPath"

# Output Path
$OutputName = $ApkName.Replace(".apk", ".objection.apk")
$OutputPath = Join-Path $OutputDir $OutputName

Write-Host "Patching..."
objection patchapk --source $ApkPath --output $OutputPath

if ($?) {
    Write-Host "Success! Patched APK saved to: $OutputPath"
    Write-Host "Install with: adb install -r $OutputPath"
}
else {
    Write-Error "Patching failed."
}
