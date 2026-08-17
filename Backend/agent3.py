"""
agent3.py
Route Optimization Agent: proposes alternative routes that respect
mandatory checkpoints, budget and delivery-time constraints.

Runs on the lighter LIGHT_MODEL_NAME (no web search needed) since it's a
pure combination/optimization task over inputs already given to it.
"""
from config import get_structured_response, LIGHT_MODEL_NAME
from prompts.agent3_prompt import agent3_prompt
from models import Agent3Input, Agent3Output


def run_agent3(data: Agent3Input) -> Agent3Output:
    prompt = agent3_prompt(
        data.origin,
        data.destinations,
        data.mandatory_checkpoints,
        data.preferred_transport.value,
        data.budget,
        data.maximum_duration,
    )
    # `validate` lets get_structured_response's repair loop catch schema
    # problems too, not just malformed JSON - e.g. the model putting
    # waypoint names into mandatory_checkpoints instead of 0/1 flags, or
    # dropping a required field on one route. Without this, a reply that
    # parses as JSON but doesn't match Agent3Output would only fail later,
    # uncaught, at the plain `Agent3Output(**parsed)` below.
    def _validate(d: dict) -> None:
        Agent3Output(**d)

    parsed = get_structured_response(prompt, model=LIGHT_MODEL_NAME, validate=_validate, agent_name="agent3")
    return Agent3Output(**parsed)