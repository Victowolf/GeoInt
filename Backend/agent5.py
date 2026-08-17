"""
agent5.py
Procurement Advisor: suggests better markets/suppliers for the requested
commodity, with intent-aware buy/sell guidance (see recommended_action /
demand_assessment on Agent5Output, driven by prompts/agent5_prompt.py).

estimated_savings is recomputed here in Python (money.py) rather than
trusted as-is from the LLM - see money.py's module docstring for the bug
this closed.

risk_adjusted_note is intentionally left for the orchestrator to enrich
(advisory.py) once Agent 1's real risk_score is available.

MEMORY WIRING (this revision): same mechanism as agent1.py/agent2.py -
data.prior_context (from CockroachDB's vector-indexed `memories` table)
is appended to the prompt so procurement advice can reference and update
on previously-identified markets/suppliers instead of starting cold.
"""
from config import get_structured_response, SEARCH_MODEL_NAME
from prompts.agent5_prompt import agent5_prompt
from models import Agent5Input, Agent5Output
from money import compute_estimated_savings


def run_agent5(data: Agent5Input) -> Agent5Output:
    prompt = agent5_prompt(
        data.sector.value,
        data.intent.value,
        data.commodity_name,
        data.quantity,
        data.expected_price,
        data.origin,
        data.destinations,
        data.budget,
        data.maximum_duration,
        data.preferred_transport.value,
    )

    if data.prior_context:
        prompt += (
            "\n\nPRIOR MEMORY (from earlier procurement assessments of this same route, "
            "stored in CockroachDB and retrieved via vector similarity search):\n"
            f"{data.prior_context}\n\n"
            "Re-verify these markets/suppliers are still current via fresh search rather "
            "than assuming they still hold, and note if pricing or demand has shifted."
        )

    parsed = get_structured_response(prompt, model=SEARCH_MODEL_NAME, agent_name="agent5")
    output = Agent5Output(**parsed)

    computed_savings, basis = compute_estimated_savings(
        cost_diff=output.cost_diff,
        quantity=data.quantity,
        expected_price=data.expected_price,
        budget=data.budget,
    )
    if computed_savings is not None:
        output.estimated_savings = computed_savings
    output.savings_basis = basis

    return output
