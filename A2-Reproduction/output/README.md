# Output Directory

This directory serves as the workspace for the A2 Analysis System.

## Structure

- **<app_name>/**: Sub-directories created for each analyzed APK.
    - **resources/**: Extracted resources (AndroidManifest.xml, strings.xml, etc.).
    - **sources/**: Decompiled Java source code (filtered for relevant logic).
    - **analysis_report.json**: (Planned) Final analysis report for the app.

## Note
The contents of this directory are **temporary** and **git-ignored** to prevent committing massive amounts of decompiled code and sensitive information.
