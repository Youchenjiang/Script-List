import os
import re
import json
import urllib.request
import sys
from collections import Counter
import pypdf

# Reconfigure stdout to use UTF-8 to prevent UnicodeEncodeError on non-UTF-8 terminals (e.g. CP950 on Windows)
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass

# Directory configuration
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DOWNLOADS_DIR = os.path.join(SCRIPT_DIR, "downloads")
CACHE_FILE = os.path.join(SCRIPT_DIR, "classified_metadata.json")
INDEX_FILE = os.path.join(SCRIPT_DIR, "slides_index.md")

API_URL = "https://ccmsapi.ithome.com.tw"

# Ensure downloads directory exists
os.makedirs(DOWNLOADS_DIR, exist_ok=True)

# Categories and their directory names
CATEGORIES = {
    "01_AI_LLM": "AI & Large Language Models",
    "02_Zero_Trust_Identity": "Zero Trust & Identity Security",
    "03_OT_IoT_Hardware": "OT, IoT & Hardware Security",
    "04_CRA_Compliance": "CRA, Compliance & GRC Regulations",
    "05_Red_Blue_Attacks": "Red/Blue Team Attack & Penetration",
    "06_Cloud_Network": "Cloud & Network Security SASE",
    "07_Others": "General Presentations & Opening Remarks"
}

CATEGORY_KEYWORDS = {
    "01_AI_LLM": ["ai", "llm", "gpt", "claude", "openai", "chatgpt", "copilot", "genai", "agent", "rag", "ml", "deep learning", "machine learning", "人工智慧", "智慧", "語言模型", "機器學習", "生成式", "模型"],
    "02_Zero_Trust_Identity": ["zero trust", "ztna", "identity", "iam", "pam", "oauth", "saml", "sso", "active directory", "ldap", "mfa", "ad", "ntlm", "零信任", "身分", "憑證", "識別", "驗證", "授權"],
    "03_OT_IoT_Hardware": ["ot", "ics", "iot", "iiot", "scada", "plc", "modbus", "dnp3", "opc", "firmware", "hardware", "chip", "車聯網", "v2x", "晶片", "製造業", "半導體", "工控", "物聯網", "硬體", "旁通道", "錯誤注入", "汽車"],
    "04_CRA_Compliance": ["cra", "cyber resilience act", "合規", "法規", "網路安全法", "標準", "iso", "nist", "grc", "sla", "稽核", "fda", "規範", "防禦成熟度", "compliance", "regulation"],
    "05_Red_Blue_Attacks": ["red team", "blue team", "紅隊", "藍隊", "攻防", "威脅", "釣魚", "phishing", "mdr", "獵捕", "threat", "木馬", "cve", "漏洞", "apt", "沙盒", "sandbox", "越獄", "jailbreak", "kql", "soc", "駭客", "入侵", "attack", "malware", "ransomware", "exploit", "vulnerability", "攻擊", "惡意程式", "勒索軟體", "滲透", "鑑識"],
    "06_Cloud_Network": ["cloud", "sase", "vpn", "sd-wan", "雲端", "邊緣", "dlp", "web", "dns", "waf", "ssl", "tls", "網路", "防火牆", "firewall", "ddos"]
}

def is_english_word(word):
    return re.match(r'^[a-zA-Z0-9\s_-]+$', word) is not None

STOP_WORDS = set([
    'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'cannot', 'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'me', 'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she', 'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would', 'you', 'your', 'yours', 'yourself', 'yourselves',
    '的', '了', '和', '是', '就', '都', '而', '及', '與', '或', '在', '著', '於', '之', '由', '被', '讓', '給', '往', '朝', '向', '本', '照', '按', '依', '因', '為', '由於', '所以', '因此', '進而', '從而', '雖然', '儘管', '但是', '可是', '然而', '卻', '不過', '只要', '只有', '除非', '否則', '如果', '假如', '要是', '即使', '就算', '哪怕', '並且', '而且', '還', '甚至', '更', '以及', '其', '他', '她', '它', '他們', '她們', '它們', '我們', '你們', '這', '那', '這裡', '那裡', '這個', '那個', '這些', '那些', '這樣', '那樣', '如此', '怎麼', '甚麼', '什麼', '為什麼', '誰', '哪', '哪裡', '哪個', '哪些', '幾', '多', '少', '多少', '一些', '一個', '一次', '一點', '我們', '可以', '目前', '透過', '使用', '包括', '主要', '進行', '對於', '關於', '為了'
])

