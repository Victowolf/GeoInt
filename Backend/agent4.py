"""
agent4.py
Decision Advisor: combines Agent 1-3 outputs into one final
recommendation (Proceed / Caution / Wait / Use Alternate Route).

Runs on the lighter LIGHT_MODEL_NAME (no web search needed) since it's a
pure combination task over Agent 1-3's already-fetched outputs.
"""
from config import get_structured_response, LIGHT_MODEL_NAME
from prompts.agent4_prompt import agent4_prompt
from models import Agent4Input, Agent4Output


def run_agent4(data: Agent4Input) -> Agent4Output:
    prompt = agent4_prompt(
        data.agent1.risk_score,
        [d.model_dump() for d in data.agent1.destinations],
        data.agent2.supply_chain_analysis,
        data.agent3.least_risk_route.model_dump(),
    )
    parsed = get_structured_response(prompt, model=LIGHT_MODEL_NAME, agent_name="agent4")
    return Agent4Output(**parsed)