#!/usr/bin/env python3
"""
CyLab Security Academy / picoCTF Challenge Processor & Checklist Generator

This script processes exported JSON data from export_challenges.js,
generates detailed statistics, and builds a Markdown checklist for tracking progress.

Usage:
    python process_challenges.py --input cylab_challenges_YYYY-MM-DD.json
    python process_challenges.py --input cylab_challenges_YYYY-MM-DD.json --output checklist.md
    python process_challenges.py --cookie "session=..." (Optional direct online fetch)
"""

import argparse
import json
import os
import sys
from typing import Dict, List, Any
import urllib.request
import urllib.error


def fetch_online_challenges(cookie: str, base_url: str = "https://learn.cylabacademy.org") -> List[Dict[str, Any]]:
    """Fetch challenges directly if session cookie is provided."""
    challenges = []
    page = 1
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'application/json',
        'Cookie': cookie
    }

    print("🌐 Attempting online fetch using provided session cookie...")
    while True:
        url = f"{base_url}/api/challenges/?page={page}&page_size=100"
        req = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(req) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                results = data.get('results', [])
                if not results:
                    break
                challenges.extend(results)
                print(f"  Fetched page {page} ({len(results)} items)...")
                if not data.get('next') and len(results) < 100:
                    break
                page += 1
        except urllib.error.HTTPError as e:
            print(f"❌ HTTP Error {e.code}: {e.reason}")
            break
        except Exception as e:
            print(f"❌ Error fetching online data: {e}")
            break
            
    return challenges


def process_and_generate_markdown(challenges: List[Dict[str, Any]], output_path: str):
    """Analyze challenge list and generate a Markdown checklist."""
    total = len(challenges)
    solved_count = sum(1 for c in challenges if c.get('solved_by_user'))
    solved_ratio = (solved_count / total * 100) if total > 0 else 0.0

    # Group by Category
    by_category: Dict[str, List[Dict[str, Any]]] = {}
    for c in challenges:
        cat_raw = c.get('category')
        cat_name = cat_raw.get('name') if isinstance(cat_raw, dict) else (cat_raw or 'Uncategorized')
        by_category.setdefault(cat_name, []).append(c)

    md_lines = [
        "# CyLab Security Academy Challenge Progress & Checklist",
        "",
        f"- **Total Challenges**: {total}",
        f"- **Solved**: {solved_count} / {total} ({solved_ratio:.1f}%)",
        "",
        "## Category Summary",
        "",
        "| Category | Solved | Total | Completion |",
        "| :--- | :---: | :---: | :---: |"
    ]

    for cat, cat_items in sorted(by_category.items()):
        c_solved = sum(1 for item in cat_items if item.get('solved_by_user'))
        c_total = len(cat_items)
        c_pct = (c_solved / c_total * 100) if c_total > 0 else 0
        md_lines.append(f"| {cat} | {c_solved} | {c_total} | {c_pct:.1f}% |")

    md_lines.extend(["", "---", "", "## Challenge Checklist", ""])

    for cat, cat_items in sorted(by_category.items()):
        md_lines.append(f"### 📂 {cat} ({sum(1 for i in cat_items if i.get('solved_by_user'))}/{len(cat_items)})")
        md_lines.append("")
        
        # Sort items by difficulty / points
        sorted_items = sorted(cat_items, key=lambda x: (x.get('difficulty', 0), x.get('name', '')))
        for item in sorted_items:
            check = "[x]" if item.get('solved_by_user') else "[ ]"
            name = item.get('name', 'Untitled')
            points = item.get('event_points') or item.get('points') or 0
            diff = item.get('difficulty', '-')
            event_raw = item.get('event')
            event_name = event_raw.get('name') if isinstance(event_raw, dict) else (event_raw or '')
            event_str = f" *({event_name})*" if event_name else ""
            
            md_lines.append(f"- {check} **{name}** — {points} pts | Diff: {diff}{event_str}")
        
        md_lines.append("")

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("\n".join(md_lines))

    print(f"✅ Generated Markdown checklist: {output_path}")
    print(f"📊 Summary: {solved_count}/{total} solved ({solved_ratio:.1f}%) across {len(by_category)} categories.")


def main():
    parser = argparse.ArgumentParser(description="Process CyLab Security Academy exported challenges JSON.")
    parser.add_argument("-i", "--input", help="Path to input JSON file exported by export_challenges.js")
    parser.add_argument("-o", "--output", default="challenges_checklist.md", help="Output Markdown checklist path (default: challenges_checklist.md)")
    parser.add_argument("-c", "--cookie", help="Optional Session cookie string to attempt direct online fetching")

    args = parser.parse_args()

    challenges = []
    if args.input and os.path.exists(args.input):
        with open(args.input, 'r', encoding='utf-8') as f:
            challenges = json.load(f)
        print(f"📖 Loaded {len(challenges)} challenges from {args.input}")
    elif args.cookie:
        challenges = fetch_online_challenges(args.cookie)
    else:
        # Check if any json file exists in local directory
        json_files = [f for f in os.listdir('.') if f.startswith('cylab_challenges_') and f.endswith('.json')]
        if json_files:
            latest = sorted(json_files)[-1]
            print(f"🔍 Found exported JSON file: {latest}")
            with open(latest, 'r', encoding='utf-8') as f:
                challenges = json.load(f)
        else:
            print("❌ Error: Please specify an input JSON file using --input <file.json> or provide --cookie.")
            print("   (Run export_challenges.js in your browser console first to generate the JSON file).")
            sys.exit(1)

    if not challenges:
        print("❌ No challenge data available to process.")
        sys.exit(1)

    process_and_generate_markdown(challenges, args.output)


if __name__ == "__main__":
    main()
