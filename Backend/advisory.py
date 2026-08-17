"""
advisory.py
Small, deterministic (non-LLM) enrichment applied in the orchestrator once
Agent 1 and Agent 5 have both finished: ties Agent 5's procurement advice to
Agent 1's *actual computed* route risk score in plain Python, instead of
asking the LLM to guess at a number that already exists elsewhere in the
pipeline (same "don't trust LLM arithmetic" principle as money.py).

Agent 5 runs in parallel with Agent 1 (it doesn't need to wait on it - see
orchestrator.py), so this only runs afterward, as a cheap post-processing
step, and never blocks Agent 5's own turnaround time.
"""
from models import Agent1Output, Agent5Output

HIGH_RISK_THRESHOLD = 0.5
MODERATE_RISK_THRESHOLD = 0.3


def apply_route_risk_context(agent5_out: Agent5Output, agent1_out: Agent1Output) -> Agent5Output:
    """Prepend a risk-contingent recommendation to Agent 5's
    risk_adjusted_note, grounded in Agent 1's real risk_score rather than a
    model-guessed number. Keeps whatever the LLM already wrote (if
    anything) appended after it."""
    score = agent1_out.consolidated.risk_score
    top_markets = ", ".join(m.name for m in agent5_out.markets[:2]) or "the alternative markets listed above"

    if score >= HIGH_RISK_THRESHOLD:
        note = (
            f"Route risk is currently elevated (risk score {score:.2f} out of 1.00). If conditions on "
            f"this route worsen or shipments get delayed, it's worth actively shifting volume toward "
            f"{top_markets} now, rather than waiting for this corridor to clear."
        )
    elif score >= MODERATE_RISK_THRESHOLD:
        note = (
            f"Route risk is moderate right now (risk score {score:.2f} out of 1.00) - proceeding as "
            f"planned is reasonable, but keep {top_markets} in mind as a fallback if this corridor "
            f"deteriorates."
        )
    else:
        note = (
            f"Route risk is currently low (risk score {score:.2f} out of 1.00), so there's no immediate "
            f"need to shift away from the planned route on risk grounds alone."
        )

    existing = (agent5_out.risk_adjusted_note or "").strip()
    agent5_out.risk_adjusted_note = f"{note} {existing}".strip() if existing else note
    return agent5_out
