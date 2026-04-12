# Photo Splitter - Technical Notes

This document summarizes the core logic and technical challenges solved during the development of the `photo-splitter` script.

## 1. Face Detection Evolution
Initially, the script used **Haar Cascades** (via OpenCV), but it suffered from several issues:
- **False Positives**: Small background objects or textures were often misidentified as faces.
- **Inaccuracy**: Detecting students at various angles (profile, partial tilt) was unreliable.

**Solution**: The script was upgraded to **YuNet**, a fast and accurate CNN-based face detector.
- **Confidence Filtering**: Only faces with a score > 0.7 are kept.
- **Fallback Mechanism**: The script still contains Haar Cascades as a backup if YuNet fails to load.

## 2. Advanced Cropping Strategy
A simple bounding box expansion often results in overlapping images (where one student's photo contains part of their neighbor).

**Solution: Midline Splitting**
- Instead of fixed-size padding, the script calculates the **midpoint between the centers of adjacent faces** in the same row.
- This midpoint serves as the hard boundary for both students, ensuring their crop boxes never overlap horizontally.
- **Vertical Row Detection**: The script automatically determines if students are standing in one or two rows based on the vertical distribution of face centers.

## 3. Name Mapping Logic
Matching detected faces to names (from OCR or a roster) is challenging due to varying photo layouts.

**Mapping Strategies**:
1.  **Bottom-of-Image OCR**: The script tries to find a white area at the bottom representing the name label and runs Tesseract OCR.
2.  **Hardcoded Mapping (`GROUP_IMAGE_ORDER_NAMES`)**: For known group layouts (1-12), the script uses a predefined list of names in the exact order they appear in the original photo (Top-Down, Left-to-Right).
3.  **Layout Templates (`GROUP_ROW_LAYOUT`)**: Specifies how many people are in each row (e.g., `4, 2`) to guide the coordinate-to-name matching.

## 4. Special Case Handling
- **Full Image Detection (`GROUP_USE_FULL_IMAGE`)**: For groups where name labels are integrated into the photo area (like Group 3 and 9), the script skips the photo/text area splitting to avoid cutting off faces in the lower row.
- **OCR Correction**: If Tesseract output is noisy, the script uses a `roster_map` with `difflib.SequenceMatcher` to find the closest valid student name from a provided roster.

## 5. System Dependencies
- **Tesseract OCR**: Required for text-based name extraction. The `chi_tra` (Traditional Chinese) language pack must be installed.
- **YuNet Model**: `face_detection_yunet_2023mar.onnx` is automatically downloaded from the OpenCV Zoo on the first run.
