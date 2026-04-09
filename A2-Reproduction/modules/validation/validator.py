from .state import AgentState
from typing import Dict
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from config import SILICONFLOW_API_KEY, SILICONFLOW_BASE_URL, SILICONFLOW_MODEL

class TaskValidator:
    def __init__(self):
        self.llm = ChatOpenAI(
            model=SILICONFLOW_MODEL,
            api_key=SILICONFLOW_API_KEY,
            base_url=SILICONFLOW_BASE_URL,
            temperature=0.1
        )

    def validate(self, state: AgentState) -> Dict:
        """
        Dynamically generates and executes a Python Oracle to verify the last action.
        """
        print("--- Validator Node ---")
        last_action = state['history'][-1]
        
        # 1. Ask LLM to generate a Python assertion script
        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are an Android Verification Oracle. 
            Your job is to write a short PYTHON script to verify if an action succeeded.
            
            Available Read-Only Tools (Mocked for now):
            - check_file_exists(path) -> bool
            - read_file_content(path) -> str
            - get_current_activity() -> str
            - grep_logcat(pattern) -> bool
            
            Input:
            - Action: The action that was just executed.
            
            Output:
            - Python code that uses `assert` statements.
            - If the assertion passes, the action succeeded.
            - If it fails (AssertionError), the action failed.
            
            Example:
            Action: create_file('/sdcard/test.txt')
            Code: 
            ```python
            assert check_file_exists('/sdcard/test.txt'), "File was not created"
            ```
            
            IMPORTANT:
            - Return ONLY the python code block.
            - Do not include explanatory text outside the block.
            """),
            ("user", f"Action: {last_action}")
        ])
        
        try:
            chain = prompt | self.llm
            result = chain.invoke({})
            
            # Extract code from markdown
            code = result.content
            if "```python" in code:
                code = code.split("```python")[1].split("```")[0].strip()
            elif "```" in code:
                code = code.split("```")[1].split("```")[0].strip()
            
            print(f"Generated Oracle Code:\n{code}")
            
            # 2. Execute the Oracle (Sandboxed/Mocked)
            self._execute_oracle(code)
            
            print("Oracle Verification passed.")
            return {
                "status": "executing", 
                "current_step_index": state['current_step_index'] + 1,
                "history": state['history'] + [f"Verification PASSED: {last_action}"]
            }
            
        except AssertionError as e:
            print(f"Oracle Verification FAILED: {e}")
            return {
                "status": "planning", 
                "retry_count": state['retry_count'] + 1,
                "history": state['history'] + [f"Verification FAILED: {e}"]
            }
        except Exception as e:
            print(f"Validator Error: {e}")
            # In prototype, we might want to fail safe or retry
            return {
                "status": "planning",
                "retry_count": state['retry_count'] + 1,
                "history": state['history'] + [f"Validator Error: {e}"]
            }

    def _execute_oracle(self, code: str):
        """
        Executes the generated validation code with mocked tools.
        """
        # specialized mock tools for the oracle
        def check_file_exists(path):
            # Mock: Always return True for now to simulate success, 
            # or logic based on path for testing
            if "fail" in path: return False
            return True
            
        def read_file_content(path):
            return "mock content"
            
        def get_current_activity():
            return "com.example.MainActivity"
            
        def grep_logcat(pattern):
            # Mock: simulate log finding
            return True

        # Safe execution dictionary
        local_scope = {
            "check_file_exists": check_file_exists,
            "read_file_content": read_file_content,
            "get_current_activity": get_current_activity,
            "grep_logcat": grep_logcat
        }
        
        exec(code, {}, local_scope)
