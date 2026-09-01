## 🏬 Store Publishing & Release Governance

### 1. No Autonomous Version Bumps
- Never bump product versions or create release tags autonomously.
- Any version change (modifying `package.json`, `AppxManifest.xml`, `Directory.Build.props`, or running release scripts) requires explicit confirmation from the user.

### 2. Store Ingestion State Machine Guardrails
- `POST .../commit` responds with `CommitStarted` (HTTP 202), which is an asynchronous ingestion process and **does NOT mean the app is in certification**.
- True certified submission status is only reached when state transitions to `Certification`.
- Metadata Constraints:
  - Maximum 7 keywords per listing container (case-insensitive enforcement).
  - Every active listing locale must contain at least 1 screenshot.
  - Apply exponential backoff with minimum 180s timeout on heavy ingestion endpoints.
