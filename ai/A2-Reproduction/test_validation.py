import sys
import os
from pathlib import Path
from pprint import pprint

# Add project root to path
sys.path.append(str(Path(__file__).parent))

from modules.validation.graph import create_agent_graph

def test_validation_graph():
    print("Testing Validation Graph...")
    
    # Mock Vulnerability Report
    mock_vuln = {
        "vulnerability": "Hardcoded API Key",
        "description": "Found a hardcoded API key in MainActivity.",
        "file": "MainActivity.java"
    }
    
    # Initial State
    initial_state = {
        "vuln_report": mock_vuln,
        "plan": [],
        "current_step_index": 0,
        "history": [],
        "status": "planning",
        "retry_count": 0,
        "context": {}
    }
    
    app = create_agent_graph()
    
    print("Invoking graph...")
    # Run the graph
    # We use stream to see steps
    for output in app.stream(initial_state):
        for key, value in output.items():
            print(f"--- Node: {key} ---")
            pprint(value)
            print("\n")

if __name__ == "__main__":
    test_validation_graph()
