<#
.SYNOPSIS
  Project Scaffolding Tool for Agent Rules, Git Policies & CI Workflows
.DESCRIPTION
  Automatically initializes Agent rules, Conventional Commit hooks, and GitHub Actions workflows for new or existing projects.
.PARAMETER Preset
  Preset profile: desktop, web, research, minimal
.PARAMETER TargetDir
  Target project directory (defaults to current directory)
.PARAMETER ProjectName
  Project name (defaults to TargetDir folder name)
.PARAMETER Force
  Overwrite existing rule/workflow files
.EXAMPLE
  .\init-project.ps1 -Preset desktop -ProjectName "MyNewApp"
#>

[CmdletBinding()]
param(
  [ValidateSet('desktop', 'web', 'research', 'minimal')]
  [string]$Preset,

  [string]$TargetDir = (Get-Location).Path,

  [string]$ProjectName,

  [switch]$Force
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$PresetsFile = Join-Path $ScriptDir "presets.json"
$TemplatesDir = Join-Path $ScriptDir "templates"

if (-not (Test-Path $PresetsFile)) {
  Write-Error "presets.json not found in $ScriptDir"
  exit 1
}

$Config = Get-Content $PresetsFile -Raw -Encoding UTF8 | ConvertFrom-Json

# Interactive selection if preset not provided
if (-not $Preset) {
  Write-Host ""
  Write-Host "=================================================" -ForegroundColor Cyan
  Write-Host "   🚀 Youchen Project Scaffolding Initializer" -ForegroundColor Yellow
  Write-Host "=================================================" -ForegroundColor Cyan
  Write-Host "Please select a project preset profile:"
  Write-Host ""

  $presetKeys = @($Config.presets.PSObject.Properties.Name)
  for ($i = 0; $i -lt $presetKeys.Count; $i++) {
    $key = $presetKeys[$i]
    $desc = $Config.presets.$key.description
    Write-Host "  [$($i + 1)] $key" -ForegroundColor Green -NoNewline
    Write-Host " - $desc" -ForegroundColor Gray
  }
  Write-Host ""

  $choice = Read-Host "Enter number (1-$($presetKeys.Count))"
  $index = [int]$choice - 1
  if ($index -ge 0 -and $index -lt $presetKeys.Count) {
    $Preset = $presetKeys[$index]
  } else {
    Write-Error "Invalid choice. Aborting."
    exit 1
  }
}

$SelectedPreset = $Config.presets.$Preset
if (-not $SelectedPreset) {
  Write-Error "Preset '$Preset' not found in configuration."
  exit 1
}

# Resolve Target Directory & Project Name
if (-not (Test-Path $TargetDir)) {
  New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
}
$TargetDir = (Resolve-Path $TargetDir).Path

if (-not $ProjectName) {
  $ProjectName = Split-Path -Leaf $TargetDir
}

Write-Host ""
Write-Host "Target Directory : $TargetDir" -ForegroundColor Cyan
Write-Host "Project Name     : $ProjectName" -ForegroundColor Cyan
Write-Host "Selected Preset  : $Preset ($($SelectedPreset.description))" -ForegroundColor Green
Write-Host "-------------------------------------------------"

# 1. Assemble Agent Rules
Write-Host "[1/4] Assembling Agent Rules..." -ForegroundColor Yellow

$RulesHeader = @"
# $ProjectName Agent Rules & Developer Guidelines

You are a senior pair-programming AI assistant operating in the **$ProjectName** codebase.
Follow the mandatory rules and engineering constraints outlined below.

"@

$CombinedRules = $RulesHeader

foreach ($ruleFile in $SelectedPreset.agentRules) {
  $rulePath = Join-Path $TemplatesDir "agent-rules\$ruleFile"
  if (Test-Path $rulePath) {
    $content = Get-Content $rulePath -Raw -Encoding UTF8
    $CombinedRules += "`n`n" + $content
  }
}

# Write AGENTS.md
$AgentsMdPath = Join-Path $TargetDir "AGENTS.md"
[System.IO.File]::WriteAllText($AgentsMdPath, $CombinedRules, [System.Text.Encoding]::UTF8)
Write-Host "  + Created: AGENTS.md" -ForegroundColor Gray

# Write .agent/rules.md
$AgentDir = Join-Path $TargetDir ".agent"
if (-not (Test-Path $AgentDir)) { New-Item -ItemType Directory -Path $AgentDir -Force | Out-Null }
$AgentRulesPath = Join-Path $AgentDir "rules.md"
[System.IO.File]::WriteAllText($AgentRulesPath, $CombinedRules, [System.Text.Encoding]::UTF8)
Write-Host "  + Created: .agent/rules.md" -ForegroundColor Gray

# Initialize MEMORY.md if not present
$MemoryPath = Join-Path $TargetDir "MEMORY.md"
if (-not (Test-Path $MemoryPath) -or $Force) {
  $StarterMemory = @"
# Agent Persistent Memory

> **Every agent session MUST read this file first** (defined in `.agent/rules.md`).
> **Every agent session MUST update this file before ending.**

---

## 🔑 User Preferences
- **Language**: 繁體中文 preferred for casual conversation; code/commits in English.
- **Style**: Direct, no fluff. Get things done with high engineering rigor.

---

## 📋 Current Active Tasks
- Initial project setup completed.

---

## 🏗️ Architectural Context
- **Project**: $ProjectName
- **Preset**: $Preset

---

## ✅ Completed Decisions & Lessons Learned
- Initialized with standard scaffolding system.
"@
  [System.IO.File]::WriteAllText($MemoryPath, $StarterMemory, [System.Text.Encoding]::UTF8)
  Write-Host "  + Created: MEMORY.md (Starter Context)" -ForegroundColor Gray
}

# 2. Setup Git Policies & Templates
Write-Host "[2/4] Configuring Git Templates & Hooks..." -ForegroundColor Yellow

$EditorConfigSrc = Join-Path $TemplatesDir "git\.editorconfig"
$EditorConfigDst = Join-Path $TargetDir ".editorconfig"
if (Test-Path $EditorConfigSrc) {
  Copy-Item $EditorConfigSrc $EditorConfigDst -Force
  Write-Host "  + Created: .editorconfig" -ForegroundColor Gray
}

$GitMessageSrc = Join-Path $TemplatesDir "git\.gitmessage.txt"
$GitMessageDst = Join-Path $TargetDir ".gitmessage.txt"
if (Test-Path $GitMessageSrc) {
  Copy-Item $GitMessageSrc $GitMessageDst -Force
  Write-Host "  + Created: .gitmessage.txt" -ForegroundColor Gray
}

# Setup Git Hook if .git repository exists
$GitDir = Join-Path $TargetDir ".git"
if (Test-Path $GitDir) {
  $HooksDir = Join-Path $GitDir "hooks"
  if (-not (Test-Path $HooksDir)) { New-Item -ItemType Directory -Path $HooksDir -Force | Out-Null }
  
  $HookSrc = Join-Path $TemplatesDir "git\hooks\commit-msg"
  $HookDst = Join-Path $HooksDir "commit-msg"
  if (Test-Path $HookSrc) {
    Copy-Item $HookSrc $HookDst -Force
    Write-Host "  + Installed: .git/hooks/commit-msg" -ForegroundColor Green
  }

  # Configure commit template locally
  try {
    Push-Location $TargetDir
    git config commit.template .gitmessage.txt
    Pop-Location
    Write-Host "  + Configured: git config commit.template .gitmessage.txt" -ForegroundColor Green
  } catch {
    # Non-fatal if git fails
  }
} else {
  Write-Host "  (Note: .git directory not found. Run 'git init' later and re-run to install hook)" -ForegroundColor DarkYellow
}

# 3. Setup GitHub Actions Workflows & Templates
Write-Host "[3/4] Deploying GitHub Workflows & Policy CI..." -ForegroundColor Yellow

$GithubDir = Join-Path $TargetDir ".github"
$WorkflowsDir = Join-Path $GithubDir "workflows"
if (-not (Test-Path $WorkflowsDir)) { New-Item -ItemType Directory -Path $WorkflowsDir -Force | Out-Null }

foreach ($wf in $SelectedPreset.githubWorkflows) {
  $wfSrc = Join-Path $TemplatesDir "github\workflows\$wf"
  $wfDst = Join-Path $WorkflowsDir $wf
  if (Test-Path $wfSrc) {
    Copy-Item $wfSrc $wfDst -Force
    Write-Host "  + Deployed Workflow: .github/workflows/$wf" -ForegroundColor Gray
  }
}

foreach ($ghFile in $SelectedPreset.githubFiles) {
  $ghSrc = Join-Path $TemplatesDir "github\$ghFile"
  $ghDst = Join-Path $GithubDir $ghFile
  if (Test-Path $ghSrc) {
    Copy-Item $ghSrc $ghDst -Force
    Write-Host "  + Deployed GitHub Template: .github/$ghFile" -ForegroundColor Gray
  }
}

# 4. Final Summary
Write-Host "[4/4] Scaffolding Complete!" -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "✨ Project '$ProjectName' is fully scaffolded!" -ForegroundColor Green
Write-Host "   - Agent Rules: AGENTS.md, .agent/rules.md, MEMORY.md"
Write-Host "   - Git Policies: .editorconfig, .gitmessage.txt, commit-msg hook"
Write-Host "   - GitHub CI: $($SelectedPreset.githubWorkflows -join ', ')"
Write-Host "=================================================" -ForegroundColor Cyan
