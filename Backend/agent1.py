"""
agent1.py
Geopolitical Intelligence Agent: checks the current risk status
(safe / tension / unsafe) for every destination on the route, in plain
language and grounded in authoritative sources (see prompts/agent1_prompt.py
for the sourcing rules given to the model).

MEMORY WIRING (this revision): if data.prior_context is non-empty (set by
orchestrator.py from memory.recall_context() against CockroachDB's
vector-indexed `memories` table), it's appended to the prompt as explicit
prior findings for this same route. This is what makes CockroachDB's
vector index do real work in the agent's reasoning, not just accumulate
write-only history - the model is told what it concluded last time and
asked to verify whether that's still current, rather than researching a
route from zero every single call.
"""
from config import get_structured_response, SEARCH_MODEL_NAME
from prompts.agent1_prompt import agent1_prompt
from models import Agent1Input, Agent1Output, Coordinates
from geocode import attach_coordinates


def run_agent1(data: Agent1Input) -> Agent1Output:
    prompt = agent1_prompt(
        data.origin, data.destinations, data.preferred_transport.value, data.sector.value
    )

    if data.prior_context:
        prompt += (
            "\n\nPRIOR MEMORY (from earlier assessments of this same route, stored in "
            "CockroachDB and retrieved via vector similarity search):\n"
            f"{data.prior_context}\n\n"
            "Treat this as useful prior context, not ground truth - conditions may have "
            "changed since then. Use fresh web search to confirm or update it, and note "
            "explicitly in your summary if the current situation differs from what was "
            "found previously."
        )

    parsed = get_structured_response(prompt, model=SEARCH_MODEL_NAME, agent_name="agent1")
    output = Agent1Output(**parsed)

    # The LLM is never asked for coordinates (it can't be trusted to produce
    # accurate lat/lon) — resolve them separately so the frontend's map
    # feature has something real to plot.
    for stop in output.destinations:
        stop.source.coordinates = Coordinates(**attach_coordinates(stop.destination))

    return output
