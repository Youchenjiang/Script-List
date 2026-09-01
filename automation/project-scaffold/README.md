# 🚀 Project Scaffolding System (工程規範一鍵腳手架)

本工具為新專案或既有專案提供**一鍵自動化裝配**：
- **Agent Rules**（授權網關、思考防暴力、記憶協議、Conventional Commits、平台防禦）
- **Git 規範與 Hook**（`.gitmessage.txt`、`.editorconfig`、`commit-msg` 驗證鉤子）
- **GitHub Actions CI/CD**（`policy.yml` 看門狗、TruffleHog 金鑰外洩掃描、CodeQL SAST、OWASP ZAP、PR-Agent）
- **協作模板**（`pull_request_template.md`、`dependabot.yml`、`SECURITY.md`）

---

## 快速使用

### 1. 互動式選單
直接在目標專案目錄（或從本目錄指向目標專案）執行：
```powershell
.\init-project.ps1
```

### 2. 命令列快速執行
```powershell
# 桌面端 (Windows / .NET / Python)
.\init-project.ps1 -Preset desktop -TargetDir "C:\path\to\NewApp" -ProjectName "NewApp"

# 網頁 / 前端全端 (React / Ionic / Vite)
.\init-project.ps1 -Preset web -TargetDir "C:\path\to\WebPortal" -ProjectName "WebPortal"

# AI 研究 / 資安分析
.\init-project.ps1 -Preset research -TargetDir "C:\path\to\Research" -ProjectName "Research"

# 極簡小腳本 / 輕量工具
.\init-project.ps1 -Preset minimal -TargetDir "C:\path\to\Tool" -ProjectName "Tool"
```

### 3. 直接對 Agent 下指令
在新專案開啟對話時，直接告訴 Agent：
> *「請使用 `Script-List/automation/project-scaffold` 的 `web` preset 初始化這個專案」*

Agent 會自動讀取配置並就地生成完整的規範體系。

---

## Presets 設定一覽

| Preset | 適用技術棧 | 包含 Agent 規則 | 包含 GitHub Workflows |
| :--- | :--- | :--- | :--- |
| **`desktop`** | Windows / C# / .NET / WinUI | Core + Memory + Git + .NET Hygiene + Store Release | `policy.yml`, `trufflehog.yml`, `codeql.yml` |
| **`web`** | React / Ionic / Vite / Node | Core + Memory + Git + Web Guidelines | `policy.yml`, `trufflehog.yml`, `zap-scan.yml` |
| **`research`** | AI 論文 / 資安挖掘 / 實驗 | Core + Memory + Git | `policy.yml`, `trufflehog.yml`, `pr_agent.yml` |
| **`minimal`** | 快速小工具 / 單檔腳本 | Core + Memory + Git | `policy.yml` |

---

## 如何擴充與自訂
1. **新增/修改 Rule**：在 `templates/agent-rules/` 新增或調整 `.md` 模組。
2. **新增 Workflow**：在 `templates/github/workflows/` 新增 `.yml` 檔案。
3. **調整 Preset**：編輯 `presets.json`，將對應的檔案名稱加入對應的 array 即可。
