# -*- coding: utf-8 -*-
"""
輔助檢查腳本 (convert-check.py)

功能：
這是一個唯讀的輔助工具，用於快速檢查指定檔案中包含哪些簡體字及其對應的繁體字。
這個腳本不會修改任何檔案，只會將檢查結果輸出到終端機。

使用方式：
執行 `python convert-check.py <檔案路徑>`
"""
from opencc import OpenCC
import sys

if len(sys.argv) < 2:
    print("用法: python convert-check.py <檔案路徑>")
    sys.exit(1)

file_path = sys.argv[1]
cc_s2t = OpenCC('s2t')

# 讀取檔案內容
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 找出所有簡體字
simplified_chars = set()
for char in content:
    # 如果一個字元和它轉換後的結果不同，就認定為簡體字
    if char != cc_s2t.convert(char):
        simplified_chars.add(char)

# 建立簡繁對照字典
conversion_map = {char: cc_s2t.convert(char) for char in sorted(list(simplified_chars))}

print(f"在檔案 '{file_path}' 中找到以下可轉換的簡體字：")
# 將結果逐行印出
for simplified, traditional in conversion_map.items():
    print(f"{simplified} -> {traditional}")