GRAPHQL_QUERY = """
query gets($language: AvailableLang) {
    getProject: cybersec2026(lang: $language) {
        sessions {
            id
            title
            started_at
            finished_at
            track
            relatedSpeakers {
                speaker {
                    public_name
                    companies {
                        name
                    }
                }
            }
        }
    }
}
"""

def fetch_api_metadata():
    print("Fetching metadata from CYBERSEC 2026 GraphQL API...")
    req_data = json.dumps({
        "query": GRAPHQL_QUERY,
        "variables": {"language": "tw"}
    }).encode('utf-8')
    
    req = urllib.request.Request(
        API_URL,
        data=req_data,
        headers={
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0"
        }
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            res_data = response.read().decode('utf-8')
            res_json = json.loads(res_data)
            sessions = res_json.get("data", {}).get("getProject", {}).get("sessions", [])
            print(f"Successfully loaded {len(sessions)} sessions from API.")
            return {s["id"]: s for s in sessions}
    except Exception as e:
        print(f"Warning: Failed to fetch API metadata: {e}")
        return {}

def clean_text_to_words(text):
    english_words = re.findall(r'[a-zA-Z]{2,}', text)
    chinese_chars = re.findall(r'[\u4e00-\u9fff]', text)
    cleaned_english = [w.lower() for w in english_words if w.lower() not in STOP_WORDS]
    cleaned_chinese = [c for c in chinese_chars if c not in STOP_WORDS]
    
    chinese_words = []
    blocks = re.findall(r'[\u4e00-\u9fff]+', text)
    for block in blocks:
        for i in range(len(block) - 1):
            w = block[i:i+2]
            if w not in STOP_WORDS and not any(c in STOP_WORDS for c in w):
                chinese_words.append(w)
        for i in range(len(block) - 2):
            w = block[i:i+3]
            if w not in STOP_WORDS and not any(c in STOP_WORDS for c in w):
                chinese_words.append(w)
                
    return cleaned_english + chinese_words

def classify_pdf(pdf_path, session_title="", session_track=""):
    try:
        reader = pypdf.PdfReader(pdf_path)
        full_text = ""
        for i in range(min(len(reader.pages), 15)):
            text = reader.pages[i].extract_text()
            if text:
                full_text += text + "\n"
        
        # Calculate category scores
        cat_scores = {cat: 0 for cat in CATEGORY_KEYWORDS}
        lower_text = full_text.lower()
        lower_title = session_title.lower()
        lower_track = session_track.lower()
        
        for cat, keywords in CATEGORY_KEYWORDS.items():
            for kw in keywords:
                kw_lower = kw.lower()
                if is_english_word(kw_lower):
                    pattern = rf"\b{re.escape(kw_lower)}\b"
                else:
                    pattern = re.escape(kw_lower)
                
                # Direct content score
                content_matches = len(re.findall(pattern, lower_text))
                cat_scores[cat] += content_matches
                
                # Title score (weight = 5)
                title_matches = len(re.findall(pattern, lower_title))
                cat_scores[cat] += title_matches * 5
                
                # Track score (weight = 8)
                track_matches = len(re.findall(pattern, lower_track))
                cat_scores[cat] += track_matches * 8
                
        # Find best category
        best_cat = "07_Others"
        max_score = 2 # Threshold score to be classified in a specific folder
        for cat, score in cat_scores.items():
            if score > max_score:
                max_score = score
                best_cat = cat
                
        # Generate top keywords
        words = clean_text_to_words(full_text)
        word_counts = Counter(words)
        top_keywords = [w for w, count in word_counts.most_common(12) if len(w) > 1]
        
        # Filter duplicates or short overlaps
        unique_keywords = []
        for kw in top_keywords:
            if kw not in unique_keywords and not any(existing in kw for existing in unique_keywords):
                unique_keywords.append(kw)
        
        # Outline extraction (slide titles)
        all_pages_lines = []
        line_counts = Counter()
        num_pages = min(len(reader.pages), 12)
        for i in range(num_pages):
            text = reader.pages[i].extract_text()
            if text:
                lines = [line.strip() for line in text.split('\n') if line.strip()]
                all_pages_lines.append(lines)
                for line in set(lines):
                    line_counts[line] += 1
            else:
                all_pages_lines.append([])
                
        running_headers = {line for line, count in line_counts.items() if count > 2}
        
        outline = []
        for i, page_lines in enumerate(all_pages_lines):
            if i == 0:
                continue # Skip cover
            for line in page_lines:
                if line in running_headers:
                    continue
                if line.isdigit() or len(line) < 4:
                    continue
                lower_line = line.lower()
                if 'disclaimer' in lower_line or '免責' in lower_line:
                    continue
                if 'agenda' in lower_line or 'outline' in lower_line or '目錄' in lower_line or '大綱' in lower_line:
                    continue
                outline.append(line)
                break
                
        return best_cat, unique_keywords[:6], outline[:5]
    except Exception as e:
        print(f"Error classifying {pdf_path}: {e}")
        return "07_Others", [], []

def main():
    print("Initializing PDF classifier and sorter...")
    
    # 1. Fetch live API metadata
    api_sessions = fetch_api_metadata()
    
    # 2. Load existing cache
    cache = {}
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                cache = json.load(f)
            print(f"Loaded {len(cache)} cached items from {CACHE_FILE}.")
        except Exception as e:
            print(f"Warning: Failed to load cache: {e}")
            
    # 3. Create category folders
    for folder in CATEGORIES:
        os.makedirs(os.path.join(DOWNLOADS_DIR, folder), exist_ok=True)
        
    # 4. Scan root downloads directory for sorting
    files_to_sort = [f for f in os.listdir(DOWNLOADS_DIR) if f.endswith('.pdf')]
    print(f"Found {len(files_to_sort)} PDF files in root downloads folder.")
    
    # Move and classify files in root downloads
    for f in files_to_sort:
        pdf_path = os.path.join(DOWNLOADS_DIR, f)
        
        # Extract session ID from prefix [ID]
        match = re.match(r'^\[(\d+)\]', f)
        session_id = match.group(1) if match else None
        
        session = api_sessions.get(session_id, {})
        title = session.get("title", f)
        track = session.get("track", "")
        
        print(f"Classifying: {f}...")
        category, keywords, outline = classify_pdf(pdf_path, title, track)
        print(f"  Category: {category}")
        
        # Move file to the correct category subfolder
        dest_path = os.path.join(DOWNLOADS_DIR, category, f)
        try:
            os.rename(pdf_path, dest_path)
            print(f"  Moved to {category}/")
        except Exception as e:
            print(f"  Failed to move: {e}")
            dest_path = pdf_path
            
        # Format speakers
        speakers = []
        for rs in session.get("relatedSpeakers", []):
            name = rs.get("speaker", {}).get("public_name", "")
            company = "/".join([c.get("name") or "" for c in rs.get("speaker", {}).get("companies", []) if c])
            speakers.append(f"{name} ({company})" if company else name)
        speakers_str = ", ".join(speakers) if speakers else "大會提供"
        
        # Store in cache
        cache[f] = {
            "id": session_id,
            "title": title,
            "track": track,
            "speakers": speakers_str,
            "category": category,
            "filename": f,
            "keywords": keywords,
            "outline": outline
        }
        
    # 5. Scan all subdirectories to ensure index is compiled from all sorted files
    all_sorted_metadata = []
    
    for folder in CATEGORIES:
        folder_path = os.path.join(DOWNLOADS_DIR, folder)
        if not os.path.exists(folder_path):
            continue
            
        sorted_files = [f for f in os.listdir(folder_path) if f.endswith('.pdf')]
        for sf in sorted_files:
            sf_path = os.path.join(folder_path, sf)
            
            # If in cache and folder is correct, use cached data
            if sf in cache and cache[sf]["category"] == folder:
                all_sorted_metadata.append(cache[sf])
            else:
                # Re-parse if not in cache (e.g. file was sorted manually or cache cleared)
                match = re.match(r'^\[(\d+)\]', sf)
                session_id = match.group(1) if match else None
                session = api_sessions.get(session_id, {})
                title = session.get("title", sf)
                track = session.get("track", "")
                
                print(f"Re-indexing: {sf}...")
                category, keywords, outline = classify_pdf(sf_path, title, track)
                
                speakers = []
                for rs in session.get("relatedSpeakers", []):
                    name = rs.get("speaker", {}).get("public_name", "")
                    company = "/".join([c.get("name") or "" for c in rs.get("speaker", {}).get("companies", []) if c])
                    speakers.append(f"{name} ({company})" if company else name)
                speakers_str = ", ".join(speakers) if speakers else "大會提供"
                
                meta = {
                    "id": session_id,
                    "title": title,
                    "track": track,
                    "speakers": speakers_str,
                    "category": folder, # Matches the folder it is currently in
                    "filename": sf,
                    "keywords": keywords,
                    "outline": outline
                }
                cache[sf] = meta
                all_sorted_metadata.append(meta)

    # 6. Save updated cache
    try:
        with open(CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump(cache, f, ensure_ascii=False, indent=2)
        print(f"Saved cache to {CACHE_FILE}.")
    except Exception as e:
        print(f"Warning: Failed to save cache: {e}")

    # 7. Generate slides_index.md
    print("Generating slides_index.md...")
    
    # Sort metadata by category and title
    all_sorted_metadata.sort(key=lambda x: (x["category"], x["title"]))
    
    # Build markdown index content
    md_lines = [
        "# CYBERSEC 2026 簡報檢索目錄 (Slides Index)",
        "",
        "本目錄自動解析大會議程與本地下載的簡報內文，提取大綱與關鍵字，將簡報分類歸檔於各個資料夾下。您可在 VS Code 或瀏覽器中直接點擊檔案連結開啟閱讀。",
        "",
        "## 📁 目錄索引 (Table of Contents)",
        ""
    ]
    
    # List categories
    for folder, desc in CATEGORIES.items():
        count = len([m for m in all_sorted_metadata if m["category"] == folder])
        md_lines.append(f"- [{desc}](#{folder.lower().replace('_', '-')}) ({count} 份簡報)")
    md_lines.append("")
    
    # Detailed category sections
    current_cat = None
    for item in all_sorted_metadata:
        cat = item["category"]
        if cat != current_cat:
            current_cat = cat
            md_lines.append(f"\n---")
            md_lines.append(f"\n## <a id=\"{cat.lower().replace('_', '-')}\"></a>📁 {CATEGORIES[cat]}")
            md_lines.append("")
            
        escaped_filename = urllib.parse.quote(f"downloads/{cat}/{item['filename']}")
        md_lines.append(f"### 📄 [{item['title']}]({escaped_filename})")
        md_lines.append(f"- **講師**: {item['speakers']}")
        if item["track"]:
            md_lines.append(f"- **單元分類**: `{item['track']}`")
        if item["keywords"]:
            kws = ", ".join([f"`{kw}`" for kw in item["keywords"]])
            md_lines.append(f"- **核心關鍵詞**: {kws}")
        if item["outline"]:
            md_lines.append("- **簡報大綱 (投影片標題)**:")
            for idx, o in enumerate(item["outline"]):
                md_lines.append(f"  {idx + 1}. {o}")
        md_lines.append("")
        
    try:
        with open(INDEX_FILE, 'w', encoding='utf-8') as f:
            f.write("\n".join(md_lines))
        print(f"Generated index successfully: {INDEX_FILE}")
    except Exception as e:
        print(f"Error writing index: {e}")

if __name__ == "__main__":
    main()
