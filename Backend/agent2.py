"""
agent2.py
Future Scenario Simulator: predicts likely future disruptions
(wars, closures, bans, disasters) and their cost/delay impact.

Each scenario's cost_impact comes back from the LLM as a fraction (e.g.
0.12 for "12%"), which means nothing to a reader on its own. As with Agent
5's estimated_savings, that percentage is turned into a real dollar figure
here in Python (money.py) against the shipment's own stated budget, rather
than trusting the LLM to do that arithmetic itself.

MEMORY WIRING (this revision): same mechanism as agent1.py -
data.prior_context (from CockroachDB's vector-indexed `memories` table,
recalled by orchestrator.py before this agent runs) is appended to the
prompt so the model can reference what supply-chain risks were flagged
last time for this route, rather than re-deriving everything from scratch.
"""
from config import get_structured_response, SEARCH_MODEL_NAME
from prompts.agent2_prompt import agent2_prompt
from models import Agent2Input, Agent2Output
from money import compute_scenario_cost_amount


def run_agent2(data: Agent2Input) -> Agent2Output:
    prompt = agent2_prompt(
        data.origin,
        data.destinations,
        data.preferred_transport.value,
        budget=data.budget,
        sector=data.sector.value if data.sector else "",
        intent=data.intent.value if data.intent else "",
        commodity_name=data.commodity_name,
        quantity=data.quantity,
        expected_price=data.expected_price,
    )

    if data.prior_context:
        prompt += (
            "\n\nPRIOR MEMORY (from earlier supply-chain assessments of this same route, "
            "stored in CockroachDB and retrieved via vector similarity search):\n"
            f"{data.prior_context}\n\n"
            "Check whether these previously-identified risks are still active via fresh "
            "search, and call out explicitly if something has improved, worsened, or "
            "resolved since then."
        )

    def _validate(d: dict) -> None:
        Agent2Output(**d)

    parsed = get_structured_response(
        prompt, model=SEARCH_MODEL_NAME, validate=_validate, agent_name="agent2"
    )
    output = Agent2Output(**parsed)

    for scenario in output.scenarios:
        amount, note = compute_scenario_cost_amount(
            fraction_value=scenario.cost_impact.value,
            impact_type=scenario.cost_impact.type,
            budget=data.budget,
            estimated_delays=scenario.estimated_delays,
        )
        if amount:
            scenario.estimated_cost_impact_amount = amount
        if note:
            scenario.plain_language_note = note

    return output
