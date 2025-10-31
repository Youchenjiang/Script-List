# -*- coding: utf-8 -*-
"""
主轉換腳本 (convert-main.py)

功能：
這是一個用於簡繁轉換的選擇性轉換工具，分為兩個主要步驟。

使用方式：

步驟 1: 產生設定檔
1. 執行 `python convert-main.py <檔案路徑>`。
2. 腳本會掃描指定的檔案，找出所有可轉換的簡體字，並生成一個 `conversion_config.json` 檔案。

步驟 2: 執行轉換
1. 手動開啟 `conversion_config.json`，檢視所有「簡體: 繁體」的對應關係。
2. **刪除**您不希望被轉換的字元所在的行。
3. 執行 `python convert-main.py <檔案路徑> --convert`。
4. 腳本會根據您編輯後的 `conversion_config.json` 設定，對原始檔案進行替換。
"""
import sys
import json
from opencc import OpenCC

def find_simplified_chars(file_path):
    """掃描檔案並找出所有簡體字及其對應的繁體字。"""
    cc_s2t = OpenCC('s2t')
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    simplified_chars = set()
    for char in content:
        if char != cc_s2t.convert(char):
            simplified_chars.add(char)

    # 返回一個排序過的字典，格式為 {'簡體': '繁體'}
    return {char: cc_s2t.convert(char) for char in sorted(list(simplified_chars))}

def create_config_file(file_path, conversion_map):
    """根據找到的簡繁對應表，生成 conversion_config.json 檔案。"""
    with open('conversion_config.json', 'w', encoding='utf-8') as f:
        json.dump(conversion_map, f, ensure_ascii=False, indent=4)

def convert_file(file_path):
    """根據 conversion_config.json 的內容，對指定檔案執行簡繁替換。"""
    with open('conversion_config.json', 'r', encoding='utf-8') as f:
        conversion_map = json.load(f)

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 遍歷設定檔中的每一個鍵值對，並在檔案內容中進行替換
    for simplified, traditional in conversion_map.items():
        content = content.replace(simplified, traditional)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == "__main__":
    # 主執行區塊
    if len(sys.argv) < 2:
        print("用法: python convert-main.py <檔案路徑> [--convert]")
        sys.exit(1)

    file_path = sys.argv[1]

    # 檢查是否包含 --convert 參數
    if "--convert" in sys.argv:
        # 如果有，則執行轉換
        print("正在根據 conversion_config.json 進行檔案轉換...")
        convert_file(file_path)
        print("轉換完成。")
    else:
        # 如果沒有，則生成設定檔
        print("正在掃描簡體字並生成 conversion_config.json...")
        conversion_map = find_simplified_chars(file_path)
        create_config_file(file_path, conversion_map)
        print("設定檔已生成。請在編輯 'conversion_config.json' 後，使用 --convert 參數重新執行腳本以套用變更。")
