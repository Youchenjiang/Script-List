from langgraph.graph import StateGraph, END
from .state import AgentState
from .planner import PoCPlanner
from .executor import TaskExecutor
from .validator import TaskValidator

def create_agent_graph():
    # Initialize Nodes
    planner = PoCPlanner()
    executor = TaskExecutor()
    validator = TaskValidator()

    # Build Graph
    workflow = StateGraph(AgentState)

    # Add Nodes
    workflow.add_node("planner", planner.plan)
    workflow.add_node("executor", executor.execute)
    workflow.add_node("validator", validator.validate)

    # Set Entry Point
    workflow.set_entry_point("planner")

    # Define Edges
    
    # From Planner -> Executor (if planning succeeded) or END (if failed)
    def after_plan(state):
        if state['status'] == 'executing':
            return "executor"
        return END
    
    workflow.add_conditional_edges("planner", after_plan)

    # From Executor -> Validator (always validate after execution)
    # Or END if done
    def after_execute(state):
        if state['status'] == 'done':
            return END
        return "validator"

    workflow.add_conditional_edges("executor", after_execute)

    # From Validator -> Executor (next step) or Planner (retry)
    def after_validate(state):
        if state['status'] == 'planning':
            return "planner"
        elif state['status'] == 'executing':
            return "executor"
        return END

    workflow.add_conditional_edges("validator", after_validate)

    return workflow.compile()
