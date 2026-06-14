# GitHub Star Lists Sync Utility

A Node.js utility to automatically synchronize starred GitHub repositories listed in your Markdown file into organized custom **"Star Lists"** (UserLists) on your GitHub profile based on Markdown headings.

## Features

1. **Heading-to-List Mapping**: Maps markdown category headers (e.g., `## AI Tools` and `### Agent Frameworks`) into formatted list names (e.g., `[AI] Agent Frameworks`).
2. **Auto List Creation**: If a targeted list does not exist on your profile, the tool automatically creates it via GitHub's GraphQL API.
3. **Safe Sync (No Overwriting)**: Assigns repositories to target lists while preserving all other custom list memberships you've manually added in the past.
4. **Recursive Parsing**: Automatically processes local sub-markdown files linked inside the tables.
5. **Auto Cleanup**: Deletes any empty, incorrectly formatted custom lists from your profile at the end of execution.
6. **Zero Dependencies**: Pure native Node.js implementation using built-in `fetch` and `readline` APIs.

---

## 🚀 Quick Start

### 1. Generate GitHub Personal Access Token (PAT)

1. Go to [GitHub Developer Settings (Classic Tokens)](https://github.com/settings/tokens).
2. Click **Generate new token (classic)**.
3. Select the following scopes:
   - [x] **`repo`** (to access and resolve public & private repository IDs)
   - [x] **`user`** (to read, create, and manage your custom star lists)
4. Click **Generate token** and copy it.

---

### 2. Usage

Place your token in a `.env` file in the script directory (format: `GITHUB_TOKEN=your_token`), set it in the `GITHUB_TOKEN` environment variable, or enter it when prompted by the CLI.

#### Interactive Menu
Allows you to choose between checking status, running synchronization, or exiting:

```bash
node sync-github-stars.js
```

#### CLI Automated Sync
Directly runs the list synchronization process and cleans up any empty bad lists without prompts:

```bash
node sync-github-stars.js --sync
```

#### CLI Status Check
Performs a dry-run check to verify which repositories are missing from their target lists:

```bash
node sync-github-stars.js --check
```
