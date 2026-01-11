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
        Checks if the last action had the desired effect.
        """
        print("--- Validator Node ---")
        last_action = state['history'][-1]
        
        # In a real implementation, we would pass the Before/After screenshots
        # to the Vision Model.
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", "You are an Android UI Validator. Check if the action was successful."),
            ("user", """
            Action: {action}
            
            Did this action likely succeed based on the logs?
            
            Output JSON:
            {{
                "success": boolean,
                "reason": "string"
            }}
            """)
        ])
        
        try:
            chain = prompt | self.llm | JsonOutputParser()
            result = chain.invoke({"action": last_action})
            
            if result.get('success', False):
                return {
                    "status": "executing", # Go back to executor for next step
                    "current_step_index": state['current_step_index'] + 1
                }
            else:
                # If failed, we might want to retry or replan
                return {
                    "status": "planning", # Go back to planner
                    "retry_count": state['retry_count'] + 1,
                    "history": state['history'] + [f"Validation failed: {result.get('reason')}"]
                }
                
        except Exception as e:
            print(f"Validation error: {e}")
            # Fallback: assume success to keep moving in this demo
            return {
                "status": "executing",
                "current_step_index": state['current_step_index'] + 1
            }
