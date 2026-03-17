# Image-Text Verifier

A specialized tool for extracting answers from scanned questionnaire images and verifying/fixing them against an existing CSV dataset.

## Features

- **Automated Structure Detection**: Uses morphological operations to detect table rows and columns while ignoring noise outside the answer area.
- **Handwriting Energy Scoring**: Calculates pixel density across candidate fields to determine the best choice and confidence margin.
- **Targeted Risk Management**: Supports stricter parsing rules for specific pages (e.g., page 2) to catch double-checks, crossed-out answers, or smudges.
- **Reporting**: Generates a JSON verification report (`verify_report.json`) listing all mismatches and low-confidence cells requiring human review.
- **Auto-Fixing**: Can automatically overwrite the CSV file with high-confidence corrections.

## Requirements

- Python 3.8+
- OpenCV (`opencv-python`)
- NumPy (`numpy`)

## Installation

1. Navigate to the tool directory:
```bash
cd image-text-verifier
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

## Usage

The main script is `image-text-verifier.py`, which supports various CLI arguments.

### Prerequisites

- **CSV Format**: The first two columns must be identifiers (e.g., Company, Name), followed by the answer columns.
- **Image Naming Scheme**: `{record}-{page}.jpg` (e.g., `17-1.jpg`, `17-2.jpg`).
- **Fixed Question Layout**: Default assumes 16 questions on page 1, and 24 questions on page 2 (customizable via flags).

### Example Commands

**1. Dry Run (Check mismatches without modifying CSV):**
```bash
python image-text-verifier.py --csv results.csv --image-dir image --strict-page2 --dry-run
```

**2. Generate Report and Auto-Fix High-Confidence Errors:**
```bash
python image-text-verifier.py --csv results.csv --image-dir image --strict-page2 --report-json verify_report.json
```

### Important Parameters

- `--csv`: Path to the input CSV file (default: `results.csv`)
- `--image-dir`: Directory containing the scanned images (default: `image`)
- `--strict-page2`: Enable stricter risk assessment for the second page
- `--apply-risky`: Force overwrite even for low-confidence cells (not recommended by default)
- `--dry-run`: Read-only mode; do not overwrite the CSV file
- `--records`: Total number of records (default: `40`)
- `--questions-per-record`: Questions per record (default: `40`)
- `--report-json`: Path for the output JSON report (default: `verify_report.json`)

## Recommended Verification Workflow

1. Run the script with `--dry-run` and inspect `mismatches` and `page2_risky` in the JSON report.
2. Manually review the source images for any items marked as risky/low-confidence.
3. Remove `--dry-run` and run the script again to let it auto-fix all high-confidence errors.
4. Manually update the CSV for the risky items you reviewed, then re-run to confirm zero mismatches.
