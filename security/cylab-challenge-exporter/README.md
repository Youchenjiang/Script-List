# CyLab Security Academy Challenge Exporter & Checklist Generator

A toolkit for exporting, analyzing, and generating progress checklists for all cybersecurity challenges hosted on [CyLab Security Academy](https://learn.cylabacademy.org) (formerly picoCTF).

## Features

- **Session-Authenticated Challenge Exporter (`export_challenges.js`)**: Bypasses Cloudflare protection and authentication by running directly inside the browser F12 Console using your active session.
- **Learning Paths & Topics Crawler (`export_learning_paths.js`)**: Automatically navigates through all Learning Path detail pages via popup windows (bypassing `X-Frame-Options` headers), extracts rendered React DOM topics, and exports a structured Markdown overview (`CyLab_Learning_Paths_and_Topics_YYYY-MM-DD.md`).
- **Automated Pagination & Bulk Fetch**: Automatically iterates through all challenge API pages to harvest complete challenge data.
- **Dual Export Formats**: Exports raw `JSON` (for program analysis) and UTF-8 BOM `CSV` (ready to open directly in Microsoft Excel without encoding glitches).
- **Offline Markdown Checklist Generator (`process_challenges.py`)**: Parses exported JSON files to generate a structured Markdown checklist grouped by category, showing completion status, points, and difficulty metrics.

## Architecture & Why Dual-Tooling?

Web security platforms like CyLab Academy employ Cloudflare protections and HTTP 403 authorization guards. Running a standalone HTTP client (such as Python `requests` or `urllib`) without a valid session cookie will be blocked by Cloudflare.

To resolve this, the toolset uses a hybrid two-step architecture:
1. **`export_challenges.js`**: Runs inside the browser context where Cloudflare clearance and session cookies are already present.
2. **`process_challenges.py`**: Operates locally offline to process the exported JSON dataset into progress reports and checklists.

```
[ Browser (learn.cylabacademy.org) ] 
        │
        ▼ (Run export_challenges.js in F12 Console)
 [ cylab_challenges_YYYY-MM-DD.json ]
        │
        ▼ (python process_challenges.py)
 [ challenges_checklist.md ] (Formatted Markdown Progress Report)
```

## Quick Start

### Step 1: Export Data via Browser Console
1. Open your browser and log into [https://learn.cylabacademy.org/library](https://learn.cylabacademy.org/library).
2. Press `F12` to open Developer Tools and select the **Console** tab.
3. Copy all code from [export_challenges.js](export_challenges.js), paste it into the console, and press `Enter`.
4. The browser will automatically download:
   - `cylab_challenges_YYYY-MM-DD.json`
   - `CyLab_Challenges_YYYY-MM-DD.csv`

### Step 2: Generate Checklist & Statistics
Run the Python processor on the downloaded JSON file:

```bash
python process_challenges.py --input cylab_challenges_YYYY-MM-DD.json
```

Or omit `--input` to auto-detect the latest exported JSON in the current directory:

```bash
python process_challenges.py
```

This generates `challenges_checklist.md` in the local directory, complete with category summaries and checkbox tasks (`[x]` for solved, `[ ]` for unsolved).

## Output Preview (`challenges_checklist.md`)

```markdown
# CyLab Security Academy Challenge Progress & Checklist

- **Total Challenges**: 512
- **Solved**: 128 / 512 (25.0%)

## Category Summary

| Category | Solved | Total | Completion |
| :--- | :---: | :---: | :---: |
| Artificial Intelligence | 5 | 10 | 50.0% |
| Cryptography | 30 | 100 | 30.0% |
| Web Exploitation | 40 | 120 | 33.3% |

---

## Challenge Checklist

### 📂 Cryptography (30/100)

- [x] **Basic Mod 26** — 100 pts | Diff: 1 *(picoCTF 2022)*
- [ ] **Mod 26** — 100 pts | Diff: 1 *(picoCTF 2021)*
```

## License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.
