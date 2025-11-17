# -*- coding: utf-8 -*-
"""OpenAI Chat CLI - 快速互動腳本"""

import os
from openai import OpenAI

API_KEY = os.getenv("OPENAI_API_KEY")
if not API_KEY:
    API_KEY = input("請輸入 OpenAI API 金鑰: ").strip()
    if not API_KEY:
        print("未提供 API 金鑰，程式結束。")
        exit(1)

BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.chatanywhere.tech/v1")
MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

SYSTEM_PROMPT = (
    "你是 Execute Copilot，使用繁體中文回覆。"
    "流程：重述目標 → 列 1-3 個行動 → 提醒風險。"
)

client = OpenAI(api_key=API_KEY, base_url=BASE_URL)

print("=" * 48)
print("OpenAI Chat CLI")
print("輸入 exit/quit 可離開\n")

while True:
    try:
        question = input("你: ").strip()
    except KeyboardInterrupt:
        print("\n\n已中斷，再見!")
        break

    if not question:
        continue
    if question.lower() in {"exit", "quit", "離開", "退出"}:
        print("再見!")
        break

    try:
        completion = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": question + " 以繁體中文回答"},
            ],
        )
        reply = completion.choices[0].message.content.strip()
    except Exception as exc:
        print(f"\n錯誤：{exc}\n")
        continue

    print(f"\nAI: {reply}\n")
