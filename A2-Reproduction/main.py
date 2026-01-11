import argparse
import sys
from pathlib import Path
from pprint import pprint

# Add project root to path
PROJECT_ROOT = Path(__file__).parent
sys.path.append(str(PROJECT_ROOT))

from config import OUTPUT_DIR, JADX_PATH
from modules.discovery.extractor import ResourceExtractor
from modules.discovery.analyzer import VulnerabilityAnalyzer
from modules.validation.graph import create_agent_graph

def run_discovery(apk_path):
    print(f"\n[Phase 1] Discovery Phase: {apk_path}")
    
    # 1. Extraction
    extractor = ResourceExtractor(jadx_path=JADX_PATH)
    app_name = Path(apk_path).stem
    output_path = OUTPUT_DIR / app_name
    
    print(f"Extracting to {output_path}...")
    if not extractor.extract_apk(apk_path, str(output_path)):
        print("Extraction failed.")
        return None

    # 2. Simple File Search (Replacing Mock Static Analysis)
    # In a real scenario, MobSF would give us these paths.
    # Here we search for MainActivity.java
    print("Searching for MainActivity.java...")
    search_path = output_path / "sources"
    
    target_file = None
    for file in search_path.rglob("MainActivity.java"):
        target_file = file
        break
        
    if not target_file:
        print("MainActivity.java not found in sources.")
        return None

    print(f"Found target file: {target_file}")
    
    # Mock finding structure but with REAL file path
    mock_finding = {
        "vulnerability": "Potential Vulnerability Check",
        "file": str(target_file.relative_to(output_path)),
        "lines": [1] # Generic line for whole-file analysis
    }
    
    # 3. LLM Analysis
    print("Running LLM Vulnerability Analysis on REAL code...")
    try:
        analyzer = VulnerabilityAnalyzer()
        
        # Read Manifest
        manifest_path = output_path / "resources/AndroidManifest.xml"
        manifest_content = ""
        if manifest_path.exists():
            manifest_content = manifest_path.read_text(errors='ignore')
            
        # Read REAL Source Code
        source_code = target_file.read_text(encoding='utf-8', errors='ignore') 
        
        result = analyzer.analyze_vulnerability(manifest_content, source_code, mock_finding)
        print("Discovery Result:", result)
        
        if result.get('is_vulnerability'):
            return result
        else:
            print("No vulnerability confirmed by LLM.")
            return None
            
    except Exception as e:
        print(f"Discovery failed: {e}")
        return None

def run_validation(finding):
    print(f"\n[Phase 2] Validation Phase")
    print(f"Targeting: {finding.get('name', 'Unknown Vulnerability')}")
    
    initial_state = {
        "vuln_report": finding,
        "plan": [],
        "current_step_index": 0,
        "history": [],
        "status": "planning",
        "retry_count": 0,
        "context": {}
    }
    
    app = create_agent_graph()
    
    print("Starting Agentic Workflow...")
    # Stream events
    final_status = "unknown"
    for output in app.stream(initial_state):
        for key, value in output.items():
            print(f"\n--- Node: {key} ---")
            if 'plan' in value:
                print("Generated Plan:", value['plan'])
            if 'history' in value and value['history']:
                print("Last Log:", value['history'][-1])
            
            # Update final status check
            if 'status' in value:
                final_status = value['status']

    print(f"\nValidation Completed. Status: {final_status}")

def main():
    parser = argparse.ArgumentParser(description="A2: Agentic Android Analysis Reproduction")
    parser.add_argument("--apk", help="Path to the target APK file", required=True)
    parser.add_argument("--mode", choices=["discovery", "full"], default="discovery", help="Analysis mode")
    
    args = parser.parse_args()
    
    finding = run_discovery(args.apk)
    
    if finding and args.mode == "full":
        run_validation(finding)
    elif args.mode == "full" and not finding:
        print("Skipping validation as no vulnerability was found.")

if __name__ == "__main__":
    main()
