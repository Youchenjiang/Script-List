from typing import Dict
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from langchain_openai import ChatOpenAI
from config import SILICONFLOW_API_KEY, SILICONFLOW_BASE_URL, SILICONFLOW_MODEL
from .state import AgentState

class PoCPlanner:
    def __init__(self):
        self.llm = ChatOpenAI(
            model=SILICONFLOW_MODEL,
            api_key=SILICONFLOW_API_KEY,
            base_url=SILICONFLOW_BASE_URL,
            temperature=0.4
        )

    def plan(self, state: AgentState) -> Dict:
        """
        Generates a step-by-step plan to verify the vulnerability.
        """
        print("--- Planner Node ---")
        vuln = state['vuln_report']
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are an expert Android Penetration Tester.
            Your goal is to create a safe, step-by-step plan to verify a specific vulnerability.
            
            Available Tools:
            - adb_shell(command): Run shell commands
            - launch_app(package, activity): Start the app
            - input_text(text): Type text
            - click(x, y): Tap screen
            - take_screenshot(): Capture screen
            - read_logcat(): Check logs
            
            Constraints:
            - Do NOT use destructive commands (rm -rf).
            - Keep the plan concise (max 5-7 steps).
            - Focus on VERIFICATION (proving it exists), not exploitation (doing damage).
            """),
            ("user", """
            Vulnerability: {name}
            Description: {description}
            Target File: {file}
            
            Generate a plan as a JSON list of strings.
            Example: ["launch_app('com.example', '.MainActivity')", "input_text('test')", "click(100, 200)"]
            
            IMPORTANT:
            1. Return ONLY the JSON array.
            2. Do NOT include comments.
            3. QUOTING RULES:
               - The outer list must use double quotes: ["cmd1", "cmd2"]
               - Inside the string, use single quotes for python arguments: "tool('arg')"
               - If you need quotes INSIDE the tool argument, ONLY use escaped double quotes: "tool('grep \"pattern\"')" or better yet, avoid them.
            """)
        ])
        
        chain = prompt | self.llm | JsonOutputParser()
        
        try:
            plan = chain.invoke({
                "name": vuln.get('vulnerability', 'Unknown'),
                "description": vuln.get('description', 'No description'),
                "file": vuln.get('file', 'Unknown')
            })
            
            return {
                "plan": plan,
                "current_step_index": 0,
                "status": "executing",
                "history": ["Plan generated."]
            }
        except Exception as e:
            return {
                "status": "failed",
                "history": [f"Planning failed: {str(e)}"]
            }
