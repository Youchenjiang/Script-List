# 🎓 Homework Submission Analyzer

A Node.js tool designed to accelerate the statistics and review of student homework submissions and certificates downloaded from eeclass.

[閱讀繁體中文版](README.zh-TW.md)

## Features
- Automatically parses eeclass homework zip extractions.
- Validates PDF certificates using `pdf-parse`.
- Generates a CSV report summarizing student completion statuses.

## Prerequisites
- Node.js installed on your system.

## Usage
1. Place the extracted eeclass folders in the same directory.
2. Run `node run_report.js`.
3. A `submission_report.csv` will be generated automatically.
