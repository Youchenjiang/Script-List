import sys
import os
from pathlib import Path

# Add project root to path
sys.path.append(str(Path(__file__).parent))

from config import OUTPUT_DIR, JADX_PATH
from modules.discovery.extractor import ResourceExtractor
from modules.discovery.analyzer import VulnerabilityAnalyzer
# from modules.discovery.static_tools import StaticAnalyzer # Skip MobSF for now as it requires a running server

def test_discovery(apk_path):
    print(f"Testing Discovery Module with: {apk_path}")
    
    # 1. Extraction
    extractor = ResourceExtractor(jadx_path=JADX_PATH)
    app_name = Path(apk_path).stem
    output_path = OUTPUT_DIR / app_name
    
    print(f"Extracting to {output_path}...")
    if extractor.extract_apk(apk_path, str(output_path)):
        print("Extraction successful.")
    else:
        print("Extraction failed.")
        return

    # 2. Static Analysis (Mocking for now if MobSF isn't up)
    # static = StaticAnalyzer()
    # apk_hash = static.upload_apk(apk_path)
    # ...
    
    # Mocking a static finding for LLM testing
    print("Simulating Static Analysis finding...")
    mock_finding = {
        "vulnerability": "Hardcoded Secret",
        "file": "sources/com/example/app/MainActivity.java", # Adjust based on actual file structure if known, or generic
        "lines": [10, 11, 12]
    }
    
    # 3. LLM Analysis
    print("Testing LLM Analyzer...")
    try:
        analyzer = VulnerabilityAnalyzer()
        
        # Read Manifest
        manifest_path = output_path / "resources/AndroidManifest.xml"
        manifest_content = ""
        if manifest_path.exists():
            manifest_content = manifest_path.read_text(errors='ignore')
        else:
            print("Manifest not found, using empty.")
            
        # Read Source (Mocking read since we don't know exact file yet)
        # In real flow, we read the file pointed to by static analysis
        source_code = "public class MainActivity { String apiKey = '12345'; }" 
        
        result = analyzer.analyze_vulnerability(manifest_content, source_code, mock_finding)
        print("LLM Analysis Result:")
        print(result)
        
    except Exception as e:
        print(f"LLM Analysis failed: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test_discovery.py <apk_path>")
    else:
        test_discovery(sys.argv[1])
