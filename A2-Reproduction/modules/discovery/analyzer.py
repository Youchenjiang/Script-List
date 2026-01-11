import logging
from typing import List, Dict, Any
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from config import SILICONFLOW_API_KEY, SILICONFLOW_BASE_URL, SILICONFLOW_MODEL

logger = logging.getLogger(__name__)

class VulnerabilityAnalyzer:
    def __init__(self):
        if not SILICONFLOW_API_KEY:
            logger.error("SILICONFLOW_API_KEY not set.")
            raise ValueError("SILICONFLOW_API_KEY not set")
            
        self.llm = ChatOpenAI(
            model=SILICONFLOW_MODEL,
            api_key=SILICONFLOW_API_KEY,
            base_url=SILICONFLOW_BASE_URL,
            temperature=0.2
        )

    def analyze_vulnerability(self, manifest_content: str, source_code: str, static_finding: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyzes a specific finding to determine if it's a valid vulnerability.
        """
        logger.info(f"Analyzing finding: {static_finding.get('vulnerability')}")

        prompt = ChatPromptTemplate.from_messages([
            ("system", "You are an expert Android Security Researcher. Your goal is to analyze code and determine if a potential vulnerability is exploitable."),
            ("user", """
            Analyze the following potential vulnerability reported by a static analysis tool.
            
            Vulnerability Type: {vuln_type}
            File: {file_path}
            Lines: {lines}
            
            AndroidManifest.xml:
            ```xml
            {manifest}
            ```
            
            Source Code Context:
            ```java
            {source_code}
            ```
            
            Task:
            1. Determine if this is a False Positive or a True Positive.
            2. If True Positive, explain the attack vector.
            3. Provide a 'Speculative Vulnerability' report.
            
            Output JSON format:
            {{
                "is_vulnerability": boolean,
                "confidence": float (0.0-1.0),
                "reasoning": "string",
                "attack_vector": "string or null",
                "name": "standardized vulnerability name"
            }}
            """)
        ])

        chain = prompt | self.llm | JsonOutputParser()

        try:
            result = chain.invoke({
                "vuln_type": static_finding.get('vulnerability'),
                "file_path": static_finding.get('file'),
                "lines": static_finding.get('lines'),
                "manifest": manifest_content[:5000], # Truncate to avoid token limits if necessary
                "source_code": source_code[:10000]
            })
            return result
        except Exception as e:
            logger.error(f"LLM Analysis failed: {e}")
            return {"is_vulnerability": False, "error": str(e)}

    def aggregate_findings(self, mobsf_findings: List[Dict], llm_findings: List[Dict]) -> List[Dict]:
        """
        Deduplicates and merges findings.
        """
        # Simple aggregation for now
        # In a real scenario, we would match them by file/line
        return [f for f in llm_findings if f.get('is_vulnerability')]
